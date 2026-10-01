import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  SESSION_EXPIRED_EVENT,
  clearPortalToken,
  getPortalToken,
  getPortalTokenKey,
  portalChangePassword,
  portalLogin,
  validatePortalSession,
  type PortalKind,
  type PortalSessionUser,
} from '../lib/portal-auth';

interface AuthContextValue {
  portal: PortalKind;
  isAuthenticated: boolean;
  user: PortalSessionUser | null;
  login: (email: string, password: string, tenantSubdomain?: string) => Promise<void>;
  logout: () => void;
  refreshSession: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  portal,
  children,
}: {
  portal: PortalKind;
  children: ReactNode;
}) {
  const [user, setUser] = useState<PortalSessionUser | null>(() =>
    validatePortalSession(portal),
  );
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!user);

  const login = useCallback(
    async (email: string, password: string, tenantSubdomain?: string) => {
      await portalLogin(portal, email, password, tenantSubdomain);
      const session = validatePortalSession(portal);
      setUser(session);
      setIsAuthenticated(!!session);
    },
    [portal],
  );

  const logout = useCallback(() => {
    clearPortalToken(portal);
    setUser(null);
    setIsAuthenticated(false);
  }, [portal]);

  const refreshSession = useCallback(() => {
    const session = validatePortalSession(portal);
    setUser(session);
    setIsAuthenticated(!!session);
  }, [portal]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await portalChangePassword(portal, currentPassword, newPassword);
      refreshSession();
    },
    [portal, refreshSession],
  );

  useEffect(() => {
    const onSessionExpired = (event: Event) => {
      const detail = (event as CustomEvent<{ portal: PortalKind }>).detail;
      if (detail?.portal === portal) logout();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === getPortalTokenKey(portal)) {
        if (!getPortalToken(portal)) logout();
      }
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
      window.removeEventListener('storage', onStorage);
    };
  }, [portal, logout]);

  const value = useMemo(
    () => ({ portal, isAuthenticated, user, login, logout, refreshSession, changePassword }),
    [portal, isAuthenticated, user, login, logout, refreshSession, changePassword],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
