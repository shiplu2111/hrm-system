export interface PermissionClaim {
  module: string;
  action: string;
}

export interface AccessTokenPayload {
  sub: string;
  tenant_id: string | null;
  role_id: string;
  role_name: string;
  employee_id: string | null;
  permissions: PermissionClaim[];
  /** UI hint only — DataScopeService reads the role's scope from the DB. */
  data_scope?: 'all' | 'team';
  must_change_password?: boolean;
}

export interface AuthenticatedUser {
  id: string;
  tenantId: string | null;
  roleId: string;
  roleName: string;
  employeeId: string | null;
  email: string;
  permissions: PermissionClaim[];
  dataScope?: 'all' | 'team';
  mustChangePassword?: boolean;
  authMethod?: 'jwt' | 'api_key' | 'oauth';
  apiKeyId?: string;
  oauthClientId?: string;
}

export interface AuthSessionView {
  id: string;
  createdAt: string;
  expiresAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  isCurrent: boolean;
  isRevoked: boolean;
  isExpired: boolean;
}
