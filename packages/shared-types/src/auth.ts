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
  /**
   * ROLES_PERMISSIONS.md §5 — `team` limits employee data to the user's reporting tree;
   * `own` limits it to the user's own record (self-service only).
   */
  dataScope?: 'all' | 'team' | 'own';
  /** Set when an admin issued a temporary password; every API except change-password/logout returns 403 until cleared. */
  mustChangePassword?: boolean;
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

export interface RefreshResponse extends AuthTokens { }

export interface AccessTokenClaims {
  sub: string;
  tenant_id: string | null;
  role_id: string;
  employee_id: string | null;
  permissions: PermissionClaim[];
  must_change_password?: boolean;
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

/** Admin-managed login for an employee (MODULES.md §08). */
export interface EmployeePortalAccessView {
  employeeId: string;
  userId: string;
  email: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  isLocked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface EmployeePortalAccessState {
  access: EmployeePortalAccessView | null;
  /** Work email from the employee profile, used to prefill a new login. */
  suggestedEmail: string | null;
  /** False for terminated employees — logins cannot be created or re-enabled. */
  canGrant: boolean;
  /** Why the signed-in admin cannot change this login, if they cannot. */
  manageBlockedReason: EmployeePortalManageBlockedReason | null;
}

export type EmployeePortalManageBlockedReason = 'self' | 'role_privilege';

export interface EmployeePortalRoleOption {
  id: string;
  name: string;
}

export interface CreateEmployeePortalAccessRequest {
  email: string;
  roleId: string;
}

export interface UpdateEmployeePortalAccessRequest {
  email?: string;
  roleId?: string;
  isActive?: boolean;
}

/** Returned once when a login is created or its password is reset; never retrievable again. */
export interface EmployeePortalCredentialsResult {
  access: EmployeePortalAccessView;
  temporaryPassword: string;
}

// ---------------------------------------------------------------------------
// Platform Staff Identity & Auth Types (STAGE A, Prompt A.0)
// ---------------------------------------------------------------------------

export interface PlatformPermissionClaim {
  module: string;
  action: string;
}

export interface PlatformUserView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  permissions: PlatformPermissionClaim[];
}

export interface PlatformLoginRequest {
  email: string;
  password: string;
  totpCode?: string;
}

export interface PlatformLogin2faChallenge {
  requires2fa: true;
  mfaToken: string;
  setupRequired?: boolean;
  secret?: string;
  qrUri?: string;
}

export interface PlatformLoginSuccess extends AuthTokens {
  requires2fa?: false;
  user: PlatformUserView;
}

export type PlatformLoginResponse = PlatformLoginSuccess | PlatformLogin2faChallenge;

export interface PlatformVerify2faRequest {
  mfaToken: string;
  totpCode: string;
}

export interface PlatformSessionView {
  id: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: string;
  isRevoked: boolean;
  createdAt: string;
  isCurrent?: boolean;
}

export interface PlatformLoginHistoryView {
  id: string;
  userId: string | null;
  email: string;
  status: string;
  failureReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface PlatformChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface PlatformTotpSetupView {
  secret: string;
  qrUri: string;
}

export type PlatformTenantStatus =
  | 'Trial'
  | 'Active'
  | 'Past_due'
  | 'Suspended'
  | 'Cancelled'
  | 'Pending_deletion'
  | 'Deleted';

export type PlatformTenantSuspensionMode = 'read_only' | 'fully_blocked';
export type PlatformTenantPlan = 'Starter' | 'Business' | 'Enterprise' | 'Free';

export interface PlatformTenantSummary {
  id: string;
  name: string;
  subdomain: string;
  plan: PlatformTenantPlan;
  status: PlatformTenantStatus;
  employeeCount?: number;
  companyCount?: number;
  mrr?: number;
  health?: number;
  region?: string;
  country?: string;
  countryCode?: string;
  lastActivity?: string | null;
  storageDriver?: string;
  suspensionMode?: PlatformTenantSuspensionMode | null;
  suspensionReason?: string | null;
  suspendedAt?: string | null;
  trialEndsAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  scheduledDeletionAt?: string | null;
  deletedAt?: string | null;
  isSandbox?: boolean;
  sandboxTemplate?: string | null;
  sandboxExpiresAt?: string | null;
  lastResetAt?: string | null;
  demoLeadName?: string | null;
  demoLeadEmail?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export type SandboxDemoTemplate =
  | 'tech_saas'
  | 'retail_hospitality'
  | 'enterprise_healthcare'
  | 'manufacturing_logistics';

export interface SandboxTenantSummary extends PlatformTenantSummary {
  isSandbox: true;
  sandboxTemplate: SandboxDemoTemplate;
  demoLeadName?: string | null;
  demoLeadEmail?: string | null;
  sandboxExpiresAt?: string | null;
  lastResetAt?: string | null;
  sampleDataStats: {
    employeesCount: number;
    departmentsCount: number;
    activeLeavesCount: number;
    payslipsCount: number;
    attendancePunchesCount: number;
    documentsCount: number;
  };
}

export interface CreateSandboxTenantDto {
  name: string;
  subdomain: string;
  countryCode?: string;
  template: SandboxDemoTemplate;
  demoLeadName: string;
  demoLeadEmail: string;
  durationDays?: number;
  notes?: string;
  reason: string;
}

export interface ResetSandboxTenantDto {
  reason: string;
  reseedOption?: 'full_clean_slate' | 'preserve_custom_roles';
}

export interface DeleteSandboxTenantDto {
  reason: string;
}

export interface ListTenantsQuery {
  search?: string;
  plan?: string;
  status?: string;
  country?: string;
  isSandbox?: boolean | string;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: 'name' | 'plan' | 'employees' | 'status' | 'created' | 'lastActivity';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface ProvisionTenantDto {
  name: string;
  subdomain: string;
  planId?: string;
  billingCycle?: 'monthly' | 'annual';
  trialDays?: number;
  countryCode?: string;
  storageDriver?: 'local' | 's3';
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
  reason: string;
}

export interface SuspendTenantDto {
  mode: PlatformTenantSuspensionMode;
  reason: string;
}

export interface RestoreTenantDto {
  reason: string;
}

export interface CancelTenantDto {
  reason: string;
}

export interface ScheduleDeletionDto {
  gracePeriodDays?: number; // Defaults to 30 days
  reason: string;
}

export interface CancelDeletionDto {
  reason: string;
}

export interface HardDeleteTenantDto {
  reason: string;
}

export interface TenantProvisioningResult {
  jobId?: string;
  tenantId: string;
  name: string;
  subdomain: string;
  status: PlatformTenantStatus;
  companyId: string;
  ownerUserId: string;
  ownerEmail: string;
  invitationSent: boolean;
  message: string;
}

export interface PlatformConfirm2faRequest {
  secret: string;
  totpCode: string;
}

export interface PlatformAuditLogView {
  id: string;
  userId: string | null;
  userEmail?: string | null;
  action: string;
  module: string;
  recordId: string | null;
  reason?: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

