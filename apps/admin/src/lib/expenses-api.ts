import type {
  ExpenseCategoryRecord,
  ExpenseClaimRecord,
  ExpenseClaimStatus,
} from '@hrm/shared-types';
import { ApiError, getTenantAccessToken, tenantApiRequest } from './tenant-api-client';

export interface CreateExpenseCategoryInput {
  name: string;
  description?: string;
  maxAmountPerClaim?: number;
  maxAmountPerMonth?: number;
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
  const params = new URLSearchParams();
  if (activeOnly) params.set('activeOnly', 'true');
  const qs = params.toString();
  return tenantApiRequest<ExpenseCategoryRecord[]>(
    `/companies/${companyId}/expense-categories${qs ? `?${qs}` : ''}`,
  );
}

export function createExpenseCategory(
  companyId: string,
  input: CreateExpenseCategoryInput,
): Promise<ExpenseCategoryRecord> {
  return tenantApiRequest<ExpenseCategoryRecord>(
    `/companies/${companyId}/expense-categories`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function listExpenseClaims(
  companyId: string,
  query?: { employeeId?: string; status?: ExpenseClaimStatus },
): Promise<ExpenseClaimRecord[]> {
  const params = new URLSearchParams();
  if (query?.employeeId) params.set('employeeId', query.employeeId);
  if (query?.status) params.set('status', query.status);
  const qs = params.toString();
  return tenantApiRequest<ExpenseClaimRecord[]>(
    `/companies/${companyId}/expense-claims${qs ? `?${qs}` : ''}`,
  );
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
  reason?: string,
): Promise<ExpenseClaimRecord> {
  return tenantApiRequest<ExpenseClaimRecord>(
    `/expense-claims/${claimId}/reject`,
    { method: 'POST', body: JSON.stringify({ reason }) },
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
): Promise<ExpenseClaimRecord['receipts'][number]> {
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
    data?: ExpenseClaimRecord['receipts'][number];
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

export function getExpenseReceiptFileUrl(
  claimId: string,
  receiptId: string,
): Promise<{ url: string; expiresInSeconds: number }> {
  return tenantApiRequest<{ url: string; expiresInSeconds: number }>(
    `/expense-claims/${claimId}/receipts/${receiptId}/file-url`,
  );
}

export function formatReceiptSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
