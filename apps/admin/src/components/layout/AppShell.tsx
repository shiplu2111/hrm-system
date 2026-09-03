import type { ReactNode } from 'react';
import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { HelpWidget } from '@/components/support/HelpWidget';

export function AppShell({
  children,
  onLogout,
}: {
  children: ReactNode;
  onLogout: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
          {children}
          <footer className="px-6 py-4 text-center text-[10px] text-muted border-t border-base">
            Acme Corporation Company Admin · Powered by <span className="font-semibold text-accent-600">Nexus HR</span>
          </footer>
        </main>
      </div>
      <HelpWidget />
    </div>
  );
}
