/** Outbound webhooks (API_GUIDELINES.md §9) */

export type WebhookEventType =
  | 'employee.created'
  | 'leave.approved'
  | 'payroll.finalized';

export type TenantWebhookStatus = 'active' | 'disabled';

export type WebhookDeliveryStatus =
  | 'queued'
  | 'processing'
  | 'delivered'
  | 'failed';

export const WEBHOOK_SCHEMA_VERSION = '2026-01-01';

export const WEBHOOK_EVENT_LABELS: Record<WebhookEventType, string> = {
  'employee.created': 'Employee created',
  'leave.approved': 'Leave request approved',
  'payroll.finalized': 'Payroll run finalized',
};

export const ALL_WEBHOOK_EVENT_TYPES = Object.keys(
  WEBHOOK_EVENT_LABELS,
) as WebhookEventType[];

export interface WebhookPayloadEnvelope<T = Record<string, unknown>> {
  schema_version: string;
  id: string;
  type: WebhookEventType;
  created_at: string;
  tenant_id: string;
  company_id: string;
  data: T;
}

export interface TenantWebhookRecord {
  id: string;
  tenantId: string;
  companyId: string | null;
  name: string;
  url: string;
  secretMasked: string;
  events: WebhookEventType[];
  status: TenantWebhookStatus;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantWebhookResult {
  webhook: TenantWebhookRecord;
  /** Signing secret — shown once at creation. */
  secret: string;
}

export interface WebhookDeliveryRecord {
  id: string;
  webhookId: string;
  eventType: WebhookEventType;
  eventId: string;
  schemaVersion: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  httpStatus: number | null;
  errorMessage: string | null;
  queuedAt: string;
  deliveredAt: string | null;
  failedAt: string | null;
  createdAt: string;
}
