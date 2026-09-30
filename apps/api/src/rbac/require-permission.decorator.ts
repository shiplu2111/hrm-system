import { SetMetadata } from '@nestjs/common';
import type { PermissionAction } from '@hrm/shared-types';

export const PERMISSION_KEY = 'requiredPermission';

export interface PermissionRef {
  module: string;
  action: PermissionAction;
}

export interface RequiredPermission extends PermissionRef {
  /** Non-sensitive alternatives that also grant access (e.g. read-only lookups shared across modules). */
  orAnyOf?: PermissionRef[];
}

/** Declare required module + action (ROLES_PERMISSIONS.md §3, RULES.md §7). */
export const RequirePermission = (
  module: string,
  action: PermissionAction,
  options?: { orAnyOf?: PermissionRef[] },
) =>
  SetMetadata(PERMISSION_KEY, {
    module,
    action,
    ...(options?.orAnyOf?.length ? { orAnyOf: options.orAnyOf } : {}),
  } satisfies RequiredPermission);
