import { useState } from "react";
import "./SettingsPage.css";

interface ConfigSection {
  title: string;
  fields: { key: string; label: string; type: "text" | "password" | "select" | "toggle"; value: string; options?: string[]; }[];
}

const SECTIONS: ConfigSection[] = [
  {
    title: "AI Provider",
    fields: [
      { key: "ai_provider", label: "Provider", type: "select", value: "workers-ai", options: ["workers-ai", "anthropic", "openai", "cf-ai-gateway"] },
      { key: "anthropic_key", label: "Anthropic API Key", type: "password", value: "" },
      { key: "openai_key", label: "OpenAI API Key", type: "password", value: "" },
      { key: "default_model", label: "Default Model", type: "text", value: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
    ],
  },
  {
    title: "Gateway",
    fields: [
      { key: "gw_token", label: "Gateway Token", type: "password", value: "" },
      { key: "gw_mode", label: "Mode", type: "select", value: "local", options: ["local", "remote", "dev"] },
      { key: "gw_port", label: "Port", type: "text", value: "18789" },
      { key: "dev_mode", label: "Dev Mode", type: "toggle", value: "false" },
    ],
  },
  {
    title: "Channels",
    fields: [
      { key: "telegram_token", label: "Telegram Bot Token", type: "password", value: "" },
      { key: "telegram_policy", label: "Telegram DM Policy", type: "select", value: "owner", options: ["owner", "anyone", "none"] },
      { key: "discord_token", label: "Discord Bot Token", type: "password", value: "" },
      { key: "slack_token", label: "Slack Bot Token", type: "password", value: "" },
    ],
  },
  {
    title: "Storage (R2)",
    fields: [
      { key: "r2_key", label: "R2 Access Key ID", type: "password", value: "" },
      { key: "r2_secret", label: "R2 Secret Key", type: "password", value: "" },
      { key: "r2_bucket", label: "R2 Bucket Name", type: "text", value: "moltbot-data" },
      { key: "cf_account", label: "CF Account ID", type: "text", value: "" },
    ],
  },
  {
    title: "Authentication",
    fields: [
      { key: "auth_method", label: "Auth Method", type: "select", value: "cf-access", options: ["cf-access", "google-oauth", "none"] },
      { key: "google_client_id", label: "Google Client ID", type: "text", value: "" },
      { key: "google_client_secret", label: "Google Client Secret", type: "password", value: "" },
      { key: "allowed_emails", label: "Allowed Emails", type: "text", value: "" },
    ],
  },
  {
    title: "Browser & Search",
    fields: [
      { key: "browser_enabled", label: "Browser Rendering", type: "toggle", value: "true" },
      { key: "search_enabled", label: "Web Search", type: "toggle", value: "true" },
      { key: "tavily_key", label: "Tavily API Key", type: "password", value: "" },
      { key: "sandbox_sleep", label: "Sandbox Sleep After", type: "select", value: "never", options: ["never", "5m", "15m", "30m", "1h"] },
    ],
  },
];

export default function SettingsPage() {
  const [sections] = useState(SECTIONS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    SECTIONS.forEach((s) => s.fields.forEach((f) => { m[f.key] = f.value; }));
    return m;
  });

  const update = (key: string, value: string) => {
    setVals((v) => ({ ...v, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/autoclaw/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vals),
      });
      setSaved(true);
    } catch {}
    setSaving(false);
  };

  return (
    <div className="st-page">
      <div className="st-top">
        <div>
          <h1>Settings</h1>
          <p className="st-sub">Configure API keys, channels, storage, and authentication.</p>
        </div>
        <button className="st-save" onClick={save} disabled={saving}>
          {saving ? "Saving..." : saved ? "Saved!" : "Save All"}
        </button>
      </div>
      <div className="st-sections">
        {sections.map((s) => (
          <div key={s.title} className="st-section">
            <h2>{s.title}</h2>
            <div className="st-fields">
              {s.fields.map((f) => (
                <div key={f.key} className="st-field">
                  <label>{f.label}</label>
                  {f.type === "select" ? (
                    <select value={vals[f.key]} onChange={(e) => update(f.key, e.target.value)}>
                      {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === "toggle" ? (
                    <button
                      className={`st-toggle ${vals[f.key] === "true" ? "on" : "off"}`}
                      onClick={() => update(f.key, vals[f.key] === "true" ? "false" : "true")}
                    >
                      {vals[f.key] === "true" ? "Enabled" : "Disabled"}
                    </button>
                  ) : (
                    <input
                      type={f.type}
                      value={vals[f.key]}
                      onChange={(e) => update(f.key, e.target.value)}
                      placeholder={f.label}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
