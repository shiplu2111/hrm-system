import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  clearPortalToken,
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

  const value = useMemo(
    () => ({ portal, isAuthenticated, user, login, logout, refreshSession }),
    [portal, isAuthenticated, user, login, logout, refreshSession],
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
