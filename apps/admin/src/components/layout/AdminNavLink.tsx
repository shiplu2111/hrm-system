import type { LucideIcon } from 'lucide-react';
import type { PermissionAction } from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import type { PageKey } from '@/context/NavContext';

interface AdminNavLinkProps {
  label: string;
  page: PageKey;
  icon: LucideIcon;
  module: string;
  action: PermissionAction;
  current: PageKey;
  collapsed: boolean;
  onNavigate: (page: PageKey) => void;
}

export function AdminNavLink({
  label,
  page,
  icon: Icon,
  module,
  action,
  current,
  collapsed,
  onNavigate,
}: AdminNavLinkProps) {
  const allowed = usePermission(module, action);
  if (!allowed) return null;

  const active = page === current;

  return (
    <button
      onClick={() => onNavigate(page)}
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
