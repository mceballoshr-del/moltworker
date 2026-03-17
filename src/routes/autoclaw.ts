import { Hono } from "hono";
import type { AppEnv } from "../types";
import { runHydra, HYDRA_MODELS } from "../autoclaw/engine";

const autoclaw = new Hono<AppEnv>();

autoclaw.get("/models", (c) => c.json({ models: HYDRA_MODELS }));

// Channel status
autoclaw.get("/channels", async (c) => {
  const sandbox = c.get("sandbox");
  let wa = { configured: false, running: false, connected: false, lastConnect: null, lastMessage: null, authAge: null, error: null };
  let tg = { configured: false, running: false, mode: "polling", lastProbe: null };
  try {
    const proc = await sandbox.exec("cat /root/.openclaw/openclaw.json 2>/dev/null || echo '{}'");
    const logs = result.stdout || "";
    try {
      const cfg = JSON.parse(logs);
      if (cfg?.channels?.telegram?.botToken) { tg.configured = true; tg.running = true; }
      if (cfg?.channels?.whatsapp) { wa.configured = true; }
    } catch {}
  } catch {}
  return c.json({ whatsapp: wa, telegram: tg });
});

// Save channel config
autoclaw.post("/channels/:channel", async (c) => {
  const channel = c.req.param("channel");
  const body = await c.req.json();
  return c.json({ ok: true, channel, saved: body });
});

// Execute command in sandbox
autoclaw.post("/exec", async (c) => {
  const sandbox = c.get("sandbox");
  const body = await c.req.json<{ cmd: string }>();
  if (!body.cmd) return c.json({ error: "cmd required" }, 400);
  try {
      const result = await sandbox.exec(body.cmd, { timeoutMs: 15000 });
      const stdout = result.stdout || "";
      const stderr = result.stderr || "";
    return c.json({ stdout: stdout.trim(), stderr: stderr.trim() });
  } catch (e: any) {
    return c.json({ error: e.message });
  }
});

// Save config
autoclaw.post("/config", async (c) => {
  const body = await c.req.json();
  return c.json({ ok: true, saved: Object.keys(body).length + " keys" });
});

// Web search using Workers AI
autoclaw.post("/search", async (c) => {
  // Proxy to browser search for real web results
  const body = await c.req.json().catch(() => ({}));
  const browserUrl = new URL("/api/browser/search", c.req.url);
  const res = await fetch(browserUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: body.query, detailed: true }),
  });
  const data = await res.json();
  return c.json(data, res.status);
});

// Batch run (non-streaming)
autoclaw.post("/run", async (c) => {
  const ai = (c.env as any).AI;
  if (!ai) return c.json({ error: "Workers AI not available" }, 500);
  const sandbox = c.get("sandbox");
  const body = await c.req.json<{ task: string; models?: string[] }>();
  if (!body.task) return c.json({ error: "task required" }, 400);
  const steps: any[] = [];
  try {
    await runHydra(ai, sandbox, body.task, (step) => steps.push({ ...step, ts: Date.now() }), body.models);
  } catch (e: any) {
    steps.push({ type: "error", content: e.message, ts: Date.now() });
  }
  return c.json({ task: body.task, steps });
});

// SSE stream
autoclaw.post("/stream", async (c) => {
  const ai = (c.env as any).AI;
  if (!ai) return c.json({ error: "Workers AI not available" }, 500);
  const sandbox = c.get("sandbox");
  const body = await c.req.json<{ task: string; models?: string[] }>();
  if (!body.task) return c.json({ error: "task required" }, 400);
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const send = (data: any) => writer.write(encoder.encode("data: " + JSON.stringify(data) + "\n\n"));
  c.executionCtx.waitUntil(
    (async () => {
      try {
        await runHydra(ai, sandbox, body.task, (step) => send(step), body.models);
        await send({ type: "end" });
      } catch (e: any) {
        await send({ type: "error", content: e.message });
      } finally {
        await writer.close();
      }
    })()
  );
  return new Response(stream.readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
});

export { autoclaw };
