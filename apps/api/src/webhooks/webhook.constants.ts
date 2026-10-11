import { randomUUID } from 'crypto';
import type {
  WebhookDeliveryEventType,
  WebhookEventType,
  WebhookPayloadEnvelope,
} from '@hrm/shared-types';
import { ALL_WEBHOOK_EVENT_TYPES, WEBHOOK_SCHEMA_VERSION } from '@hrm/shared-types';

export const SUPPORTED_WEBHOOK_EVENTS = new Set<WebhookEventType>(
  ALL_WEBHOOK_EVENT_TYPES,
);

export const MAX_WEBHOOKS_PER_TENANT = 20;

export function isWebhookEventType(value: string): value is WebhookEventType {
  return SUPPORTED_WEBHOOK_EVENTS.has(value as WebhookEventType);
}

export function buildWebhookEnvelope(input: {
  eventType: WebhookDeliveryEventType;
  tenantId: string;
  companyId: string;
  data: Record<string, unknown>;
  deliveryId?: string;
}): WebhookPayloadEnvelope {
  return {
    schema_version: WEBHOOK_SCHEMA_VERSION,
    id: input.deliveryId ?? randomUUID(),
    type: input.eventType,
    created_at: new Date().toISOString(),
    tenant_id: input.tenantId,
    company_id: input.companyId,
    data: input.data,
  };
}

export function deriveWebhookEventId(
  eventType: WebhookEventType,
  data: Record<string, unknown>,
): string {
  switch (eventType) {
    case 'employee.created':
      return String(data.employeeId ?? data.employee_id ?? randomUUID());
    case 'leave.approved':
      return String(data.leaveRequestId ?? data.leave_request_id ?? randomUUID());
    case 'payroll.finalized':
      return String(data.payrollRunId ?? data.payroll_run_id ?? randomUUID());
    default:
      return randomUUID();
  }
}
