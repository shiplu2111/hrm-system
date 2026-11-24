// apps/api/src/platform/webhook-monitor/platform-webhook-monitor.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import {
  Prisma,
  TenantWebhookStatus,
  WebhookDeliveryStatus,
} from '@prisma/client';
import {
  AutoDisableFailingEndpointsInput,
  AutoDisableFailingEndpointsResult,
  PlatformWebhookDeliveriesQuery,
  PlatformWebhookDeliveryItem,
  PlatformWebhookEndpointItem,
  PlatformWebhookEndpointsQuery,
  PlatformWebhookMonitorSummary,
  RedeliverWebhookResult,
  WEBHOOK_MAX_ATTEMPTS,
  webhookDeliveryState,
} from '@hrm/shared-types';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { NotificationDeliveryService } from '../../notifications/notification-delivery.service';
import { WebhookDeliveryQueueService } from '../../webhooks/webhook-delivery-queue.service';
import { SensitiveFieldService } from '../../crypto/sensitive-field.service';

export interface PlatformActorContext {
  id?: string;
  email?: string;
  roleName?: string;
  permissions?: Array<{ module: string; action: string }>;
}

@Injectable()
export class PlatformWebhookMonitorService implements OnModuleInit {
  private readonly logger = new Logger(PlatformWebhookMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformAudit: PlatformAuditService,
    @Optional() private readonly notificationDelivery?: NotificationDeliveryService,
    @Optional() private readonly deliveryQueue?: WebhookDeliveryQueueService,
    @Optional() private readonly sensitiveField?: SensitiveFieldService,
  ) {}

  private get db() {
    return (this.prisma as any).unscoped || this.prisma;
  }

  async onModuleInit() {
    await this.seedInitialWebhookDataIfEmpty();
  }

