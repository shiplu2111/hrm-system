import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, TenantWebhookStatus, WebhookDeliveryStatus } from '@prisma/client';
import type { WebhookEventType } from '@hrm/shared-types';
import { WEBHOOK_SCHEMA_VERSION } from '@hrm/shared-types';
import { Queue, Worker, type Job } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { getRedisConnection, isRedisConfigured } from '../queue/redis.connection';
import { TenantWebhooksService } from './tenant-webhooks.service';
import { buildWebhookEnvelope } from './webhook.constants';
import {
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SCHEMA_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  signWebhookBody,
} from './webhook-signing.util';

export const WEBHOOK_DELIVERY_QUEUE = 'webhook-delivery';

export interface WebhookDeliveryJobPayload {
  deliveryId: string;
}

export interface WebhookEnqueueInput {
  tenantId: string;
  companyId: string;
  eventType: WebhookEventType;
  eventId: string;
  data: Record<string, unknown>;
  webhookId?: string;
}

@Injectable()
export class WebhookDeliveryQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookDeliveryQueueService.name);
  private queue: Queue<WebhookDeliveryJobPayload> | null = null;
  private worker: Worker<WebhookDeliveryJobPayload> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooksService: TenantWebhooksService,
  ) {}

  onModuleInit(): void {
    if (!isRedisConfigured()) {
      this.logger.warn(
        'REDIS_URL not set — outbound webhook delivery queue disabled',
      );
      return;
    }

    const connection = getRedisConnection();
    this.queue = new Queue<WebhookDeliveryJobPayload>(WEBHOOK_DELIVERY_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 15_000 },
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    });

    this.worker = new Worker<WebhookDeliveryJobPayload>(
      WEBHOOK_DELIVERY_QUEUE,
      async (job) => this.processDelivery(job),
      { connection, concurrency: 3 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.warn(
        `Webhook delivery ${job?.id} failed: ${err.message}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueue(input: WebhookEnqueueInput): Promise<void> {
    const webhooks = await this.prisma.unscoped.tenantWebhook.findMany({
      where: {
        tenantId: input.tenantId,
        status: TenantWebhookStatus.active,
        events: { has: input.eventType },
        ...(input.webhookId ? { id: input.webhookId } : {}),
        OR: [{ companyId: null }, { companyId: input.companyId }],
      },
    });

    if (webhooks.length === 0) {
      return;
    }

    if (!this.queue) {
      this.logger.warn(
        `Webhook queue unavailable — skipped ${input.eventType} for tenant ${input.tenantId}`,
      );
      return;
    }

    for (const webhook of webhooks) {
      const envelope = buildWebhookEnvelope({
        eventType: input.eventType,
        tenantId: input.tenantId,
        companyId: input.companyId,
        data: input.data,
      });

      let delivery;
      try {
        delivery = await this.prisma.unscoped.webhookDelivery.create({
          data: {
            tenantId: input.tenantId,
            webhookId: webhook.id,
            eventType: input.eventType,
            eventId: input.eventId,
            schemaVersion: WEBHOOK_SCHEMA_VERSION,
            payload: envelope as unknown as Prisma.InputJsonValue,
            status: WebhookDeliveryStatus.queued,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }

      const job = await this.queue.add(
        'deliver',
        { deliveryId: delivery.id },
        { jobId: `webhook:${delivery.id}` },
      );

      await this.prisma.unscoped.webhookDelivery.update({
        where: { id: delivery.id },
        data: { bullJobId: job.id ?? delivery.id },
      });
    }
  }

  private async processDelivery(
    job: Job<WebhookDeliveryJobPayload>,
  ): Promise<void> {
    const delivery = await this.prisma.unscoped.webhookDelivery.findUnique({
      where: { id: job.data.deliveryId },
      include: { webhook: true },
    });

    if (!delivery || delivery.status === WebhookDeliveryStatus.delivered) {
      return;
    }

    if (
      delivery.webhook.status !== TenantWebhookStatus.active ||
      !delivery.webhook.events.includes(delivery.eventType)
    ) {
      await this.markFailed(delivery.id, 'Webhook endpoint is disabled');
      return;
    }

    await this.prisma.unscoped.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: WebhookDeliveryStatus.processing,
        attempts: { increment: 1 },
      },
    });

    const secret = this.webhooksService.revealSecret(
      delivery.webhook.secretEncrypted,
    );
    const body = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signWebhookBody(secret, timestamp, body);

    try {
      const response = await fetch(delivery.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [WEBHOOK_SIGNATURE_HEADER]: signature,
          [WEBHOOK_EVENT_HEADER]: delivery.eventType,
          [WEBHOOK_SCHEMA_HEADER]: delivery.schemaVersion,
          [WEBHOOK_DELIVERY_HEADER]: delivery.id,
        },
        body,
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
          `HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
        );
      }

      await this.prisma.unscoped.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: WebhookDeliveryStatus.delivered,
          httpStatus: response.status,
          deliveredAt: new Date(),
          errorMessage: null,
          failedAt: null,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Webhook delivery failed';
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

      if (isLastAttempt) {
        await this.markFailed(delivery.id, message);
      }

      throw error;
    }
  }

  private async markFailed(deliveryId: string, message: string): Promise<void> {
    await this.prisma.unscoped.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: WebhookDeliveryStatus.failed,
        errorMessage: message,
        failedAt: new Date(),
      },
    });
  }
}
