import { Menu, Moon, Sun } from 'lucide-react';
import type { InAppNotificationRecord } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Badge } from '@/components/ui/Badge';
import { LanguageMenu } from '@/components/layout/LanguageMenu';
import { NotificationBell } from '@/components/layout/NotificationBell';
import {
  OrgLogo,
  OrganizationSwitcher,
} from '@/components/layout/OrganizationSwitcher';
import { UserAvatarMenu } from '@/components/layout/UserAvatarMenu';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/context/ThemeContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { usePageAccess } from '@/hooks/usePageAccess';
import { resolveNotificationTargetPage } from '@/lib/notification-links';

interface EmployeeTopHeaderProps {
  onOpenMobile: () => void;
  onLogout: () => void;
  notifications: {
    items: InAppNotificationRecord[];
    unreadCount: number;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    markRead: (id: string) => Promise<void>;
    markAllRead: () => Promise<void>;
  };
}

export function EmployeeTopHeader({
  onOpenMobile,
  onLogout,
  notifications,
}: EmployeeTopHeaderProps) {
  const { t } = useAppTranslation();
  const { theme, toggleTheme } = useTheme();
  const { current: currentTenant, memberships } = useTenant();
  const { company } = useCompany();
  const { navigate } = useNav();
  const { canView, selfServiceOnly } = usePageAccess();
  const online = useOnlineStatus();

  const companyName =
    currentTenant?.tenantName ?? company?.name ?? t('shell.employeePortal');

  const handleNotificationSelect = async (n: InAppNotificationRecord) => {
    if (!n.readAt) {
      await notifications.markRead(n.id);
    }
    const target = resolveNotificationTargetPage(n.eventType, {
      selfServiceOnly,
    });
    if (target && canView(target)) {
      navigate(target);
    }
  };

  return (
    <header className="h-14 surface border-b border-base flex items-center gap-2 px-3 sm:px-4 lg:px-6 shrink-0 z-30">
      <button
        type="button"
        onClick={onOpenMobile}
        className="lg:hidden text-secondary hover:text-primary min-h-[44px] min-w-[44px] -ml-1 flex items-center justify-center rounded-lg hover:bg-[rgb(var(--bg-hover))] transition-colors"
        aria-label={t('shell.openNavigation')}
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => navigate('my-dashboard')}
        className="flex items-center gap-2.5 min-w-0 rounded-lg py-1 pr-2 text-left hover:bg-[rgb(var(--bg-hover))] transition-colors"
      >
        <OrgLogo name={companyName} logoUrl={currentTenant?.logoUrl} size="md" />
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-sm font-bold text-primary truncate max-w-[160px] sm:max-w-[240px]">
            {companyName}
          </span>
          <span className="text-[10px] text-muted font-medium truncate">
            {t('shell.employeePortal')}
          </span>
        </div>
      </button>

      <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
        <span
          className="hidden sm:inline-flex"
          title={online ? t('shell.online') : t('shell.offlineHint')}
          aria-live="polite"
        >
          <Badge tone={online ? 'success' : 'warning'} dot>
            {online ? t('shell.online') : t('shell.offline')}
          </Badge>
        </span>

        {memberships.length > 1 && <OrganizationSwitcher />}

        <LanguageMenu />

        <button
          type="button"
          onClick={toggleTheme}
          className="text-secondary hover:text-primary p-2 rounded-lg hover:bg-[rgb(var(--bg-hover))] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
          title={t('shell.toggleTheme')}
          aria-label={t('shell.toggleTheme')}
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

        <UserAvatarMenu onLogout={onLogout} />
      </div>
    </header>
  );
}

