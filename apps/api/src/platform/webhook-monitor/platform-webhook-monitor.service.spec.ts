// apps/api/src/platform/webhook-monitor/platform-webhook-monitor.service.spec.ts
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantWebhookStatus, WebhookDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { NotificationDeliveryService } from '../../notifications/notification-delivery.service';
import { WebhookDeliveryQueueService } from '../../webhooks/webhook-delivery-queue.service';
import { SensitiveFieldService } from '../../crypto/sensitive-field.service';
import { PlatformWebhookMonitorService } from './platform-webhook-monitor.service';

describe('PlatformWebhookMonitorService', () => {
  let service: PlatformWebhookMonitorService;
  let prisma: any;
  let audit: any;
  let notificationDelivery: any;
  let deliveryQueue: any;

  beforeEach(async () => {
    prisma = {
      unscoped: {
        webhookDelivery: {
          count: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
          create: jest.fn(),
        },
        tenantWebhook: {
          count: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
          create: jest.fn(),
        },
        user: {
          findFirst: jest.fn().mockResolvedValue({ id: 'user-admin-1' }),
        },
        company: {
          findFirst: jest.fn().mockResolvedValue({ id: 'company-1' }),
        },
        tenant: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        platformUser: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      },
    };

    audit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    notificationDelivery = {
      deliverInApp: jest.fn().mockResolvedValue(undefined),
    };

    deliveryQueue = {
      retryDelivery: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformWebhookMonitorService,
        { provide: PrismaService, useValue: prisma },
        { provide: PlatformAuditService, useValue: audit },
        { provide: NotificationDeliveryService, useValue: notificationDelivery },
        { provide: WebhookDeliveryQueueService, useValue: deliveryQueue },
        {
          provide: SensitiveFieldService,
          useValue: { encrypt: (s: string) => `enc_${s}` },
        },
      ],
    }).compile();

    service = module.get<PlatformWebhookMonitorService>(
      PlatformWebhookMonitorService,
    );
  });

  describe('getSummary', () => {
    it('calculates 24h success rate and active/disabled counts correctly', async () => {
      prisma.unscoped.webhookDelivery.count
        .mockResolvedValueOnce(100) // total24h
        .mockResolvedValueOnce(95) // delivered24h
        .mockResolvedValueOnce(5) // failed24h
        .mockResolvedValueOnce(450) // total7d
        .mockResolvedValueOnce(8); // retrying

      prisma.unscoped.tenantWebhook.count
        .mockResolvedValueOnce(12) // active
        .mockResolvedValueOnce(3); // disabled

      prisma.unscoped.tenantWebhook.findMany.mockResolvedValue([]);

      const summary = await service.getSummary();

      expect(summary.totalDeliveries24h).toBe(100);
      expect(summary.successRate24h).toBe(95);
      expect(summary.failedCount24h).toBe(5);
      expect(summary.totalDeliveries7d).toBe(450);
      expect(summary.retryingCount).toBe(8);
      expect(summary.totalActiveEndpoints).toBe(12);
      expect(summary.totalDisabledEndpoints).toBe(3);
    });
  });

  describe('redeliver', () => {
    it('throws NotFoundException if delivery does not exist', async () => {
      prisma.unscoped.webhookDelivery.findUnique.mockResolvedValue(null);

      await expect(
        service.redeliver('del-unknown', { id: 'admin-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('resets attempts, schedules immediate retry, and logs to audit', async () => {
      const mockDelivery = {
        id: 'del-1',
        tenantId: 'tenant-1',
        webhookId: 'hook-1',
        eventType: 'employee.created',
        eventId: 'evt-1',
        schemaVersion: '2026-01-01',
        status: WebhookDeliveryStatus.failed,
        attempts: 6,
        httpStatus: 504,
        errorMessage: 'Timeout',
        queuedAt: new Date(),
        webhook: {
          id: 'hook-1',
          name: 'HR Sync',
          url: 'https://api.acme.com',
          status: TenantWebhookStatus.active,
        },
      };

      prisma.unscoped.webhookDelivery.findUnique.mockResolvedValue(mockDelivery);
      prisma.unscoped.webhookDelivery.update.mockResolvedValue({
        ...mockDelivery,
        status: WebhookDeliveryStatus.queued,
        attempts: 0,
        httpStatus: null,
        errorMessage: null,
      });

      const res = await service.redeliver('del-1', {
        id: 'admin-1',
        email: 'admin@platform.com',
      });

      expect(res.delivery.status).toBe('queued');
      expect(res.delivery.attempts).toBe(0);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'webhooks',
          action: 'webhook_delivery:redeliver',
          recordId: 'del-1',
        }),
      );
    });

    it('auto-enables disabled endpoint when redelivering', async () => {
      const mockDelivery = {
        id: 'del-2',
        tenantId: 'tenant-1',
        webhookId: 'hook-2',
        eventType: 'leave.approved',
        eventId: 'evt-2',
        schemaVersion: '2026-01-01',
        status: WebhookDeliveryStatus.failed,
        attempts: 6,
        queuedAt: new Date(),
        webhook: {
          id: 'hook-2',
          name: 'Legacy Hook',
          url: 'https://dead.acme.com',
          status: TenantWebhookStatus.disabled,
        },
      };

      prisma.unscoped.webhookDelivery.findUnique.mockResolvedValue(mockDelivery);
      prisma.unscoped.tenantWebhook.update.mockResolvedValue({
        ...mockDelivery.webhook,
        status: TenantWebhookStatus.active,
      });
      prisma.unscoped.webhookDelivery.update.mockResolvedValue({
        ...mockDelivery,
        status: WebhookDeliveryStatus.queued,
        attempts: 0,
      });

      await service.redeliver('del-2', { id: 'admin-1' });

      expect(prisma.unscoped.tenantWebhook.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'hook-2' },
          data: { status: TenantWebhookStatus.active },
        }),
      );
    });
  });

  describe('autoDisableFailingEndpoints', () => {
    it('identifies and disables endpoint failing continuously for >= 3 days', async () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 86400000);
      const mockActiveEndpoints = [
        {
          id: 'hook-failing',
          tenantId: 'tenant-1',
          name: 'Dead Jira Hook',
          url: 'https://dead-jira.com',
          status: TenantWebhookStatus.active,
          createdByUserId: 'user-admin-1',
          companyId: 'company-1',
          deliveries: [
            {
              id: 'del-old',
              status: WebhookDeliveryStatus.failed,
              createdAt: fiveDaysAgo,
            },
            {
              id: 'del-recent',
              status: WebhookDeliveryStatus.failed,
              createdAt: new Date(),
            },
          ],
        },
      ];

      prisma.unscoped.tenantWebhook.findMany.mockResolvedValue(mockActiveEndpoints);
      prisma.unscoped.tenantWebhook.update.mockResolvedValue({});

      const res = await service.autoDisableFailingEndpoints(
        { failingDays: 3, dryRun: false },
        { id: 'admin-1' },
      );

      expect(res.disabledCount).toBe(1);
      expect(res.disabledEndpoints[0].name).toBe('Dead Jira Hook');
      expect(prisma.unscoped.tenantWebhook.update).toHaveBeenCalledWith({
        where: { id: 'hook-failing' },
        data: { status: TenantWebhookStatus.disabled },
      });
      expect(notificationDelivery.deliverInApp).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          eventType: 'webhook.endpoint_disabled',
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'webhooks',
          action: 'webhook_endpoint:auto_disable',
        }),
      );
    });

    it('does not mutate or send notifications during dryRun', async () => {
      const mockActiveEndpoints = [
        {
          id: 'hook-failing-2',
          tenantId: 'tenant-1',
          name: 'Broken Hook',
          url: 'https://broken.com',
          status: TenantWebhookStatus.active,
          createdByUserId: 'user-admin-1',
          companyId: 'company-1',
          deliveries: [
            {
              id: 'del-1',
              status: WebhookDeliveryStatus.failed,
              createdAt: new Date(Date.now() - 4 * 86400000),
            },
          ],
        },
      ];

      prisma.unscoped.tenantWebhook.findMany.mockResolvedValue(mockActiveEndpoints);

      const res = await service.autoDisableFailingEndpoints({
        failingDays: 3,
        dryRun: true,
      });

      expect(res.dryRun).toBe(true);
      expect(res.disabledCount).toBe(0);
      expect(res.disabledEndpoints.length).toBe(1);
      expect(prisma.unscoped.tenantWebhook.update).not.toHaveBeenCalled();
      expect(notificationDelivery.deliverInApp).not.toHaveBeenCalled();
    });
  });
});