  /**
   * KPI Metrics Summary across all tenants.
   */
  async getSummary(): Promise<PlatformWebhookMonitorSummary> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      total24h,
      delivered24h,
      failed24h,
      total7d,
      retryingCount,
      activeEndpoints,
      disabledEndpoints,
    ] = await Promise.all([
      this.db.webhookDelivery.count({
        where: { createdAt: { gte: oneDayAgo } },
      }),
      this.db.webhookDelivery.count({
        where: {
          createdAt: { gte: oneDayAgo },
          status: WebhookDeliveryStatus.delivered,
        },
      }),
      this.db.webhookDelivery.count({
        where: {
          createdAt: { gte: oneDayAgo },
          status: WebhookDeliveryStatus.failed,
        },
      }),
      this.db.webhookDelivery.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
      this.db.webhookDelivery.count({
        where: {
          status: WebhookDeliveryStatus.queued,
          attempts: { gt: 0 },
        },
      }),
      this.db.tenantWebhook.count({
        where: { status: TenantWebhookStatus.active },
      }),
      this.db.tenantWebhook.count({
        where: { status: TenantWebhookStatus.disabled },
      }),
    ]);

    const successRate24h =
      total24h > 0 ? Math.round((delivered24h / total24h) * 1000) / 10 : 100;

    // Check how many active endpoints are failing for >= 3 days
    const endpoints = await this.listEndpoints({ status: 'active', limit: 200 });
    const failingEndpointsCount = endpoints.data.filter(
      (e) => e.consecutiveFailingDays >= 3,
    ).length;

    return {
      totalDeliveries24h: total24h,
      totalDeliveries7d: total7d,
      successRate24h,
      retryingCount,
      failedCount24h: failed24h,
      totalActiveEndpoints: activeEndpoints,
      totalDisabledEndpoints: disabledEndpoints,
      failingEndpointsCount,
    };
  }

  /**
   * List deliveries across all tenants with filters and pagination.
   */
  async listDeliveries(query: PlatformWebhookDeliveriesQuery = {}): Promise<{
    data: PlatformWebhookDeliveryItem[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    if (query.eventType) {
      where.eventType = query.eventType;
    }

    if (query.status && query.status !== 'all') {
      if (query.status === 'retrying') {
        where.status = WebhookDeliveryStatus.queued;
        where.attempts = { gt: 0 };
      } else if (query.status === 'pending') {
        where.status = WebhookDeliveryStatus.queued;
        where.attempts = 0;
      } else {
        where.status = query.status;
      }
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { eventType: { contains: s, mode: 'insensitive' } },
        { eventId: { contains: s, mode: 'insensitive' } },
        { errorMessage: { contains: s, mode: 'insensitive' } },
        { webhook: { name: { contains: s, mode: 'insensitive' } } },
        { webhook: { url: { contains: s, mode: 'insensitive' } } },
        { tenant: { name: { contains: s, mode: 'insensitive' } } },
        { tenant: { subdomain: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.db.webhookDelivery.count({ where }),
      this.db.webhookDelivery.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, subdomain: true } },
          webhook: { select: { id: true, name: true, url: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const data: PlatformWebhookDeliveryItem[] = rows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenantId,
      tenantName: r.tenant?.name || 'Unknown Tenant',
      tenantSubdomain: r.tenant?.subdomain || '',
      webhookId: r.webhookId,
      webhookName: r.webhook?.name || 'Unnamed Endpoint',
      webhookUrl: r.webhook?.url || '',
      eventType: r.eventType,
      eventId: r.eventId,
      schemaVersion: r.schemaVersion,
      status: r.status,
      deliveryState: webhookDeliveryState({
        status: r.status,
        attempts: r.attempts,
      }),
      httpStatus: r.httpStatus,
      attempts: r.attempts,
      maxAttempts: WEBHOOK_MAX_ATTEMPTS,
      errorMessage: r.errorMessage,
      queuedAt: r.queuedAt.toISOString(),
      lastAttemptAt: r.lastAttemptAt?.toISOString() || null,
      nextAttemptAt: r.nextAttemptAt?.toISOString() || null,
      deliveredAt: r.deliveredAt?.toISOString() || null,
      failedAt: r.failedAt?.toISOString() || null,
      payload: r.payload,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single delivery details with full payload.
   */
  async getDeliveryDetail(id: string): Promise<PlatformWebhookDeliveryItem> {
    const r = await this.db.webhookDelivery.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, name: true, subdomain: true } },
        webhook: { select: { id: true, name: true, url: true } },
      },
    });

    if (!r) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Webhook delivery not found',
      });
    }

    return {
      id: r.id,
      tenantId: r.tenantId,
      tenantName: r.tenant?.name || 'Unknown Tenant',
      tenantSubdomain: r.tenant?.subdomain || '',
      webhookId: r.webhookId,
      webhookName: r.webhook?.name || 'Unnamed Endpoint',
      webhookUrl: r.webhook?.url || '',
      eventType: r.eventType,
      eventId: r.eventId,
      schemaVersion: r.schemaVersion,
      status: r.status,
      deliveryState: webhookDeliveryState({
        status: r.status,
        attempts: r.attempts,
      }),
      httpStatus: r.httpStatus,
      attempts: r.attempts,
      maxAttempts: WEBHOOK_MAX_ATTEMPTS,
      errorMessage: r.errorMessage,
      queuedAt: r.queuedAt.toISOString(),
      lastAttemptAt: r.lastAttemptAt?.toISOString() || null,
      nextAttemptAt: r.nextAttemptAt?.toISOString() || null,
      deliveredAt: r.deliveredAt?.toISOString() || null,
      failedAt: r.failedAt?.toISOString() || null,
      payload: r.payload,
    };
  }

  /**
   * Manual redelivery action from the platform control plane.
   */
  async redeliver(
    deliveryId: string,
    actor: PlatformActorContext,
  ): Promise<RedeliverWebhookResult> {
    const existing = await this.db.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        tenant: { select: { id: true, name: true, subdomain: true } },
        webhook: true,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Webhook delivery not found',
      });
    }

    // Auto-enable endpoint if disabled so redelivery can proceed cleanly
    if (existing.webhook.status === TenantWebhookStatus.disabled) {
      await this.db.tenantWebhook.update({
        where: { id: existing.webhookId },
        data: { status: TenantWebhookStatus.active },
      });
    }

    // Reset delivery record to queued
    const updated = await this.db.webhookDelivery.update({
      where: { id: existing.id },
      data: {
        status: WebhookDeliveryStatus.queued,
        attempts: 0,
        httpStatus: null,
        errorMessage: null,
        failedAt: null,
        deliveredAt: null,
        queuedAt: new Date(),
        nextAttemptAt: new Date(), // scheduled immediately
      },
      include: {
        tenant: { select: { id: true, name: true, subdomain: true } },
        webhook: { select: { id: true, name: true, url: true } },
      },
    });

    // If delivery queue service is available, attempt enqueue
    if (this.deliveryQueue) {
      try {
        await this.deliveryQueue.retryDelivery(
          existing.tenantId,
          existing.id,
          {
            id: actor.id || 'platform-admin',
            tenantId: existing.tenantId,
            roleId: 'platform_admin',
            roleName: actor.roleName || 'platform_admin',
            employeeId: null,
            email: actor.email || 'platform@local',
            permissions: [{ module: 'settings', action: 'edit' }],
          } as any,
        );
      } catch (err: any) {
        this.logger.warn(`Could not enqueue via BullMQ worker: ${err?.message || err}`);
      }
    }

    // Audit log
    await this.platformAudit.log({
      userId: actor.id || null,
      tenantId: existing.tenantId,
      module: 'webhooks',
      action: 'webhook_delivery:redeliver',
      recordId: existing.id,
      reason: 'Manual redelivery triggered from Platform Control Plane',
      oldValue: {
        status: existing.status,
        attempts: existing.attempts,
        errorMessage: existing.errorMessage,
        httpStatus: existing.httpStatus,
      },
      newValue: {
        status: 'queued',
        attempts: 0,
        scheduledAt: new Date().toISOString(),
      },
    });

    const item: PlatformWebhookDeliveryItem = {
      id: updated.id,
      tenantId: updated.tenantId,
      tenantName: updated.tenant?.name || 'Unknown Tenant',
      tenantSubdomain: updated.tenant?.subdomain || '',
      webhookId: updated.webhookId,
      webhookName: updated.webhook?.name || 'Unnamed Endpoint',
      webhookUrl: updated.webhook?.url || '',
      eventType: updated.eventType,
      eventId: updated.eventId,
      schemaVersion: updated.schemaVersion,
      status: updated.status,
      deliveryState: webhookDeliveryState({
        status: updated.status,
        attempts: updated.attempts,
      }),
      httpStatus: updated.httpStatus,
      attempts: updated.attempts,
      maxAttempts: WEBHOOK_MAX_ATTEMPTS,
      errorMessage: updated.errorMessage,
      queuedAt: updated.queuedAt.toISOString(),
      lastAttemptAt: updated.lastAttemptAt?.toISOString() || null,
      nextAttemptAt: updated.nextAttemptAt?.toISOString() || null,
      deliveredAt: updated.deliveredAt?.toISOString() || null,
      failedAt: updated.failedAt?.toISOString() || null,
      payload: updated.payload,
    };

    return {
      delivery: item,
      message: `Delivery ${existing.id} has been queued for immediate redelivery.`,
    };
  }

  /**
   * List all webhook endpoints across all tenants with health metrics and consecutive failure days.
   */
  async listEndpoints(query: PlatformWebhookEndpointsQuery = {}): Promise<{
    data: PlatformWebhookEndpointItem[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }
    if (query.status && query.status !== 'all') {
      where.status = query.status as TenantWebhookStatus;
    }
    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { url: { contains: s, mode: 'insensitive' } },
        { tenant: { name: { contains: s, mode: 'insensitive' } } },
        { tenant: { subdomain: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

    const [total, rows] = await Promise.all([
      this.db.tenantWebhook.count({ where }),
      this.db.tenantWebhook.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, subdomain: true } },
          deliveries: {
            where: { createdAt: { gte: sevenDaysAgo } },
            select: {
              id: true,
              status: true,
              createdAt: true,
              deliveredAt: true,
              failedAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const data: PlatformWebhookEndpointItem[] = rows.map((w: any) => {
      const delivered7d = w.deliveries.filter(
        (d: any) => d.status === WebhookDeliveryStatus.delivered,
      ).length;
      const failed7d = w.deliveries.filter(
        (d: any) => d.status === WebhookDeliveryStatus.failed,
      ).length;
      const retryingNow = w.deliveries.filter(
        (d: any) => d.status === WebhookDeliveryStatus.queued,
      ).length;

      const lastDelivery = w.deliveries[0] || null;

      // Compute consecutive failing days
      let consecutiveFailingDays = 0;
      if (lastDelivery && lastDelivery.status === WebhookDeliveryStatus.failed) {
        // Find earliest consecutive failure going back from recent
        const failures = w.deliveries.filter(
          (d: any) => d.status === WebhookDeliveryStatus.failed,
        );
        if (failures.length > 0) {
          const oldestFailure = failures[failures.length - 1];
          const diffMs = Date.now() - new Date(oldestFailure.createdAt).getTime();
          consecutiveFailingDays = Math.max(1, Math.floor(diffMs / 86400000));
        }
      }

      return {
        id: w.id,
        tenantId: w.tenantId,
        tenantName: w.tenant?.name || 'Unknown Tenant',
        tenantSubdomain: w.tenant?.subdomain || '',
        name: w.name,
        url: w.url,
        events: w.events,
        status: w.status,
        description: w.description,
        delivered7d,
        failed7d,
        retryingNow,
        consecutiveFailingDays,
        lastDeliveryAt: lastDelivery ? lastDelivery.createdAt.toISOString() : null,
        lastDeliveryStatus: lastDelivery ? lastDelivery.status : null,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      };
    });

    let filtered = data;
    if (query.failingOnly) {
      filtered = data.filter((e) => e.consecutiveFailingDays >= 1);
    }

    return {
      data: filtered,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Auto-disable webhook endpoints failing continuously for N days with notification to the tenant.
   */
  async autoDisableFailingEndpoints(
    input: AutoDisableFailingEndpointsInput = {},
    actor: PlatformActorContext = {},
  ): Promise<AutoDisableFailingEndpointsResult> {
    const thresholdDays = Math.max(1, input.failingDays ?? 3);
    const isDryRun = Boolean(input.dryRun);

    const cutoffDate = new Date(Date.now() - thresholdDays * 86400000);

    // Find all active endpoints
    const activeEndpoints = await this.db.tenantWebhook.findMany({
      where: { status: TenantWebhookStatus.active },
      include: {
        tenant: { select: { id: true, name: true, subdomain: true } },
        deliveries: {
          where: { createdAt: { gte: cutoffDate } },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    const candidatesToDisable: Array<{
      id: string;
      name: string;
      url: string;
      tenantId: string;
      tenantName: string;
      consecutiveDays: number;
      createdByUserId: string;
      companyId: string | null;
    }> = [];

    for (const ep of activeEndpoints) {
      const deliveries = ep.deliveries || [];
      const hasDeliveries = deliveries.length > 0;
      const hasDelivered = deliveries.some(
        (d: any) => d.status === WebhookDeliveryStatus.delivered,
      );
      const hasFailures = deliveries.some(
        (d: any) => d.status === WebhookDeliveryStatus.failed,
      );

      // Endpoint must have failures, NO success in the period, and oldest failure >= threshold
      if (hasDeliveries && hasFailures && !hasDelivered) {
        const oldest = deliveries[deliveries.length - 1];
        const daysFailing = Math.max(
          thresholdDays,
          Math.floor((Date.now() - new Date(oldest.createdAt).getTime()) / 86400000),
        );

        candidatesToDisable.push({
          id: ep.id,
          name: ep.name,
          url: ep.url,
          tenantId: ep.tenantId,
          tenantName: ep.tenant?.name || 'Unknown Tenant',
          consecutiveDays: daysFailing,
          createdByUserId: ep.createdByUserId,
          companyId: ep.companyId,
        });
      }
    }

    let notificationsSent = 0;

    if (!isDryRun && candidatesToDisable.length > 0) {
      for (const target of candidatesToDisable) {
        // 1. Disable the endpoint
        await this.db.tenantWebhook.update({
          where: { id: target.id },
          data: { status: TenantWebhookStatus.disabled },
        });

        // 2. Send in-app notification to tenant
        try {
          // Find target recipient user (creator or first admin of the tenant)
          let recipientUserId = target.createdByUserId;
          if (!recipientUserId) {
            const adminUser = await this.db.user.findFirst({
              where: { tenantId: target.tenantId },
              select: { id: true },
            });
            recipientUserId = adminUser?.id;
          }

          if (recipientUserId) {
            let targetCompanyId: string = target.companyId || '';
            if (!targetCompanyId) {
              const comp = await this.db.company.findFirst({
                where: { tenantId: target.tenantId },
                select: { id: true },
              });
              targetCompanyId = comp?.id || target.tenantId;
            }

            if (this.notificationDelivery) {
              await this.notificationDelivery.deliverInApp({
                tenantId: target.tenantId,
                companyId: targetCompanyId,
                userId: recipientUserId,
                eventType: 'webhook.endpoint_disabled',
                title: `Webhook Endpoint Auto-Disabled: ${target.name}`,
                body: `Your webhook endpoint "${target.name}" (${target.url}) was automatically disabled after continuous delivery failures for ${target.consecutiveDays} days. Please verify the endpoint URL and server logs before re-enabling it in Settings.`,
                payload: {
                  webhookId: target.id,
                  webhookName: target.name,
                  url: target.url,
                  consecutiveFailingDays: target.consecutiveDays,
                  thresholdDays,
                },
              });
              notificationsSent++;
            }
          }
        } catch (err: any) {
          this.logger.warn(`Could not send auto-disable notification: ${err?.message || err}`);
        }

        // 3. Platform audit log
        await this.platformAudit.log({
          userId: actor.id || null,
          tenantId: target.tenantId,
          module: 'webhooks',
          action: 'webhook_endpoint:auto_disable',
          recordId: target.id,
          reason: `Auto-disabled webhook endpoint after failing continuously for ${target.consecutiveDays} days (threshold: ${thresholdDays} days)`,
          oldValue: { status: 'active', name: target.name, url: target.url },
          newValue: {
            status: 'disabled',
            disabledAt: new Date().toISOString(),
            consecutiveFailingDays: target.consecutiveDays,
          },
        });
      }
    }

    return {
      thresholdDays,
      endpointsEvaluated: activeEndpoints.length,
      disabledCount: isDryRun ? 0 : candidatesToDisable.length,
      disabledEndpoints: candidatesToDisable.map((c) => ({
        id: c.id,
        name: c.name,
        url: c.url,
        tenantId: c.tenantId,
        tenantName: c.tenantName,
        consecutiveDays: c.consecutiveDays,
      })),
      notificationsSent,
      dryRun: isDryRun,
    };
  }

  /**
   * Toggle endpoint active/disabled manually from control plane.
   */
  async toggleEndpointStatus(
    webhookId: string,
    status: TenantWebhookStatus,
    actor: PlatformActorContext,
  ): Promise<PlatformWebhookEndpointItem> {
    const existing = await this.db.tenantWebhook.findUnique({
      where: { id: webhookId },
      include: {
        tenant: { select: { id: true, name: true, subdomain: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Webhook endpoint not found',
      });
    }

    const updated = await this.db.tenantWebhook.update({
      where: { id: webhookId },
      data: { status },
      include: {
        tenant: { select: { id: true, name: true, subdomain: true } },
      },
    });

    await this.platformAudit.log({
      userId: actor.id || null,
      tenantId: existing.tenantId,
      module: 'webhooks',
      action: status === 'active' ? 'webhook_endpoint:enable' : 'webhook_endpoint:disable',
      recordId: existing.id,
      reason: `Endpoint status changed to ${status} via platform control plane`,
      oldValue: { status: existing.status },
      newValue: { status: updated.status },
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      tenantName: updated.tenant?.name || 'Unknown Tenant',
      tenantSubdomain: updated.tenant?.subdomain || '',
      name: updated.name,
      url: updated.url,
      events: updated.events,
      status: updated.status,
      description: updated.description,
      delivered7d: 0,
      failed7d: 0,
      retryingNow: 0,
      consecutiveFailingDays: 0,
      lastDeliveryAt: null,
      lastDeliveryStatus: null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Seed initial webhook endpoints and deliveries if table is empty.
   */
  async seedInitialWebhookDataIfEmpty(): Promise<void> {
    try {
      const count = await this.db.tenantWebhook.count();
      if (count > 0) return;

      this.logger.log('Seeding initial webhook endpoints and deliveries across tenants...');

      const tenants = await this.db.tenant.findMany({
        take: 5,
        orderBy: { createdAt: 'asc' },
      });

      if (!tenants.length) return;

      const acme = tenants.find((t: any) => t.subdomain === 'acme') || tenants[0];
      const techflow =
        tenants.find((t: any) => t.subdomain === 'techflow') || tenants[1] || tenants[0];

      const owner = await this.db.platformUser.findFirst({
        where: { email: 'platform.owner@cmsnbd.com' },
      });
      const creatorId = owner?.id || randomUUID();

      const encSecret = this.sensitiveField
        ? this.sensitiveField.encrypt('whsec_seeded_webhook_secret_key_9988')
        : 'whsec_seeded_webhook_secret_key_9988';

      // 1. Acme - Workday HR Hook (Healthy)
      const acmeHook1 = await this.db.tenantWebhook.create({
        data: {
          tenantId: acme.id,
          name: 'Workday HR Integration Hook',
          url: 'https://workday-gw.acme.corp/api/v1/hr-events',
          secretEncrypted: encSecret,
          events: ['employee.created', 'payroll.finalized'],
          status: TenantWebhookStatus.active,
          description: 'Production event stream to Acme enterprise Workday tenant',
          createdByUserId: creatorId,
        },
      });

      // 2. Acme - Legacy ERP Ingest Service (Retrying & intermittent failures)
      const acmeHook2 = await this.db.tenantWebhook.create({
        data: {
          tenantId: acme.id,
          name: 'Legacy ERP Ingest Service',
          url: 'https://erp-gw.acme-internal.com/events',
          secretEncrypted: encSecret,
          events: ['employee.created', 'leave.approved'],
          status: TenantWebhookStatus.active,
          description: 'On-premise ERP bridge gateway behind DMZ proxy',
          createdByUserId: creatorId,
        },
      });

      // 3. TechFlow - Slack Bot Hook (Healthy)
      const techflowHook1 = await this.db.tenantWebhook.create({
        data: {
          tenantId: techflow.id,
          name: 'Slack Employee & Leave Bot',
          url: 'https://hooks.slack.com/services/T00/B00/techflow-bot',
          secretEncrypted: encSecret,
          events: ['employee.created', 'leave.approved'],
          status: TenantWebhookStatus.active,
          description: 'Internal Slack channel notifications for HR team',
          createdByUserId: creatorId,
        },
      });

      // 4. TechFlow - Decommissioned Jira Hook (Failing continuously for 5 days!)
      const techflowHook2 = await this.db.tenantWebhook.create({
        data: {
          tenantId: techflow.id,
          name: 'Decommissioned Jira Hook',
          url: 'https://jira-dead-server.techflow.dev/webhook',
          secretEncrypted: encSecret,
          events: ['leave.approved'],
          status: TenantWebhookStatus.active,
          description: 'Old Jira test staging environment (deprecated server)',
          createdByUserId: creatorId,
        },
      });

      // Seed Deliveries
      // Delivery 1: Acme Workday - Delivered (HTTP 200)
      await this.db.webhookDelivery.create({
        data: {
          tenantId: acme.id,
          webhookId: acmeHook1.id,
          eventType: 'employee.created',
          eventId: `evt_${randomUUID()}`,
          schemaVersion: '2026-01-01',
          payload: {
            event: 'employee.created',
            data: {
              employeeId: 'EMP-001',
              firstName: 'Eleanor',
              lastName: 'Vance',
              department: 'Engineering',
            },
          },
          status: WebhookDeliveryStatus.delivered,
          attempts: 1,
          httpStatus: 200,
          queuedAt: new Date(Date.now() - 2 * 3600 * 1000),
          lastAttemptAt: new Date(Date.now() - 2 * 3600 * 1000),
          deliveredAt: new Date(Date.now() - 2 * 3600 * 1000),
        },
      });

      // Delivery 2: Acme Workday - Delivered (HTTP 200)
      await this.db.webhookDelivery.create({
        data: {
          tenantId: acme.id,
          webhookId: acmeHook1.id,
          eventType: 'payroll.finalized',
          eventId: `evt_${randomUUID()}`,
          schemaVersion: '2026-01-01',
          payload: {
            event: 'payroll.finalized',
            data: {
              payrollRunId: 'PAY-2026-11',
              totalNet: 142500,
              currency: 'USD',
            },
          },
          status: WebhookDeliveryStatus.delivered,
          attempts: 1,
          httpStatus: 200,
          queuedAt: new Date(Date.now() - 24 * 3600 * 1000),
          lastAttemptAt: new Date(Date.now() - 24 * 3600 * 1000),
          deliveredAt: new Date(Date.now() - 24 * 3600 * 1000),
        },
      });

      // Delivery 3: Acme ERP - Currently Retrying (HTTP 502, Attempt 2/6, Next retry in 15 mins)
      await this.db.webhookDelivery.create({
        data: {
          tenantId: acme.id,
          webhookId: acmeHook2.id,
          eventType: 'leave.approved',
          eventId: `evt_${randomUUID()}`,
          schemaVersion: '2026-01-01',
          payload: {
            event: 'leave.approved',
            data: {
              leaveRequestId: 'LR-9912',
              employeeId: 'EMP-004',
              days: 3,
            },
          },
          status: WebhookDeliveryStatus.queued,
          attempts: 2,
          httpStatus: 502,
          errorMessage: 'HTTP 502: Bad Gateway from upstream Nginx reverse proxy',
          queuedAt: new Date(Date.now() - 45 * 60 * 1000),
          lastAttemptAt: new Date(Date.now() - 15 * 60 * 1000),
          nextAttemptAt: new Date(Date.now() + 15 * 60 * 1000), // in 15 mins
        },
      });

      // Delivery 4: Acme ERP - Failed (HTTP 504 Gateway Timeout, Attempt 6/6)
      await this.db.webhookDelivery.create({
        data: {
          tenantId: acme.id,
          webhookId: acmeHook2.id,
          eventType: 'employee.created',
          eventId: `evt_${randomUUID()}`,
          schemaVersion: '2026-01-01',
          payload: {
            event: 'employee.created',
            data: {
              employeeId: 'EMP-009',
              firstName: 'Marcus',
              lastName: 'Brody',
            },
          },
          status: WebhookDeliveryStatus.failed,
          attempts: 6,
          httpStatus: 504,
          errorMessage: 'No response within 15 seconds (Gateway Timeout)',
          queuedAt: new Date(Date.now() - 6 * 3600 * 1000),
          lastAttemptAt: new Date(Date.now() - 3 * 3600 * 1000),
          failedAt: new Date(Date.now() - 3 * 3600 * 1000),
        },
      });

      // Delivery 5: Techflow Slack - Delivered (HTTP 200)
      await this.db.webhookDelivery.create({
        data: {
          tenantId: techflow.id,
          webhookId: techflowHook1.id,
          eventType: 'employee.created',
          eventId: `evt_${randomUUID()}`,
          schemaVersion: '2026-01-01',
          payload: {
            event: 'employee.created',
            data: { employeeId: 'TF-102', firstName: 'Devon', lastName: 'Miles' },
          },
          status: WebhookDeliveryStatus.delivered,
          attempts: 1,
          httpStatus: 200,
          queuedAt: new Date(Date.now() - 8 * 3600 * 1000),
          lastAttemptAt: new Date(Date.now() - 8 * 3600 * 1000),
          deliveredAt: new Date(Date.now() - 8 * 3600 * 1000),
        },
      });

      // Deliveries 6, 7, 8: Techflow Decommissioned Jira - Continuous failures across 5 days!
      await this.db.webhookDelivery.create({
        data: {
          tenantId: techflow.id,
          webhookId: techflowHook2.id,
          eventType: 'leave.approved',
          eventId: `evt_${randomUUID()}`,
          schemaVersion: '2026-01-01',
          payload: {
            event: 'leave.approved',
            data: { leaveRequestId: 'TF-LR-01' },
          },
          status: WebhookDeliveryStatus.failed,
          attempts: 6,
          httpStatus: null,
          errorMessage: 'Connection refused (ECONNREFUSED)',
          queuedAt: new Date(Date.now() - 5 * 86400000),
          lastAttemptAt: new Date(Date.now() - 5 * 86400000),
          failedAt: new Date(Date.now() - 5 * 86400000),
          createdAt: new Date(Date.now() - 5 * 86400000),
        },
      });

      await this.db.webhookDelivery.create({
        data: {
          tenantId: techflow.id,
          webhookId: techflowHook2.id,
          eventType: 'leave.approved',
          eventId: `evt_${randomUUID()}`,
          schemaVersion: '2026-01-01',
          payload: {
            event: 'leave.approved',
            data: { leaveRequestId: 'TF-LR-02' },
          },
          status: WebhookDeliveryStatus.failed,
          attempts: 6,
          httpStatus: null,
          errorMessage: 'Host not found (ENOTFOUND)',
          queuedAt: new Date(Date.now() - 3 * 86400000),
          lastAttemptAt: new Date(Date.now() - 3 * 86400000),
          failedAt: new Date(Date.now() - 3 * 86400000),
          createdAt: new Date(Date.now() - 3 * 86400000),
        },
      });

      await this.db.webhookDelivery.create({
        data: {
          tenantId: techflow.id,
          webhookId: techflowHook2.id,
          eventType: 'leave.approved',
          eventId: `evt_${randomUUID()}`,
          schemaVersion: '2026-01-01',
          payload: {
            event: 'leave.approved',
            data: { leaveRequestId: 'TF-LR-03' },
          },
          status: WebhookDeliveryStatus.failed,
          attempts: 6,
          httpStatus: null,
          errorMessage: 'Host not found (ENOTFOUND)',
          queuedAt: new Date(Date.now() - 2 * 3600 * 1000),
          lastAttemptAt: new Date(Date.now() - 2 * 3600 * 1000),
          failedAt: new Date(Date.now() - 2 * 3600 * 1000),
          createdAt: new Date(Date.now() - 2 * 3600 * 1000),
        },
      });

      this.logger.log('Seeded initial webhook data successfully.');
    } catch (err: any) {
      this.logger.warn(`Could not seed initial webhook data: ${err?.message || err}`);
    }
  }
}
