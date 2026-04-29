import { Outlet, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { MessageSquare, FileText, Plus, Trash2, Loader2, Folder, X, ChevronDown, ChevronRight, Sun, Moon, Globe } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export default function MainLayout() {
  const { t, i18n } = useTranslation();
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
    clearError,
    theme,
    toggleTheme
  } = useAppStore();
  
  const [createLoading, setCreateLoading] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const newProjectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProjects();
  }, []);

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

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    if (shouldBeDark && theme !== 'dark') {
      useAppStore.setState({ theme: 'dark' });
    } else if (!shouldBeDark && theme !== 'light') {
      useAppStore.setState({ theme: 'light' });
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleNewChat = async () => {
    let targetProjectId = urlProjectId;
    
    if (targetProjectId === 'default' && projects.length > 0) {
      targetProjectId = projects[0].id;
    }
    
    if (!targetProjectId || targetProjectId === 'default') {
      return;
    }
    
    setCreateLoading(true);
    try {
      const sessionId = await createSession(targetProjectId);
      navigate(`/projects/${targetProjectId}/session/${sessionId}`);
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

  const toggleLanguage = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm(t('layout.deleteProjectConfirm'))) {
      await deleteProject(id);
      if (projects.length <= 1) {
        navigate('/projects');
      }
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm(t('layout.deleteSessionConfirm'))) {
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

    if (diffMins < 1) return t('layout.justNow');
    if (diffMins < 60) return t('layout.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('layout.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('layout.daysAgo', { count: diffDays });
    
    return date.toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : 'en-US');
  };

  const isInFilesPage = location.pathname.includes('/files');
  const isInChatPage = !isInFilesPage;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-96 max-w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('modals.newProject')}</h3>
              <button
                onClick={() => setShowNewProjectModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('modals.projectName')}
                </label>
                <input
                  ref={newProjectInputRef}
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                  placeholder={t('modals.enterProjectName')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('modals.projectDescription')}
                </label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder={t('modals.enterProjectDescription')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowNewProjectModal(false)}
                  className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={createLoading || !newProjectName.trim()}
                  className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {createLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('common.create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <aside className="w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('layout.appName')}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleLanguage}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={i18n.language === 'zh' ? t('layout.switchToEnglish') : t('layout.switchToChinese')}
            >
              <Globe className="w-5 h-5" />
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={theme === 'light' ? t('layout.switchToDark') : t('layout.switchToLight')}
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
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
            {t('layout.newChat')}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin p-2">
          <div className="mb-4">
            <Link
              to={currentProjectId ? `/projects/${currentProjectId}` : '/projects'}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isInChatPage
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm font-medium">{t('layout.chat')}</span>
            </Link>
            <Link
              to={currentProjectId ? `/projects/${currentProjectId}/files` : '/projects'}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isInFilesPage
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="text-sm font-medium">{t('layout.knowledgeBase')}</span>
            </Link>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {t('layout.projects')}
              </span>
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                title={t('layout.newProject')}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {isLoading && projects.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 text-gray-400 dark:text-gray-500 animate-spin" />
              </div>
            ) : projects.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">{t('layout.noProjects')}</p>
            ) : (
              projects.map((project) => (
                <div key={project.id}>
                  <div
                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      currentProjectId === project.id
                        ? 'bg-gray-100 dark:bg-gray-700'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                    onClick={() => selectProject(project.id)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleProject(project.id);
                      }}
                      className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-0.5"
                    >
                      {expandedProjects.has(project.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    <Folder className={`w-4 h-4 flex-shrink-0 ${
                      currentProjectId === project.id ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                        {project.name}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {project.description || t('placeholders.noDescription')}
                      </p>
                    </div>
                    {projects.length > 1 && (
                      <button
                        onClick={(e) => handleDeleteProject(e, project.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-opacity"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {expandedProjects.has(project.id) && (
                    <div className="ml-6 mt-1 space-y-0.5">
                      <div className="px-3 py-1 text-xs text-gray-400 dark:text-gray-500">
                        {t('layout.historySessions')}
                      </div>
                      {currentProjectId === project.id && isLoading && sessions.length === 0 ? (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="w-4 h-4 text-gray-400 dark:text-gray-500 animate-spin" />
                        </div>
                      ) : currentProjectId === project.id && sessions.length === 0 ? (
                        <p className="px-3 py-1 text-xs text-gray-400 dark:text-gray-500">{t('layout.noSessions')}</p>
                      ) : currentProjectId === project.id ? (
                        sessions.map((session) => (
                          <div
                            key={session.id}
                            className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                              currentSessionId === session.id
                                ? 'bg-gray-100 dark:bg-gray-700'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                            onClick={() => navigate(`/projects/${project.id}/session/${session.id}`)}
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                {session.title}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                {formatDate(session.updated_at)}
                              </p>
                            </div>
                            <button
                              onClick={(e) => handleDeleteSession(e, session.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-opacity"
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

        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
          <div className="text-xs text-gray-400 dark:text-gray-500">
            v0.1
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800 flex items-center justify-between">
            <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
            <button
              onClick={clearError}
              className="text-sm text-red-400 hover:text-red-600 dark:hover:text-red-300"
            >
              {t('common.close')}
            </button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
