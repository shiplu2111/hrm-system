import type { ReactNode } from 'react';
import { useState } from 'react';
import { usePermissions } from '@hrm/portal-ui';
import { EmployeeShell } from '@/components/layout/employee/EmployeeShell';
import { ShellMainContent } from '@/components/layout/ShellMainContent';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { HelpWidget } from '@/components/support/HelpWidget';
import { useTenant } from '@/context/TenantContext';
import { usePageAccess } from '@/hooks/usePageAccess';
import { SupportAccessBanner } from '@/components/layout/SupportAccessBanner';
import { MaintenanceBanner } from '@/components/layout/MaintenanceBanner';

function AdminShell({
  children,
  onLogout,
}: {
  children: ReactNode;
  onLogout: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { tenantKey } = useTenant();
  const { can } = usePermissions();
  const { homePage } = usePageAccess();

  return (
    <div className="flex h-full overflow-hidden bg-[rgb(var(--bg-base))] flex-col">
      <div className="flex flex-1 overflow-hidden min-h-0">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar onOpenMobile={() => setMobileOpen(true)} onLogout={onLogout} />
          <ShellMainContent
            fallbackFooterLabel="Company Admin"
            homeActionLabel={
              homePage === 'dashboard' ? 'Go to dashboard' : 'Go to My Space'
            }
          >
            {children}
          </ShellMainContent>
        </div>
        {can('support', 'view') && <HelpWidget key={tenantKey} />}
      </div>
    </div>
  );
}

export function AppShell({
  children,
  onLogout,
}: {
  children: ReactNode;
  onLogout: () => void;
}) {
  const { selfServiceOnly } = usePageAccess();

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <MaintenanceBanner />
      <SupportAccessBanner />
      <div className="flex-1 min-h-0 overflow-hidden">
        {selfServiceOnly ? (
          <EmployeeShell onLogout={onLogout}>{children}</EmployeeShell>
        ) : (
          <AdminShell onLogout={onLogout}>{children}</AdminShell>
        )}
      </div>
    </div>
  );
}
