export { ThemeProvider, useTheme } from './context/ThemeContext';
export { AuthProvider, useAuth } from './context/AuthContext';
export { PortalLoginPage } from './auth/PortalLoginPage';
export {
  ApiError,
  assertPortalAccess,
  clearPortalToken,
  ensurePortalLogin,
  getPortalSession,
  getPortalToken,
  isAdminPortalUser,
  isEmployeePortalUser,
  portalApiRequest,
  portalLogin,
  setPortalToken,
  validatePortalSession,
  type PermissionClaim,
  type PortalKind,
  type PortalSessionUser,
} from './lib/portal-auth';

export { Button } from './components/ui/Button';
export { Badge } from './components/ui/Badge';
export { Card, CardHeader, CardTitle, CardBody } from './components/ui/Card';
export { Modal } from './components/ui/Modal';
export { Input, Label, Select, Textarea } from './components/ui/Form';
export {
  Dropdown,
  DropdownItem,
  DropdownDivider,
  DropdownHeader,
  DropdownSection,
} from './components/ui/Dropdown';
export { Progress, ProgressBar } from './components/ui/Progress';
export { Toggle, Avatar } from './components/ui/Toggle';
