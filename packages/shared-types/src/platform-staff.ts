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
    key: 'platform',
    label: 'Control Plane Operations',
    description: 'Core platform administration, announcements, feature flags, and health telemetry.',
    actions: ['view', 'edit', 'manage'],
  },
];
