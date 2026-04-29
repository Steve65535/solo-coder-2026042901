import { create } from 'zustand';
import { Session, ChatMessage, Document } from '../services/api';
import * as api from '../services/api';

interface AppState {
  sessions: Session[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  documents: Document[];
  isLoading: boolean;
  error: string | null;
  
  setCurrentSessionId: (id: string | null) => void;
  loadSessions: () => Promise<void>;
  createSession: (title?: string) => Promise<string>;
  deleteSession: (id: string) => Promise<void>;
  
  loadMessages: (sessionId: string) => Promise<void>;
  sendMessage: (sessionId: string, question: string) => Promise<void>;
  
  loadDocuments: () => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  
  clearError: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  documents: [],
  isLoading: false,
  error: null,

  setCurrentSessionId: (id) => set({ currentSessionId: id }),

  loadSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.listSessions();
      set({ sessions: response.data.sessions });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || '加载会话失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  createSession: async (title) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.createSession(title);
      const newSession = response.data;
      set((state) => ({
        sessions: [newSession, ...state.sessions],
        currentSessionId: newSession.id,
        messages: [],
      }));
      return newSession.id;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || '创建会话失败' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteSession: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteSession(id);
      set((state) => {
        const newSessions = state.sessions.filter((s) => s.id !== id);
        const newCurrentId = state.currentSessionId === id ? null : state.currentSessionId;
        const newMessages = state.currentSessionId === id ? [] : state.messages;
        return {
          sessions: newSessions,
          currentSessionId: newCurrentId,
          messages: newMessages,
        };
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || '删除会话失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  loadMessages: async (sessionId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getChatHistory(sessionId);
      set({ messages: response.data });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || '加载消息失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  sendMessage: async (sessionId, question) => {
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: 'user',
      content: question,
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      error: null,
    }));

    try {
      const response = await api.askQuestion({
        session_id: sessionId,
        question,
      });

      const assistantMessage: ChatMessage = {
        id: response.data.message_id,
        session_id: sessionId,
        role: 'assistant',
        content: response.data.answer,
        created_at: new Date().toISOString(),
        context_chunks: response.data.context_chunks,
      };

      set((state) => ({
        messages: [
          ...state.messages.filter((m) => m.id !== userMessage.id),
          { ...userMessage, id: `user-${Date.now()}` },
          assistantMessage,
        ],
      }));

      set((state) => {
        const session = state.sessions.find((s) => s.id === sessionId);
        if (session && session.title.startsWith('对话 ')) {
          const newTitle = question.length > 30 ? question.slice(0, 30) : question;
          return {
            sessions: state.sessions.map((s) =>
              s.id === sessionId ? { ...s, title: newTitle, updated_at: new Date().toISOString() } : s
            ),
          };
        }
        return {
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, updated_at: new Date().toISOString() } : s
          ),
        };
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== userMessage.id),
        error: err.response?.data?.message || '发送消息失败',
      }));
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  loadDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.listFiles();
      set({ documents: response.data.documents });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || '加载文件列表失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  uploadFile: async (file) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.uploadFile(file);
      set((state) => ({
        documents: [response.data.document, ...state.documents],
      }));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || '上传文件失败' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteDocument: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteFile(id);
      set((state) => ({
        documents: state.documents.filter((d) => d.id !== id),
      }));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || '删除文件失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
