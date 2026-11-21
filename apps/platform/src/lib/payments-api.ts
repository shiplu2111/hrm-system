import type {
  DunningTenantView,
  PlatformPaymentDetailView,
  PlatformPaymentListItem,
  QueryPaymentsFilter,
  RefundPaymentRequest,
  RetryPaymentRequest,
} from '@hrm/shared-types';
import { apiRequest } from './api-client';

export async function listPlatformPayments(
  filter: QueryPaymentsFilter = {},
): Promise<PlatformPaymentListItem[]> {
  const params = new URLSearchParams();

  if (filter.tenantId) params.append('tenantId', filter.tenantId);
  if (filter.search) params.append('search', filter.search);
  if (filter.status) params.append('status', filter.status);
  if (filter.provider) params.append('provider', filter.provider);
  if (filter.fromDate) params.append('fromDate', filter.fromDate);
  if (filter.toDate) params.append('toDate', filter.toDate);
  if (filter.page) params.append('page', String(filter.page));
  if (filter.limit) params.append('limit', String(filter.limit));

  const queryStr = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<PlatformPaymentListItem[]>(`/platform/payments${queryStr}`);
}

export async function getPlatformPayment(
  id: string,
): Promise<PlatformPaymentDetailView> {
  return apiRequest<PlatformPaymentDetailView>(`/platform/payments/${id}`);
}

export async function retryPlatformPayment(
  id: string,
  req: RetryPaymentRequest = {},
): Promise<{
  success: boolean;
  message: string;
  payment: PlatformPaymentDetailView;
}> {
  return apiRequest<{
    success: boolean;
    message: string;
    payment: PlatformPaymentDetailView;
  }>(`/platform/payments/${id}/retry`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function refundPlatformPayment(
  id: string,
  req: RefundPaymentRequest,
): Promise<PlatformPaymentDetailView> {
  return apiRequest<PlatformPaymentDetailView>(`/platform/payments/${id}/refund`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function listDunningTenants(): Promise<DunningTenantView[]> {
  return apiRequest<DunningTenantView[]>(`/platform/dunning/tenants`);
}

export async function retryDunningTenant(
  tenantId: string,
  req: RetryPaymentRequest = {},
): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(
    `/platform/dunning/tenants/${tenantId}/retry`,
    {
      method: 'POST',
      body: JSON.stringify(req),
    },
  );
}
