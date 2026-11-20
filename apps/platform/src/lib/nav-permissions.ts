import type { NavGroup, NavItem } from '@/config/navigation';

type CanFn = (module: string, action?: string) => boolean;

/**
 * Returns true if the nav item has no permission requirement or if the user possesses the required permission.
 */
export function isPlatformNavItemVisible(item: NavItem, can: CanFn): boolean {
  if (!item.permission) return true;
  return can(item.permission.module, item.permission.action);
}

/**
 * Filters navigation groups and items based on current platform user permissions.
 * Groups with no visible items are completely removed from the sidebar.
 */
export function filterPlatformNavGroups(groups: NavGroup[], can: CanFn): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isPlatformNavItemVisible(item, can)),
    }))
    .filter((group) => group.items.length > 0);
}
