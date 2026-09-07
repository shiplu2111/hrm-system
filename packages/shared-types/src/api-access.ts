/** Enterprise API access (MODULES.md §43) */

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
  | 'write:payroll'
  | 'read:reports';

export const API_ACCESS_SCOPE_LABELS: Record<ApiAccessScope, string> = {
  'read:employees': 'Read employees',
  'write:employees': 'Write employees',
  'read:attendance': 'Read attendance',
  'write:attendance': 'Write attendance',
  'read:leave': 'Read leave',
  'write:leave': 'Write leave',
  'read:payroll': 'Read payroll',
  'write:payroll': 'Write payroll',
  'read:reports': 'Read reports',
};

export const ALL_API_ACCESS_SCOPES = Object.keys(
  API_ACCESS_SCOPE_LABELS,
) as ApiAccessScope[];

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
