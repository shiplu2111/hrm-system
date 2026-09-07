import { BadRequestException } from '@nestjs/common';
import type { PermissionAction } from '@hrm/shared-types';
import type { PermissionClaim } from '../auth/auth.types';
import { ALL_API_ACCESS_SCOPES, type ApiAccessScope } from '@hrm/shared-types';

const SCOPE_PERMISSION_MAP: Record<
  ApiAccessScope,
  Array<{ module: string; action: PermissionAction }>
> = {
  'read:employees': [{ module: 'employees', action: 'view' }],
  'write:employees': [
    { module: 'employees', action: 'view' },
    { module: 'employees', action: 'create' },
    { module: 'employees', action: 'edit' },
  ],
  'read:attendance': [{ module: 'attendance', action: 'view' }],
  'write:attendance': [
    { module: 'attendance', action: 'view' },
    { module: 'attendance', action: 'create' },
    { module: 'attendance', action: 'edit' },
  ],
  'read:leave': [{ module: 'leave', action: 'view' }],
  'write:leave': [
    { module: 'leave', action: 'view' },
    { module: 'leave', action: 'create' },
    { module: 'leave', action: 'edit' },
  ],
  'read:payroll': [{ module: 'payroll', action: 'view' }],
  'write:payroll': [
    { module: 'payroll', action: 'view' },
    { module: 'payroll', action: 'create' },
    { module: 'payroll', action: 'edit' },
  ],
  'read:reports': [{ module: 'reports', action: 'view' }],
};

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
  return scopes as ApiAccessScope[];
}

export function scopesToPermissionClaims(scopes: string[]): PermissionClaim[] {
  const claims = new Map<string, PermissionClaim>();
  for (const scope of scopes) {
    if (!isValidApiAccessScope(scope)) continue;
    for (const permission of SCOPE_PERMISSION_MAP[scope]) {
      claims.set(`${permission.module}:${permission.action}`, permission);
    }
  }
  return [...claims.values()];
}

export function maskApiKeySecret(prefix: string): string {
  return `${prefix}••••••••••••••••`;
}
