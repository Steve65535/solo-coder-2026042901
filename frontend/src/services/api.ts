import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  content_type: string;
  created_at: string;
}

export interface ContextChunk {
  chunk_id: string;
  document_id: string;
  document_name: string;
  content: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  context_chunks?: ContextChunk[];
}

export interface AskRequest {
  session_id: string;
  question: string;
}

export interface AskResponse {
  answer: string;
  context_chunks: ContextChunk[];
  message_id: string;
}

export const healthCheck = () => api.get('/health');

export const createProject = (name: string, description?: string) => 
  api.post<Project>('/projects', { name, description });

export const getProject = (id: string) => 
  api.get<Project>(`/projects/${id}`);

export const listProjects = () => 
  api.get<{ projects: Project[]; total: number }>('/projects');

export const updateProject = (id: string, name?: string, description?: string) => 
  api.put<Project>(`/projects/${id}`, { name, description });

export const deleteProject = (id: string) => 
  api.delete(`/projects/${id}`);

export const createSession = (projectId: string, title?: string) => 
  api.post<Session>('/sessions', { project_id: projectId, title });

export const getSession = (id: string) => 
  api.get<Session>(`/sessions/${id}`);

export const listSessions = (projectId: string) => 
  api.get<{ sessions: Session[]; total: number }>(`/projects/${projectId}/sessions`);

export const deleteSession = (id: string) => 
  api.delete(`/sessions/${id}`);

export const uploadFile = (projectId: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<{ document: Document; chunk_count: number }>(`/projects/${projectId}/files/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const listFiles = (projectId: string) => 
  api.get<{ documents: Document[]; total: number }>(`/projects/${projectId}/files`);

export const deleteFile = (id: string) => 
  api.delete(`/files/${id}`);

export const askQuestion = (request: AskRequest) => 
  api.post<AskResponse>('/qa/ask', request);

export const getChatHistory = (sessionId: string) => 
  api.get<ChatMessage[]>(`/qa/history/${sessionId}`);

export default api;
