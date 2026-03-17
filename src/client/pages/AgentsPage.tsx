import { useState } from "react";
import "./AgentsPage.css";

interface AgentDef {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  tools: string[];
  active: boolean;
}

const DEFAULT_AGENTS: AgentDef[] = [
  { id: "hydra", name: "HYDRA", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", systemPrompt: "Multi-model autonomous agent", tools: ["shell", "read", "write", "search"], active: true },
  { id: "coder", name: "Coder", model: "@cf/qwen/qwen2.5-coder-32b-instruct", systemPrompt: "Expert programmer", tools: ["shell", "read", "write"], active: true },
  { id: "researcher", name: "Researcher", model: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", systemPrompt: "Deep research agent", tools: ["search", "read", "browse"], active: false },
  { id: "assistant", name: "Assistant", model: "@cf/meta/llama-3.1-8b-instruct-fast", systemPrompt: "General assistant", tools: ["shell", "read"], active: true },
];

const TOOLS = ["shell", "read", "write", "search", "browse", "email", "notify", "image", "screenshot"];

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentDef[]>(DEFAULT_AGENTS);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<AgentDef>>({});

  const startEdit = (a: AgentDef) => {
    setEditing(a.id);
    setDraft({ ...a });
  };

  const saveEdit = () => {
    if (!editing) return;
    setAgents((prev) => prev.map((a) => (a.id === editing ? { ...a, ...draft } as AgentDef : a)));
    setEditing(null);
  };

  const toggleActive = (id: string) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a)));
  };

  const toggleTool = (tool: string) => {
    setDraft((d) => {
      const tools = d.tools || [];
      return { ...d, tools: tools.includes(tool) ? tools.filter((t) => t !== tool) : [...tools, tool] };
    });
  };

  return (
    <div className="ag-page">
      <div className="ag-top">
        <h1>Agents</h1>
        <p className="ag-sub">Configure autonomous AI agents and their capabilities.</p>
      </div>
      <div className="ag-list">
        {agents.map((a) => (
          <div key={a.id} className={`ag-card ${a.active ? "" : "ag-inactive"}`}>
            {editing === a.id ? (
              <div className="ag-edit">
                <input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name" />
                <input value={draft.model || ""} onChange={(e) => setDraft({ ...draft, model: e.target.value })} placeholder="Model ID" />
                <textarea value={draft.systemPrompt || ""} onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })} placeholder="System prompt" />
                <div className="ag-tools-edit">
                  {TOOLS.map((t) => (
                    <label key={t} className={`ag-tool-chk ${(draft.tools || []).includes(t) ? "checked" : ""}`}>
                      <input type="checkbox" checked={(draft.tools || []).includes(t)} onChange={() => toggleTool(t)} />
                      {t}
                    </label>
                  ))}
                </div>
                <div className="ag-edit-actions">
                  <button className="ag-btn-save" onClick={saveEdit}>Save</button>
                  <button className="ag-btn-cancel" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="ag-card-head">
                  <div className="ag-card-title">
                    <span className="ag-name">{a.name}</span>
                    <span className={`ag-status ${a.active ? "on" : "off"}`}>{a.active ? "Active" : "Inactive"}</span>
                  </div>
                  <div className="ag-card-actions">
                    <button className="ag-btn-edit" onClick={() => startEdit(a)}>Edit</button>
                    <button className="ag-btn-toggle" onClick={() => toggleActive(a.id)}>{a.active ? "Disable" : "Enable"}</button>
                  </div>
                </div>
                <div className="ag-model">{a.model.split("/").pop()}</div>
                <div className="ag-prompt">{a.systemPrompt}</div>
                <div className="ag-tools">
                  {a.tools.map((t) => (
                    <span key={t} className="ag-tool-badge">{t}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
