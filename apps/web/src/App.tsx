import {
  AuthProvider,
  PortalLoginPage,
  ThemeProvider,
  useAuth,
} from '@hrm/portal-ui';
import { ESSPortalPage } from '@/pages/ess/ESSPortalPage';
import { HelpWidget } from '@/components/support/HelpWidget';

function EmployeeApp() {
  const { isAuthenticated, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <PortalLoginPage portal="employee" onLogin={login} />;
  }

  return (
    <>
      <ESSPortalPage onLogout={logout} />
      <HelpWidget />
    </>
  );
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
