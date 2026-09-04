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
}

export interface AuthenticatedUser {
  id: string;
  tenantId: string | null;
  roleId: string;
  roleName: string;
  employeeId: string | null;
  email: string;
  permissions: PermissionClaim[];
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
