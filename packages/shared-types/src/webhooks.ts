/** Outbound webhooks (API_GUIDELINES.md §9) */

import type { SubscriptionPlanTier } from './billing';

export type WebhookEventType =
  | 'employee.created'
  | 'leave.approved'
  | 'payroll.finalized';

/** Sent only by "Send test"; endpoints can't subscribe to it. */
export const WEBHOOK_TEST_EVENT = 'webhook.test';

export type WebhookDeliveryEventType = WebhookEventType | typeof WEBHOOK_TEST_EVENT;

export type TenantWebhookStatus = 'active' | 'disabled';

export type WebhookDeliveryStatus =
  | 'queued'
  | 'processing'
  | 'delivered'
  | 'failed';

/** What the delivery log shows: `queued` with earlier attempts is a retry. */
export type WebhookDeliveryState =
  | 'pending'
  | 'sending'
  | 'retrying'
  | 'delivered'
  | 'failed';

export const WEBHOOK_SCHEMA_VERSION = '2026-01-01';

/** Wait before retry N (index 0 = after the first failed attempt). */
export const WEBHOOK_RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  6 * 60 * 60_000,
] as const;

export const WEBHOOK_MAX_ATTEMPTS = WEBHOOK_RETRY_DELAYS_MS.length + 1;

export function webhookRetryDelayMs(failedAttempts: number): number {
  const index = Math.min(
    Math.max(failedAttempts, 1),
    WEBHOOK_RETRY_DELAYS_MS.length,
  ) - 1;
  return WEBHOOK_RETRY_DELAYS_MS[index];
}

export function webhookDeliveryState(delivery: {
  status: WebhookDeliveryStatus;
  attempts: number;
}): WebhookDeliveryState {
  switch (delivery.status) {
    case 'delivered':
      return 'delivered';
    case 'failed':
      return 'failed';
    case 'processing':
      return 'sending';
    default:
      return delivery.attempts > 0 ? 'retrying' : 'pending';
  }
}

export interface WebhookEventDefinition {
  label: string;
  description: string;
  /** Fields inside `data` of the payload envelope. */
  dataFields: string[];
}

export const WEBHOOK_EVENT_CATALOG: Record<WebhookEventType, WebhookEventDefinition> = {
  'employee.created': {
    label: 'Employee created',
    description: 'A new employee record is added, manually or by import.',
    dataFields: [
      'employeeId',
      'employeeNumber',
      'companyId',
      'firstName',
      'lastName',
      'hireDate',
      'employmentStatus',
    ],
  },
  'leave.approved': {
    label: 'Leave approved',
    description: 'A leave request receives its final approval.',
    dataFields: ['leaveRequestId', 'employeeId'],
  },
  'payroll.finalized': {
    label: 'Payroll finalized',
    description: 'An employee’s payroll run is finalized. Sent once per employee in the run.',
    dataFields: ['payrollRunId', 'employeeId'],
  },
};

export const WEBHOOK_EVENT_LABELS: Record<WebhookEventType, string> = {
  'employee.created': WEBHOOK_EVENT_CATALOG['employee.created'].label,
  'leave.approved': WEBHOOK_EVENT_CATALOG['leave.approved'].label,
  'payroll.finalized': WEBHOOK_EVENT_CATALOG['payroll.finalized'].label,
};

export const ALL_WEBHOOK_EVENT_TYPES = Object.keys(
  WEBHOOK_EVENT_CATALOG,
) as WebhookEventType[];

export interface WebhookPayloadEnvelope<T = Record<string, unknown>> {
  schema_version: string;
  id: string;
  type: WebhookDeliveryEventType;
  created_at: string;
  tenant_id: string;
  company_id: string;
  data: T;
}

export interface WebhookEndpointStats {
  lastDeliveryAt: string | null;
  lastDeliveryState: WebhookDeliveryState | null;
  deliveredLast7Days: number;
  failedLast7Days: number;
  retryingNow: number;
}

export interface TenantWebhookRecord {
  id: string;
  tenantId: string;
  companyId: string | null;
  companyName: string | null;
  name: string;
  url: string;
  secretMasked: string;
  events: WebhookEventType[];
  status: TenantWebhookStatus;
  description: string | null;
  createdByName: string | null;
  secretRotatedAt: string | null;
  stats: WebhookEndpointStats;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantWebhookInput {
  name: string;
  url: string;
  events: WebhookEventType[];
  companyId?: string | null;
  description?: string;
}

export interface UpdateTenantWebhookInput {
  name?: string;
  url?: string;
  events?: WebhookEventType[];
  companyId?: string | null;
  description?: string | null;
  status?: TenantWebhookStatus;
}

export interface CreateTenantWebhookResult {
  webhook: TenantWebhookRecord;
  /** Signing secret — shown once at creation. */
  secret: string;
}

export interface WebhookStatusView {
  planId: SubscriptionPlanTier;
  webhooksEnabled: boolean;
  /** False when the delivery queue (Redis) isn't configured; events are not sent. */
  deliveryAvailable: boolean;
  activeEndpointCount: number;
  maxAttempts: number;
  retryDelaysMs: number[];
  schemaVersion: string;
}

export interface WebhookDeliveryRecord {
  id: string;
  webhookId: string;
  webhookName: string;
  eventType: WebhookDeliveryEventType;
  eventId: string;
  schemaVersion: string;
  status: WebhookDeliveryStatus;
  state: WebhookDeliveryState;
  attempts: number;
  maxAttempts: number;
  httpStatus: number | null;
  errorMessage: string | null;
  queuedAt: string;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

export interface WebhookDeliveryDetail extends WebhookDeliveryRecord {
  url: string;
  payload: WebhookPayloadEnvelope;
}

export type WebhookDeliveryStateFilter = WebhookDeliveryState | 'all';

export interface WebhookDeliveryListQuery {
  webhookId?: string;
  state?: WebhookDeliveryStateFilter;
  page?: number;
  pageSize?: number;
}

export interface WebhookDeliveryList {
  items: WebhookDeliveryRecord[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<WebhookDeliveryState, number>;
}
