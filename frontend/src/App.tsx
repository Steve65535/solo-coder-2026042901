import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import ChatPage from './pages/ChatPage';
import FilesPage from './pages/FilesPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route element={<MainLayout />}>
        <Route path="/projects" element={<Navigate to="/projects/default" replace />} />
        <Route path="/projects/:projectId" element={<ChatPage />} />
        <Route path="/projects/:projectId/session/:sessionId" element={<ChatPage />} />
        <Route path="/projects/:projectId/files" element={<FilesPage />} />
      </Route>
    </Routes>
  );
}

export default App;
