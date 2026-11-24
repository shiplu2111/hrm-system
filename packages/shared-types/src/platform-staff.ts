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
