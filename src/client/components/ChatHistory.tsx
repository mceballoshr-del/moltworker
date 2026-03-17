import React, { useState, useEffect } from 'react';
import {
  getStoredContexts,
  ChatSession,
  setCurrentSession,
  deleteChatSession,
  createChatSession
} from '../utils/chatStorage';
import './ChatHistory.css';

interface ChatHistoryProps {
  currentSession: ChatSession | null;
  onSessionSelect: (session: ChatSession) => void;
  onNewSession: () => void;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({
  currentSession,
  onSessionSelect,
  onNewSession
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = () => {
    const contexts = getStoredContexts();
    setSessions(contexts.sessions);
  };

  const handleSessionClick = (session: ChatSession) => {
    setCurrentSession(session.id);
    onSessionSelect(session);
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (window.confirm('¿Eliminar esta conversación?')) {
      deleteChatSession(sessionId);
      loadSessions();
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleString('es-ES', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '🔄';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '💬';
    }
  };

  return (
    <div className={`chat-history ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="chat-history-header">
        <h3>💬 Conversaciones</h3>
        <button
          className="collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? '▶' : '◀'}
        </button>
      </div>

      {!isCollapsed && (
        <div className="chat-history-content">
          <button className="new-chat-btn" onClick={onNewSession}>
            ➕ Nueva Conversación
          </button>

          <div className="sessions-list">
            {sessions.length === 0 ? (
              <div className="no-sessions">
                <p>No hay conversaciones guardadas</p>
                <small>Haz clic en "Nueva Conversación" para empezar</small>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={`session-item ${currentSession?.id === session.id ? 'active' : ''}`}
                  onClick={() => handleSessionClick(session)}
                >
                  <div className="session-header">
                    <span className="session-icon">{getStatusIcon(session.status)}</span>
                    <span className="session-title">{session.title}</span>
                    <button
                      className="delete-btn"
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      title="Eliminar conversación"
                    >
                      🗑️
                    </button>
                  </div>
                  <div className="session-meta">
                    <span className="session-model">{session.aiModel}</span>
                    <span className="session-time">{formatTimestamp(session.timestamp)}</span>
                  </div>
                  {session.lastMessage && (
                    <div className="session-preview">
                      {session.lastMessage.length > 50
                        ? `${session.lastMessage.substring(0, 50)}...`
                        : session.lastMessage}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHistory;