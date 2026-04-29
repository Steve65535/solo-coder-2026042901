import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
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

export const createSession = (title?: string) => 
  api.post<Session>('/sessions', { title });

export const getSession = (id: string) => 
  api.get<Session>(`/sessions/${id}`);

export const listSessions = () => 
  api.get<{ sessions: Session[]; total: number }>('/sessions');

export const deleteSession = (id: string) => 
  api.delete(`/sessions/${id}`);

export const uploadFile = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<{ document: Document; chunk_count: number }>('/files/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const listFiles = () => 
  api.get<{ documents: Document[]; total: number }>('/files');

export const deleteFile = (id: string) => 
  api.delete(`/files/${id}`);

export const askQuestion = (request: AskRequest) => 
  api.post<AskResponse>('/qa/ask', request);

export const getChatHistory = (sessionId: string) => 
  api.get<ChatMessage[]>(`/qa/history/${sessionId}`);

export default api;
