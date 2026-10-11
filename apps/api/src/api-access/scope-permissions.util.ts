import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  ALL_API_ACCESS_SCOPES,
  API_ACCESS_SCOPE_LABELS,
  API_ACCESS_SCOPE_PERMISSIONS,
  type ApiAccessScope,
} from '@hrm/shared-types';
import type { PermissionClaim } from '../auth/auth.types';

export function isValidApiAccessScope(scope: string): scope is ApiAccessScope {
  return ALL_API_ACCESS_SCOPES.includes(scope as ApiAccessScope);
}

export function assertValidScopes(scopes: string[]): ApiAccessScope[] {
  const invalid = scopes.filter((scope) => !isValidApiAccessScope(scope));
  if (invalid.length > 0) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `Invalid scopes: ${invalid.join(', ')}`,
    });
  }
  if (scopes.length === 0) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'At least one scope is required',
    });
  }
  return [...new Set(scopes)] as ApiAccessScope[];
}

/** Scopes the holder of `permissions` may not grant, because they lack a permission the scope carries. */
export function scopesBeyondPermissions(
  scopes: ApiAccessScope[],
  permissions: PermissionClaim[],
): ApiAccessScope[] {
  const held = new Set(permissions.map((p) => `${p.module}:${p.action}`));
  return scopes.filter((scope) =>
    API_ACCESS_SCOPE_PERMISSIONS[scope].some((p) => !held.has(`${p.module}:${p.action}`)),
  );
}

/** Stops a settings admin from minting credentials stronger than their own role. */
export function assertScopesWithinPermissions(
  scopes: ApiAccessScope[],
  permissions: PermissionClaim[],
): void {
  const beyond = scopesBeyondPermissions(scopes, permissions);
  if (beyond.length > 0) {
    throw new ForbiddenException({
      code: 'SCOPE_EXCEEDS_PERMISSIONS',
      message: `You can't grant access you don't have yourself: ${beyond
        .map((scope) => API_ACCESS_SCOPE_LABELS[scope])
        .join(', ')}`,
    });
  }
}

export function scopesToPermissionClaims(scopes: string[]): PermissionClaim[] {
  const claims = new Map<string, PermissionClaim>();
  for (const scope of scopes) {
    if (!isValidApiAccessScope(scope)) continue;
    for (const permission of API_ACCESS_SCOPE_PERMISSIONS[scope]) {
      claims.set(`${permission.module}:${permission.action}`, { ...permission });
    }
  }
  return [...claims.values()];
}

export function maskApiKeySecret(prefix: string): string {
  return `${prefix}••••••••••••••••`;
}
