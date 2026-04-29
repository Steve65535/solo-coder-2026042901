import { Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import ChatPage from './pages/ChatPage';
import FilesPage from './pages/FilesPage';

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<ChatPage />} />
        <Route path="/session/:sessionId" element={<ChatPage />} />
        <Route path="/files" element={<FilesPage />} />
      </Route>
    </Routes>
  );
}

export default App;
