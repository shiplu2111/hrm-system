import { Menu, Search, Sun, Moon } from 'lucide-react';
import type { InAppNotificationRecord } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { LanguageMenu } from '@/components/layout/LanguageMenu';
import { OrganizationSwitcher } from '@/components/layout/OrganizationSwitcher';
import { UserAvatarMenu } from '@/components/layout/UserAvatarMenu';
import { useNav } from '@/context/NavContext';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/context/ThemeContext';
import { useNotifications } from '@/hooks/useNotifications';
import { usePageAccess } from '@/hooks/usePageAccess';
import { resolveNotificationTargetPage } from '@/lib/notification-links';

export function Topbar({
  onOpenMobile,
  onLogout,
}: {
  onOpenMobile: () => void;
  onLogout: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useAppTranslation();
  const { navigate } = useNav();
  const { tenantKey } = useTenant();
  const { canView, selfServiceOnly } = usePageAccess();
  const notifications = useNotifications(tenantKey);

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
    <header className="h-14 surface border-b border-base flex items-center gap-2 px-4 lg:px-6 shrink-0 z-30">
      <button
        type="button"
        onClick={onOpenMobile}
        className="lg:hidden text-secondary hover:text-primary p-1.5 rounded-lg hover:bg-[rgb(var(--bg-hover))]"
        aria-label={t('shell.openNavigation')}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className={`flex-1 max-w-md hidden ${selfServiceOnly ? '' : 'md:block'}`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="search"
            placeholder={t('shell.searchPlaceholder')}
            className="w-full h-9 pl-9 pr-16 rounded-lg border border-base surface text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-colors"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted border border-base rounded px-1.5 py-0.5 surface">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="ml-auto">
        <LanguageMenu />
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        className="text-secondary hover:text-primary p-2 rounded-lg hover:bg-[rgb(var(--bg-hover))] transition-colors"
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

      <OrganizationSwitcher />

      <UserAvatarMenu onLogout={onLogout} />
    </header>
  );
}
