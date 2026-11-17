import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { cardClass, inputClass, primaryButton } from '../styles';

const FIELDS = {
  name: { label: 'Full Name', type: 'text', placeholder: 'John Doe' },
  email: { label: 'Email Address', type: 'email', placeholder: 'you@example.com' },
  password: { label: 'Password', type: 'password', placeholder: '••••••••' },
};

// Login and Register pages (FR-1, FR-2)
export default function Auth({ mode }) {
  const isLogin = mode === 'login';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const { user, authenticate, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) navigate(location.state?.from || '/', { replace: true });
  }, [user, navigate, location.state]);
  useEffect(() => clearError, [mode, clearError]);

  const handleSubmit = (e) => {
    e.preventDefault();
    authenticate(mode, form);
  };

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className={`w-full max-w-md p-8 ${cardClass}`}>
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">{isLogin ? 'Welcome back' : 'Create an account'}</h2>
        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2 mb-8">
          {isLogin ? 'Sign in to your NeoSetu account' : 'Join NeoSetu to start collaborating'}
        </p>

        {error && <div className="mb-4 p-3 rounded-lg text-sm text-center bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-500">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          {(isLogin ? ['email', 'password'] : ['name', 'email', 'password']).map((field) => (
            <label key={field} className="block">
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{FIELDS[field].label}</span>
              <input
                {...FIELDS[field]} required minLength={!isLogin && field === 'password' ? 6 : undefined}
                value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} className={inputClass}
              />
            </label>
          ))}
          <button type="submit" disabled={isLoading} className={primaryButton}>
            {isLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <Link to={isLogin ? '/register' : '/login'} state={location.state} className="font-medium text-black dark:text-white hover:underline">
            {isLogin ? 'Create one' : 'Sign in'}
          </Link>
        </p>
      </div>
    </div>
  );
}
