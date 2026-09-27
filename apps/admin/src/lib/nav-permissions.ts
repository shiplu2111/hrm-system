import type { PermissionAction } from '@hrm/shared-types';
import { getPageViewPermission, type PagePermission } from '@/config/page-permissions';
import type { NavGroup, NavItem } from '@/config/navigation';
import type { AdminNavItem } from '@/config/shell-navigation';

type CanFn = (module: string, action: PermissionAction) => boolean;

function isItemVisible(
  item: { page: string; permission?: PagePermission },
  can: CanFn,
): boolean {
  const required = item.permission ?? getPageViewPermission(item.page as never);
  if (!required) return true;
  return can(required.module, required.action);
}

export function filterAdminNavItems(items: AdminNavItem[], can: CanFn): AdminNavItem[] {
  return items
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) => isItemVisible(child, can)),
    }))
    .filter(
      (item) =>
        isItemVisible(item, can) || (item.children && item.children.length > 0),
    );
}

export function filterNavGroups(groups: NavGroup[], can: CanFn): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item: NavItem) => isItemVisible(item, can)),
    }))
    .filter((group) => group.items.length > 0);
}
