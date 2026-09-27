import type { PermissionAction } from '@hrm/shared-types';
import type { PermissionClaim, PortalSessionUser } from './portal-auth';

export interface PermissionRequirement {
  module: string;
  action: PermissionAction;
}

type PermissionUser = Pick<PortalSessionUser, 'permissions'> | null | undefined;

/** UX-only check — server enforces on every API call (ROLES_PERMISSIONS.md §4). */
export function hasPermission(
  user: PermissionUser,
  module: string,
  action: PermissionAction,
): boolean {
  return (user?.permissions ?? []).some(
    (p) => p.module === module && p.action === action,
  );
}

export function hasAnyPermission(
  user: PermissionUser,
  checks: PermissionRequirement[],
): boolean {
  return checks.some((check) => hasPermission(user, check.module, check.action));
}

export function hasAllPermissions(
  user: PermissionUser,
  checks: PermissionRequirement[],
): boolean {
  return checks.every((check) => hasPermission(user, check.module, check.action));
}

export function canViewModule(
  user: PermissionUser,
  module: string,
): boolean {
  return (user?.permissions ?? []).some((p) => p.module === module);
}

export function listGrantedActions(
  user: PermissionUser,
  module: string,
): PermissionAction[] {
  return (user?.permissions ?? [])
    .filter((p) => p.module === module)
    .map((p) => p.action as PermissionAction);
}

export type { PermissionClaim };
