import { create } from 'zustand';
import { Project, Session, ChatMessage, Document } from '../services/api';
import * as api from '../services/api';

interface AppState {
  projects: Project[];
  currentProjectId: string | null;
  sessions: Session[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  documents: Document[];
  isLoading: boolean;
  error: string | null;
  
  setCurrentProjectId: (id: string | null) => void;
  loadProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<string>;
  updateProject: (id: string, name?: string, description?: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  
  setCurrentSessionId: (id: string | null) => void;
  loadSessions: (projectId: string) => Promise<void>;
  createSession: (projectId: string, title?: string) => Promise<string>;
  deleteSession: (id: string) => Promise<void>;
  
  loadMessages: (sessionId: string) => Promise<void>;
  sendMessage: (sessionId: string, question: string) => Promise<void>;
  
  loadDocuments: (projectId: string) => Promise<void>;
  uploadFile: (projectId: string, file: File) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  
  clearError: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  sessions: [],
  currentSessionId: null,
  messages: [],
  documents: [],
  isLoading: false,
  error: null,

  setCurrentProjectId: (id) => {
    set({ currentProjectId: id, sessions: [], currentSessionId: null, messages: [] });
  },

  loadProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.listProjects();
      const projects = response.data.projects;
      set({ projects });
      
      if (projects.length > 0 && !get().currentProjectId) {
        set({ currentProjectId: projects[0].id });
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || '加载项目列表失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  createProject: async (name, description) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.createProject(name, description);
      const newProject = response.data;
      set((state) => ({
        projects: [newProject, ...state.projects],
        currentProjectId: newProject.id,
        sessions: [],
        currentSessionId: null,
        messages: [],
        documents: [],
      }));
      return newProject.id;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || '创建项目失败' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateProject: async (id, name, description) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.updateProject(id, name, description);
      const updatedProject = response.data;
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? updatedProject : p
        ),
      }));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || '更新项目失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteProject: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteProject(id);
      set((state) => {
        const newProjects = state.projects.filter((p) => p.id !== id);
        const newCurrentId = state.currentProjectId === id 
          ? (newProjects.length > 0 ? newProjects[0].id : null)
          : state.currentProjectId;
        return {
          projects: newProjects,
          currentProjectId: newCurrentId,
          sessions: state.currentProjectId === id ? [] : state.sessions,
          currentSessionId: state.currentProjectId === id ? null : state.currentSessionId,
          messages: state.currentProjectId === id ? [] : state.messages,
          documents: state.currentProjectId === id ? [] : state.documents,
        };
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || '删除项目失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  setCurrentSessionId: (id) => set({ currentSessionId: id }),

  loadSessions: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.listSessions(projectId);
      
      set((state) => {
        if (state.currentProjectId !== projectId) {
          return {};
        }
        
        const serverSessions = response.data.sessions;
        const serverIds = new Set(serverSessions.map(s => s.id));
        
        const localOnlySessions = state.sessions.filter(s => !serverIds.has(s.id));
        
        const mergedSessions = [...serverSessions, ...localOnlySessions].sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        
        return { sessions: mergedSessions };
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || '加载会话列表失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  createSession: async (projectId, title) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.createSession(projectId, title);
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

  loadDocuments: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.listFiles(projectId);
      set({ documents: response.data.documents });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      set({ error: err.response?.data?.message || '加载文件列表失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  uploadFile: async (projectId, file) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.uploadFile(projectId, file);
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
