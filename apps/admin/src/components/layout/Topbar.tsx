import {
  Menu,
  Search,
  Sun,
  Moon,
  ChevronDown,
  User,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@hrm/portal-ui';
import { useTheme } from '@/context/ThemeContext';
import { useNav } from '@/context/NavContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useTenant } from '@/context/TenantContext';
import {
  Dropdown,
  DropdownItem,
  DropdownDivider,
  DropdownHeader,
} from '@/components/ui/Dropdown';
import { Avatar } from '@/components/ui/Toggle';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { OrganizationSwitcher } from '@/components/layout/OrganizationSwitcher';
import { PermissionGate } from '@hrm/portal-ui';
import type { InAppNotificationRecord } from '@hrm/shared-types';

function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function Topbar({
  onOpenMobile,
  onLogout,
}: {
  onOpenMobile: () => void;
  onLogout: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { navigate } = useNav();
  const { sessionVersion } = useTenant();
  const notifications = useNotifications(sessionVersion);

  const displayName = user?.email
    ? displayNameFromEmail(user.email)
    : 'User';
  const roleLabel = user?.roleName || 'Admin';

  const handleNotificationSelect = async (n: InAppNotificationRecord) => {
    if (!n.readAt) {
      await notifications.markRead(n.id);
    }
  };

  const handleOrganizationSwitched = () => {
    navigate('dashboard');
    void notifications.refresh();
  };

  return (
    <header className="h-14 surface border-b border-base flex items-center gap-2 px-4 lg:px-6 shrink-0 z-30">
      <button
        type="button"
        onClick={onOpenMobile}
        className="lg:hidden text-secondary hover:text-primary p-1.5 rounded-lg hover:bg-[rgb(var(--bg-hover))]"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="search"
            placeholder="Search employees, departments, reports…"
            className="w-full h-9 pl-9 pr-16 rounded-lg border border-base surface text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-colors"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted border border-base rounded px-1.5 py-0.5 surface">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex-1 md:hidden" />

      <button
        type="button"
        onClick={toggleTheme}
        className="text-secondary hover:text-primary p-2 rounded-lg hover:bg-[rgb(var(--bg-hover))] transition-colors"
        title="Toggle theme"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? (
          <Moon className="h-[18px] w-[18px]" />
        ) : (
          <Sun className="h-[18px] w-[18px]" />
        )}
      </button>

      <NotificationBell
        items={notifications.items}
        unreadCount={notifications.unreadCount}
        loading={notifications.loading}
        error={notifications.error}
        onOpen={() => void notifications.refresh()}
        onSelect={handleNotificationSelect}
        onMarkAllRead={() => void notifications.markAllRead()}
      />

      <OrganizationSwitcher onSwitched={handleOrganizationSwitched} />

      <Dropdown
        width="w-56"
        trigger={
          <div className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-[rgb(var(--bg-hover))] transition-colors cursor-pointer">
            <Avatar name={displayName} size="sm" />
            <div className="hidden sm:flex flex-col leading-tight text-left min-w-0">
              <span className="text-sm font-medium text-primary truncate max-w-[140px]">
                {displayName}
              </span>
              <span className="text-[10px] text-muted truncate max-w-[140px]">
                {roleLabel}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted hidden sm:block shrink-0" />
          </div>
        }
      >
        <DropdownHeader>
          <div className="flex items-center gap-2.5">
            <Avatar name={displayName} size="md" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-primary truncate">
                {displayName}
              </div>
              <div className="text-xs text-muted truncate">{user?.email}</div>
            </div>
          </div>
        </DropdownHeader>
        <DropdownDivider />
        <PermissionGate module="settings" action="view">
          <DropdownItem
            icon={<User className="h-4 w-4" />}
            onClick={() => navigate('settings-general')}
          >
            Profile
          </DropdownItem>
        </PermissionGate>
        <DropdownDivider />
        <DropdownItem icon={<LogOut className="h-4 w-4" />} onClick={onLogout}>
          Logout
        </DropdownItem>
      </Dropdown>
    </header>
  );
}
