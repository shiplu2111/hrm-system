jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => {},
  CronExpression: {
    EVERY_DAY_AT_6AM: '0 6 * * *',
  },
}));

import { ComplianceNoticeJobService } from './compliance-notice-job.service';
import type { PrismaService } from '../../database/prisma.service';
import type { NotificationEngineService } from '../../notifications/notification-engine.service';

describe('ComplianceNoticeJobService', () => {
  let service: ComplianceNoticeJobService;
  let prisma: any;
  let notificationEngine: any;

  const mockCountryId = '10000000-0000-4000-8000-000000000002';
  const mockTenantId = 'tenant-uuid-1';
  const mockCompanyId = 'company-uuid-1';
  const mockEventId = 'event-uuid-1';

  beforeEach(() => {
    prisma = {
      unscoped: {
        complianceEvent: {
          findMany: jest.fn(),
        },
        company: {
          findMany: jest.fn(),
        },
        complianceEventNotice: {
          findUnique: jest.fn(),
          create: jest.fn(),
          findMany: jest.fn(),
          findFirst: jest.fn(),
          update: jest.fn(),
        },
        user: {
          findMany: jest.fn(),
        },
        employee: {
          findFirst: jest.fn(),
        },
      },
    };

    notificationEngine = {
      emit: jest.fn().mockResolvedValue(undefined),
    };

    service = new ComplianceNoticeJobService(
      prisma as unknown as PrismaService,
      notificationEngine as unknown as NotificationEngineService,
    );
  });

  describe('runNoticeJob', () => {
    it('should generate notices for eligible tenants when compliance event is within notice window', async () => {
      // Event: due on 21st of every month, notice 7 days before
      // As of 2026-11-15, due date is 2026-11-21 (6 days remaining -> within notice window!)
      prisma.unscoped.complianceEvent.findMany.mockResolvedValue([
        {
          id: mockEventId,
          countryId: mockCountryId,
          stateProvinceId: null,
          title: 'Monthly PAYG Withholding Return (IAS)',
          description: 'Monthly tax withholding lodgement',
          category: 'tax_filing',
          recurrence: 'monthly',
          dueDateRule: { dayOfMonth: 21 },
          applicablePlans: [],
          noticeDaysBefore: 7,
          actionRequired: 'Lodge statement with ATO',
          sourceReference: 'Taxation Administration Act 1953',
          country: { id: mockCountryId, name: 'Australia', isoCode: 'AU' },
        },
      ]);

      prisma.unscoped.company.findMany.mockResolvedValue([
        {
          id: mockCompanyId,
          name: 'Acme Australia Pty Ltd',
          tenantId: mockTenantId,
          countryId: mockCountryId,
          tenant: {
            id: mockTenantId,
            name: 'Acme Corp',
            planId: 'growth',
            status: 'active',
          },
        },
      ]);

      // Not existing notice yet
      prisma.unscoped.complianceEventNotice.findUnique.mockResolvedValue(null);
      prisma.unscoped.user.findMany.mockResolvedValue([
        {
          id: 'admin-user-1',
          email: 'hr@acme.com',
          employeeId: 'emp-1',
          role: { name: 'HR Admin' },
        },
      ]);
      prisma.unscoped.complianceEventNotice.create.mockResolvedValue({});

      const result = await service.runNoticeJob({
        asOfDate: '2026-11-15',
        countryId: mockCountryId,
      });

      expect(result.scannedEventsCount).toBe(1);
      expect(result.eligibleTenantsCount).toBe(1);
      expect(result.noticesGeneratedCount).toBe(1);
      expect(result.skippedExistingCount).toBe(0);

      // Verify notification engine call
      expect(notificationEngine.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenantId,
          companyId: mockCompanyId,
          eventType: 'compliance.deadline.upcoming',
          directUserIds: ['admin-user-1'],
          variables: expect.objectContaining({
            event_title: 'Monthly PAYG Withholding Return (IAS)',
            due_date: '2026-11-21',
            days_remaining: '6',
          }),
        }),
      );

      // Verify DB tracking record inserted
      expect(prisma.unscoped.complianceEventNotice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: mockTenantId,
            companyId: mockCompanyId,
            complianceEventId: mockEventId,
            daysRemaining: 6,
            status: 'sent',
          }),
        }),
      );
    });

    it('should skip notice generation if already sent (idempotency check)', async () => {
      prisma.unscoped.complianceEvent.findMany.mockResolvedValue([
        {
          id: mockEventId,
          countryId: mockCountryId,
          stateProvinceId: null,
          title: 'Monthly PAYG Withholding Return (IAS)',
          recurrence: 'monthly',
          dueDateRule: { dayOfMonth: 21 },
          applicablePlans: [],
          noticeDaysBefore: 7,
          country: { id: mockCountryId, name: 'Australia', isoCode: 'AU' },
        },
      ]);

      prisma.unscoped.company.findMany.mockResolvedValue([
        {
          id: mockCompanyId,
          name: 'Acme Australia Pty Ltd',
          tenantId: mockTenantId,
          tenant: { id: mockTenantId, name: 'Acme Corp', status: 'active' },
        },
      ]);

      // Existing notice already in database for this period
      prisma.unscoped.complianceEventNotice.findUnique.mockResolvedValue({
        id: 'existing-notice-1',
      });

      const result = await service.runNoticeJob({ asOfDate: '2026-11-15' });

      expect(result.noticesGeneratedCount).toBe(0);
      expect(result.skippedExistingCount).toBe(1);
      expect(notificationEngine.emit).not.toHaveBeenCalled();
      expect(prisma.unscoped.complianceEventNotice.create).not.toHaveBeenCalled();
    });

    it('should skip event if not within notice window', async () => {
      // Due on 21st, evaluated on 1st with 7 days notice -> 20 days remaining, window not active
      prisma.unscoped.complianceEvent.findMany.mockResolvedValue([
        {
          id: mockEventId,
          countryId: mockCountryId,
          recurrence: 'monthly',
          dueDateRule: { dayOfMonth: 21 },
          noticeDaysBefore: 7,
        },
      ]);

      const result = await service.runNoticeJob({ asOfDate: '2026-11-01' });

      expect(result.scannedEventsCount).toBe(1);
      expect(result.eligibleTenantsCount).toBe(0);
      expect(result.noticesGeneratedCount).toBe(0);
      expect(prisma.unscoped.company.findMany).not.toHaveBeenCalled();
    });
  });

  describe('updateNoticeStatus', () => {
    it('should update notice status to completed with timestamp', async () => {
      prisma.unscoped.complianceEventNotice.findFirst.mockResolvedValue({
        id: 'notice-1',
        tenantId: mockTenantId,
      });
      prisma.unscoped.complianceEventNotice.update.mockResolvedValue({
        id: 'notice-1',
        tenantId: mockTenantId,
        companyId: mockCompanyId,
        complianceEventId: mockEventId,
        dueDate: new Date('2026-11-21'),
        noticeDate: new Date('2026-11-15'),
        daysRemaining: 6,
        status: 'completed',
        completedAt: new Date('2026-11-16T10:00:00Z'),
        completedBy: 'user-123',
        createdAt: new Date('2026-11-15T06:00:00Z'),
        complianceEvent: { title: 'PAYG', category: 'tax_filing' },
      });

      const res = await service.updateNoticeStatus(
        mockTenantId,
        'notice-1',
        'completed',
        'user-123',
      );

      expect(res.status).toBe('completed');
      expect(res.completedBy).toBe('user-123');
      expect(prisma.unscoped.complianceEventNotice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'notice-1' },
          data: expect.objectContaining({
            status: 'completed',
            completedBy: 'user-123',
          }),
        }),
      );
    });
  });
});
