import type { PlatformPermissionClaim, PlatformUserView } from '@hrm/shared-types';

export interface PlatformPermissionRequirement {
  module: string;
  action: string;
}

export type PermissionUser = Pick<PlatformUserView, 'permissions' | 'roleName'> | null | undefined;

const EXPLICIT_ONLY_PLATFORM_ACTIONS = new Set(['raw_html']);

/**
 * Checks whether the platform staff member holds an explicit module:action grant
 * without wildcard or role-name bypasses.
 */
export function hasExplicitPlatformPermission(
  user: PermissionUser,
  module: string,
  action: string,
): boolean {
  if (!user) return false;
  return (user.permissions ?? []).some(
    (p) => p.module === module && p.action === action,
  );
}

/**
 * Evaluates whether the platform staff member possesses the requested permission.
 * - Explicit-only actions (such as `cms:raw_html`) require an explicit claim.
 * - Platform Owner is superuser with root wildcard access across all standard modules and actions.
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

  if (EXPLICIT_ONLY_PLATFORM_ACTIONS.has(action)) {
    return hasExplicitPlatformPermission(user, module, action);
  }

  // Platform Owner has full access to all standard platform operations
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
