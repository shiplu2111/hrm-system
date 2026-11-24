// apps/api/src/platform/queues/platform-queues.service.spec.ts
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { ActorContext, PlatformQueuesService } from './platform-queues.service';

describe('PlatformQueuesService', () => {
  let service: PlatformQueuesService;
  let mockPrisma: any;

  const ownerActor: ActorContext = {
    id: 'owner-uuid-1',
    email: 'platform.owner@cmsnbd.com',
    roleName: 'Platform Owner',
    permissions: [{ module: 'platform', action: 'manage' }],
  };

  const adminActor: ActorContext = {
    id: 'admin-uuid-2',
    email: 'platform.admin@cmsnbd.com',
    roleName: 'Platform Admin',
    permissions: [{ module: 'platform', action: 'manage' }],
  };

  const billingActor: ActorContext = {
    id: 'billing-uuid-3',
    email: 'billing@cmsnbd.com',
    roleName: 'Billing Admin',
    permissions: [{ module: 'billing', action: 'manage' }],
  };

  const supportActor: ActorContext = {
    id: 'support-uuid-4',
    email: 'support@cmsnbd.com',
    roleName: 'Support Agent',
    permissions: [{ module: 'support', action: 'view' }],
  };

  beforeEach(async () => {
    mockPrisma = {
      unscoped: {
        platformAuditLog: {
          create: jest.fn().mockResolvedValue({ id: 'audit-log-uuid-101' }),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformQueuesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<PlatformQueuesService>(PlatformQueuesService);
    await service.onModuleInit();
  });

  describe('Role-Gating & Access Control', () => {
    it('allows Platform Owner to access inspector', () => {
      expect(() => service.assertPlatformAdminAccess(ownerActor)).not.toThrow();
    });

    it('allows Platform Admin to access inspector', () => {
      expect(() => service.assertPlatformAdminAccess(adminActor)).not.toThrow();
    });

    it('allows user with platform:manage permission', () => {
      expect(() =>
        service.assertPlatformAdminAccess({
          id: 'custom-staff',
          email: 'custom@cmsnbd.com',
          roleName: 'Custom SRE',
          permissions: [{ module: 'platform', action: 'manage' }],
        }),
      ).not.toThrow();
    });

    it('rejects Billing Admin with ForbiddenException', () => {
      expect(() => service.assertPlatformAdminAccess(billingActor)).toThrow(ForbiddenException);
    });

    it('rejects Support Agent with ForbiddenException', () => {
      expect(() => service.assertPlatformAdminAccess(supportActor)).toThrow(ForbiddenException);
    });

    it('rejects unauthenticated calls with ForbiddenException', () => {
      expect(() => service.assertPlatformAdminAccess(undefined)).toThrow(ForbiddenException);
    });
  });

  describe('Queue Overview & Prominent Highlights', () => {
    it('returns all queues with prominent payroll and sync queues prioritized', async () => {
      const overview = await service.getQueueOverview(adminActor);

      expect(overview).toBeDefined();
      expect(overview.totalQueues).toBeGreaterThanOrEqual(7);
      expect(overview.prominentQueuesCount).toBeGreaterThanOrEqual(3);

      // Verify prominent queues appear at the top
      const top3Names = overview.queues.slice(0, 3).map((q) => q.name);
      expect(top3Names).toContain('payroll-processing');
      expect(top3Names).toContain('attendance-sync');

      // Check payroll attributes
      const payrollQ = overview.queues.find((q) => q.name === 'payroll-processing');
      expect(payrollQ).toBeDefined();
      expect(payrollQ?.isProminent).toBe(true);
      expect(payrollQ?.isPayroll).toBe(true);
      expect(payrollQ?.counts.failed).toBeGreaterThanOrEqual(1);

      // Check sync attributes
      const syncQ = overview.queues.find((q) => q.name === 'attendance-sync');
      expect(syncQ).toBeDefined();
      expect(syncQ?.isProminent).toBe(true);
      expect(syncQ?.isPayroll).toBe(false);
    });
  });

  describe('Job Listing & Filtering by State', () => {
    it('lists jobs across all states (failed, active, waiting, completed)', async () => {
      const result = await service.getJobs({ queueName: 'payroll-processing', state: 'all' }, adminActor);

      expect(result.items.length).toBeGreaterThanOrEqual(4);
      const states = result.items.map((j) => j.state);
      expect(states).toContain('failed');
      expect(states).toContain('active');
      expect(states).toContain('waiting');
      expect(states).toContain('completed');
    });

    it('filters specifically by failed state', async () => {
      const result = await service.getJobs({ queueName: 'payroll-processing', state: 'failed' }, adminActor);

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      result.items.forEach((job) => {
        expect(job.state).toBe('failed');
        expect(job.failedReason).toBeDefined();
      });
    });

    it('supports search query by tenant name or job id', async () => {
      const result = await service.getJobs(
        { queueName: 'payroll-processing', search: 'Vertex' },
        adminActor,
      );

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.items[0].data.tenantName).toContain('Vertex');
    });
  });

  describe('Failed Job Details & Error Diagnostics', () => {
    it('returns full diagnostic details with stacktrace for a failed job', async () => {
      const job = await service.getJobDetails('payroll-processing', 'job-pr-failed-001', adminActor);

      expect(job.id).toBe('job-pr-failed-001');
      expect(job.state).toBe('failed');
      expect(job.failedReason).toContain('StatutoryRuleResolutionError');
      expect(job.stacktrace.length).toBeGreaterThanOrEqual(3);
      expect(job.attemptsMade).toBe(3);
      expect(job.data.countryCode).toBe('GB');
      expect(job.isPayroll).toBe(true);
    });

    it('throws NotFoundException for non-existent job', async () => {
      await expect(
        service.getJobDetails('payroll-processing', 'job-non-existent-999', adminActor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Job Retry Action', () => {
    it('re-queues a failed job and resets failed state', async () => {
      const res = await service.retryJob('payroll-processing', 'job-pr-failed-001', adminActor);

      expect(res.success).toBe(true);
      expect(res.newState).toBe('waiting');

      const updated = await service.getJobDetails('payroll-processing', 'job-pr-failed-001', adminActor);
      expect(updated.state).toBe('waiting');
      expect(updated.failedReason).toBeNull();

      expect(mockPrisma.unscoped.platformAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'JOB_RETRIED',
            module: 'queue:payroll',
            recordId: 'job-pr-failed-001',
          }),
        }),
      );
    });
  });

  describe('Job Removal & Safety Constraints', () => {
    it('FORBIDS deleting a payroll job when reason is missing', async () => {
      await expect(
        service.removeJob('payroll-processing', 'job-pr-completed-004', {}, adminActor),
      ).rejects.toThrow(BadRequestException);
    });

    it('FORBIDS deleting a payroll job when reason is shorter than 5 chars', async () => {
      await expect(
        service.removeJob('payroll-processing', 'job-pr-completed-004', { reason: 'test' }, adminActor),
      ).rejects.toThrow(BadRequestException);
    });

    it('ALLOWS deleting a payroll job when a valid typed justification reason is provided', async () => {
      const validReason = 'Redundant draft payroll batch deleted per tenant request #TC-8891';
      const res = await service.removeJob(
        'payroll-processing',
        'job-pr-completed-004',
        { reason: validReason },
        adminActor,
      );

      expect(res.success).toBe(true);
      expect(res.reason).toBe(validReason);

      // Verify audit log
      expect(mockPrisma.unscoped.platformAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'JOB_DELETED',
            module: 'queue:payroll',
            recordId: 'job-pr-completed-004',
            reason: validReason,
          }),
        }),
      );

      // Verify job is removed
      await expect(
        service.getJobDetails('payroll-processing', 'job-pr-completed-004', adminActor),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows deleting non-payroll job without typed reason', async () => {
      const res = await service.removeJob(
        'webhook-delivery',
        'job-wh-failed-001',
        {},
        adminActor,
      );

      expect(res.success).toBe(true);
      expect(mockPrisma.unscoped.platformAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'JOB_DELETED',
            module: 'queue:webhook-delivery',
          }),
        }),
      );
    });
  });
});
