import type { ReactNode } from 'react';
import { useState } from 'react';
import { ShieldOff } from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { HelpWidget } from '@/components/support/HelpWidget';
import { EmptyState } from '@/components/ui/EmptyState';
import { canViewPage } from '@/config/page-permissions';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
import { useTenant } from '@/context/TenantContext';

export function AppShell({
  children,
  onLogout,
}: {
  children: ReactNode;
  onLogout: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { current: currentTenant } = useTenant();
  const { company } = useCompany();
  const { current, navigate } = useNav();
  const { can } = usePermissions();
  const pageAllowed = canViewPage(current, can);
  const footerLabel =
    currentTenant?.tenantName ?? company?.name ?? 'Company Admin';

  return (
    <div className="flex h-screen overflow-hidden bg-[rgb(var(--bg-base))]">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onOpenMobile={() => setMobileOpen(true)} onLogout={onLogout} />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {pageAllowed ? (
            children
          ) : (
            <EmptyState
              icon={ShieldOff}
              title="You don't have access to this page"
              description="Your role doesn't include the permission this screen needs. Ask a Company Owner if you think this is a mistake."
              action={
                current !== 'dashboard' && canViewPage('dashboard', can)
                  ? { label: 'Go to dashboard', onClick: () => navigate('dashboard') }
                  : undefined
              }
            />
          )}
          <footer className="px-6 py-4 text-center text-[10px] text-muted border-t border-base">
            {footerLabel} · Powered by{' '}
            <span className="font-semibold text-accent-600">Nexus HR</span>
          </footer>
        </main>
      </div>
      {can('support', 'view') && <HelpWidget />}
    </div>
  );
}
