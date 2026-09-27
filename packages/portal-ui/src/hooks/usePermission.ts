import { useMemo } from 'react';
import type { PermissionAction } from '@hrm/shared-types';
import { useAuth } from '../context/AuthContext';
import {
  canViewModule,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  type PermissionRequirement,
} from '../lib/permissions';

/** Returns whether the signed-in user has `module` + `action` (JWT permission snapshot). */
export function usePermission(
  module: string,
  action: PermissionAction,
): boolean {
  const { user } = useAuth();
  return useMemo(
    () => hasPermission(user, module, action),
    [user, module, action],
  );
}

/** Permission helpers bound to the current session user. */
export function usePermissions() {
  const { user } = useAuth();

  return useMemo(
    () => ({
      user,
      permissions: user?.permissions ?? [],
      can: (module: string, action: PermissionAction) =>
        hasPermission(user, module, action),
      canAny: (checks: PermissionRequirement[]) =>
        hasAnyPermission(user, checks),
      canAll: (checks: PermissionRequirement[]) =>
        hasAllPermissions(user, checks),
      canViewModule: (module: string) => canViewModule(user, module),
    }),
    [user],
  );
}
