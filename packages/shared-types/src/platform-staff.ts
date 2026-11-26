export type PlatformUserStatus = 'active' | 'invited' | 'deactivated';

export type Platform2faResetStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Platform2faResetRequestView {
  id: string;
  targetUserId: string;
  targetUserEmail: string;
  targetUserName: string;
  targetUserRole: string;
  requestedBy: string;
  requesterEmail: string;
  requesterName: string;
  reason: string;
  status: Platform2faResetStatus;
  reviewedBy: string | null;
  reviewerEmail: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformUserDetailedView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  status: PlatformUserStatus;
  totpEnabled: boolean;
  totpEnrolled: boolean;
  hasPending2faReset: boolean;
  pending2faResetRequestId: string | null;
  lastLoginAt: string | null;
  invitedAt: string | null;
  createdAt: string;
  permissions: Array<{ module: string; action: string }>;
}

export interface InvitePlatformUserInput {
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  temporaryPassword?: string;
  sendEmail?: boolean;
}

export interface Request2faResetInput {
  reason: string;
}

export interface Review2faResetInput {
  action: 'approve' | 'reject';
  reviewReason?: string;
}

export interface PlatformPermissionDefinition {
  key: string;
  label: string;
  description: string;
  actions: string[];
}

export interface PlatformRoleRecord {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Array<{ module: string; action: string }>;
  userCount: number;
  activeUserCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlatformRoleInput {
  name: string;
  description?: string;
  permissions: Array<{ module: string; action: string }>;
}

export interface UpdatePlatformRoleInput {
  name?: string;
  description?: string;
  permissions?: Array<{ module: string; action: string }>;
}

export interface ActiveOwnerCheckResult {
  activeOwnerCount: number;
  totalOwnerCount: number;
  isAtRisk: boolean;
  warningMessage?: string | null;
}

export const PLATFORM_PERMISSION_DEFINITIONS: PlatformPermissionDefinition[] = [
  {
    key: 'tenant',
    label: 'Tenants & Organizations',
    description: 'Tenant lifecycle provisioning, suspension, deletion, and cross-tenant overview.',
    actions: ['view', 'create', 'edit', 'delete', 'manage'],
  },
  {
    key: 'billing',
    label: 'Billing & Subscriptions',
    description: 'Pricing tiers, subscription changes, payment providers, and revenue operations.',
    actions: ['view', 'create', 'edit', 'manage'],
  },
  {
    key: 'compliance',
    label: 'Compliance & Rules',
    description: 'Statutory rule packs, tax brackets, minimum wage, and approval workflows.',
    actions: ['view', 'create', 'edit', 'manage'],
  },
  {
    key: 'country',
    label: 'Country Packs & Localization',
    description: 'Country profiles, currency pairs, exchange rates, and language packs.',
    actions: ['view', 'create', 'edit', 'manage'],
  },
  {
    key: 'support',
    label: 'Support Access & Tickets',
    description: 'Customer assistance, ticket handling, and authorized tenant support impersonation.',
    actions: ['view', 'manage', 'impersonate'],
  },
  {
    key: 'setting',
    label: 'Platform Settings & Toggles',
    description: 'Global configurations, email/SMS/Push providers, maintenance mode, and kill switches.',
    actions: ['view', 'edit', 'manage'],
  },
  {
    key: 'audit',
    label: 'Platform Audit Logs',
    description: 'Immutable security event history, staff action logs, and administrative trails.',
    actions: ['view'],
  },
  {
    key: 'user',
    label: 'Staff Users & Access',
    description: 'Staff operator accounts, invitations, 2FA reset reviews, and role assignments.',
    actions: ['view', 'create', 'edit', 'manage'],
  },
  {
    key: 'leads',
    label: 'Leads & Demo Requests',
    description: 'Sales pipeline triage, demo requests, staff assignment, notes, and CSV exports.',
    actions: ['view', 'edit', 'manage'],
  },
  {
    key: 'cms',
    label: 'Website CMS & Publishing',
    description: 'Website pages, drafts, immutable versions, preview tokens, scheduled publishing, menus, posts, changelog, careers, and site settings.',
    actions: ['view', 'create', 'edit', 'delete', 'manage', 'raw_html'],
  },
  {
    key: 'platform',
    label: 'Control Plane Operations',
    description: 'Core platform administration, announcements, feature flags, and health telemetry.',
    actions: ['view', 'edit', 'manage'],
  },
];

// ============================================================================
// Platform Staff Sessions & Login Telemetry
// ============================================================================

export interface PlatformStaffSessionView {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRoleName: string;
  ipAddress: string | null;
  userAgent: string | null;
  device: string;
  browser: string;
  os: string;
  location: string;
  country: string;
  city: string;
  countryCode: string;
  isUnusualLocation: boolean;
  unusualLocationReason?: string | null;
  createdAt: string;
  expiresAt: string;
  isRevoked: boolean;
  isCurrent: boolean;
}

export type Platform2faResult =
  | 'verified'
  | 'failed'
  | 'challenge_issued'
  | 'setup_required'
  | 'not_applicable';

export interface PlatformStaffLoginHistoryView {
  id: string;
  userId: string | null;
  userName?: string;
  email: string;
  userRoleName?: string;
  status: 'success' | 'failed' | 'locked' | '2fa_failed' | '2fa_challenge';
  failureReason: string | null;
  twoFactorResult: Platform2faResult;
  ipAddress: string | null;
  userAgent: string | null;
  device: string;
  browser: string;
  os: string;
  location: string;
  country: string;
  city: string;
  countryCode: string;
  isUnusualLocation: boolean;
  unusualLocationReason?: string | null;
  createdAt: string;
}

export interface PlatformSessionFilter {
  search?: string;
  userId?: string;
  status?: 'all' | 'active' | 'revoked' | 'expired';
  unusualOnly?: boolean;
}

export interface PlatformLoginHistoryFilter {
  search?: string;
  userId?: string;
  status?: string;
  twoFactorResult?: string;
  unusualOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface RevokeSessionResult {
  success: boolean;
  sessionId: string;
  isRevoked: boolean;
  message: string;
}

export interface RevokeUserSessionsResult {
  success: boolean;
  userId: string;
  revokedCount: number;
  message: string;
}

export interface PlatformSecurityStats {
  totalActiveSessions: number;
  distinctStaffWithSessions: number;
  unusualLocationSessionsCount: number;
  recentLogins24hCount: number;
  failedLogins24hCount: number;
  unusualLoginsCount: number;
}
