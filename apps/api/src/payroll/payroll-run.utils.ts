import { BadRequestException } from '@nestjs/common';
import type { PayrollRunStatus, PermissionAction } from '@hrm/shared-types';

/** Allowed status transitions (PAYROLL_LOGIC.md §7). */
export const PAYROLL_RUN_TRANSITIONS: Record<
  PayrollRunStatus,
  readonly PayrollRunStatus[]
> = {
  draft: ['calculated', 'cancelled'],
  calculated: ['under_review', 'cancelled'],
  under_review: ['approved', 'calculated', 'cancelled'],
  approved: ['finalized', 'under_review', 'cancelled'],
  finalized: ['paid'],
  paid: [],
  cancelled: [],
};

/** Statuses that allow (re)calculation of pay amounts (PAYROLL_LOGIC.md §7). */
export const PAYROLL_RUN_RECALCULABLE_STATUSES: readonly PayrollRunStatus[] = [
  'draft',
  'calculated',
  'under_review',
];

export function assertPayrollRunTransition(
  from: PayrollRunStatus,
  to: PayrollRunStatus,
): void {
  const allowed = PAYROLL_RUN_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new BadRequestException({
      code: 'INVALID_TRANSITION',
      message: `Cannot transition payroll run from "${from}" to "${to}"`,
    });
  }
}

export function canRecalculatePayrollRun(status: PayrollRunStatus): boolean {
  return PAYROLL_RUN_RECALCULABLE_STATUSES.includes(status);
}

export function isPayrollRunLocked(
  status: PayrollRunStatus,
  locked: boolean,
): boolean {
  return locked || status === 'finalized' || status === 'paid';
}

export function requiredPermissionForPayrollTransition(
  targetStatus: PayrollRunStatus,
): PermissionAction {
  switch (targetStatus) {
    case 'approved':
      return 'approve';
    case 'finalized':
    case 'paid':
      return 'finalize';
    default:
      return 'edit';
  }
}

export function auditActionForPayrollTransition(
  targetStatus: PayrollRunStatus,
): 'update' | 'approve' | 'finalize' | 'reject' {
  switch (targetStatus) {
    case 'approved':
      return 'approve';
    case 'finalized':
    case 'paid':
      return 'finalize';
    case 'cancelled':
      return 'reject';
    default:
      return 'update';
  }
}
