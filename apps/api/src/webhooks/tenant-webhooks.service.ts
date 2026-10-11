import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  TenantWebhookStatus,
  WebhookDeliveryStatus,
  type TenantWebhook,
} from '@prisma/client';
import type {
  CreateTenantWebhookResult,
  TenantWebhookRecord,
  WebhookDeliveryDetail,
  WebhookDeliveryList,
  WebhookDeliveryListQuery,
  WebhookDeliveryState,
  WebhookEndpointStats,
  WebhookEventType,
  WebhookPayloadEnvelope,
} from '@hrm/shared-types';
import { webhookDeliveryState } from '@hrm/shared-types';
import { randomBytes } from 'crypto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PlanFeaturesService } from '../billing/plan-features.service';
import { SensitiveFieldService } from '../crypto/sensitive-field.service';
import { PrismaService } from '../database/prisma.service';
import { isWebhookEventType, MAX_WEBHOOKS_PER_TENANT } from './webhook.constants';
import {
  deliveryStateWhere,
  toWebhookDeliveryRecord,
} from './webhook-delivery.mapper';
import { assertValidWebhookUrl, WebhookUrlError } from './webhook-url.util';

const STATS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const DELIVERY_STATES: WebhookDeliveryState[] = [
  'pending',
  'sending',
  'retrying',
  'delivered',
  'failed',
];

interface WebhookChanges {
  name?: string;
  url?: string;
  events?: string[];
  companyId?: string | null;
  description?: string | null;
  status?: 'active' | 'disabled';
}

