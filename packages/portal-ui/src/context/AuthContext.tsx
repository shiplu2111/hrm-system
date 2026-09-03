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
  getPortalToken,
  portalLogin,
  type PortalKind,
} from '../lib/portal-auth';

interface AuthContextValue {
  portal: PortalKind;
  isAuthenticated: boolean;
  login: (email: string, password: string, tenantSubdomain?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  portal,
  children,
}: {
  portal: PortalKind;
  children: ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!getPortalToken(portal),
  );

  const login = useCallback(
    async (email: string, password: string, tenantSubdomain?: string) => {
      await portalLogin(portal, email, password, tenantSubdomain);
      setIsAuthenticated(true);
    },
    [portal],
  );

  const logout = useCallback(() => {
    clearPortalToken(portal);
    setIsAuthenticated(false);
  }, [portal]);

  const value = useMemo(
    () => ({ portal, isAuthenticated, login, logout }),
    [portal, isAuthenticated, login, logout],
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
