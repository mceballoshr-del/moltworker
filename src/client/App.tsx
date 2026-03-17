import { useState, useEffect } from "react";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import AutoClawPage from "./pages/AutoClawPage";
import ChannelsPage from "./pages/ChannelsPage";
import AgentsPage from "./pages/AgentsPage";
import SkillsPage from "./pages/SkillsPage";
import NexusCortexPage from "./pages/NexusCortexPage";
import DebugPage from "./pages/DebugPage";
import SettingsPage from "./pages/SettingsPage";
import ChatHistory from "./components/ChatHistory";
import { ChatSession, getCurrentSession, createChatSession, addChatSession, updateChatSession } from "./utils/chatStorage";
import "./App.css";

type Page = "hydra" | "channels" | "agents" | "skills" | "nexus" | "debug" | "settings" | "admin";

const NAV = [
  { id: "hydra" as Page, label: "HYDRA", icon: "\u{1F409}", section: "Core" },
  { id: "channels" as Page, label: "Channels", icon: "\u{1F4E1}", section: "Control" },
  { id: "agents" as Page, label: "Agents", icon: "\u{1F916}", section: "Agent" },
  { id: "skills" as Page, label: "Skills", icon: "\u26A1", section: "Agent" },
  { id: "nexus" as Page, label: "NEXUS CORTEX", icon: "\u{1F9E0}", section: "Analysis" },
  { id: "debug" as Page, label: "Debug", icon: "\u{1F41B}", section: "Dev" },
  { id: "settings" as Page, label: "Settings", icon: "\u2699\uFE0F", section: "Dev" },
  { id: "admin" as Page, label: "Admin", icon: "\u{1F6E1}\uFE0F", section: "Dev" },
];

export function App() {
  const [page, setPage] = useState<Page>("hydra");
  const [collapsed, setCollapsed] = useState(false);
  const [auth, setAuth] = useState<{ authenticated: boolean; role: string } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [hydraSteps, setHydraSteps] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);

  useEffect(() => {
    fetch("/api/ncauth/session")
      .then((r) => r.json())
      .then((data: any) => {
        if (data.authenticated) setAuth({ authenticated: true, role: data.role });
        else setAuth(null);
      })
      .catch(() => setAuth(null))
      .finally(() => setCheckingAuth(false));
  }, []);

  useEffect(() => {
    // Load current chat session on mount
    const session = getCurrentSession();
    setCurrentSession(session);
    if (session) {
      setHydraSteps(session.steps);
    }
  }, []);

  const handleLogin = (role: string) => {
    setAuth({ authenticated: true, role });
  };

  const handleSkillSuggested = (skill: any) => {
    console.log('New skill:', skill);
    // Lógica para agregar el skill a la lista de skills
  };

  const handleLogout = async () => {
    await fetch("/api/ncauth/logout", { method: "POST" });
    setAuth(null);
  };

  const handleSessionSelect = (session: ChatSession) => {
    setCurrentSession(session);
    setHydraSteps(session.steps);
  };

  const handleNewSession = () => {
    const newSession = createChatSession("Nueva Conversación", "HYDRA Multi-Model");
    addChatSession(newSession);
    setCurrentSession(newSession);
    setHydraSteps([]);
  };

  const handleTaskChange = (task: string) => {
    if (currentSession) {
      updateChatSession(currentSession.id, { task });
    }
  };

  const handleStepUpdate = (step: any) => {
    const newSteps = [...hydraSteps, step];
    setHydraSteps(newSteps);

    if (currentSession) {
      const updatedSession = {
        ...currentSession,
        steps: newSteps,
        lastMessage: step.content,
        status: step.type === 'error' ? 'error' : 'active'
      };
      updateChatSession(currentSession.id, updatedSession);
      setCurrentSession(updatedSession);
    }
  };

  if (checkingAuth) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0a0f", color: "#00ff88" }}>Loading...</div>;
  }

  if (!auth) {
    return <LoginPage onLogin={handleLogin} />;
  }

  let currentSection = "";
  return (
    <div className={`app ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo" onClick={() => setCollapsed(!collapsed)}>
            <span className="logo-icon">{"\u{1F432}"}</span>
            {!collapsed && <span className="logo-text">NewClaw</span>}
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((item) => {
            const showSection = item.section !== currentSection;
            if (showSection) currentSection = item.section;
            return (
              <div key={item.id}>
                {showSection && !collapsed && (
                  <div className="nav-section">{item.section}</div>
                )}
                <button
                  className={`nav-item ${page === item.id ? "active" : ""}`}
                  onClick={() => setPage(item.id)}
                  title={item.label}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {!collapsed && <span className="nav-label">{item.label}</span>}
                </button>
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          {!collapsed && (
            <>
              <div className="sidebar-status">
                <span className="status-dot green" />
                <span>{auth.role === "claude-leader" ? "Claude Leader" : "Coworker"}</span>
              </div>
              <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </>
          )}
        </div>
      </aside>
      <main className="main-content">
        {page === "hydra" && <AutoClawPage steps={hydraSteps} onStep={handleStepUpdate} running={isRunning} setRunning={setIsRunning} initialTask={currentSession?.task || ""} onTaskChange={handleTaskChange} />}
        {page === "channels" && <ChannelsPage />}
        {page === "agents" && <AgentsPage />}
        {page === "skills" && <SkillsPage />}
        {page === "nexus" && <NexusCortexPage />}
        {page === "debug" && <DebugPage />}
        {page === "settings" && <SettingsPage />}
        {page === "admin" && <AdminPage />}
      </main>
      <ChatHistory
        currentSession={currentSession}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
      />
    </div>
  );
}

export default App;
