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
  data_scope?: 'all' | 'team' | 'own';
  must_change_password?: boolean;
  // Support access impersonation claims (SECURITY.md §2, AUDIT_LOG.md)
  support_access?: boolean;
  support_request_id?: string;
  platform_user_id?: string;
  staff_name?: string;
  staff_email?: string;
  access_mode?: 'read_only' | 'read_write';
}

export interface AuthenticatedUser {
  id: string;
  tenantId: string | null;
  roleId: string;
  roleName: string;
  employeeId: string | null;
  email: string;
  permissions: PermissionClaim[];
  dataScope?: 'all' | 'team' | 'own';
  mustChangePassword?: boolean;
  authMethod?: 'jwt' | 'api_key' | 'oauth';
  apiKeyId?: string;
  oauthClientId?: string;
  // Support access impersonation context
  isSupportAccess?: boolean;
  supportRequestId?: string;
  platformUserId?: string;
  staffName?: string;
  staffEmail?: string;
  accessMode?: 'read_only' | 'read_write';
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
