/**
 * Support Access Mechanism (SECURITY.md, AUDIT_LOG.md)
 *
 * Rules:
 * 1. Staff must request access to a tenant with a reason and a duration (max 4 hours).
 * 2. The tenant's Company Owner must approve it (email plus in-app notification), unless
 *    the tenant has pre-authorised support access in its settings.
 * 3. Approved access issues a short-lived impersonation token, scoped to a named tenant,
 *    read-only by default; write access needs a separate explicit approval.
 * 4. Every request made with that token is tagged and written to both platform_audit_logs
 *    and the tenant's audit_logs, with the staff member's name visible to the tenant.
 * 5. Payroll finalize, payment and bank-detail reveal are blocked even in write mode.
 */

export type SupportAccessMode = 'read_only' | 'read_write';

export type SupportAccessStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'revoked';

export interface SupportAccessRequestRecord {
  id: string;
  tenantId: string;
  tenantName?: string;
  tenantSubdomain?: string;
  platformUserId: string;
  staffName: string;
  staffEmail: string;
  reason: string;
  durationMinutes: number; // 15 - 240
  accessMode: SupportAccessMode;
  status: SupportAccessStatus;
  autoApproved: boolean;
  approvedAt: string | null;
  approvedByUserId: string | null;
  approvedByUserName?: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedByUserId: string | null;
  revokedReason: string | null;
  tokenJti: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupportAccessRequestDto {
  tenantId?: string;
  reason: string;
  durationMinutes: number; // 15 to 240
  accessMode?: SupportAccessMode;
}

export interface ApproveSupportAccessDto {
  accessMode?: SupportAccessMode;
}

export interface RejectSupportAccessDto {
  reason?: string;
}

export interface RevokeSupportAccessDto {
  reason: string;
}

export interface ImpersonationTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  accessMode: SupportAccessMode;
  tenantId: string;
  tenantName: string;
  tenantSubdomain: string;
  staffName: string;
  staffEmail: string;
  requestId: string;
}

export interface TenantSecuritySettings {
  preauthorizedSupportAccess: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface UpdateTenantSecuritySettingsDto {
  preauthorizedSupportAccess: boolean;
}

export interface SupportSessionListItem extends SupportAccessRequestRecord {
  tenantName: string;
  tenantSubdomain: string;
  tenantCountryCode?: string;
  platformUserRoleName?: string;
  actionsCount: number;
}

export interface SupportSessionStats {
  totalSessions: number;
  activeSessions: number;
  totalActionsTaken: number;
  preauthorizedCount: number;
  readWriteCount: number;
  avgDurationMinutes: number;
}

export interface SupportSessionsQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  status?: SupportAccessStatus | 'all';
  accessMode?: SupportAccessMode | 'all';
  tenantId?: string;
  sortBy?: 'createdAt' | 'expiresAt' | 'durationMinutes' | 'actionsCount';
  sortDir?: 'asc' | 'desc';
}

export interface PaginatedSupportSessions {
  items: SupportSessionListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
