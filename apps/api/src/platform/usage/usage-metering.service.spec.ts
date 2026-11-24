// usage-metering.service.spec.ts
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_DAY_AT_1AM: '0 1 * * *', EVERY_DAY_AT_MIDNIGHT: '0 0 * * *' },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { UsageMeteringService } from './usage-metering.service';
import { PrismaService } from '../../database/prisma.service';
import { HealthTelemetryService } from '../health/health-telemetry.service';

describe('UsageMeteringService', () => {
  let service: UsageMeteringService;
  let prisma: PrismaService;
  let telemetry: HealthTelemetryService;

  const mockPrisma = {
    unscoped: {
      tenant: {
        findMany: jest.fn(),
      },
      employee: {
        count: jest.fn(),
      },
      employmentContractDocument: {
        aggregate: jest.fn(),
      },
      candidateDocument: {
        aggregate: jest.fn(),
      },
      jobApplicationResume: {
        aggregate: jest.fn(),
      },
      expenseClaimReceipt: {
        aggregate: jest.fn(),
      },
      employeeCertification: {
        aggregate: jest.fn(),
      },
      notificationDelivery: {
        findMany: jest.fn(),
      },
      inAppNotification: {
        count: jest.fn(),
      },
      attendanceSyncEvent: {
        count: jest.fn(),
      },
      usageDaily: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    },
  };

  const mockTelemetry = {
    getTenantApiCalls: jest.fn().mockReturnValue(45),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageMeteringService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: HealthTelemetryService, useValue: mockTelemetry },
      ],
    }).compile();

    service = module.get<UsageMeteringService>(UsageMeteringService);
    prisma = module.get<PrismaService>(PrismaService);
    telemetry = module.get<HealthTelemetryService>(HealthTelemetryService);
    jest.clearAllMocks();
  });

  describe('runDailyMetering', () => {
    it('calculates active employees, storage, notifications, and sync events per tenant and upserts into usage_daily', async () => {
      mockPrisma.unscoped.tenant.findMany.mockResolvedValueOnce([
        { id: 'tenant-1', name: 'Acme Corp', subdomain: 'acme' },
      ]);
      mockPrisma.unscoped.employee.count.mockResolvedValueOnce(25); // active employees
      mockPrisma.unscoped.employmentContractDocument.aggregate.mockResolvedValueOnce({
        _sum: { sizeBytes: 1048576 }, // 1 MB
      });
      mockPrisma.unscoped.candidateDocument.aggregate.mockResolvedValueOnce({ _sum: { sizeBytes: 0 } });
      mockPrisma.unscoped.jobApplicationResume.aggregate.mockResolvedValueOnce({ _sum: { sizeBytes: 0 } });
      mockPrisma.unscoped.expenseClaimReceipt.aggregate.mockResolvedValueOnce({ _sum: { sizeBytes: 0 } });
      mockPrisma.unscoped.employeeCertification.aggregate.mockResolvedValueOnce({ _sum: { fileSizeBytes: 0 } });

      mockPrisma.unscoped.notificationDelivery.findMany.mockResolvedValueOnce([
        { channel: 'email' },
        { channel: 'email' },
        { channel: 'push' },
      ]);
      mockPrisma.unscoped.inAppNotification.count.mockResolvedValueOnce(5);
      mockPrisma.unscoped.attendanceSyncEvent.count.mockResolvedValueOnce(18); // synced attendance events
      mockPrisma.unscoped.usageDaily.upsert.mockResolvedValueOnce({ id: 'usage-1' });

      const summary = await service.runDailyMetering('2026-11-23');

      expect(summary.totalTenantsMetered).toBe(1);
      expect(summary.totalActiveEmployees).toBe(25);
      expect(summary.totalStorageUsedMb).toBe(1);
      expect(summary.totalApiCalls).toBe(45);
      expect(summary.totalNotificationsSent).toBe(8); // 2 email + 1 push + 5 in-app
      expect(summary.notificationsByChannel.email).toBe(2);
      expect(summary.notificationsByChannel.push).toBe(1);
      expect(summary.notificationsByChannel.in_app).toBe(5);
      expect(summary.totalAttendanceEventsSynced).toBe(18);

      expect(mockPrisma.unscoped.usageDaily.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId_date: expect.objectContaining({ tenantId: 'tenant-1' }),
          }),
          create: expect.objectContaining({
            tenantId: 'tenant-1',
            activeEmployees: 25,
            storageUsedBytes: BigInt(1048576),
            apiCalls: 45,
            notificationsTotal: 8,
            attendanceEventsSynced: 18,
          }),
        }),
      );
    });
  });

  describe('listDailyUsage', () => {
    it('returns paginated usage daily records with formatted MB', async () => {
      mockPrisma.unscoped.usageDaily.findMany.mockResolvedValueOnce([
        {
          id: 'u-1',
          tenantId: 't-1',
          date: new Date('2026-11-23T00:00:00.000Z'),
          activeEmployees: 10,
          storageUsedBytes: BigInt(2097152), // 2 MB
          apiCalls: 100,
          notificationsTotal: 15,
          notificationsEmail: 5,
          notificationsSms: 0,
          notificationsPush: 2,
          notificationsInApp: 8,
          attendanceEventsSynced: 12,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          tenant: { name: 'Acme', subdomain: 'acme' },
        },
      ]);
      mockPrisma.unscoped.usageDaily.count.mockResolvedValueOnce(1);

      const result = await service.listDailyUsage({ page: 1, limit: 10 });
      expect(result.total).toBe(1);
      expect(result.items.length).toBe(1);
      expect(result.items[0].tenantName).toBe('Acme');
      expect(result.items[0].storageUsedMb).toBe(2);
      expect(result.items[0].apiCalls).toBe(100);
      expect(result.items[0].attendanceEventsSynced).toBe(12);
    });
  });
});