@Injectable()
export class TenantWebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly sensitiveField: SensitiveFieldService,
    private readonly planFeatures: PlanFeaturesService,
  ) {}

  async countActive(tenantId: string): Promise<number> {
    return this.prisma.unscoped.tenantWebhook.count({
      where: { tenantId, status: TenantWebhookStatus.active },
    });
  }

  async listWebhooks(tenantId: string): Promise<TenantWebhookRecord[]> {
    const rows = await this.prisma.unscoped.tenantWebhook.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    return this.toRecords(tenantId, rows);
  }

  async createWebhook(
    tenantId: string,
    input: {
      name: string;
      url: string;
      events: string[];
      companyId?: string | null;
      description?: string;
    },
    user: AuthenticatedUser,
  ): Promise<CreateTenantWebhookResult> {
    await this.planFeatures.assertFeature(tenantId, 'api_access');

    const total = await this.prisma.unscoped.tenantWebhook.count({
      where: { tenantId },
    });
    if (total >= MAX_WEBHOOKS_PER_TENANT) {
      throw new BadRequestException({
        code: 'WEBHOOK_LIMIT_REACHED',
        message: `You can register up to ${MAX_WEBHOOKS_PER_TENANT} endpoints. Delete one you no longer use first.`,
      });
    }

    const url = this.parseUrl(input.url);
    const events = this.parseEvents(input.events);
    const companyId = await this.parseCompanyId(tenantId, input.companyId);
    const secret = this.generateSecret();

    const row = await this.prisma.unscoped.tenantWebhook.create({
      data: {
        tenantId,
        companyId,
        name: input.name.trim(),
        url,
        secretEncrypted: this.sensitiveField.encrypt(secret),
        events,
        status: TenantWebhookStatus.active,
        description: input.description?.trim() || null,
        createdByUserId: user.id,
      },
    });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'create',
      module: 'webhooks',
      recordId: row.id,
      newValue: this.auditSnapshot(row),
    });

    const [record] = await this.toRecords(tenantId, [row]);
    return { webhook: record, secret };
  }

  async updateWebhook(
    tenantId: string,
    webhookId: string,
    changes: WebhookChanges,
    user: AuthenticatedUser,
  ): Promise<TenantWebhookRecord> {
    const existing = await this.findOrThrow(tenantId, webhookId);

    const onlyDisabling =
      changes.status === 'disabled' &&
      Object.entries(changes).every(
        ([key, value]) => key === 'status' || value === undefined,
      );
    if (!onlyDisabling) {
      await this.planFeatures.assertFeature(tenantId, 'api_access');
    }

    const data: Partial<TenantWebhook> = {};
    if (changes.name !== undefined) data.name = changes.name.trim();
    if (changes.url !== undefined) data.url = this.parseUrl(changes.url);
    if (changes.events !== undefined) data.events = this.parseEvents(changes.events);
    if (changes.companyId !== undefined) {
      data.companyId = await this.parseCompanyId(tenantId, changes.companyId);
    }
    if (changes.description !== undefined) {
      data.description = changes.description?.trim() || null;
    }
    if (changes.status !== undefined) {
      data.status = changes.status as TenantWebhookStatus;
    }

    const row = await this.prisma.unscoped.tenantWebhook.update({
      where: { id: existing.id },
      data,
    });

    const before = this.auditSnapshot(existing);
    const after = this.auditSnapshot(row);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      await this.auditService.log({
        tenantId,
        userId: user.id,
        action: 'update',
        module: 'webhooks',
        recordId: row.id,
        oldValue: before,
        newValue: after,
      });
    }

    const [record] = await this.toRecords(tenantId, [row]);
    return record;
  }

  async rotateSecret(
    tenantId: string,
    webhookId: string,
    user: AuthenticatedUser,
  ): Promise<CreateTenantWebhookResult> {
    await this.planFeatures.assertFeature(tenantId, 'api_access');
    const existing = await this.findOrThrow(tenantId, webhookId);
    const secret = this.generateSecret();

    const row = await this.prisma.unscoped.tenantWebhook.update({
      where: { id: existing.id },
      data: {
        secretEncrypted: this.sensitiveField.encrypt(secret),
        secretRotatedAt: new Date(),
      },
    });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'update',
      module: 'webhooks',
      recordId: row.id,
      newValue: { event: 'secret_rotated' },
    });

    const [record] = await this.toRecords(tenantId, [row]);
    return { webhook: record, secret };
  }

  /** Removes the endpoint and its delivery log. Allowed on any plan. */
  async deleteWebhook(
    tenantId: string,
    webhookId: string,
    user: AuthenticatedUser,
  ): Promise<{ id: string; deleted: true }> {
    const existing = await this.findOrThrow(tenantId, webhookId);
    await this.prisma.unscoped.tenantWebhook.delete({ where: { id: existing.id } });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'delete',
      module: 'webhooks',
      recordId: existing.id,
      oldValue: this.auditSnapshot(existing),
    });

    return { id: existing.id, deleted: true };
  }

  async listDeliveries(
    tenantId: string,
    query: WebhookDeliveryListQuery,
  ): Promise<WebhookDeliveryList> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const scope = {
      tenantId,
      ...(query.webhookId ? { webhookId: query.webhookId } : {}),
    };
    const where =
      query.state && query.state !== 'all'
        ? { ...scope, ...deliveryStateWhere(query.state) }
        : scope;

    const [rows, total, byStatus, retrying] = await Promise.all([
      this.prisma.unscoped.webhookDelivery.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { webhook: { select: { name: true } } },
      }),
      this.prisma.unscoped.webhookDelivery.count({ where }),
      this.prisma.unscoped.webhookDelivery.groupBy({
        by: ['status'],
        where: scope,
        _count: { _all: true },
      }),
      this.prisma.unscoped.webhookDelivery.count({
        where: { ...scope, ...deliveryStateWhere('retrying') },
      }),
    ]);

    const statusCount = (status: WebhookDeliveryStatus) =>
      byStatus.find((entry) => entry.status === status)?._count._all ?? 0;
    const counts = Object.fromEntries(
      DELIVERY_STATES.map((state) => [state, 0]),
    ) as Record<WebhookDeliveryState, number>;
    counts.delivered = statusCount(WebhookDeliveryStatus.delivered);
    counts.failed = statusCount(WebhookDeliveryStatus.failed);
    counts.sending = statusCount(WebhookDeliveryStatus.processing);
    counts.retrying = retrying;
    counts.pending = statusCount(WebhookDeliveryStatus.queued) - retrying;

    return {
      items: rows.map((row) => toWebhookDeliveryRecord(row, row.webhook.name)),
      total,
      page,
      pageSize,
      counts,
    };
  }

  async getDelivery(
    tenantId: string,
    deliveryId: string,
  ): Promise<WebhookDeliveryDetail> {
    const row = await this.prisma.unscoped.webhookDelivery.findFirst({
      where: { id: deliveryId, tenantId },
      include: { webhook: { select: { name: true, url: true } } },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Delivery not found',
      });
    }
    return {
      ...toWebhookDeliveryRecord(row, row.webhook.name),
      url: row.webhook.url,
      payload: row.payload as unknown as WebhookPayloadEnvelope,
    };
  }

  revealSecret(stored: string): string {
    return this.sensitiveField.reveal(stored)!;
  }

  async findOrThrow(tenantId: string, webhookId: string): Promise<TenantWebhook> {
    const row = await this.prisma.unscoped.tenantWebhook.findFirst({
      where: { id: webhookId, tenantId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Webhook endpoint not found',
      });
    }
    return row;
  }

  private maskSecret(stored: string): string {
    try {
      const secret = this.sensitiveField.reveal(stored);
      return secret ? `whsec_••••${secret.slice(-4)}` : 'whsec_••••';
    } catch {
      return 'whsec_••••';
    }
  }

  private generateSecret(): string {
    return `whsec_${randomBytes(24).toString('hex')}`;
  }

  private parseUrl(raw: string): string {
    try {
      return assertValidWebhookUrl(raw);
    } catch (error) {
      if (error instanceof WebhookUrlError) {
        throw new BadRequestException({
          code: 'WEBHOOK_URL_INVALID',
          message: error.message,
        });
      }
      throw error;
    }
  }

  private parseEvents(events: string[]): WebhookEventType[] {
    const unique = [...new Set(events)];
    const invalid = unique.filter((event) => !isWebhookEventType(event));
    if (invalid.length > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Unsupported webhook events: ${invalid.join(', ')}`,
      });
    }
    if (unique.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Choose at least one event',
      });
    }
    return unique as WebhookEventType[];
  }

  private async parseCompanyId(
    tenantId: string,
    companyId: string | null | undefined,
  ): Promise<string | null> {
    if (!companyId) return null;
    const company = await this.prisma.unscoped.company.findFirst({
      where: { id: companyId, tenantId },
      select: { id: true },
    });
    if (!company) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Company not found in this organisation',
      });
    }
    return company.id;
  }

  private auditSnapshot(row: TenantWebhook) {
    return {
      name: row.name,
      url: row.url,
      events: row.events,
      companyId: row.companyId,
      description: row.description,
      status: row.status,
    };
  }

  private async toRecords(
    tenantId: string,
    rows: TenantWebhook[],
  ): Promise<TenantWebhookRecord[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const since = new Date(Date.now() - STATS_WINDOW_MS);

    const [names, companies, recent, retrying, latest] = await Promise.all([
      this.userNames(rows.map((row) => row.createdByUserId)),
      this.companyNames(rows.map((row) => row.companyId)),
      this.prisma.unscoped.webhookDelivery.groupBy({
        by: ['webhookId', 'status'],
        where: {
          tenantId,
          webhookId: { in: ids },
          createdAt: { gte: since },
          status: { in: [WebhookDeliveryStatus.delivered, WebhookDeliveryStatus.failed] },
        },
        _count: { _all: true },
      }),
      this.prisma.unscoped.webhookDelivery.groupBy({
        by: ['webhookId'],
        where: { tenantId, webhookId: { in: ids }, ...deliveryStateWhere('retrying') },
        _count: { _all: true },
      }),
      Promise.all(
        ids.map((webhookId) =>
          this.prisma.unscoped.webhookDelivery.findFirst({
            where: { webhookId },
            orderBy: { createdAt: 'desc' },
            select: { webhookId: true, status: true, attempts: true, createdAt: true },
          }),
        ),
      ),
    ]);

    return rows.map((row) => {
      const count = (status: WebhookDeliveryStatus) =>
        recent.find((entry) => entry.webhookId === row.id && entry.status === status)
          ?._count._all ?? 0;
      const last = latest.find((entry) => entry?.webhookId === row.id) ?? null;
      const stats: WebhookEndpointStats = {
        lastDeliveryAt: last?.createdAt.toISOString() ?? null,
        lastDeliveryState: last ? webhookDeliveryState(last) : null,
        deliveredLast7Days: count(WebhookDeliveryStatus.delivered),
        failedLast7Days: count(WebhookDeliveryStatus.failed),
        retryingNow:
          retrying.find((entry) => entry.webhookId === row.id)?._count._all ?? 0,
      };

      return {
        id: row.id,
        tenantId: row.tenantId,
        companyId: row.companyId,
        companyName: row.companyId ? (companies.get(row.companyId) ?? null) : null,
        name: row.name,
        url: row.url,
        secretMasked: this.maskSecret(row.secretEncrypted),
        events: row.events.filter(isWebhookEventType),
        status: row.status,
        description: row.description,
        createdByName: names.get(row.createdByUserId) ?? null,
        secretRotatedAt: row.secretRotatedAt?.toISOString() ?? null,
        stats,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  private async companyNames(ids: Array<string | null>): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return new Map();
    const companies = await this.prisma.unscoped.company.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(companies.map((company) => [company.id, company.name]));
  }

  private async userNames(userIds: string[]): Promise<Map<string, string>> {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return new Map();
    const users = await this.prisma.unscoped.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        email: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    });
    return new Map(
      users.map((user) => [
        user.id,
        user.employee
          ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
          : user.email,
      ]),
    );
  }
}
