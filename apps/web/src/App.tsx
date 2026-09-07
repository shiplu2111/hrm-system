import {
  AuthProvider,
  ThemeProvider,
  isEmployeePortalUser,
  useAuth,
} from '@hrm/portal-ui';
import { useEffect } from 'react';
import { EmployeeLoginPage } from '@/pages/auth/EmployeeLoginPage';
import { ESSPortalPage } from '@/pages/ess/ESSPortalPage';

function EmployeeApp() {
  const { isAuthenticated, login, logout, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user && !isEmployeePortalUser(user)) {
      logout();
    }
  }, [isAuthenticated, user, logout]);

  if (!isAuthenticated) {
    return <EmployeeLoginPage onLogin={login} />;
  }

  return <ESSPortalPage onLogout={logout} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider portal="employee">
        <EmployeeApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
