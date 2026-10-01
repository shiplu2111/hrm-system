import {
  AuthProvider,
  ThemeProvider,
  isEmployeePortalUser,
  useAuth,
} from '@hrm/portal-ui';
import { useEffect } from 'react';
import { EmployeeLoginPage } from '@/pages/auth/EmployeeLoginPage';
import { EmployeePasswordChangePage } from '@/pages/auth/EmployeePasswordChangePage';
import { ESSPortalPage } from '@/pages/ess/ESSPortalPage';

function EmployeeApp() {
  const { isAuthenticated, login, logout, user, changePassword } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user && !isEmployeePortalUser(user)) {
      logout();
    }
  }, [isAuthenticated, user, logout]);

  if (!isAuthenticated) {
    return <EmployeeLoginPage onLogin={login} />;
  }

  if (user?.mustChangePassword) {
    return (
      <EmployeePasswordChangePage
        email={user.email}
        onSubmit={changePassword}
        onSignOut={logout}
      />
    );
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
