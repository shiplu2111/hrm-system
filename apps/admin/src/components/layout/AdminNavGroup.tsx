import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '@hrm/portal-ui';
import { useAppTranslation } from '@hrm/i18n';
import type { PageKey } from '@/context/NavContext';
import { pathForPage } from '@/config/routes';
import { usePageAccess } from '@/hooks/usePageAccess';
import type { AdminNavItem } from '@/config/shell-navigation';
import { navItemContainsPage } from '@/config/shell-navigation';

interface AdminNavGroupProps {
  item: AdminNavItem;
  current: PageKey;
  collapsed: boolean;
  openMenu?: string | null;
  onToggleMenu?: (menuKey: string) => void;
  onNavigate: (page: PageKey) => void;
}

export function AdminNavGroup({
  item,
  current,
  collapsed,
  openMenu,
  onToggleMenu,
  onNavigate,
}: AdminNavGroupProps) {
  const routerNavigate = useNavigate();
  const { t } = useAppTranslation();
  const label = item.labelKey ? t(item.labelKey, { defaultValue: item.label }) : item.label;
  const hasParentPermission = usePermission(item.permission.module, item.permission.action);
  const { canView } = usePageAccess();
  const parentAllowed = hasParentPermission && canView(item.page);

  const goToPage = (page: PageKey) => {
    routerNavigate(pathForPage(page));
    onNavigate(page);
  };

  const visibleChildren = useMemo(
    () => (item.children ?? []).filter((child) => canView(child.page)),
    [item.children, canView],
  );

  const isActive = navItemContainsPage(item, current);
  
  // Accordion controlled state if passed, else fallback to internal state
  const isControlled = onToggleMenu !== undefined;
  const [internalExpanded, setInternalExpanded] = useState(isActive);

  useEffect(() => {
    if (isActive && isControlled && onToggleMenu && openMenu === null) {
      onToggleMenu(item.page);
    } else if (isActive && !isControlled) {
      setInternalExpanded(true);
    }
  }, [isActive]);

  const expanded = isControlled ? openMenu === item.page : internalExpanded;

  const handleToggle = () => {
    if (isControlled && onToggleMenu) {
      onToggleMenu(item.page);
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  if (!parentAllowed && visibleChildren.length === 0) return null;

  const hasChildren = visibleChildren.length > 0;
  const Icon = item.icon;

  if (!hasChildren) {
    return (
      <NavButton
        label={label}
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
        label={label}
        icon={Icon}
        active={isActive}
        collapsed={collapsed}
        onClick={() => {
          handleToggle();
          goToPage(parentAllowed ? item.page : visibleChildren[0]!.page);
        }}
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
          onClick={handleToggle}
          aria-expanded={expanded}
          className={`flex flex-1 items-center gap-2.5 h-9 px-2.5 text-sm font-medium min-w-0 cursor-pointer ${
            isActive ? 'text-accent-700 dark:text-accent-300' : 'text-secondary hover:text-primary'
          }`}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className="flex-1 text-left truncate">{label}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform duration-200 text-muted ${
              expanded ? 'rotate-180' : ''
            } ${isActive ? 'text-accent-600' : ''}`}
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
                className={`w-full text-left h-8 px-2.5 rounded-md text-sm transition-colors truncate cursor-pointer ${
                  childActive
                    ? 'bg-accent-50 text-accent-700 font-medium dark:bg-accent-950/40 dark:text-accent-300'
                    : 'text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))]'
                }`}
              >
                {child.labelKey ? t(child.labelKey, { defaultValue: child.label }) : child.label}
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
