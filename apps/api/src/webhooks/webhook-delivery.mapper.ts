import type { WebhookDelivery } from '@prisma/client';
import { Prisma, WebhookDeliveryStatus } from '@prisma/client';
import type {
  WebhookDeliveryEventType,
  WebhookDeliveryRecord,
  WebhookDeliveryState,
} from '@hrm/shared-types';
import { WEBHOOK_MAX_ATTEMPTS, webhookDeliveryState } from '@hrm/shared-types';

export function toWebhookDeliveryRecord(
  row: WebhookDelivery,
  webhookName: string,
): WebhookDeliveryRecord {
  return {
    id: row.id,
    webhookId: row.webhookId,
    webhookName,
    eventType: row.eventType as WebhookDeliveryEventType,
    eventId: row.eventId,
    schemaVersion: row.schemaVersion,
    status: row.status,
    state: webhookDeliveryState(row),
    attempts: row.attempts,
    maxAttempts: WEBHOOK_MAX_ATTEMPTS,
    httpStatus: row.httpStatus,
    errorMessage: row.errorMessage,
    queuedAt: row.queuedAt.toISOString(),
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function deliveryStateWhere(
  state: WebhookDeliveryState,
): Prisma.WebhookDeliveryWhereInput {
  switch (state) {
    case 'delivered':
      return { status: WebhookDeliveryStatus.delivered };
    case 'failed':
      return { status: WebhookDeliveryStatus.failed };
    case 'sending':
      return { status: WebhookDeliveryStatus.processing };
    case 'retrying':
      return { status: WebhookDeliveryStatus.queued, attempts: { gt: 0 } };
    case 'pending':
      return { status: WebhookDeliveryStatus.queued, attempts: 0 };
  }
}
