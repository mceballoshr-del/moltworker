import { useState, useEffect } from "react";
import "./ChannelsPage.css";

interface WaStatus {
  configured: boolean;
  phoneNumberId: string | null;
  webhookVerifyTokenSet: boolean;
  stats: { queueSize: number; inbound: number; outbound: number; failed: number; lastMessageAt: number | null };
}

export default function ChannelsPage() {
  const [waStatus, setWaStatus] = useState<WaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"status" | "setup" | "send">("status");
  // setup
  const [phoneId, setPhoneId] = useState("");
  const [bizId, setBizId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [setupMsg, setSetupMsg] = useState("");
  const [setupErr, setSetupErr] = useState("");
  // send
  const [sendTo, setSendTo] = useState("");
  const [sendText, setSendText] = useState("");
  const [sendResult, setSendResult] = useState("");

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/status");
      if (res.ok) setWaStatus(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchStatus(); }, []);

  const yn = (v: boolean) => <span className={v ? "ch-yes" : "ch-no"}>{v ? "Yes" : "No"}</span>;

  const handleSetup = async () => {
    setSetupMsg(""); setSetupErr("");
    try {
      const res = await fetch("/api/whatsapp/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId: phoneId, businessAccountId: bizId, accessToken, verifyToken }),
      });
      const data = await res.json() as any;
      if (data.ok) {
        setSetupMsg("Config validated! Set secrets via wrangler:\n  wrangler secret put WHATSAPP_TOKEN\n  wrangler secret put WHATSAPP_PHONE_ID\n  wrangler secret put WHATSAPP_VERIFY_TOKEN");
        fetchStatus();
      } else {
        setSetupErr(data.error + (data.detail ? " - " + data.detail : ""));
      }
    } catch { setSetupErr("Connection failed"); }
  };

  const handleSend = async () => {
    setSendResult("");
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: sendTo, message: sendText }),
      });
      const data = await res.json() as any;
      setSendResult(data.ok ? "Sent! ID: " + data.messageId : "Error: " + data.error);
      if (data.ok) { setSendText(""); fetchStatus(); }
    } catch { setSendResult("Connection failed"); }
  };

  const webhookUrl = window.location.origin + "/api/whatsapp/webhook";

  return (
    <div className="ch-page">
      <div className="ch-top">
        <h1>Channels</h1>
        <p className="ch-sub">WhatsApp Cloud API Integration</p>
      </div>

      <div className="ch-tabs">
        {(["status", "setup", "send"] as const).map((t) => (
          <button key={t} className={`ch-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "status" ? "Status" : t === "setup" ? "Setup Wizard" : "Send Message"}
          </button>
        ))}
      </div>

      {tab === "status" && (
        <div className="ch-card">
          <h2>WhatsApp Status</h2>
          {loading ? <p className="ch-loading">Loading...</p> : waStatus ? (
            <>
              <div className="ch-table">
                <div className="ch-row"><span>Configured</span>{yn(waStatus.configured)}</div>
                <div className="ch-row"><span>Phone Number ID</span><span className="ch-val">{waStatus.phoneNumberId || "not set"}</span></div>
                <div className="ch-row"><span>Verify Token Set</span>{yn(waStatus.webhookVerifyTokenSet)}</div>
                <div className="ch-row"><span>Messages In Queue</span><span className="ch-val">{waStatus.stats.queueSize}</span></div>
                <div className="ch-row"><span>Inbound</span><span className="ch-val">{waStatus.stats.inbound}</span></div>
                <div className="ch-row"><span>Outbound</span><span className="ch-val">{waStatus.stats.outbound}</span></div>
                <div className="ch-row"><span>Failed</span><span className={waStatus.stats.failed > 0 ? "ch-no" : "ch-val"}>{waStatus.stats.failed}</span></div>
                <div className="ch-row"><span>Last Message</span><span className="ch-val">{waStatus.stats.lastMessageAt ? new Date(waStatus.stats.lastMessageAt).toLocaleString() : "none"}</span></div>
              </div>
              <div className="ch-webhook-url">
                <label>Webhook URL (for Meta Developer Portal):</label>
                <code>{webhookUrl}</code>
              </div>
              <button className="ch-btn-sec" onClick={fetchStatus}>Refresh</button>
            </>
          ) : <p className="ch-error">Could not load status</p>}
        </div>
      )}

      {tab === "setup" && (
        <div className="ch-card">
          <h2>WhatsApp Cloud API Setup</h2>
          <p className="ch-desc">Configure your Meta Business WhatsApp integration. You need a Meta Developer account with WhatsApp Business API access.</p>
          <div className="ch-form">
            <div className="ch-field">
              <label>Phone Number ID</label>
              <input placeholder="e.g. 123456789012345" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} />
            </div>
            <div className="ch-field">
              <label>Business Account ID</label>
              <input placeholder="e.g. 109876543210" value={bizId} onChange={(e) => setBizId(e.target.value)} />
            </div>
            <div className="ch-field">
              <label>Permanent Access Token</label>
              <input type="password" placeholder="From Meta Developer Portal" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
            </div>
            <div className="ch-field">
              <label>Webhook Verify Token</label>
              <input placeholder="Any string you choose" value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} />
            </div>
            <button className="ch-btn-primary" onClick={handleSetup} disabled={!phoneId || !bizId || !accessToken || !verifyToken}>
              Validate & Save
            </button>
          </div>
          {setupMsg && <div className="ch-success">{setupMsg}</div>}
          {setupErr && <div className="ch-error">{setupErr}</div>}
          <div className="ch-webhook-url">
            <label>Your Webhook URL:</label>
            <code>{webhookUrl}</code>
          </div>
        </div>
      )}

      {tab === "send" && (
        <div className="ch-card">
          <h2>Send Message</h2>
          <p className="ch-desc">Send a WhatsApp message through the Cloud API.</p>
          <div className="ch-form">
            <div className="ch-field">
              <label>Recipient Phone Number</label>
              <input placeholder="e.g. 5491112345678" value={sendTo} onChange={(e) => setSendTo(e.target.value)} />
            </div>
            <div className="ch-field">
              <label>Message</label>
              <textarea placeholder="Type your message..." value={sendText} onChange={(e) => setSendText(e.target.value)} rows={4} />
            </div>
            <button className="ch-btn-primary" onClick={handleSend} disabled={!sendTo || !sendText}>Send</button>
          </div>
          {sendResult && <div className={sendResult.startsWith("Error") ? "ch-error" : "ch-success"}>{sendResult}</div>}
        </div>
      )}

      <div className="ch-card">
        <h2>Telegram / Discord / Slack</h2>
        <p className="ch-desc">Coming soon. Additional channel integrations planned.</p>
        <div className="ch-badge-warn">planned</div>
      </div>
    </div>
  );
}
