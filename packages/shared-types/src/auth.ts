/** Auth-related shared types — see AUTH_FLOW.md */

import type { PermissionAction } from './common';

export interface PermissionClaim {
  module: string;
  action: PermissionAction;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  tenantId: string | null;
  roleId: string;
  employeeId: string | null;
  permissions: PermissionClaim[];
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantSubdomain?: string;
  tenantId?: string;
}

export interface LoginResponse extends AuthTokens {
  user: AuthUser;
}

export interface RefreshResponse extends AuthTokens {}

export interface AccessTokenClaims {
  sub: string;
  tenant_id: string | null;
  role_id: string;
  employee_id: string | null;
  permissions: PermissionClaim[];
}

/** Active tenant membership for multi-tenant login (AUTH_FLOW.md §5). */
export interface TenantMembershipView {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  logoUrl: string | null;
  roleName: string;
  isCurrent: boolean;
}

export interface SwitchTenantResponse extends AuthTokens {
  user: AuthUser & { roleName: string };
}
