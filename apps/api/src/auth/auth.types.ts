export interface PermissionClaim {
  module: string;
  action: string;
}

export interface AccessTokenPayload {
  sub: string;
  tenant_id: string | null;
  role_id: string;
  employee_id: string | null;
  permissions: PermissionClaim[];
}

export interface AuthenticatedUser {
  id: string;
  tenantId: string | null;
  roleId: string;
  employeeId: string | null;
  email: string;
  permissions: PermissionClaim[];
}
