import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Send, Loader2, FileText, ExternalLink, Plus } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { ChatMessage, ContextChunk } from '@/services/api';
import { useTranslation } from 'react-i18next';

export default function ChatPage() {
  const { t, i18n } = useTranslation();
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
    clearError,
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

    const targetSessionId = currentSessionId;
    
    if (!targetSessionId) {
      useAppStore.setState({ error: t('chat.pleaseCreateSessionFirst') });
      return;
    }

    try {
      await sendMessage(targetSessionId, question);
    } catch {
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
      <header className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              {currentSession?.title || t('chat.newChat')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {currentProject ? `${t('chat.project')}: ${currentProject.name}` : t('chat.basedOnRAG')}
            </p>
          </div>
          {currentProjectId && (
            <button
              onClick={() => navigate(`/projects/${currentProjectId}/files`)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('chat.addKnowledge')}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6 bg-gray-50 dark:bg-gray-900">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/50 rounded-2xl flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
              {t('chat.startSmartQA')}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
              {t('chat.qaIntro')}
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-md w-full">
              <button
                onClick={() => setInput(t('chat.introduceSystem'))}
                className="p-3 text-left text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
              >
                {t('chat.introduceSystem')}
              </button>
              <button
                onClick={() => currentProjectId && navigate(`/projects/${currentProjectId}/files`)}
                className="p-3 text-left text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
              >
                {t('chat.uploadDocumentsFirst')}
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
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-4 h-4 text-primary-600 dark:text-primary-400 animate-spin" />
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{t('chat.retrievingKnowledgeBase')}</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chat.enterYourQuestion')}
                className="w-full px-4 py-3 pr-12 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
                rows={1}
                style={{ minHeight: '48px', maxHeight: '160px' }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 text-center">
            {t('chat.pressEnterToSend')}
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
  const { t } = useTranslation();
  const isUser = message.role === 'user';
  const hasChunks = message.context_chunks && message.context_chunks.length > 0;

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        </div>
      )}
      
      <div className={`max-w-2xl ${isUser ? 'order-first' : ''}`}>
        <div
          className={`px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-primary-600 text-white rounded-tr-md'
              : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-md shadow-sm border border-gray-100 dark:border-gray-700'
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
              className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              <span>
                {t('chat.referenceChunks', { count: message.context_chunks!.length })}
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
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-200">{t('chat.me')}</span>
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
  const { t } = useTranslation();
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            {chunk.document_name}
          </span>
        </div>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded ${
            chunk.score > 0.5
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : chunk.score > 0.3
              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          {t('chat.relevance')}: {formatScore(chunk.score)}
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3">
        {chunk.content}
      </p>
    </div>
  );
}
