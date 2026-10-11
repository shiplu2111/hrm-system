import type {
  CreateTenantWebhookInput,
  CreateTenantWebhookResult,
  TenantWebhookRecord,
  UpdateTenantWebhookInput,
  WebhookDeliveryDetail,
  WebhookDeliveryList,
  WebhookDeliveryListQuery,
  WebhookDeliveryRecord,
  WebhookStatusView,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function getWebhookStatus(): Promise<WebhookStatusView> {
  return tenantApiRequest<WebhookStatusView>('/tenant/webhooks/status');
}

export function listTenantWebhooks(): Promise<TenantWebhookRecord[]> {
  return tenantApiRequest<TenantWebhookRecord[]>('/tenant/webhooks');
}

export function createTenantWebhook(
  input: CreateTenantWebhookInput,
): Promise<CreateTenantWebhookResult> {
  return tenantApiRequest<CreateTenantWebhookResult>('/tenant/webhooks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTenantWebhook(
  webhookId: string,
  input: UpdateTenantWebhookInput,
): Promise<TenantWebhookRecord> {
  return tenantApiRequest<TenantWebhookRecord>(`/tenant/webhooks/${webhookId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTenantWebhook(
  webhookId: string,
): Promise<{ id: string; deleted: true }> {
  return tenantApiRequest<{ id: string; deleted: true }>(`/tenant/webhooks/${webhookId}`, {
    method: 'DELETE',
  });
}

export function rotateTenantWebhookSecret(
  webhookId: string,
): Promise<CreateTenantWebhookResult> {
  return tenantApiRequest<CreateTenantWebhookResult>(
    `/tenant/webhooks/${webhookId}/rotate-secret`,
    { method: 'POST' },
  );
}

export function testTenantWebhook(webhookId: string): Promise<WebhookDeliveryRecord> {
  return tenantApiRequest<WebhookDeliveryRecord>(`/tenant/webhooks/${webhookId}/test`, {
    method: 'POST',
  });
}

export function listWebhookDeliveries(
  query: WebhookDeliveryListQuery = {},
): Promise<WebhookDeliveryList> {
  const params = new URLSearchParams();
  if (query.webhookId) params.set('webhookId', query.webhookId);
  if (query.state && query.state !== 'all') params.set('state', query.state);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  const qs = params.toString();
  return tenantApiRequest<WebhookDeliveryList>(
    `/tenant/webhook-deliveries${qs ? `?${qs}` : ''}`,
  );
}

export function getWebhookDelivery(deliveryId: string): Promise<WebhookDeliveryDetail> {
  return tenantApiRequest<WebhookDeliveryDetail>(`/tenant/webhook-deliveries/${deliveryId}`);
}

export function retryWebhookDelivery(deliveryId: string): Promise<WebhookDeliveryRecord> {
  return tenantApiRequest<WebhookDeliveryRecord>(
    `/tenant/webhook-deliveries/${deliveryId}/retry`,
    { method: 'POST' },
  );
}
