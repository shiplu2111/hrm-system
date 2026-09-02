import { useState } from 'react';
import { ChevronDown, ChevronRight, X, PanelLeftClose, PanelLeft } from 'lucide-react';
import { navGroups } from '@/config/navigation';
import { useNav, type PageKey } from '@/context/NavContext';
import { Badge } from '@/components/ui/Badge';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const { current, navigate } = useNav();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['Dashboard', 'Organization', 'Settings'])
  );

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

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
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-primary">Acme Corporation</span>
            <span className="text-[10px] text-muted font-medium">Company Admin</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3 space-y-0.5">
        {navGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.label) || collapsed;
          const hasActive = group.items.some((i) => i.page === current);
          const Icon = group.icon;

          if (collapsed) {
            return (
              <div key={group.label} className="relative group">
                <button
                  onClick={() => {
                    if (group.items.length === 1) {
                      handleNavigate(group.items[0].page);
                    } else {
                      onToggleCollapse();
                    }
                  }}
                  className={`w-full flex items-center justify-center h-9 rounded-lg transition-colors ${
                    hasActive ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300' : 'text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'
                  }`}
                  title={group.label}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </button>
              </div>
            );
          }

          return (
            <div key={group.label}>
              <button
                onClick={() => (group.items.length === 1 ? handleNavigate(group.items[0].page) : toggleGroup(group.label))}
                className={`w-full flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-sm font-medium transition-colors ${
                  hasActive ? 'text-primary' : 'text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))]'
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1 text-left">{group.label}</span>
                {group.items.length > 1 && (
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                  />
                )}
              </button>
              {isExpanded && group.items.length > 1 && (
                <div className="mt-0.5 ml-[18px] border-l border-base pl-2 space-y-0.5 animate-fade-in">
                  {group.items.map((item) => {
                    const active = item.page === current;
                    return (
                      <button
                        key={item.page}
                        onClick={() => handleNavigate(item.page)}
                        className={`w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-[13px] transition-colors ${
                          active
                            ? 'bg-accent-50 text-accent-700 font-medium dark:bg-accent-950/40 dark:text-accent-300'
                            : 'text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))]'
                        }`}
                      >
                        <span className={`h-1 w-1 rounded-full ${active ? 'bg-accent-500' : 'bg-transparent'}`} />
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.badge && <Badge tone="accent">{item.badge}</Badge>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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
