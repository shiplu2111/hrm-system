import { X, PanelLeftClose, PanelLeft } from 'lucide-react';
import { adminNavItems } from '@/config/shell-navigation';
import { useNav, type PageKey } from '@/context/NavContext';
import { useCompany } from '@/context/CompanyContext';
import { useTenant } from '@/context/TenantContext';
import { AdminNavGroup } from '@/components/layout/AdminNavGroup';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const { current, navigate } = useNav();
  const { company } = useCompany();
  const { current: currentTenant } = useTenant();
  const companyName =
    currentTenant?.tenantName ?? company?.name ?? 'Company Admin';

  const handleNavigate = (page: PageKey) => {
    navigate(page);
    onCloseMobile();
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={`flex items-center gap-2.5 h-16 px-4 border-b border-base shrink-0 ${collapsed ? 'justify-center' : ''}`}>
        <div className="h-8 w-8 rounded-lg bg-accent-600 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none">
            <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M12 12L2 7m10 5l10-5m-10 5v10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-sm font-bold text-primary truncate">{companyName}</span>
            <span className="text-[10px] text-muted font-medium">Admin Portal</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3 space-y-0.5">
        {adminNavItems.map((item) => (
          <AdminNavGroup
            key={item.page}
            item={item}
            current={current}
            collapsed={collapsed}
            onNavigate={handleNavigate}
          />
        ))}
      </nav>

      {/* Collapse toggle (desktop) */}
      <div className="hidden lg:block border-t border-base p-2 shrink-0">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-sm text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))] transition-colors"
        >
          {collapsed ? <PanelLeft className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        className={`hidden lg:flex flex-col surface border-r border-base shrink-0 transition-all duration-200 ${
          collapsed ? 'w-[60px]' : 'w-60'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-fade-in" onClick={onCloseMobile} />
          <aside className="relative surface border-r border-base w-72 flex flex-col animate-slide-in-right">
            <button
              onClick={onCloseMobile}
              className="absolute top-4 right-3 text-muted hover:text-primary p-1 rounded-lg hover:bg-[rgb(var(--bg-hover))]"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
