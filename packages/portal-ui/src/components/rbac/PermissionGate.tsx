import type { PermissionAction } from '@hrm/shared-types';
import type { ReactNode } from 'react';
import { usePermission } from '../../hooks/usePermission';
import type { PermissionRequirement } from '../../lib/permissions';
import { usePermissions } from '../../hooks/usePermission';

interface PermissionGateProps {
  module: string;
  action: PermissionAction;
  children: ReactNode;
  /** Render nothing when denied (default). Never render disabled placeholders. */
  fallback?: ReactNode;
}

/** Renders children only when the user has the required permission. */
export function PermissionGate({
  module,
  action,
  children,
  fallback = null,
}: PermissionGateProps) {
  const allowed = usePermission(module, action);
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}

interface AnyPermissionGateProps {
  anyOf: PermissionRequirement[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function AnyPermissionGate({
  anyOf,
  children,
  fallback = null,
}: AnyPermissionGateProps) {
  const { canAny } = usePermissions();
  if (!canAny(anyOf)) return <>{fallback}</>;
  return <>{children}</>;
}
