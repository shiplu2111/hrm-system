import type {
  ExpenseCategoryRecord,
  ExpenseClaimRecord,
  ExpenseClaimStatus,
} from '@hrm/shared-types';
import { formatMoney } from './payroll-copy';

type Tone = 'neutral' | 'warning' | 'accent' | 'success' | 'error';

export const EXPENSE_STATUS_LABELS: Record<ExpenseClaimStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  reimbursed: 'Reimbursed',
};

export const EXPENSE_STATUS_TONE: Record<ExpenseClaimStatus, Tone> = {
  draft: 'neutral',
  pending_approval: 'warning',
  approved: 'accent',
  rejected: 'error',
  cancelled: 'neutral',
  reimbursed: 'success',
};

export type ExpenseListFilter = ExpenseClaimStatus | 'all' | 'awaiting_me';

export const EXPENSE_STATUS_FILTERS: Array<{ value: ExpenseListFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'awaiting_me', label: 'Awaiting me' },
  { value: 'pending_approval', label: 'Pending' },
  { value: 'approved', label: 'To reimburse' },
  { value: 'reimbursed', label: 'Reimbursed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'draft', label: 'Draft' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function matchesExpenseFilter(claim: ExpenseClaimRecord, filter: ExpenseListFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'awaiting_me') return claim.canAct;
  return claim.status === filter;
}

/** Amount with the claim's currency code, e.g. "485.50 AUD". */
export function formatClaimAmount(claim: Pick<ExpenseClaimRecord, 'amount' | 'currency'>): string {
  return `${formatMoney(claim.amount)} ${claim.currency}`;
}

/** "Step 1 of 2 · Employee's manager" for pending claims; null otherwise. */
export function expenseStepLabel(claim: Pick<ExpenseClaimRecord, 'workflow'>): string | null {
  const workflow = claim.workflow;
  if (!workflow || workflow.status !== 'pending') return null;
  const step = workflow.steps.find((s) => s.order === workflow.currentStepOrder);
  if (!step) return null;
  const who =
    step.assigneeType === 'direct_manager'
      ? "Employee's manager"
      : step.assigneeType === 'skip_level_manager'
        ? "Manager's manager"
        : step.roleName;
  return `Step ${step.order} of ${workflow.steps.length} · ${who}`;
}

/** Days since submission for pending claims, so old ones stand out. */
export function daysWaiting(claim: Pick<ExpenseClaimRecord, 'status' | 'submittedAt'>): number | null {
  if (claim.status !== 'pending_approval' || !claim.submittedAt) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(claim.submittedAt).getTime()) / 86_400_000));
}

export function describeLimits(
  category: Pick<ExpenseCategoryRecord, 'maxAmountPerClaim' | 'maxAmountPerMonth'>,
): string {
  const parts = [
    category.maxAmountPerClaim != null ? `${formatMoney(category.maxAmountPerClaim)} per claim` : null,
    category.maxAmountPerMonth != null ? `${formatMoney(category.maxAmountPerMonth)} per month` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'No limit';
}

export function isPreviewableImage(contentType: string): boolean {
  return contentType === 'image/png' || contentType === 'image/jpeg';
}
