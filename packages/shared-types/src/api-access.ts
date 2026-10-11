/** Enterprise API access (MODULES.md §43) */

import type { PermissionAction } from './common';

export type TenantApiKeyStatus = 'active' | 'revoked';

export type TenantOAuthClientStatus = 'active' | 'revoked';

/** Supported API access scopes for keys and OAuth clients. */
export type ApiAccessScope =
  | 'read:employees'
  | 'write:employees'
  | 'read:attendance'
  | 'write:attendance'
  | 'read:leave'
  | 'write:leave'
  | 'read:payroll'
  | 'write:payroll';

export const API_ACCESS_SCOPE_LABELS: Record<ApiAccessScope, string> = {
  'read:employees': 'Read employees',
  'write:employees': 'Write employees',
  'read:attendance': 'Read attendance',
  'write:attendance': 'Write attendance',
  'read:leave': 'Read leave',
  'write:leave': 'Write leave',
  'read:payroll': 'Read payroll',
  'write:payroll': 'Write payroll',
};

export const ALL_API_ACCESS_SCOPES = Object.keys(
  API_ACCESS_SCOPE_LABELS,
) as ApiAccessScope[];

/**
 * Role permissions a scope grants to the credential. A user may only grant
 * scopes whose permissions they hold themselves. Report endpoints accept any
 * of employee/attendance/payroll view, so the read scopes cover reports too.
 */
export const API_ACCESS_SCOPE_PERMISSIONS: Record<
  ApiAccessScope,
  ReadonlyArray<{ module: string; action: PermissionAction }>
> = {
  'read:employees': [{ module: 'employee', action: 'view' }],
  'write:employees': [
    { module: 'employee', action: 'view' },
    { module: 'employee', action: 'create' },
    { module: 'employee', action: 'edit' },
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
};

export interface TenantApiKeyRecord {
  id: string;
  tenantId: string;
  name: string;
  prefix: string;
  keyMasked: string;
  scopes: ApiAccessScope[];
  status: TenantApiKeyStatus;
  expiresAt: string | null;
  lastUsedAt: string | null;
  /** Employee name of the creator, or their email */
  createdByName: string | null;
  revokedAt: string | null;
  revokedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantApiKeyResult {
  key: TenantApiKeyRecord;
  /** Full secret — shown once at creation only. */
  secret: string;
}

export interface TenantOAuthClientRecord {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  clientId: string;
  redirectUris: string[];
  scopes: ApiAccessScope[];
  status: TenantOAuthClientStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantOAuthClientResult {
  client: TenantOAuthClientRecord;
  /** Full client secret — shown once at creation only. */
  clientSecret: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}

export interface ApiAccessStatus {
  planId: string;
  apiAccessEnabled: boolean;
  activeKeyCount: number;
  activeOAuthClientCount: number;
}
