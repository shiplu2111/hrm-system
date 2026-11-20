import { useMemo } from 'react';
import { usePlatformAuth } from '../context/PlatformAuthContext';
import {
  hasPlatformPermission,
  hasAnyPlatformPermission,
  hasAllPlatformPermissions,
  canViewPlatformModule,
  type PlatformPermissionRequirement,
} from '../lib/permissions';

/**
 * Returns whether the authenticated platform staff member has `module` + `action`.
 * Example: const canProvision = usePermission('tenant', 'create');
 */
export function usePermission(module: string, action: string = 'view'): boolean {
  const { user } = usePlatformAuth();
  return useMemo(
    () => hasPlatformPermission(user, module, action),
    [user, module, action],
  );
}

/**
 * Multi-permission helper hook bound to the current platform user session.
 * Exposes convenient helpers: can, canAny, canAll, canViewModule, isOwner, and roleName.
 */
export function usePermissions() {
  const { user } = usePlatformAuth();

  return useMemo(
    () => ({
      user,
      roleName: user?.roleName ?? '',
      isOwner: user?.roleName === 'Platform Owner',
      permissions: user?.permissions ?? [],
      can: (module: string, action: string = 'view') =>
        hasPlatformPermission(user, module, action),
      canAny: (checks: PlatformPermissionRequirement[]) =>
        hasAnyPlatformPermission(user, checks),
      canAll: (checks: PlatformPermissionRequirement[]) =>
        hasAllPlatformPermissions(user, checks),
      canViewModule: (module: string) => canViewPlatformModule(user, module),
    }),
    [user],
  );
}

export type { PlatformPermissionRequirement };
