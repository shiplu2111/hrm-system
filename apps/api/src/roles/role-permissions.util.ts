import type { RolePermission } from '@hrm/shared-types';

interface PermissionLike {
  module: string;
  action: string;
}

export const permissionKey = (permission: PermissionLike): string =>
  `${permission.module}:${permission.action}`;

/** Deduplicated, in a stable module/action order. */
export function normalizePermissions(permissions: RolePermission[]): RolePermission[] {
  const unique = new Map(permissions.map((permission) => [permissionKey(permission), permission]));
  return [...unique.values()].sort((a, b) => permissionKey(a).localeCompare(permissionKey(b)));
}

export function diffPermissions(
  current: RolePermission[],
  next: RolePermission[],
): { added: RolePermission[]; removed: RolePermission[] } {
  const currentKeys = new Set(current.map(permissionKey));
  const nextKeys = new Set(next.map(permissionKey));
  return {
    added: next.filter((permission) => !currentKeys.has(permissionKey(permission))),
    removed: current.filter((permission) => !nextKeys.has(permissionKey(permission))),
  };
}

export function missingFromHeld<T extends PermissionLike>(required: T[], held: PermissionLike[]): T[] {
  const heldKeys = new Set(held.map(permissionKey));
  return required.filter((permission) => !heldKeys.has(permissionKey(permission)));
}
