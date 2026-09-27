import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission, usePermissions } from '@hrm/portal-ui';
import type { PageKey } from '@/context/NavContext';
import { canViewPage } from '@/config/page-permissions';
import { pathForPage } from '@/config/routes';
import type { AdminNavItem } from '@/config/shell-navigation';
import { navItemContainsPage } from '@/config/shell-navigation';

interface AdminNavGroupProps {
  item: AdminNavItem;
  current: PageKey;
  collapsed: boolean;
  onNavigate: (page: PageKey) => void;
}

export function AdminNavGroup({
  item,
  current,
  collapsed,
  onNavigate,
}: AdminNavGroupProps) {
  const routerNavigate = useNavigate();
  const parentAllowed = usePermission(item.permission.module, item.permission.action);
  const { can } = usePermissions();

  const goToPage = (page: PageKey) => {
    routerNavigate(pathForPage(page));
    onNavigate(page);
  };

  const visibleChildren = useMemo(
    () =>
      (item.children ?? []).filter((child) => canViewPage(child.page, can)),
    [item.children, can],
  );

  if (!parentAllowed && visibleChildren.length === 0) return null;

  const isActive = navItemContainsPage(item, current);
  const hasChildren = visibleChildren.length > 0;
  const [expanded, setExpanded] = useState(isActive);

  useEffect(() => {
    if (isActive) setExpanded(true);
  }, [isActive]);

  const Icon = item.icon;

  if (!hasChildren) {
    return (
      <NavButton
        label={item.label}
        icon={Icon}
        active={isActive}
        collapsed={collapsed}
        onClick={() => goToPage(item.page)}
      />
    );
  }

  if (collapsed) {
    return (
      <NavButton
        label={item.label}
        icon={Icon}
        active={isActive}
        collapsed={collapsed}
        onClick={() => goToPage(visibleChildren[0]?.page ?? item.page)}
      />
    );
  }

  return (
    <div className="space-y-0.5">
      <div
        className={`flex items-center rounded-lg transition-colors ${
          isActive
            ? 'bg-accent-50/60 dark:bg-accent-950/20'
            : 'hover:bg-[rgb(var(--bg-hover))]'
        }`}
      >
        <button
          type="button"
          onClick={() => goToPage(item.page)}
          className={`flex flex-1 items-center gap-2.5 h-9 px-2.5 text-sm font-medium min-w-0 ${
            isActive ? 'text-accent-700 dark:text-accent-300' : 'text-secondary hover:text-primary'
          }`}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className="flex-1 text-left truncate">{item.label}</span>
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label} menu`}
          className={`h-9 w-8 shrink-0 flex items-center justify-center rounded-lg text-muted hover:text-primary hover:bg-[rgb(var(--bg-hover))] transition-colors ${
            isActive ? 'text-accent-600' : ''
          }`}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      {expanded ? (
        <div className="ml-4 pl-2 border-l border-base space-y-0.5">
          {visibleChildren.map((child) => {
            const childActive = current === child.page;
            return (
              <button
                key={child.page}
                type="button"
                onClick={() => goToPage(child.page)}
                className={`w-full text-left h-8 px-2.5 rounded-md text-sm transition-colors truncate ${
                  childActive
                    ? 'bg-accent-50 text-accent-700 font-medium dark:bg-accent-950/40 dark:text-accent-300'
                    : 'text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))]'
                }`}
              >
                {child.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function NavButton({
  label,
  icon: Icon,
  active,
  collapsed,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-2.5 h-9 rounded-lg text-sm font-medium transition-colors ${
        collapsed ? 'justify-center px-0' : 'px-2.5'
      } ${
        active
          ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300'
          : 'text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))]'
      }`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="flex-1 text-left">{label}</span>}
    </button>
  );
}
