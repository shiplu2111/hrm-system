import type {
  ExpenseClaimLimitCheck,
  ExpenseClaimStatus,
  WorkflowInstanceRecord,
  WorkflowInstanceStep,
} from '@hrm/shared-types';
import { getCurrentWorkflowStep } from '../workflow/workflow.utils';

export const DEFAULT_EXPENSE_APPROVAL_STEPS = [
  { roleName: 'Manager' },
  { roleName: 'Accountant' },
] as const;

export const DEFAULT_EXPENSE_ROUTE_NAME = 'Built-in expense approval';

export function buildExpenseReferenceNumber(
  countExisting: number,
  asOf: Date = new Date(),
): string {
  const year = asOf.getUTCFullYear();
  const seq = String(countExisting + 1).padStart(3, '0');
  return `EXP-${year}-${seq}`;
}

export function formatDateValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date "${value}", expected YYYY-MM-DD`);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

export function resolveExpenseDisplayStatus(input: {
  status: ExpenseClaimStatus;
  workflow: WorkflowInstanceRecord | null;
}): string {
  const { status, workflow } = input;
  if (status === 'reimbursed') return 'Reimbursed';
  if (status === 'rejected') return 'Rejected';
  if (status === 'approved') return 'Approved';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'draft') return 'Draft';

  const step = workflow ? getCurrentWorkflowStep(workflow.steps) : null;
  if (!step) return 'Pending Approval';

  if (step.assigneeType === 'direct_manager' || step.roleName === 'Manager') {
    return 'Pending Manager';
  }
  if (step.roleName === 'Accountant') {
    return 'Pending Finance';
  }
  return `Pending ${step.roleName}`;
}

export function countApprovedWorkflowSteps(steps: WorkflowInstanceStep[]): number {
  return steps.filter((step) => step.status === 'approved').length;
}

/** A per-claim limit above the monthly limit could never be reached. */
export function assertLimitOrder(
  maxAmountPerClaim: number | null,
  maxAmountPerMonth: number | null,
): void {
  if (
    maxAmountPerClaim != null &&
    maxAmountPerMonth != null &&
    maxAmountPerClaim > maxAmountPerMonth
  ) {
    throw new Error(
      'The per-claim limit cannot be higher than the monthly limit',
    );
  }
}

export function buildLimitCheck(input: {
  amount: number;
  expenseDate: Date;
  maxAmountPerClaim: number | null;
  maxAmountPerMonth: number | null;
  otherClaimsThisMonth: number;
}): ExpenseClaimLimitCheck {
  const otherClaimsThisMonth = Math.round(input.otherClaimsThisMonth * 100) / 100;
  return {
    maxAmountPerClaim: input.maxAmountPerClaim,
    maxAmountPerMonth: input.maxAmountPerMonth,
    month: input.expenseDate.toISOString().slice(0, 7),
    otherClaimsThisMonth,
    exceedsPerClaim:
      input.maxAmountPerClaim != null && input.amount > input.maxAmountPerClaim,
    exceedsPerMonth:
      input.maxAmountPerMonth != null &&
      otherClaimsThisMonth + input.amount > input.maxAmountPerMonth + 1e-9,
  };
}

/** Allows one day ahead of UTC so employees east of UTC can claim for their "today". */
export function isFutureExpenseDate(expenseDate: Date, now: Date = new Date()): boolean {
  const latest = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return expenseDate.getTime() > latest;
}

export function monthBounds(date: Date): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)),
    end: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)),
  };
}

export function assertCategoryLimits(input: {
  amount: number;
  maxAmountPerClaim: number | null;
  maxAmountPerMonth: number | null;
  employeeMonthlyTotal: number;
}): void {
  if (
    input.maxAmountPerClaim != null &&
    input.amount > input.maxAmountPerClaim
  ) {
    throw new Error(
      `Claim amount exceeds category limit of ${input.maxAmountPerClaim}`,
    );
  }

  if (input.maxAmountPerMonth != null) {
    const projected = input.employeeMonthlyTotal + input.amount;
    if (projected > input.maxAmountPerMonth) {
      throw new Error(
        `Monthly category limit of ${input.maxAmountPerMonth} would be exceeded`,
      );
    }
  }
}
