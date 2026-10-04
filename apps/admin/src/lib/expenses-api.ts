import type {
  ExpenseCategoryRecord,
  ExpenseClaimDetailRecord,
  ExpenseClaimReceiptRecord,
  ExpenseClaimRecord,
  ExpenseClaimStatus,
} from '@hrm/shared-types';
import { fetchTenantFile, type DownloadedFile } from './download';
import { ApiError, getTenantAccessToken, tenantApiRequest } from './tenant-api-client';

export interface ExpenseCategoryInput {
  name: string;
  description?: string | null;
  /** `null` removes the limit. */
  maxAmountPerClaim?: number | null;
  /** `null` removes the limit. */
  maxAmountPerMonth?: number | null;
  receiptRequired?: boolean;
  isActive?: boolean;
}

export interface CreateExpenseClaimInput {
  employeeId: string;
  categoryId: string;
  amount: number;
  currency?: string;
  expenseDate: string;
  description?: string;
  submit?: boolean;
}

export function listExpenseCategories(
  companyId: string,
  activeOnly = true,
): Promise<ExpenseCategoryRecord[]> {
  const qs = activeOnly ? '?activeOnly=true' : '';
  return tenantApiRequest<ExpenseCategoryRecord[]>(
    `/companies/${companyId}/expense-categories${qs}`,
  );
}

export function createExpenseCategory(
  companyId: string,
  input: ExpenseCategoryInput,
): Promise<ExpenseCategoryRecord> {
  return tenantApiRequest<ExpenseCategoryRecord>(
    `/companies/${companyId}/expense-categories`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateExpenseCategory(
  categoryId: string,
  input: Partial<ExpenseCategoryInput>,
): Promise<ExpenseCategoryRecord> {
  return tenantApiRequest<ExpenseCategoryRecord>(
    `/expense-categories/${categoryId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function listExpenseClaims(
  companyId: string,
  query?: { employeeId?: string; categoryId?: string; status?: ExpenseClaimStatus },
): Promise<ExpenseClaimRecord[]> {
  const params = new URLSearchParams();
  if (query?.employeeId) params.set('employeeId', query.employeeId);
  if (query?.categoryId) params.set('categoryId', query.categoryId);
  if (query?.status) params.set('status', query.status);
  const qs = params.toString();
  return tenantApiRequest<ExpenseClaimRecord[]>(
    `/companies/${companyId}/expense-claims${qs ? `?${qs}` : ''}`,
  );
}

export function getExpenseClaim(claimId: string): Promise<ExpenseClaimDetailRecord> {
  return tenantApiRequest<ExpenseClaimDetailRecord>(`/expense-claims/${claimId}`);
}

export function createExpenseClaim(
  companyId: string,
  input: CreateExpenseClaimInput,
): Promise<ExpenseClaimRecord> {
  return tenantApiRequest<ExpenseClaimRecord>(
    `/companies/${companyId}/expense-claims`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function submitExpenseClaim(claimId: string): Promise<ExpenseClaimRecord> {
  return tenantApiRequest<ExpenseClaimRecord>(
    `/expense-claims/${claimId}/submit`,
    { method: 'POST' },
  );
}

export function approveExpenseClaim(
  claimId: string,
  comment?: string,
): Promise<ExpenseClaimRecord> {
  return tenantApiRequest<ExpenseClaimRecord>(
    `/expense-claims/${claimId}/approve`,
    { method: 'POST', body: JSON.stringify({ comment }) },
  );
}

export function rejectExpenseClaim(
  claimId: string,
  reason: string,
): Promise<ExpenseClaimRecord> {
  return tenantApiRequest<ExpenseClaimRecord>(
    `/expense-claims/${claimId}/reject`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );
}

export function cancelExpenseClaim(claimId: string): Promise<ExpenseClaimRecord> {
  return tenantApiRequest<ExpenseClaimRecord>(
    `/expense-claims/${claimId}/cancel`,
    { method: 'POST' },
  );
}

export function reimburseExpenseClaim(
  claimId: string,
): Promise<ExpenseClaimRecord> {
  return tenantApiRequest<ExpenseClaimRecord>(
    `/expense-claims/${claimId}/reimburse`,
    { method: 'POST' },
  );
}

export async function uploadExpenseReceipt(
  claimId: string,
  file: File,
): Promise<ExpenseClaimReceiptRecord> {
  const token = getTenantAccessToken();
  const formData = new FormData();
  formData.append('file', file);

  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL ?? '/api/v1'}/expense-claims/${claimId}/receipts`,
    { method: 'POST', headers, body: formData },
  );

  const payload = (await response.json().catch(() => ({}))) as {
    data?: ExpenseClaimReceiptRecord;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new ApiError(
      payload.error?.message ?? `Upload failed (${response.status})`,
      response.status,
    );
  }

  return payload.data!;
}

/** Receipt bytes (behind the bearer token, so they're fetched rather than linked). */
export function fetchExpenseReceipt(
  claimId: string,
  receipt: Pick<ExpenseClaimReceiptRecord, 'id' | 'originalName'>,
): Promise<DownloadedFile> {
  return fetchTenantFile(`/expense-claims/${claimId}/receipts/${receipt.id}/file`, {
    filename: receipt.originalName,
    errorMessage: (status) => `Could not load the receipt (${status})`,
  });
}

export function formatReceiptSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
