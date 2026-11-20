import type { ReactNode } from 'react';
import { useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useAppTranslation } from '@hrm/i18n';
import { usePermissions } from '@hrm/portal-ui';
import { ShellMainContent } from '@/components/layout/ShellMainContent';
import { EmployeeBottomNav } from '@/components/layout/employee/EmployeeBottomNav';
import { EmployeeNavRail } from '@/components/layout/employee/EmployeeNavRail';
import { EmployeeTopHeader } from '@/components/layout/employee/EmployeeTopHeader';
import { HelpWidget } from '@/components/support/HelpWidget';
import { useTenant } from '@/context/TenantContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function EmployeeShell({
  children,
  onLogout,
}: {
  children: ReactNode;
  onLogout: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useAppTranslation();
  const { tenantKey } = useTenant();
  const { can } = usePermissions();
  const online = useOnlineStatus();
  const notifications = useNotifications(tenantKey);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[rgb(var(--bg-base))]">
      <EmployeeTopHeader
        onOpenMobile={() => setMobileOpen(true)}
        onLogout={onLogout}
        notifications={notifications}
      />

      {!online && (
        <div
          role="status"
          className="bg-warning-50 border-b border-warning-200 text-warning-800 dark:bg-warning-950/40 dark:border-warning-800/60 dark:text-warning-300 px-4 py-1.5 text-xs flex items-center justify-center gap-2 shrink-0"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>{t('shell.offlineHint')}</span>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        <EmployeeNavRail
          unreadNotifications={notifications.unreadCount}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <ShellMainContent
          className="pb-20 lg:pb-0"
          fallbackFooterLabel={t('shell.employeePortal')}
          homeActionLabel={t('nav.home', 'Home')}
        >
          {children}
        </ShellMainContent>
      </div>

      <EmployeeBottomNav />
      {can('support', 'view') && <HelpWidget key={tenantKey} />}
    </div>
  );
}