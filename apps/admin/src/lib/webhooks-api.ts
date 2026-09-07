import type {
  CreateTenantWebhookResult,
  TenantWebhookRecord,
  WebhookDeliveryRecord,
  WebhookEventType,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function listTenantWebhooks(): Promise<TenantWebhookRecord[]> {
  return tenantApiRequest<TenantWebhookRecord[]>('/tenant/webhooks');
}

export function createTenantWebhook(input: {
  name: string;
  url: string;
  events: WebhookEventType[];
  companyId?: string;
  description?: string;
}): Promise<CreateTenantWebhookResult> {
  return tenantApiRequest<CreateTenantWebhookResult>('/tenant/webhooks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function disableTenantWebhook(
  webhookId: string,
): Promise<TenantWebhookRecord> {
  return tenantApiRequest<TenantWebhookRecord>(`/tenant/webhooks/${webhookId}`, {
    method: 'DELETE',
  });
}

export function listWebhookDeliveries(
  webhookId?: string,
): Promise<WebhookDeliveryRecord[]> {
  const qs = webhookId ? `?webhookId=${encodeURIComponent(webhookId)}` : '';
  return tenantApiRequest<WebhookDeliveryRecord[]>(
    `/tenant/webhook-deliveries${qs}`,
  );
}

export function testTenantWebhook(
  webhookId: string,
): Promise<{ queued: boolean; webhookId: string }> {
  return tenantApiRequest<{ queued: boolean; webhookId: string }>(
    `/tenant/webhooks/${webhookId}/test`,
    { method: 'POST' },
  );
}
