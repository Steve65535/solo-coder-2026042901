import { Outlet, Link, useLocation } from 'react-router-dom';
import { MessageSquare, FileText, Plus, Trash2, Loader2 } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { 
    sessions, 
    loadSessions, 
    createSession, 
    deleteSession,
    currentSessionId,
    setCurrentSessionId,
    isLoading,
    error,
    clearError
  } = useAppStore();
  
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const pathParts = location.pathname.split('/');
    if (pathParts[1] === 'session' && pathParts[2]) {
      setCurrentSessionId(pathParts[2]);
    }
  }, [location.pathname, setCurrentSessionId]);

  const handleNewChat = async () => {
    setCreateLoading(true);
    try {
      const sessionId = await createSession();
      navigate(`/session/${sessionId}`);
    } catch {
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这个会话吗？')) {
      await deleteSession(id);
      if (currentSessionId === id) {
        navigate('/');
      }
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-72 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <button
            onClick={handleNewChat}
            disabled={createLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {createLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            新建对话
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin p-2">
          <div className="mb-4">
            <Link
              to="/"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                location.pathname === '/' || location.pathname.startsWith('/session/')
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm font-medium">对话</span>
            </Link>
            <Link
              to="/files"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                location.pathname === '/files'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="text-sm font-medium">知识库</span>
            </Link>
          </div>

          <div className="space-y-1">
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              历史会话
            </div>
            {isLoading && sessions.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">暂无会话</p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    currentSessionId === session.id
                      ? 'bg-gray-100'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => navigate(`/session/${session.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {session.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(session.updated_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>智能问答系统 v0.1</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {error && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center justify-between">
            <span className="text-sm text-red-600">{error}</span>
            <button
              onClick={clearError}
              className="text-sm text-red-400 hover:text-red-600"
            >
              关闭
            </button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
