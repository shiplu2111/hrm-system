import type { WorkflowInstanceRecord } from './workflow';

export type ExpenseClaimStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'reimbursed';

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
  createdAt: string;
  updatedAt: string;
}
