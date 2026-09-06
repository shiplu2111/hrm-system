import type {
  ExpenseClaimStatus,
  WorkflowInstanceRecord,
  WorkflowInstanceStep,
} from '@hrm/shared-types';
import { getCurrentWorkflowStep } from '../workflow/workflow.utils';

export const DEFAULT_EXPENSE_APPROVAL_STEPS = [
  { roleName: 'Manager' },
  { roleName: 'Accountant' },
] as const;

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
  if (status === 'approved') return 'Approved for Payroll';
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
