// Chat context persistence utilities using localStorage

export interface ChatSession {
  id: string;
  title: string;
  aiModel: string;
  timestamp: Date;
  steps: any[];
  status: 'active' | 'completed' | 'error';
  lastMessage?: string;
  task?: string;
}

export interface ChatContext {
  sessions: ChatSession[];
  currentSessionId?: string;
}

const STORAGE_KEY = 'moltworker_chat_contexts';

// Get all stored chat contexts
export function getStoredContexts(): ChatContext {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert timestamp strings back to Date objects
      parsed.sessions = parsed.sessions.map((session: any) => ({
        ...session,
        timestamp: new Date(session.timestamp)
      }));
      return parsed;
    }
  } catch (error) {
    console.error('Error loading chat contexts:', error);
  }
  return { sessions: [] };
}

// Save chat contexts to localStorage
export function saveContexts(contexts: ChatContext): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contexts));
  } catch (error) {
    console.error('Error saving chat contexts:', error);
  }
}

// Create a new chat session
export function createChatSession(title: string, aiModel: string): ChatSession {
  return {
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title,
    aiModel,
    timestamp: new Date(),
    steps: [],
    status: 'active'
  };
}

// Add a session to stored contexts
export function addChatSession(session: ChatSession): void {
  const contexts = getStoredContexts();
  contexts.sessions.unshift(session); // Add to beginning
  contexts.currentSessionId = session.id;
  saveContexts(contexts);
}

// Update an existing session
export function updateChatSession(sessionId: string, updates: Partial<ChatSession>): void {
  const contexts = getStoredContexts();
  const sessionIndex = contexts.sessions.findIndex(s => s.id === sessionId);
  if (sessionIndex !== -1) {
    contexts.sessions[sessionIndex] = { ...contexts.sessions[sessionIndex], ...updates };
    saveContexts(contexts);
  }
}

// Delete a session
export function deleteChatSession(sessionId: string): void {
  const contexts = getStoredContexts();
  contexts.sessions = contexts.sessions.filter(s => s.id !== sessionId);
  if (contexts.currentSessionId === sessionId) {
    contexts.currentSessionId = contexts.sessions[0]?.id;
  }
  saveContexts(contexts);
}

// Get current session
export function getCurrentSession(): ChatSession | null {
  const contexts = getStoredContexts();
  if (contexts.currentSessionId) {
    return contexts.sessions.find(s => s.id === contexts.currentSessionId) || null;
  }
  return contexts.sessions[0] || null;
}

// Set current session
export function setCurrentSession(sessionId: string): void {
  const contexts = getStoredContexts();
  contexts.currentSessionId = sessionId;
  saveContexts(contexts);
}

// Clear all stored contexts
export function clearAllContexts(): void {
  localStorage.removeItem(STORAGE_KEY);
}