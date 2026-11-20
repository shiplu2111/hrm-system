import type { PlatformPermissionClaim, PlatformUserView } from '@hrm/shared-types';

export interface PlatformPermissionRequirement {
  module: string;
  action: string;
}

type PermissionUser = Pick<PlatformUserView, 'permissions' | 'roleName'> | null | undefined;

/**
 * Evaluates whether the platform staff member possesses the requested permission.
 * - Platform Owner is superuser with root wildcard access across all modules and actions.
 * - 'platform' module grants access across all platform modules.
 * - 'manage' action grants access to any action (view, edit, create, delete).
 * - Write actions ('edit', 'create', 'delete') implicitly grant 'view' access.
 *
 * UX-only check — backend enforcement on /platform/* endpoints stays strictly authoritative.
 */
export function hasPlatformPermission(
  user: PermissionUser,
  module: string,
  action: string = 'view',
): boolean {
  if (!user) return false;

  // Platform Owner has full access to all platform operations
  if (user.roleName === 'Platform Owner') {
    return true;
  }

  const permissions = user.permissions ?? [];
  return permissions.some((p) => {
    // Root platform:manage wildcard grants all actions across all modules
    if (p.module === 'platform' && p.action === 'manage') {
      return true;
    }

    // Direct module match required
    if (p.module !== module) return false;

    // Action check: direct match or wildcard 'manage'
    if (p.action === action || p.action === 'manage') {
      return true;
    }

    // If 'view' is required, write actions grant view ability
    if (action === 'view' && ['edit', 'create', 'delete'].includes(p.action)) {
      return true;
    }

    return false;
  });
}

export function hasAnyPlatformPermission(
  user: PermissionUser,
  checks: PlatformPermissionRequirement[],
): boolean {
  if (!user) return false;
  if (user.roleName === 'Platform Owner') return true;
  return checks.some((check) => hasPlatformPermission(user, check.module, check.action));
}

export function hasAllPlatformPermissions(
  user: PermissionUser,
  checks: PlatformPermissionRequirement[],
): boolean {
  if (!user) return false;
  if (user.roleName === 'Platform Owner') return true;
  return checks.every((check) => hasPlatformPermission(user, check.module, check.action));
}

export function canViewPlatformModule(
  user: PermissionUser,
  module: string,
): boolean {
  return hasPlatformPermission(user, module, 'view');
}
