import type { Sandbox } from "@cloudflare/sandbox";

export const HYDRA_MODELS = [
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-3.1-8b-instruct-fast",
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
  "@cf/qwen/qwen2.5-coder-32b-instruct",
  "@cf/google/gemma-3-12b-it",
];

export interface HydraStep {
  type: "dispatch" | "model" | "tool" | "result" | "synthesis" | "error";
  model?: string;
  content: string;
  ms?: number;
}

const SYS = `You are HYDRA, an autonomous AI agent on Cloudflare edge. Respond ONLY with valid JSON.
Tools:
- {"tool":"shell","args":{"cmd":"command"}} Execute shell command
- {"tool":"write","args":{"path":"file","content":"data"}} Write file
- {"tool":"read","args":{"path":"file"}} Read file
- {"tool":"search","args":{"query":"search query"}} Search the web
- {"tool":"deploy","args":{}} Deploy code changes (MUST explain what/why/risks and get permission first)
- {"tool":"done","args":{"answer":"final answer"}} Task complete
SELF-MOD: Before modifying code or deploying, MUST: 1) Explain WHAT 2) WHY 3) RISKS 4) Ask permission. Proceed only if approved.
One JSON object per response. For multi-step: call tools one at a time.`;

async function runCmd(sandbox: Sandbox, cmd: string): Promise<string> {
  try {
    const result = await sandbox.exec(cmd, { timeoutMs: 30000 });
    const o = (result.stdout || "").trim();
    const e = (result.stderr || "").trim();
    return o + (e ? "\nSTDERR: " + e : "") || "(exit " + result.exitCode + ")";
  } catch (e: any) {
    return "ERROR: " + e.message;
  }
}

async function execTool(
  sandbox: Sandbox,
  tool: string,
  args: any
): Promise<string> {
  if (tool === "shell") return runCmd(sandbox, args.cmd || "");
  if (tool === "read")
    return runCmd(sandbox, `cat '${args.path || ""}'`);
  if (tool === "write") {
    const b = btoa(unescape(encodeURIComponent(args.content || "")));
    return runCmd(
      sandbox,
      `mkdir -p "$(dirname '${args.path}')" && echo ${b} | base64 -d > '${args.path}'`
    );
  }
    if (tool === "deploy") return runCmd(sandbox, "cd /workspaces/moltworker && npx wrangler deploy 2>&1");
  return "Unknown tool: " + tool;
}

function xJSON(t: string): any {
  const m = t.match(/\{[\s\S]*?"tool"\s*:\s*"[^"]+/);
  if (!m) return null;
  try {
    let d = 0;
    const s = t.indexOf(m[0]);
    for (let i = s; i < t.length; i++) {
      if (t[i] === "{") d++;
      if (t[i] === "}") {
        d--;
        if (d === 0) return JSON.parse(t.substring(s, i + 1));
      }
    }
  } catch {}
  return null;
}

export async function runHydra(
  ai: any,
  sandbox: Sandbox,
  task: string,
  onStep: (s: HydraStep) => void,
  selModels?: string[]
): Promise<void> {
  const models = selModels || HYDRA_MODELS.slice(0, 3);
  onStep({
    type: "dispatch",
    content: "HYDRA activating " + models.length + " heads...",
  });
  const sys = SYS + "\nTime: " + new Date().toISOString();

  // Phase 1: Parallel dispatch to all models
  const p1 = await Promise.allSettled(
    models.map(async (model) => {
      const t0 = Date.now();
      const r = await ai.run(model, {
        messages: [
          { role: "system", content: sys },
          { role: "user", content: task },
        ],
        max_tokens: 2048,
      });
      const ms = Date.now() - t0;
      const text = r.response || "";
      onStep({
        type: "model",
        model: model.split("/").pop() || model,
        content: text.substring(0, 600),
        ms,
      });
      return { model, text, ms };
    })
  );

  const ok = p1
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<any>).value);
  if (!ok.length) {
    onStep({ type: "error", content: "All models failed" });
    return;
  }

  let lead = ok.find((r) => xJSON(r.text)) || ok[0];
  let msgs: any[] = [
    { role: "system", content: sys },
    { role: "user", content: task },
    { role: "assistant", content: lead.text },
  ];

  // Phase 2: Agentic loop
  for (let i = 0; i < 12; i++) {
    const tc = xJSON(lead.text);
    if (!tc || tc.tool === "done") {
      const ans = tc?.args?.answer || lead.text;
      onStep({ type: "dispatch", content: "Synthesizing consensus..." });
      try {
        const t0 = Date.now();
        const syn = await ai.run(models[0], {
          messages: [
            {
              role: "system",
              content: "Synthesize a clear, complete final answer.",
            },
            {
              role: "user",
              content: "Task: " + task + "\nAgent output:\n" + ans,
            },
          ],
          max_tokens: 2048,
        });
        onStep({
          type: "synthesis",
          content: syn.response || ans,
          ms: Date.now() - t0,
        });
      } catch {
        onStep({ type: "synthesis", content: ans });
      }
      return;
    }

    onStep({
      type: "tool",
      content:
        tc.tool + "(" + JSON.stringify(tc.args).substring(0, 300) + ")",
    });
    let result: string;
    if (tc.tool === "search") {
      try {
        const sr = await ai.run(models[0], {
          messages: [
            { role: "system", content: "You are a web search assistant. Answer concisely. Date: " + new Date().toISOString().split("T")[0] },
            { role: "user", content: tc.args?.query || "" },
          ],
          max_tokens: 1024,
        });
        result = sr.response || "No results.";
      } catch (se: any) {
        result = "Search error: " + se.message;
      }
    } else {
      result = (await execTool(sandbox, tc.tool, tc.args)) ?? "";
    }
    onStep({ type: "result", content: result.substring(0, 3000) });

    msgs.push({
      role: "user",
      content:
        "Result:\n" +
        result.substring(0, 4000) +
        '\nContinue or {"tool":"done","args":{"answer":"..."}}',
    });

    const t0 = Date.now();
    const next = await ai.run(lead.model, {
      messages: msgs,
      max_tokens: 2048,
    });
    lead = {
      model: lead.model,
      text: next.response || "",
      ms: Date.now() - t0,
    };
    msgs.push({ role: "assistant", content: lead.text });
    onStep({
      type: "model",
      model: lead.model.split("/").pop() || lead.model,
      content: lead.text.substring(0, 600),
      ms: lead.ms,
    });
  }
  onStep({ type: "synthesis", content: lead.text });
}
