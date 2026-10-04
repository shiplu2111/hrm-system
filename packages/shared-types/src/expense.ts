import type { WorkflowApprovalRoute, WorkflowInstanceRecord } from './workflow';

export type ExpenseClaimStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'reimbursed';

/** Claim activity for a category; returned by the category list. */
export interface ExpenseCategoryUsage {
  claimCount: number;
  /** Draft or pending-approval claims. */
  openClaimCount: number;
  /** Pending, approved and reimbursed claims with an expense date in the current month. */
  monthToDateAmount: number;
}

export interface ExpenseCategoryRecord {
  id: string;
  tenantId: string;
  companyId: string;
  name: string;
  description: string | null;
  maxAmountPerClaim: number | null;
  maxAmountPerMonth: number | null;
  receiptRequired: boolean;
  isActive: boolean;
  usage?: ExpenseCategoryUsage;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseClaimReceiptRecord {
  id: string;
  claimId: string;
  fileKey: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseClaimRecord {
  id: string;
  tenantId: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  employeeNumber?: string;
  categoryId: string;
  categoryName?: string;
  referenceNumber: string;
  expenseDate: string;
  amount: number;
  currency: string;
  description: string | null;
  status: ExpenseClaimStatus;
  displayStatus: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  reimbursedAt: string | null;
  rejectionReason: string | null;
  receipts: ExpenseClaimReceiptRecord[];
  workflow: WorkflowInstanceRecord | null;
  /** Chain the claim went through; for drafts, the chain it would follow if submitted now. */
  approvalRoute: WorkflowApprovalRoute | null;
  /** Whether the current user can approve or reject the claim's current step. */
  canAct: boolean;
  createdAt: string;
  updatedAt: string;
}

/** How the claim sits against its category's limits, excluding the claim itself. */
export interface ExpenseClaimLimitCheck {
  maxAmountPerClaim: number | null;
  maxAmountPerMonth: number | null;
  /** `YYYY-MM` of the expense date. */
  month: string;
  /** Employee's other pending, approved and reimbursed claims in this category that month. */
  otherClaimsThisMonth: number;
  exceedsPerClaim: boolean;
  exceedsPerMonth: boolean;
}

export interface ExpenseClaimDetailRecord extends ExpenseClaimRecord {
  categoryReceiptRequired: boolean;
  categoryIsActive: boolean;
  limitCheck: ExpenseClaimLimitCheck;
  /** Workflow step order → name of the person who acted on it. */
  stepActors: Record<number, string>;
}
