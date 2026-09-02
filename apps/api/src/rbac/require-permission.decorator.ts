import { SetMetadata } from '@nestjs/common';
import type { PermissionAction } from '@hrm/shared-types';

export const PERMISSION_KEY = 'requiredPermission';

export interface RequiredPermission {
  module: string;
  action: PermissionAction;
}

/** Declare required module + action (ROLES_PERMISSIONS.md §3, RULES.md §7). */
export const RequirePermission = (module: string, action: PermissionAction) =>
  SetMetadata(PERMISSION_KEY, { module, action } satisfies RequiredPermission);
