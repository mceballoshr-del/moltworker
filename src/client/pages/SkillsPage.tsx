import { useState } from "react";
import "./SkillsPage.css";

interface Skill {
  id: string;
  name: string;
  description: string;
  trigger: string;
  enabled: boolean;
  source: "official" | "community" | "custom";
  endpoint?: string;
  model?: string;
}

const OFFICIAL_SKILLS: Skill[] = [
  { id: "shell", name: "Shell Execute", description: "Run shell commands in sandbox container via gateway", trigger: "Any command execution request", enabled: true, source: "official", endpoint: "/api/autoclaw/exec" },
  { id: "web-search", name: "Web Search", description: "Search the web using Workers AI + Cloudflare Browser Rendering", trigger: "Search queries, fact checking", enabled: true, source: "official", endpoint: "/api/autoclaw/search", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
  { id: "hydra-dispatch", name: "HYDRA Multi-Model", description: "Dispatch queries to 3-5 Workers AI models in parallel for consensus", trigger: "Complex reasoning, multi-perspective analysis", enabled: true, source: "official", endpoint: "/api/autoclaw/stream", model: "Multi-model ensemble" },
  { id: "whatsapp", name: "WhatsApp Bridge", description: "Receive and respond to WhatsApp messages via Cloud API", trigger: "WhatsApp channel messages", enabled: true, source: "official", endpoint: "/api/whatsapp/webhook" },
  { id: "code-exec", name: "Code Execution", description: "Execute Python/Node.js code in isolated Workers sandbox", trigger: "Code running requests", enabled: true, source: "official", endpoint: "/api/autoclaw/exec" },
  { id: "image-gen", name: "Image Generation", description: "Generate images using @cf/stabilityai/stable-diffusion-xl-base-1.0", trigger: "Image creation requests", enabled: true, source: "official", model: "@cf/stabilityai/stable-diffusion-xl-base-1.0" },
  { id: "text-classify", name: "Text Classification", description: "Classify text intent/sentiment using Workers AI", trigger: "Classification, sentiment analysis", enabled: true, source: "official", model: "@cf/huggingface/distilbert-sst-2-int8" },
  { id: "translate", name: "Translation", description: "Translate text between languages using M2M100", trigger: "Translation requests", enabled: true, source: "official", model: "@cf/meta/m2m100-1.2b" },
  { id: "summarize", name: "Summarizer", description: "Summarize long text using BART", trigger: "Summarization requests", enabled: true, source: "official", model: "@cf/facebook/bart-large-cnn" },
  { id: "speech", name: "Speech-to-Text", description: "Transcribe audio using Whisper", trigger: "Audio transcription", enabled: false, source: "official", model: "@cf/openai/whisper" },
  { id: "embeddings", name: "Embeddings", description: "Generate text embeddings for semantic search", trigger: "Semantic search, similarity", enabled: true, source: "official", model: "@cf/baai/bge-base-en-v1.5" },
  { id: "proactive-cron", name: "Proactive Monitor", description: "Scheduled tasks via Cron Triggers - health checks, reports, alerts", trigger: "Automated on schedule", enabled: true, source: "official" },
];

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>(OFFICIAL_SKILLS);
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [creating, setCreating] = useState(false);
  const [newSkill, setNewSkill] = useState({ name: "", description: "", trigger: "" });
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string>("");

  const toggle = (id: string) => {
    setSkills((s) => s.map((sk) => (sk.id === id ? { ...sk, enabled: !sk.enabled } : sk)));
  };

  const filtered = skills.filter((s) => filter === "all" || (filter === "enabled" ? s.enabled : !s.enabled));

  const addSkill = () => {
    if (!newSkill.name) return;
    setSkills((s) => [...s, { ...newSkill, id: "custom-" + Date.now(), enabled: true, source: "custom" }]);
    setNewSkill({ name: "", description: "", trigger: "" });
    setCreating(false);
  };

  const testSkill = async (skill: Skill) => {
    setTestingId(skill.id);
    setTestResult("");
    try {
      if (skill.endpoint) {
        const res = await fetch(skill.endpoint, { method: skill.endpoint.includes("status") ? "GET" : "POST", headers: { "Content-Type": "application/json" }, body: skill.endpoint.includes("status") ? undefined : JSON.stringify({ prompt: "test", command: "echo skill_test_ok" }) });
        setTestResult(res.ok ? "OK (" + res.status + ")" : "Error " + res.status);
      } else {
        setTestResult("No endpoint configured");
      }
    } catch (e: any) {
      setTestResult("Failed: " + e.message);
    }
    setTimeout(() => { setTestingId(null); setTestResult(""); }, 3000);
  };

  return (
    <div className="sk-page">
      <div className="sk-top">
        <div>
          <h1>Skills</h1>
          <p className="sk-sub">Official Cloudflare Workers AI capabilities. {skills.filter(s => s.enabled).length}/{skills.length} active.</p>
        </div>
        <button className="sk-btn-new" onClick={() => setCreating(!creating)}>+ New Skill</button>
      </div>
      <div className="sk-filters">
        {(["all", "enabled", "disabled"] as const).map((f) => (
          <button key={f} className={`sk-filter ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
            {f} ({skills.filter((s) => f === "all" || (f === "enabled" ? s.enabled : !s.enabled)).length})
          </button>
        ))}
      </div>
      {creating && (
        <div className="sk-create">
          <input placeholder="Skill name" value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })} />
          <input placeholder="Description" value={newSkill.description} onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })} />
          <input placeholder="Trigger pattern" value={newSkill.trigger} onChange={(e) => setNewSkill({ ...newSkill, trigger: e.target.value })} />
          <div className="sk-create-actions">
            <button onClick={addSkill}>Create</button>
            <button className="sk-btn-cancel" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      )}
      <div className="sk-grid">
        {filtered.map((s) => (
          <div key={s.id} className={`sk-card ${s.enabled ? "" : "sk-off"}`}>
            <div className="sk-card-head">
              <span className="sk-name">{s.name}</span>
              <span className={`sk-src ${s.source}`}>{s.source}</span>
            </div>
            <p className="sk-desc">{s.description}</p>
            {s.model && <div className="sk-model">Model: {s.model}</div>}
            <div className="sk-trigger">Trigger: {s.trigger}</div>
            <div className="sk-card-foot">
              <button className={`sk-toggle ${s.enabled ? "on" : "off"}`} onClick={() => toggle(s.id)}>
                {s.enabled ? "Enabled" : "Disabled"}
              </button>
              {s.endpoint && (
                <button className="sk-test" onClick={() => testSkill(s)} disabled={testingId === s.id}>
                  {testingId === s.id ? (testResult || "Testing...") : "Test"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
