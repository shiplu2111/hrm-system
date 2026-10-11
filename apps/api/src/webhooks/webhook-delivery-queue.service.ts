import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, TenantWebhookStatus, WebhookDeliveryStatus } from '@prisma/client';
import type {
  WebhookDeliveryEventType,
  WebhookDeliveryRecord,
  WebhookEventType,
} from '@hrm/shared-types';
import {
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_SCHEMA_VERSION,
  WEBHOOK_TEST_EVENT,
  webhookRetryDelayMs,
} from '@hrm/shared-types';
import { Queue, UnrecoverableError, Worker, type Job } from 'bullmq';
import { randomUUID } from 'crypto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PlanFeaturesService } from '../billing/plan-features.service';
import { PrismaService } from '../database/prisma.service';
import { getRedisConnection, isRedisConfigured } from '../queue/redis.connection';
import { TenantWebhooksService } from './tenant-webhooks.service';
import { buildWebhookEnvelope } from './webhook.constants';
import { toWebhookDeliveryRecord } from './webhook-delivery.mapper';
import {
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SCHEMA_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  signWebhookBody,
} from './webhook-signing.util';
import { assertDeliverableWebhookUrl, WebhookUrlError } from './webhook-url.util';

export const WEBHOOK_DELIVERY_QUEUE = 'webhook-delivery';

const REQUEST_TIMEOUT_MS = 15_000;

export interface WebhookDeliveryJobPayload {
  deliveryId: string;
}

export interface WebhookEnqueueInput {
  tenantId: string;
  companyId: string;
  eventType: WebhookEventType;
  eventId: string;
  data: Record<string, unknown>;
}

class DeliveryAttemptError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number | null = null,
  ) {
    super(message);
  }
}

function describeFetchError(error: unknown): string {
  if (error instanceof DeliveryAttemptError) return error.message;
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return `No response within ${REQUEST_TIMEOUT_MS / 1000} seconds`;
    }
    const code = (error.cause as { code?: string } | undefined)?.code;
    if (code === 'ECONNREFUSED') return 'Connection refused (ECONNREFUSED)';
    if (code === 'ENOTFOUND') return 'Host not found (ENOTFOUND)';
    if (code === 'ECONNRESET') return 'Connection reset (ECONNRESET)';
    if (code?.startsWith('ERR_TLS') || code?.includes('CERT')) {
      return `TLS certificate problem (${code})`;
    }
    return code ? `${error.message} (${code})` : error.message;
  }
  return 'Webhook delivery failed';
}

