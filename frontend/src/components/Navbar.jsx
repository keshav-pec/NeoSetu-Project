import { Link } from 'react-router-dom';
import { Moon, Sun, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore, useThemeStore } from '../store';

const linkClass = 'text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  return (
    <nav className="sticky top-0 z-40 h-16 px-6 flex items-center justify-between bg-white/70 dark:bg-black/40 backdrop-blur-md border-b border-gray-200 dark:border-white/5">
      <Link to="/" className="flex items-center gap-2 text-xl font-semibold text-black dark:text-white">
        <Video className="text-cyan-500" size={22} /> NeoSetu
      </Link>
      <div className="flex gap-4 items-center">
        <button onClick={toggleTheme} className="p-2 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20" aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        {user ? (
          <>
            <Link to="/history" className={linkClass}>History</Link>
            <button
              onClick={() => { logout(); toast.success('Logged out'); }}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className={linkClass}>Log in</Link>
            <Link to="/register" className="text-sm font-medium px-4 py-2 rounded-lg bg-black dark:bg-white/10 text-white hover:bg-gray-800 dark:hover:bg-white/20">Sign up</Link>
          </>
        )}
      </div>
    </nav>
  );
}
