import { useState, useRef } from "react";
import "./AutoClawPage.css";

interface Step { type: string; model?: string; content: string; ms?: number; }

interface AutoClawPageProps {
  steps: Step[];
  onStep: (step: Step) => void;
  running: boolean;
  setRunning: (running: boolean) => void;
}

export default function AutoClawPage({ steps, onStep, running, setRunning }: AutoClawPageProps) {
  const [task, setTask] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  const run = async () => {
    if (!task.trim() || running) return;
    setRunning(true);
    try {
      const res = await fetch("/api/autoclaw/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const step = JSON.parse(line.slice(6));
              if (step.type === "end") continue;
              onStep(step);
              setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
            } catch {}
          }
        }
      }
    } catch (e: any) {
      onStep({ type: "error", content: e.message });
    }
    setRunning(false);
  };

  const icon = (t: string) =>
    ({ dispatch: "\u{1F409}", model: "\u{1F9E0}", tool: "\u26A1", result: "\u{1F4E6}", synthesis: "\u{1F31F}", error: "\u274C" }[t] || "\u2022");

  return (
    <div className="ac-page">
      <div className="ac-header">
        <h2>HYDRA <span className="ac-sub">Multi-Model Autonomous Agent</span></h2>
        <p className="ac-desc">5 Workers AI models | Zero cost | Edge-deployed | Full shell access</p>
      </div>
      <div className="ac-input">
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Describe your task... (e.g. 'Check disk usage and list top 5 largest files')"
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), run())}
          disabled={running}
        />
        <button onClick={run} disabled={running || !task.trim()} className={running ? "ac-running" : ""}>
          {running ? "EXECUTING..." : "UNLEASH HYDRA"}
        </button>
      </div>
      <div className="ac-log" ref={logRef}>
        {steps.map((s, i) => (
          <div key={i} className={"ac-step ac-" + s.type}>
            <span className="ac-icon">{icon(s.type)}</span>
            <div className="ac-step-body">
              {s.model && <span className="ac-model">{s.model}</span>}
              {s.ms != null && <span className="ac-ms">{s.ms}ms</span>}
              <pre className="ac-content">{s.content}</pre>
            </div>
          </div>
        ))}
        {steps.length === 0 && !running && (
          <div className="ac-empty">
            <div className="ac-dragon">{"\u{1F432}"}</div>
            <p>HYDRA awaits your command</p>
            <p className="ac-hint">Multi-headed AI that queries models in parallel, executes tools autonomously, and synthesizes consensus answers.</p>
          </div>
        )}
      </div>
    </div>
  );
}