@Injectable()
export class WebhookDeliveryQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookDeliveryQueueService.name);
  private queue: Queue<WebhookDeliveryJobPayload> | null = null;
  private worker: Worker<WebhookDeliveryJobPayload> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooksService: TenantWebhooksService,
    private readonly planFeatures: PlanFeaturesService,
    private readonly auditService: AuditService,
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
        attempts: WEBHOOK_MAX_ATTEMPTS,
        backoff: { type: 'custom' },
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    });

    this.worker = new Worker<WebhookDeliveryJobPayload>(
      WEBHOOK_DELIVERY_QUEUE,
      async (job) => this.processDelivery(job),
      {
        connection,
        concurrency: 3,
        settings: {
          backoffStrategy: (attemptsMade: number) => webhookRetryDelayMs(attemptsMade),
        },
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.warn(`Webhook delivery ${job?.data.deliveryId} failed: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  isAvailable(): boolean {
    return this.queue !== null;
  }

  async enqueue(input: WebhookEnqueueInput): Promise<void> {
    const webhooks = await this.prisma.unscoped.tenantWebhook.findMany({
      where: {
        tenantId: input.tenantId,
        status: TenantWebhookStatus.active,
        events: { has: input.eventType },
        OR: [{ companyId: null }, { companyId: input.companyId }],
      },
    });
    if (webhooks.length === 0) {
      return;
    }

    if (!(await this.planFeatures.hasFeature(input.tenantId, 'api_access'))) {
      return;
    }

    if (!this.queue) {
      this.logger.warn(
        `Webhook queue unavailable — skipped ${input.eventType} for tenant ${input.tenantId}`,
      );
      return;
    }

    for (const webhook of webhooks) {
      const delivery = await this.createDelivery({
        tenantId: input.tenantId,
        companyId: input.companyId,
        webhookId: webhook.id,
        eventType: input.eventType,
        eventId: input.eventId,
        data: input.data,
      });
      if (delivery) {
        await this.addJob(delivery.id, `webhook-${delivery.id}`);
      }
    }
  }

  async sendTest(
    tenantId: string,
    webhookId: string,
    user: AuthenticatedUser,
  ): Promise<WebhookDeliveryRecord> {
    await this.planFeatures.assertFeature(tenantId, 'api_access');
    const webhook = await this.webhooksService.findOrThrow(tenantId, webhookId);
    this.assertCanDeliver(webhook.status);

    const delivery = await this.createDelivery({
      tenantId,
      companyId: webhook.companyId ?? tenantId,
      webhookId,
      eventType: WEBHOOK_TEST_EVENT,
      eventId: `test-${randomUUID()}`,
      data: {
        test: true,
        message: 'Test event from CMSN-HR. Your endpoint received and can verify it.',
        triggeredByUserId: user.id,
      },
    });
    await this.addJob(delivery!.id, `webhook-${delivery!.id}`);
    return toWebhookDeliveryRecord(delivery!, webhook.name);
  }

  async retryDelivery(
    tenantId: string,
    deliveryId: string,
    user: AuthenticatedUser,
  ): Promise<WebhookDeliveryRecord> {
    await this.planFeatures.assertFeature(tenantId, 'api_access');
    const existing = await this.prisma.unscoped.webhookDelivery.findFirst({
      where: { id: deliveryId, tenantId },
      include: { webhook: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Delivery not found',
      });
    }
    if (existing.status !== WebhookDeliveryStatus.failed) {
      throw new ConflictException({
        code: 'WEBHOOK_DELIVERY_NOT_FAILED',
        message: 'Only failed deliveries can be retried. This one is still in progress or already delivered.',
      });
    }
    this.assertCanDeliver(existing.webhook.status);

    const row = await this.prisma.unscoped.webhookDelivery.update({
      where: { id: existing.id },
      data: {
        status: WebhookDeliveryStatus.queued,
        attempts: 0,
        httpStatus: null,
        errorMessage: null,
        failedAt: null,
        nextAttemptAt: null,
        queuedAt: new Date(),
      },
    });
    await this.addJob(row.id, `webhook-${row.id}-retry-${Date.now()}`);

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'update',
      module: 'webhooks',
      recordId: existing.webhookId,
      newValue: {
        event: 'delivery_retried',
        deliveryId: existing.id,
        eventType: existing.eventType,
        previousError: existing.errorMessage,
      },
    });

    return toWebhookDeliveryRecord(row, existing.webhook.name);
  }

  private assertCanDeliver(status: TenantWebhookStatus): void {
    if (status !== TenantWebhookStatus.active) {
      throw new ConflictException({
        code: 'WEBHOOK_DISABLED',
        message: 'Enable the endpoint first.',
      });
    }
    if (!this.queue) {
      throw new ServiceUnavailableException({
        code: 'WEBHOOK_DELIVERY_UNAVAILABLE',
        message: 'Webhook delivery is not running on this server (Redis is not configured).',
      });
    }
  }

  private async createDelivery(input: {
    tenantId: string;
    companyId: string;
    webhookId: string;
    eventType: WebhookDeliveryEventType;
    eventId: string;
    data: Record<string, unknown>;
  }) {
    const envelope = buildWebhookEnvelope({
      eventType: input.eventType,
      tenantId: input.tenantId,
      companyId: input.companyId,
      data: input.data,
    });
    try {
      return await this.prisma.unscoped.webhookDelivery.create({
        data: {
          tenantId: input.tenantId,
          webhookId: input.webhookId,
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
        return null;
      }
      throw error;
    }
  }

  private async addJob(deliveryId: string, jobId: string): Promise<void> {
    let job: Job<WebhookDeliveryJobPayload>;
    try {
      job = await this.queue!.add('deliver', { deliveryId }, { jobId });
    } catch (error) {
      await this.markFailed(deliveryId, 'Could not be queued for delivery');
      throw error;
    }
    await this.prisma.unscoped.webhookDelivery.update({
      where: { id: deliveryId },
      data: { bullJobId: job.id ?? jobId },
    });
  }

  private async processDelivery(job: Job<WebhookDeliveryJobPayload>): Promise<void> {
    const delivery = await this.prisma.unscoped.webhookDelivery.findUnique({
      where: { id: job.data.deliveryId },
      include: { webhook: true },
    });

    if (
      !delivery ||
      delivery.status === WebhookDeliveryStatus.delivered ||
      delivery.status === WebhookDeliveryStatus.failed
    ) {
      return;
    }

    const isTest = delivery.eventType === WEBHOOK_TEST_EVENT;
    if (delivery.webhook.status !== TenantWebhookStatus.active) {
      await this.markFailed(delivery.id, 'Endpoint was disabled before delivery');
      return;
    }
    if (!isTest && !delivery.webhook.events.includes(delivery.eventType)) {
      await this.markFailed(delivery.id, 'Endpoint is no longer subscribed to this event');
      return;
    }
    if (!(await this.planFeatures.hasFeature(delivery.tenantId, 'api_access'))) {
      await this.markFailed(delivery.id, 'Webhooks need the Enterprise plan');
      return;
    }

    const attempt = job.attemptsMade + 1;
    await this.prisma.unscoped.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: WebhookDeliveryStatus.processing,
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        nextAttemptAt: null,
      },
    });

    try {
      await assertDeliverableWebhookUrl(delivery.webhook.url);
    } catch (error) {
      if (error instanceof WebhookUrlError) {
        await this.markFailed(delivery.id, error.message, null);
        throw new UnrecoverableError(error.message);
      }
      await this.recordFailedAttempt(job, delivery.id, attempt, describeFetchError(error), null);
      throw error;
    }

    const secret = this.webhooksService.revealSecret(delivery.webhook.secretEncrypted);
    const body = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000);

    let httpStatus: number | null = null;
    try {
      const response = await fetch(delivery.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CMSN-HR-Webhooks/1.0',
          [WEBHOOK_SIGNATURE_HEADER]: signWebhookBody(secret, timestamp, body),
          [WEBHOOK_EVENT_HEADER]: delivery.eventType,
          [WEBHOOK_SCHEMA_HEADER]: delivery.schemaVersion,
          [WEBHOOK_DELIVERY_HEADER]: delivery.id,
        },
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      httpStatus = response.status;

      if (response.status >= 300 && response.status < 400) {
        throw new DeliveryAttemptError(
          `Endpoint redirected (HTTP ${response.status}); redirects aren't followed. Register the final URL.`,
          httpStatus,
        );
      }
      if (!response.ok) {
        const text = (await response.text().catch(() => '')).trim();
        throw new DeliveryAttemptError(
          `HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
          httpStatus,
        );
      }

      await this.prisma.unscoped.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: WebhookDeliveryStatus.delivered,
          httpStatus,
          deliveredAt: new Date(),
          errorMessage: null,
          failedAt: null,
          nextAttemptAt: null,
        },
      });
    } catch (error) {
      await this.recordFailedAttempt(
        job,
        delivery.id,
        attempt,
        describeFetchError(error),
        httpStatus,
      );
      throw error;
    }
  }

  private async recordFailedAttempt(
    job: Job<WebhookDeliveryJobPayload>,
    deliveryId: string,
    attempt: number,
    message: string,
    httpStatus: number | null,
  ): Promise<void> {
    if (attempt >= (job.opts.attempts ?? WEBHOOK_MAX_ATTEMPTS)) {
      await this.markFailed(deliveryId, message, httpStatus);
      return;
    }
    await this.prisma.unscoped.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: WebhookDeliveryStatus.queued,
        errorMessage: message,
        httpStatus,
        nextAttemptAt: new Date(Date.now() + webhookRetryDelayMs(attempt)),
      },
    });
  }

  /** Omit `httpStatus` to keep the response code from the previous attempt. */
  private async markFailed(
    deliveryId: string,
    message: string,
    httpStatus?: number | null,
  ): Promise<void> {
    await this.prisma.unscoped.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: WebhookDeliveryStatus.failed,
        errorMessage: message,
        ...(httpStatus !== undefined ? { httpStatus } : {}),
        failedAt: new Date(),
        nextAttemptAt: null,
      },
    });
  }
}
