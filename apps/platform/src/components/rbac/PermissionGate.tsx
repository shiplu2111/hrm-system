import React, { ReactNode } from 'react';
import { usePermission, usePermissions, type PlatformPermissionRequirement } from '@/hooks/usePermission';

export interface PermissionGateProps {
  module: string;
  action?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Conditionally renders children if the current platform staff member has `module` + `action`.
 * Example:
 * <PermissionGate module="tenant" action="create">
 *   <button>Provision Tenant</button>
 * </PermissionGate>
 */
export function PermissionGate({
  module,
  action = 'view',
  fallback = null,
  children,
}: PermissionGateProps) {
  const allowed = usePermission(module, action);
  if (!allowed) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}

export interface AnyPermissionGateProps {
  requirements: PlatformPermissionRequirement[];
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Conditionally renders children if the staff member satisfies ANY of the specified requirements.
 */
export function AnyPermissionGate({
  requirements,
  fallback = null,
  children,
}: AnyPermissionGateProps) {
  const { canAny } = usePermissions();
  const allowed = canAny(requirements);
  if (!allowed) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
