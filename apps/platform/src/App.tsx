import {
  AuthProvider,
  PortalLoginPage,
  ThemeProvider,
  useAuth,
} from '@hrm/portal-ui';
import { PlatformControlPanelPage } from '@/pages/platform/PlatformControlPanelPage';

function PlatformApp() {
  const { isAuthenticated, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <PortalLoginPage portal="platform" onLogin={login} />;
  }

  return <PlatformControlPanelPage onLogout={logout} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider portal="platform">
        <PlatformApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
