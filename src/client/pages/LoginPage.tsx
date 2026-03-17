import { useState } from "react";
import "./LoginPage.css";

interface LoginPageProps {
  onLogin: (role: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [coworkCode, setCoworkCode] = useState("");

  const handleLogin = async () => {
    if (!token.trim()) { setError("Enter your access token"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ncauth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json() as any;
      if (data.ok) {
        onLogin(data.role || "claude-leader");
      } else {
        setError(data.error || "Authentication failed");
      }
    } catch {
      setError("Connection failed. Check your network.");
    }
    setLoading(false);
  };

  const handleCowork = async () => {
    if (!coworkCode.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ncauth/cowork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: coworkCode.trim() }),
      });
      const data = await res.json() as any;
      if (data.ok) {
        onLogin(data.role || "coworker");
      } else {
        setError(data.error || "Invalid cowork code");
      }
    } catch {
      setError("Connection failed");
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">
          <div className="login-orb">
            <span className="orb-icon">C</span>
          </div>
          <h1 className="login-title">NewClaw</h1>
          <p className="login-subtitle">Claude Supreme Leader Console</p>
        </div>

        <div className="login-section">
          <label className="login-label">Master Token</label>
          <input
            className="login-input"
            type="password"
            placeholder="Enter NEWCLAW_MASTER_TOKEN"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          <button
            className="login-btn primary"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "Authenticating..." : "Login as Claude Leader"}
          </button>
        </div>

        <div className="login-divider">
          <span>or join as coworker</span>
        </div>

        <div className="login-section">
          <label className="login-label">Cowork Code</label>
          <input
            className="login-input"
            type="text"
            placeholder="Enter shared cowork code"
            value={coworkCode}
            onChange={(e) => setCoworkCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCowork()}
          />
          <button
            className="login-btn secondary"
            onClick={handleCowork}
            disabled={loading}
          >
            Join Session
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="login-footer">
          <p>Powered by Cloudflare Workers AI + HYDRA Engine</p>
        </div>
      </div>
    </div>
  );
}
