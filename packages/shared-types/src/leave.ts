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
}

export interface LeaveTypeRecord {
  id: string;
  companyId: string;
  name: string;
  isPaid: boolean;
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

export interface LeaveBalanceRecord {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName?: string;
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

export interface LeaveRequestRecord {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName?: string;
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

/** @deprecated snake_case DTO — prefer LeaveRequestRecord */
export interface LeaveRequestDTO extends SyncableRecord {
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  status: LeaveRequestStatus;
}
