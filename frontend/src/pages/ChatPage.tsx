import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Send, Loader2, FileText, ExternalLink, Plus } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { ChatMessage, ContextChunk } from '@/services/api';

export default function ChatPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const {
    currentProjectId,
    currentSessionId,
    messages,
    loadMessages,
    sendMessage,
    createSession,
    isLoading,
    sessions,
    projects,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());

  const currentProject = projects.find((p) => p.id === currentProjectId);
  const currentSession = sessions.find((s) => s.id === currentSessionId);

  useEffect(() => {
    if (sessionId && sessionId !== currentSessionId) {
      loadMessages(sessionId);
    }
  }, [sessionId, currentSessionId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const question = input.trim();
    setInput('');

    let targetSessionId = currentSessionId;
    const targetProjectId = currentProjectId;
    
    if (!targetSessionId && targetProjectId) {
      try {
        targetSessionId = await createSession(targetProjectId, question.slice(0, 30));
        navigate(`/projects/${targetProjectId}/session/${targetSessionId}`);
      } catch {
        return;
      }
    }

    if (targetSessionId) {
      try {
        await sendMessage(targetSessionId, question);
      } catch {
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleChunks = (messageId: string) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const formatScore = (score: number) => {
    return (score * 100).toFixed(1) + '%';
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <header className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">
              {currentSession?.title || '新建对话'}
            </h1>
            <p className="text-sm text-gray-500">
              {currentProject ? `项目: ${currentProject.name}` : '基于 RAG 技术的智能知识问答'}
            </p>
          </div>
          {currentProjectId && (
            <button
              onClick={() => navigate(`/projects/${currentProjectId}/files`)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加知识
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              开始智能问答
            </h2>
            <p className="text-gray-500 max-w-md mb-6">
              上传文档到当前项目的知识库后，我可以基于文档内容回答您的问题。
              支持混合召回和智能排序，为您提供最相关的答案。
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-md w-full">
              <button
                onClick={() => setInput('请介绍一下系统的功能')}
                className="p-3 text-left text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                请介绍一下系统的功能
              </button>
              <button
                onClick={() => currentProjectId && navigate(`/projects/${currentProjectId}/files`)}
                className="p-3 text-left text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                先上传一些文档
              </button>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessageComponent
              key={message.id}
              message={message}
              showChunks={expandedChunks.has(message.id)}
              onToggleChunks={() => toggleChunks(message.id)}
              formatScore={formatScore}
            />
          ))
        )}
        
        {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-4 h-4 text-primary-600 animate-spin" />
            </div>
            <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">正在检索知识库...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入您的问题..."
                className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-gray-400"
                rows={1}
                style={{ minHeight: '48px', maxHeight: '160px' }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400 text-center">
            按 Enter 发送，Shift+Enter 换行
          </p>
        </div>
      </div>
    </div>
  );
}

interface ChatMessageComponentProps {
  message: ChatMessage;
  showChunks: boolean;
  onToggleChunks: () => void;
  formatScore: (score: number) => string;
}

function ChatMessageComponent({ message, showChunks, onToggleChunks, formatScore }: ChatMessageComponentProps) {
  const isUser = message.role === 'user';
  const hasChunks = message.context_chunks && message.context_chunks.length > 0;

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-primary-600" />
        </div>
      )}
      
      <div className={`max-w-2xl ${isUser ? 'order-first' : ''}`}>
        <div
          className={`px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-primary-600 text-white rounded-tr-md'
              : 'bg-white text-gray-800 rounded-tl-md shadow-sm border border-gray-100'
          }`}
        >
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </div>
        </div>

        {hasChunks && (
          <div className="mt-2">
            <button
              onClick={onToggleChunks}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              <span>
                参考 {message.context_chunks!.length} 个文档片段
              </span>
            </button>

            {showChunks && (
              <div className="mt-2 space-y-2">
                {message.context_chunks!.map((chunk, index) => (
                  <ContextChunkCard
                    key={`${message.id}-${index}`}
                    chunk={chunk}
                    formatScore={formatScore}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-gray-600">我</span>
        </div>
      )}
    </div>
  );
}

interface ContextChunkCardProps {
  chunk: ContextChunk;
  formatScore: (score: number) => string;
}

function ContextChunkCard({ chunk, formatScore }: ContextChunkCardProps) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-600">
            {chunk.document_name}
          </span>
        </div>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded ${
            chunk.score > 0.5
              ? 'bg-green-100 text-green-700'
              : chunk.score > 0.3
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          相关度: {formatScore(chunk.score)}
        </span>
      </div>
      <p className="text-xs text-gray-500 line-clamp-3">
        {chunk.content}
      </p>
    </div>
  );
}
