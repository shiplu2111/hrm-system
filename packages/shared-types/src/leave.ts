import type { SyncableRecord } from './common';

export type LeaveRequestStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type LeaveAccrualType = 'monthly' | 'yearly' | 'on_hire';

export type YearlyAccrualAnchor = 'financial_year' | 'hire_anniversary';

export type ApprovalStepStatus = 'pending' | 'approved' | 'rejected' | 'skipped';

export interface LeaveApprovalStep {
  roleName: string;
  status: ApprovalStepStatus;
  actedByUserId: string | null;
  actedByEmployeeId: string | null;
  actedAt: string | null;
  comment: string | null;
  /** Resolved display name of whoever acted on the step */
  actedByName?: string | null;
}

export interface LeaveTypeRecord {
  id: string;
  companyId: string;
  name: string;
  isPaid: boolean;
  /** Present on the list endpoint; a type with policies or requests cannot be deleted */
  usage?: { policies: number; requests: number };
  createdAt: string;
  updatedAt: string;
}

export interface LeavePolicyRecord {
  id: string;
  companyId: string;
  leaveTypeId: string;
  entitlementDays: number;
  accrualType: LeaveAccrualType;
  carryForwardMax: number | null;
  expiryMonths: number | null;
  encashmentAllowed: boolean;
  probationRestricted: boolean;
  allowNegativeBalance: boolean;
  negativeBalanceCap: number | null;
  halfDayAllowed: boolean;
  deductPublicHolidays: boolean;
  approvalSteps: Array<{ roleName: string }>;
  yearlyAccrualAnchor: YearlyAccrualAnchor;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeavePolicyInput {
  entitlementDays: number;
  accrualType: LeaveAccrualType;
  carryForwardMax?: number | null;
  expiryMonths?: number | null;
  encashmentAllowed?: boolean;
  probationRestricted?: boolean;
  allowNegativeBalance?: boolean;
  negativeBalanceCap?: number | null;
  halfDayAllowed?: boolean;
  deductPublicHolidays?: boolean;
  approvalSteps?: Array<{ roleName: string }>;
  yearlyAccrualAnchor?: YearlyAccrualAnchor;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface CreateLeavePolicyInput extends LeavePolicyInput {
  leaveTypeId: string;
}

export type UpdateLeavePolicyInput = Partial<LeavePolicyInput>;

/** The version in effect on `asOf` (YYYY-MM-DD); versions never overlap. */
export function findEffectiveLeavePolicy<
  T extends Pick<LeavePolicyRecord, 'leaveTypeId' | 'effectiveFrom' | 'effectiveTo'>,
>(policies: T[], leaveTypeId: string, asOf: string): T | undefined {
  return policies
    .filter(
      (p) =>
        p.leaveTypeId === leaveTypeId &&
        p.effectiveFrom <= asOf &&
        (p.effectiveTo === null || p.effectiveTo >= asOf),
    )
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}

export interface LeaveBalanceRecord {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName?: string;
  isPaid?: boolean;
  /** Days of approved leave starting within the leave year */
  usedDays?: number;
  /** Days of submitted, not yet decided leave starting within the leave year */
  pendingDays?: number;
  leaveYearStart?: string;
  leaveYearEnd?: string;
  balanceDays: number;
  carriedForwardDays: number;
  carriedForwardExpiresAt: string | null;
  accruedToDate: number;
  entitlementDays: number;
  asOfYear: number;
  lastAccrualAt: string | null;
  negativeBalanceWarning: boolean;
  updatedAt: string;
}

export interface LeaveRequestEmployeeSummary {
  id: string;
  fullName: string;
  employeeNumber: string;
  departmentName: string | null;
  designationName: string | null;
}

export interface LeaveRequestRecord {
  id: string;
  employeeId: string;
  employee?: LeaveRequestEmployeeSummary;
  leaveTypeId: string;
  leaveTypeName?: string;
  leaveTypeIsPaid?: boolean;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  totalDays: number;
  reason: string | null;
  status: LeaveRequestStatus;
  approvalChain: LeaveApprovalStep[];
  deductedAt: string | null;
  balanceWarning: {
    projectedBalance: number;
    exceedsBalance: boolean;
    negativeCapExceeded: boolean;
  } | null;
  localId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequestPreviewInput {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  halfDay?: boolean;
}

export type LeaveRequestIssueCode =
  | 'invalid_range'
  | 'no_policy'
  | 'probation'
  | 'half_day_not_allowed'
  | 'half_day_multi_day'
  | 'no_working_days'
  | 'overlap'
  | 'insufficient_balance'
  | 'negative_cap_exceeded'
  | 'negative_balance'
  | 'exceeds_with_pending'
  | 'starts_in_past';

export interface LeaveRequestIssue {
  code: LeaveRequestIssueCode;
  /** Errors block submission; warnings are shown to the requester and approver */
  severity: 'error' | 'warning';
  message: string;
  /** Values interpolated into `message`, for clients that localize by `code` */
  params?: Record<string, string | number>;
}

/** Server-side dry run of a leave request, using the same rules as submission. */
export interface LeaveRequestPreview {
  totalDays: number;
  calendarDays: number;
  excludedDates: Array<{ date: string; reason: 'weekend' | 'public_holiday' }>;
  isPaid: boolean;
  /** Null for unpaid leave, which does not draw on a balance */
  balance: {
    available: number;
    /** Other submitted requests of this type awaiting approval */
    pending: number;
    afterRequest: number;
    afterPending: number;
  } | null;
  policy: {
    halfDayAllowed: boolean;
    allowNegativeBalance: boolean;
    negativeBalanceCap: number | null;
    probationRestricted: boolean;
  } | null;
  approvalSteps: string[];
  overlapping: Array<{
    id: string;
    leaveTypeName: string;
    startDate: string;
    endDate: string;
    status: LeaveRequestStatus;
  }>;
  issues: LeaveRequestIssue[];
  canSubmit: boolean;
}

export type LeaveStatusTone = 'neutral' | 'warning' | 'success' | 'error';

/** Status pill mapping (DESIGN_SYSTEM.md §5). */
export const LEAVE_REQUEST_STATUS_META: Record<
  LeaveRequestStatus,
  { label: string; tone: LeaveStatusTone }
> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending: { label: 'Pending', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'error' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

/** "Manager" and "Skip-level Manager" steps follow the requester's reporting line. */
export function leaveApproverLabel(roleName: string): string {
  if (roleName === 'Manager' || roleName === 'Direct Manager') return 'Direct manager';
  if (roleName === 'Skip-level Manager' || roleName === 'Skip Level Manager') {
    return 'Skip-level manager';
  }
  return roleName;
}

/** @deprecated snake_case DTO — prefer LeaveRequestRecord */
export interface LeaveRequestDTO extends SyncableRecord {
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  status: LeaveRequestStatus;
}
