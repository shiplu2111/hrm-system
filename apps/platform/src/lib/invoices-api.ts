import type {
  IssueCreditNoteRequest,
  MarkInvoicePaidRequest,
  PlatformInvoiceDetailView,
  PlatformInvoiceListItem,
  QueryInvoicesFilter,
  ResendInvoiceEmailRequest,
} from '@hrm/shared-types';
import { apiRequest, getPlatformAccessToken } from './api-client';

export async function listPlatformInvoices(
  params: QueryInvoicesFilter = {},
): Promise<PlatformInvoiceListItem[]> {
  const query = new URLSearchParams();
  if (params.tenantId) query.set('tenantId', params.tenantId);
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.fromDate) query.set('fromDate', params.fromDate);
  if (params.toDate) query.set('toDate', params.toDate);
  if (params.minAmount !== undefined) query.set('minAmount', String(params.minAmount));
  if (params.maxAmount !== undefined) query.set('maxAmount', String(params.maxAmount));
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const url = `/platform/invoices${qs ? `?${qs}` : ''}`;
  return apiRequest<PlatformInvoiceListItem[]>(url);
}

export async function getPlatformInvoice(
  id: string,
): Promise<PlatformInvoiceDetailView> {
  return apiRequest<PlatformInvoiceDetailView>(`/platform/invoices/${id}`);
}

export async function downloadInvoicePdf(
  id: string,
  invoiceNumber: string,
): Promise<void> {
  const token = getPlatformAccessToken();
  const res = await fetch(`/api/v1/platform/invoices/${id}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new Error(`Failed to download invoice PDF: ${res.statusText}`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoiceNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export async function resendInvoiceEmail(
  id: string,
  dto: ResendInvoiceEmailRequest = {},
): Promise<{ success: boolean; recipient: string; sent: boolean }> {
  return apiRequest<{ success: boolean; recipient: string; sent: boolean }>(
    `/platform/invoices/${id}/resend-email`,
    {
      method: 'POST',
      body: JSON.stringify(dto),
    },
  );
}

export async function markInvoiceAsPaid(
  id: string,
  dto: MarkInvoicePaidRequest,
): Promise<PlatformInvoiceDetailView> {
  return apiRequest<PlatformInvoiceDetailView>(
    `/platform/invoices/${id}/mark-paid`,
    {
      method: 'POST',
      body: JSON.stringify(dto),
    },
  );
}

export async function issueInvoiceCreditNote(
  id: string,
  dto: IssueCreditNoteRequest,
): Promise<PlatformInvoiceDetailView> {
  return apiRequest<PlatformInvoiceDetailView>(
    `/platform/invoices/${id}/credit-note`,
    {
      method: 'POST',
      body: JSON.stringify(dto),
    },
  );
}
