import { Outlet, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { MessageSquare, FileText, Plus, Trash2, Loader2, Folder, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useEffect, useState, useRef } from 'react';

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const urlProjectId = params.projectId;
  
  const { 
    projects,
    currentProjectId,
    setCurrentProjectId,
    loadProjects,
    createProject,
    deleteProject,
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
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const newProjectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (urlProjectId && urlProjectId !== 'default') {
      setCurrentProjectId(urlProjectId);
    } else if (urlProjectId === 'default' && projects.length > 0) {
      const firstProject = projects[0];
      navigate(`/projects/${firstProject.id}`, { replace: true });
      setCurrentProjectId(firstProject.id);
    }
  }, [urlProjectId, projects, setCurrentProjectId, navigate]);

  useEffect(() => {
    if (currentProjectId) {
      loadSessions(currentProjectId);
      if (!expandedProjects.has(currentProjectId)) {
        setExpandedProjects((prev) => new Set(prev).add(currentProjectId));
      }
    }
  }, [currentProjectId]);

  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const sessionIndex = pathParts.indexOf('session');
    if (sessionIndex !== -1 && pathParts[sessionIndex + 1]) {
      setCurrentSessionId(pathParts[sessionIndex + 1]);
    }
  }, [location.pathname, setCurrentSessionId]);

  const handleNewChat = async () => {
    if (!currentProjectId) return;
    
    setCreateLoading(true);
    try {
      const sessionId = await createSession(currentProjectId);
      navigate(`/projects/${currentProjectId}/session/${sessionId}`);
    } catch (error: unknown) {
      console.error('创建会话失败:', error);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    setCreateLoading(true);
    try {
      const projectId = await createProject(newProjectName.trim(), newProjectDescription.trim() || undefined);
      navigate(`/projects/${projectId}`);
      setShowNewProjectModal(false);
      setNewProjectName('');
      setNewProjectDescription('');
    } catch (error: unknown) {
      console.error('创建项目失败:', error);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这个项目吗？该项目下的所有会话和文档也将被删除。')) {
      await deleteProject(id);
      if (projects.length <= 1) {
        navigate('/projects');
      }
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这个会话吗？')) {
      await deleteSession(id);
      if (currentSessionId === id && currentProjectId) {
        navigate(`/projects/${currentProjectId}`);
      }
    }
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const selectProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
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

  const isInFilesPage = location.pathname.includes('/files');
  const isInChatPage = !isInFilesPage;

  return (
    <div className="flex h-screen bg-gray-50">
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96 max-w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">新建项目</h3>
              <button
                onClick={() => setShowNewProjectModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  项目名称
                </label>
                <input
                  ref={newProjectInputRef}
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                  placeholder="输入项目名称..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述（可选）
                </label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="输入项目描述..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowNewProjectModal(false)}
                  className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={createLoading || !newProjectName.trim()}
                  className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {createLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <aside className="w-72 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <button
            onClick={handleNewChat}
            disabled={createLoading || !currentProjectId}
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
              to={currentProjectId ? `/projects/${currentProjectId}` : '/projects'}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isInChatPage
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm font-medium">对话</span>
            </Link>
            <Link
              to={currentProjectId ? `/projects/${currentProjectId}/files` : '/projects'}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isInFilesPage
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="text-sm font-medium">知识库</span>
            </Link>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                项目
              </span>
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="text-gray-400 hover:text-gray-600 p-1"
                title="新建项目"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {isLoading && projects.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : projects.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">暂无项目</p>
            ) : (
              projects.map((project) => (
                <div key={project.id}>
                  <div
                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      currentProjectId === project.id
                        ? 'bg-gray-100'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => selectProject(project.id)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleProject(project.id);
                      }}
                      className="text-gray-400 hover:text-gray-600 p-0.5"
                    >
                      {expandedProjects.has(project.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    <Folder className={`w-4 h-4 flex-shrink-0 ${
                      currentProjectId === project.id ? 'text-primary-600' : 'text-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {project.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {project.description || '无描述'}
                      </p>
                    </div>
                    {projects.length > 1 && (
                      <button
                        onClick={(e) => handleDeleteProject(e, project.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                        title="删除项目"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {expandedProjects.has(project.id) && (
                    <div className="ml-6 mt-1 space-y-0.5">
                      <div className="px-3 py-1 text-xs text-gray-400">
                        历史会话
                      </div>
                      {currentProjectId === project.id && isLoading && sessions.length === 0 ? (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                        </div>
                      ) : currentProjectId === project.id && sessions.length === 0 ? (
                        <p className="px-3 py-1 text-xs text-gray-400">暂无会话</p>
                      ) : currentProjectId === project.id ? (
                        sessions.map((session) => (
                          <div
                            key={session.id}
                            className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                              currentSessionId === session.id
                                ? 'bg-gray-100'
                                : 'hover:bg-gray-50'
                            }`}
                            onClick={() => navigate(`/projects/${project.id}/session/${session.id}`)}
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700 truncate">
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
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))
                      ) : null}
                    </div>
                  )}
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
