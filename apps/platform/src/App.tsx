import { useEffect, useState } from 'react';
import type { PlatformLoginSuccess, PlatformUserView } from '@hrm/shared-types';
import {
  clearPlatformAuth,
  fetchPlatformProfile,
  getPlatformAccessToken,
  getPlatformStoredUser,
  platformLogout,
} from '@/lib/api-client';
import { PlatformLoginPage } from '@/pages/auth/PlatformLoginPage';
import { PlatformShell } from '@/components/layout/PlatformShell';
import { PlatformTenantProvider } from '@/context/PlatformTenantContext';
import { PlatformAuthProvider } from '@/context/PlatformAuthContext';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('hrm_platform_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [currentUser, setCurrentUser] = useState<PlatformUserView | null>(() =>
    getPlatformStoredUser(),
  );
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    Boolean(getPlatformAccessToken()),
  );
  const [loading, setLoading] = useState<boolean>(true);

  // Sync theme class to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('hrm_platform_theme', theme);
  }, [theme]);

  // Validate session on mount
  useEffect(() => {
    const token = getPlatformAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    fetchPlatformProfile()
      .then((user) => {
        setCurrentUser(user);
        setIsAuthenticated(true);
      })
      .catch(() => {
        const stored = getPlatformStoredUser();
        if (stored) {
          setCurrentUser(stored);
          setIsAuthenticated(true);
        } else {
          clearPlatformAuth();
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Listen for session expired events
  useEffect(() => {
    const handleExpired = () => {
      setIsAuthenticated(false);
      setCurrentUser(null);
    };
    window.addEventListener('hrm:platform-session-expired', handleExpired);
    return () => {
      window.removeEventListener('hrm:platform-session-expired', handleExpired);
    };
  }, []);

  const handleLoginSuccess = (bundle: PlatformLoginSuccess) => {
    setCurrentUser(bundle.user);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await platformLogout();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="h-10 w-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-xs font-mono tracking-wider text-slate-300">
          INITIALIZING PLATFORM CONSOLE...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <PlatformLoginPage
        onLoginSuccess={handleLoginSuccess}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <PlatformAuthProvider
      user={currentUser}
      setUser={setCurrentUser}
      logout={handleLogout}
    >
      <PlatformTenantProvider>
        <PlatformShell
          currentUser={currentUser}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={toggleTheme}
          onProfileUpdated={(user) => setCurrentUser(user)}
        />
      </PlatformTenantProvider>
    </PlatformAuthProvider>
  );
}
