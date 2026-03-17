import { useState, useRef } from "react";
import "./DebugPage.css";

interface LogEntry { ts: string; type: "cmd" | "out" | "err" | "info"; text: string; }

export default function DebugPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [cmd, setCmd] = useState("");
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<"console" | "processes" | "env" | "config">("console");
  const [info, setInfo] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (type: LogEntry["type"], text: string) => {
    const entry = { ts: new Date().toISOString().split("T")[1].split(".")[0], type, text };
    setLogs((p) => [...p, entry]);
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
  };

  const runCmd = async () => {
    if (!cmd.trim() || running) return;
    const c = cmd;
    setCmd("");
    addLog("cmd", c);
    setRunning(true);
    try {
      const res = await fetch("/api/autoclaw/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd: c }),
      });
      const data = await res.json();
      if (data.stdout) addLog("out", data.stdout);
      if (data.stderr) addLog("err", data.stderr);
      if (data.error) addLog("err", data.error);
    } catch (e: any) {
      addLog("err", e.message);
    }
    setRunning(false);
  };

  const loadInfo = async (endpoint: string) => {
    try {
      const res = await fetch(endpoint);
      setInfo(await res.text());
    } catch (e: any) {
      setInfo("Error: " + e.message);
    }
  };

  const loadTab = (t: typeof tab) => {
    setTab(t);
    if (t === "processes") loadInfo("/debug/processes");
    if (t === "env") loadInfo("/debug/env");
    if (t === "config") loadInfo("/debug/container-config");
  };

  return (
    <div className="db-page">
      <div className="db-top">
        <h1>Debug Console</h1>
        <p className="db-sub">Execute commands, inspect processes, and monitor system state.</p>
      </div>
      <div className="db-tabs">
        {(["console", "processes", "env", "config"] as const).map((t) => (
          <button key={t} className={`db-tab ${tab === t ? "active" : ""}`} onClick={() => loadTab(t)}>
            {t === "console" ? "Console" : t === "processes" ? "Processes" : t === "env" ? "Environment" : "Config"}
          </button>
        ))}
      </div>
      {tab === "console" ? (
        <div className="db-console">
          <div className="db-log" ref={logRef}>
            {logs.length === 0 && <div className="db-empty">Type a command below to execute in the sandbox container.</div>}
            {logs.map((l, i) => (
              <div key={i} className={`db-entry db-${l.type}`}>
                <span className="db-ts">{l.ts}</span>
                <span className="db-prefix">{l.type === "cmd" ? "$" : l.type === "err" ? "!" : ">"}</span>
                <pre className="db-text">{l.text}</pre>
              </div>
            ))}
            {running && <div className="db-entry db-info"><span className="db-ts">...</span><span className="db-prefix">*</span><pre className="db-text">Running...</pre></div>}
          </div>
          <div className="db-input">
            <span className="db-prompt">$</span>
            <input
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runCmd()}
              placeholder="Enter command..."
              disabled={running}
              autoFocus
            />
          </div>
        </div>
      ) : (
        <div className="db-info-panel">
          <div className="db-info-actions">
            <button onClick={() => loadTab(tab)}>Refresh</button>
          </div>
          <pre className="db-info-content">{info || "Loading..."}</pre>
        </div>
      )}
    </div>
  );
}
