import { Injectable, Logger } from '@nestjs/common';
import type { WebhookEventType } from '@hrm/shared-types';
import {
  buildWebhookEnvelope,
  deriveWebhookEventId,
  isWebhookEventType,
} from './webhook.constants';
import { WebhookDeliveryQueueService } from './webhook-delivery-queue.service';

export interface WebhookEmitInput {
  tenantId: string;
  companyId: string;
  eventType: string;
  data: Record<string, unknown>;
  eventId?: string;
}

/** Fire-and-forget outbound webhook dispatch (API_GUIDELINES.md §9). */
@Injectable()
export class WebhookEmitterService {
  private readonly logger = new Logger(WebhookEmitterService.name);

  constructor(private readonly deliveryQueue: WebhookDeliveryQueueService) {}

  async emit(input: WebhookEmitInput): Promise<void> {
    if (!isWebhookEventType(input.eventType)) {
      return;
    }

    const eventId =
      input.eventId ?? deriveWebhookEventId(input.eventType, input.data);

    try {
      await this.deliveryQueue.enqueue({
        tenantId: input.tenantId,
        companyId: input.companyId,
        eventType: input.eventType,
        eventId,
        data: input.data,
      });
    } catch (error) {
      this.logger.error(
        `Failed to enqueue webhook ${input.eventType}:${eventId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  buildEnvelope(
    eventType: WebhookEventType,
    tenantId: string,
    companyId: string,
    data: Record<string, unknown>,
    deliveryId: string,
  ) {
    return buildWebhookEnvelope({
      eventType,
      tenantId,
      companyId,
      data,
      deliveryId,
    });
  }
}
