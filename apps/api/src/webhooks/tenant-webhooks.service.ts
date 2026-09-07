import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantWebhookStatus } from '@prisma/client';
import type {
  CreateTenantWebhookResult,
  TenantWebhookRecord,
  WebhookDeliveryRecord,
  WebhookEventType,
} from '@hrm/shared-types';
import { randomBytes } from 'crypto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PlanFeaturesService } from '../billing/plan-features.service';
import { SensitiveFieldService } from '../crypto/sensitive-field.service';
import { PrismaService } from '../database/prisma.service';
import { isWebhookEventType } from './webhook.constants';

@Injectable()
export class TenantWebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly sensitiveField: SensitiveFieldService,
    private readonly planFeatures: PlanFeaturesService,
  ) {}

  async listWebhooks(tenantId: string): Promise<TenantWebhookRecord[]> {
    const rows = await this.prisma.unscoped.tenantWebhook.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'desc' }],
    });
    return rows.map((row) => this.toRecord(row));
  }

  async createWebhook(
    tenantId: string,
    input: {
      name: string;
      url: string;
      events: string[];
      companyId?: string;
      description?: string;
    },
    user: AuthenticatedUser,
  ): Promise<CreateTenantWebhookResult> {
    await this.planFeatures.assertFeature(tenantId, 'api_access');
    const events = this.parseEvents(input.events);
    const secret = `whsec_${randomBytes(24).toString('hex')}`;

    const row = await this.prisma.unscoped.tenantWebhook.create({
      data: {
        tenantId,
        companyId: input.companyId ?? null,
        name: input.name.trim(),
        url: input.url.trim(),
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
      newValue: { name: row.name, url: row.url, events },
    });

    return { webhook: this.toRecord(row), secret };
  }

  async disableWebhook(
    tenantId: string,
    webhookId: string,
    user: AuthenticatedUser,
  ): Promise<TenantWebhookRecord> {
    await this.planFeatures.assertFeature(tenantId, 'api_access');

    const existing = await this.prisma.unscoped.tenantWebhook.findFirst({
      where: { id: webhookId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Webhook not found',
      });
    }

    const row = await this.prisma.unscoped.tenantWebhook.update({
      where: { id: webhookId },
      data: { status: TenantWebhookStatus.disabled },
    });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'delete',
      module: 'webhooks',
      recordId: webhookId,
    });

    return this.toRecord(row);
  }

  async listDeliveries(
    tenantId: string,
    webhookId?: string,
  ): Promise<WebhookDeliveryRecord[]> {
    const rows = await this.prisma.unscoped.webhookDelivery.findMany({
      where: {
        tenantId,
        ...(webhookId ? { webhookId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 50,
    });

    return rows.map((row) => ({
      id: row.id,
      webhookId: row.webhookId,
      eventType: row.eventType as WebhookEventType,
      eventId: row.eventId,
      schemaVersion: row.schemaVersion,
      status: row.status,
      attempts: row.attempts,
      httpStatus: row.httpStatus,
      errorMessage: row.errorMessage,
      queuedAt: row.queuedAt.toISOString(),
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      failedAt: row.failedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  revealSecret(stored: string): string {
    return this.sensitiveField.reveal(stored)!;
  }

  private parseEvents(events: string[]): WebhookEventType[] {
    const invalid = events.filter((event) => !isWebhookEventType(event));
    if (invalid.length > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Unsupported webhook events: ${invalid.join(', ')}`,
      });
    }
    return events as WebhookEventType[];
  }

  private toRecord(row: {
    id: string;
    tenantId: string;
    companyId: string | null;
    name: string;
    url: string;
    secretEncrypted: string;
    events: string[];
    status: TenantWebhookStatus;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): TenantWebhookRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      name: row.name,
      url: row.url,
      secretMasked: this.sensitiveField.mask(row.secretEncrypted) ?? 'whsec••••••••',
      events: row.events.filter(isWebhookEventType),
      status: row.status,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
