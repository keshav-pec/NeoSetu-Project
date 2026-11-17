import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Auth from './pages/Auth';
import History from './pages/History';
import MeetingRoom from './pages/MeetingRoom';
import { useAuthStore, useThemeStore } from './store';

// Sends logged-out users to the login page and brings them back afterwards
function RequireAuth({ children }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  return user ? children : <Navigate to="/login" state={{ from: location.pathname }} replace />;
}

function Layout() {
  const inMeeting = useLocation().pathname.startsWith('/room/');
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-200 transition-colors">
      {!inMeeting && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/register" element={<Auth mode="register" />} />
        <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
        <Route path="/room/:id" element={<RequireAuth><MeetingRoom /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <BrowserRouter>
      <Layout />
      <Toaster position="bottom-left" toastOptions={{ style: { background: '#1a1a1a', color: '#fff' } }} />
    </BrowserRouter>
  );
}
