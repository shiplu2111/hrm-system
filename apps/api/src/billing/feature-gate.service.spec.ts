import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import { FeatureGateService } from './feature-gate.service';

describe('FeatureGateService', () => {
  let service: FeatureGateService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      unscoped: {
        tenantFeatureOverride: {
          findUnique: jest.fn(),
          upsert: jest.fn(),
          deleteMany: jest.fn(),
        },
        tenantLimitOverride: {
          findUnique: jest.fn(),
          upsert: jest.fn(),
          deleteMany: jest.fn(),
        },
        tenantSetting: {
          findUnique: jest.fn(),
        },
        tenant: {
          findUnique: jest.fn(),
          findUniqueOrThrow: jest.fn(),
        },
        plan: {
          findFirst: jest.fn(),
          findUnique: jest.fn(),
          findMany: jest.fn(),
        },
        employee: {
          count: jest.fn(),
        },
        company: {
          count: jest.fn(),
        },
        employmentContractDocument: {
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
        candidateDocument: {
          aggregate: jest.fn(),
        },
      },
    };

    service = new FeatureGateService(mockPrisma as unknown as PrismaService);
  });

  describe('hasFeature', () => {
    it('returns false for empty tenantId', async () => {
      expect(await service.hasFeature('', 'core_hr')).toBe(false);
    });

    it('returns true when TenantFeatureOverride explicitly enables feature', async () => {
      mockPrisma.unscoped.tenantFeatureOverride.findUnique.mockResolvedValue({
        tenantId: 'tenant-1',
        featureKey: 'api_access',
        enabled: true,
      });

      const enabled = await service.hasFeature('tenant-1', 'api_access');
      expect(enabled).toBe(true);
      expect(mockPrisma.unscoped.tenant.findUnique).not.toHaveBeenCalled();
    });

    it('returns false when TenantFeatureOverride explicitly disables feature', async () => {
      mockPrisma.unscoped.tenantFeatureOverride.findUnique.mockResolvedValue({
        tenantId: 'tenant-1',
        featureKey: 'core_hr',
        enabled: false,
      });

      const enabled = await service.hasFeature('tenant-1', 'core_hr');
      expect(enabled).toBe(false);
    });

    it('falls back to TenantSetting (category: feature_flag) if override does not exist', async () => {
      mockPrisma.unscoped.tenantFeatureOverride.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.tenantSetting.findUnique.mockResolvedValue({
        category: 'feature_flag',
        key: 'ai_insights',
        value: { enabled: true },
      });

      const enabled = await service.hasFeature('tenant-1', 'ai_insights');
      expect(enabled).toBe(true);
    });

    it('resolves database plan features when no override exists', async () => {
      mockPrisma.unscoped.tenantFeatureOverride.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.tenantSetting.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 'tenant-starter',
        planId: 'starter',
        status: 'active',
        isSandbox: false,
      });
      mockPrisma.unscoped.plan.findFirst.mockResolvedValue({
        id: 'plan-starter-uuid',
        code: 'starter',
        features: [
          { featureKey: 'core_hr', enabled: true },
          { featureKey: 'attendance', enabled: true },
          { featureKey: 'api_access', enabled: false },
        ],
      });

      expect(await service.hasFeature('tenant-starter', 'attendance')).toBe(true);
      expect(await service.hasFeature('tenant-starter', 'api_access')).toBe(false);
    });

    it('returns false for deleted or pending_deletion tenants', async () => {
      mockPrisma.unscoped.tenantFeatureOverride.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.tenantSetting.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 'tenant-del',
        planId: 'enterprise',
        status: 'deleted',
      });

      expect(await service.hasFeature('tenant-del', 'core_hr')).toBe(false);
    });
  });

  describe('withinLimit and getLimit', () => {
    it('returns true when plan limit is unlimited (null)', async () => {
      mockPrisma.unscoped.tenantLimitOverride.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 'tenant-ent',
        planId: 'enterprise',
      });
      mockPrisma.unscoped.plan.findFirst.mockResolvedValue({
        id: 'plan-ent-uuid',
        code: 'enterprise',
        limits: [{ limitKey: 'employees', value: null }],
      });

      const within = await service.withinLimit('tenant-ent', 'employees', 999999);
      expect(within).toBe(true);
    });

    it('enforces plan default limit when usage exceeds cap', async () => {
      mockPrisma.unscoped.tenantLimitOverride.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 'tenant-starter',
        planId: 'starter',
      });
      mockPrisma.unscoped.plan.findFirst.mockResolvedValue({
        id: 'plan-starter-uuid',
        code: 'starter',
        limits: [{ limitKey: 'employees', value: 50 }],
      });

      expect(await service.withinLimit('tenant-starter', 'employees', 45)).toBe(true);
      expect(await service.withinLimit('tenant-starter', 'employees', 50)).toBe(true);
      expect(await service.withinLimit('tenant-starter', 'employees', 51)).toBe(false);
    });

    it('respects TenantLimitOverride over plan default', async () => {
      mockPrisma.unscoped.tenantLimitOverride.findUnique.mockResolvedValue({
        tenantId: 'tenant-starter',
        limitKey: 'employees',
        value: 120, // custom upgraded quota
      });

      expect(await service.withinLimit('tenant-starter', 'employees', 75)).toBe(true);
      expect(await service.withinLimit('tenant-starter', 'employees', 121)).toBe(false);
    });

    it('calculates employee count automatically when currentUsage is not passed', async () => {
      mockPrisma.unscoped.tenantLimitOverride.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 'tenant-starter',
        planId: 'starter',
      });
      mockPrisma.unscoped.plan.findFirst.mockResolvedValue({
        id: 'plan-starter-uuid',
        code: 'starter',
        limits: [{ limitKey: 'employees', value: 50 }],
      });
      mockPrisma.unscoped.employee.count.mockResolvedValue(30);

      expect(await service.withinLimit('tenant-starter', 'employees')).toBe(true);
      expect(mockPrisma.unscoped.employee.count).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-starter',
          deletedAt: null,
          employmentStatus: { not: 'terminated' },
        },
      });
    });
  });

  describe('assertFeature', () => {
    it('throws ForbiddenException with FEATURE_NOT_IN_PLAN and upgrade hint when feature is disabled', async () => {
      mockPrisma.unscoped.tenantFeatureOverride.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.tenantSetting.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        planId: 'starter',
        status: 'active',
      });
      mockPrisma.unscoped.plan.findFirst.mockResolvedValue({
        id: 'plan-1',
        code: 'starter',
        features: [{ featureKey: 'api_access', enabled: false }],
      });

      await expect(service.assertFeature('tenant-1', 'api_access')).rejects.toMatchObject({
        response: {
          code: 'FEATURE_NOT_IN_PLAN',
          message: expect.stringContaining('Enterprise'),
          upgradeHint: expect.stringContaining('Enterprise'),
          details: [{ field: 'feature', message: expect.stringContaining('Enterprise') }],
        },
      });
    });

    it('resolves cleanly when feature is enabled', async () => {
      mockPrisma.unscoped.tenantFeatureOverride.findUnique.mockResolvedValue({
        tenantId: 'tenant-1',
        featureKey: 'api_access',
        enabled: true,
      });

      await expect(service.assertFeature('tenant-1', 'api_access')).resolves.toBeUndefined();
    });
  });

  describe('assertWithinLimit', () => {
    it('throws ForbiddenException PLAN_LIMIT_REACHED when employee capacity is reached', async () => {
      mockPrisma.unscoped.tenantLimitOverride.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        planId: 'free',
        status: 'active',
      });
      mockPrisma.unscoped.plan.findFirst.mockResolvedValue({
        id: 'plan-free',
        code: 'free',
        limits: [{ limitKey: 'employees', value: 10 }],
      });
      mockPrisma.unscoped.employee.count.mockResolvedValue(10);

      await expect(service.assertWithinLimit('tenant-1', 'employees', 1)).rejects.toMatchObject({
        response: {
          code: 'PLAN_LIMIT_REACHED',
          message: expect.stringContaining('Upgrade your plan to Starter'),
          upgradeHint: expect.stringContaining('Starter'),
          details: [{ field: 'employees', message: expect.stringContaining('Starter') }],
        },
      });
    });

    it('throws ForbiddenException PLAN_LIMIT_REACHED when storage capacity is reached', async () => {
      mockPrisma.unscoped.tenantLimitOverride.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        planId: 'starter',
        status: 'active',
      });
      mockPrisma.unscoped.plan.findFirst.mockResolvedValue({
        id: 'plan-starter',
        code: 'starter',
        limits: [{ limitKey: 'storage_gb', value: 10 }],
      });
      // 10 GB in bytes: 10 * 1024 * 1024 * 1024 = 10737418240
      mockPrisma.unscoped.employmentContractDocument.aggregate.mockResolvedValue({
        _sum: { sizeBytes: 10737418240 },
      });
      mockPrisma.unscoped.jobApplicationResume.aggregate.mockResolvedValue({ _sum: { sizeBytes: 0 } });
      mockPrisma.unscoped.expenseClaimReceipt.aggregate.mockResolvedValue({ _sum: { sizeBytes: 0 } });
      mockPrisma.unscoped.employeeCertification.aggregate.mockResolvedValue({ _sum: { fileSizeBytes: 0 } });
      mockPrisma.unscoped.candidateDocument.aggregate.mockResolvedValue({ _sum: { sizeBytes: 0 } });

      await expect(service.assertWithinLimit('tenant-1', 'storage_gb', 0.01)).rejects.toMatchObject({
        response: {
          code: 'PLAN_LIMIT_REACHED',
          message: expect.stringContaining('Upgrade your plan to Business'),
          upgradeHint: expect.stringContaining('Business'),
          details: [{ field: 'storage_gb', message: expect.stringContaining('Business') }],
        },
      });
    });

    it('throws ForbiddenException PLAN_LIMIT_REACHED when company limit is reached', async () => {
      mockPrisma.unscoped.tenantLimitOverride.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        planId: 'starter',
        status: 'active',
      });
      mockPrisma.unscoped.plan.findFirst.mockResolvedValue({
        id: 'plan-starter',
        code: 'starter',
        limits: [{ limitKey: 'companies', value: 1 }],
      });
      mockPrisma.unscoped.company.count.mockResolvedValue(1);

      await expect(service.assertWithinLimit('tenant-1', 'companies', 1)).rejects.toMatchObject({
        response: {
          code: 'PLAN_LIMIT_REACHED',
          message: expect.stringContaining('Upgrade your plan to Business'),
          upgradeHint: expect.stringContaining('Business'),
          details: [{ field: 'companies', message: expect.stringContaining('Business') }],
        },
      });
    });

    it('allows addition when within limit', async () => {
      mockPrisma.unscoped.tenantLimitOverride.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        planId: 'starter',
        status: 'active',
      });
      mockPrisma.unscoped.plan.findFirst.mockResolvedValue({
        id: 'plan-starter',
        code: 'starter',
        limits: [{ limitKey: 'employees', value: 50 }],
      });
      mockPrisma.unscoped.employee.count.mockResolvedValue(40);

      await expect(service.assertWithinLimit('tenant-1', 'employees', 5)).resolves.toBeUndefined();
    });
  });

  describe('Stage G Overrides Management', () => {
    it('sets feature override', async () => {
      await service.setFeatureOverride('t1', 'api_access', true, 'Pilot VIP cohort', 'staff-1');
      expect(mockPrisma.unscoped.tenantFeatureOverride.upsert).toHaveBeenCalledWith({
        where: { tenantId_featureKey: { tenantId: 't1', featureKey: 'api_access' } },
        create: {
          tenantId: 't1',
          featureKey: 'api_access',
          enabled: true,
          reason: 'Pilot VIP cohort',
          createdBy: 'staff-1',
        },
        update: {
          enabled: true,
          reason: 'Pilot VIP cohort',
          createdBy: 'staff-1',
        },
      });
    });

    it('sets limit override', async () => {
      await service.setLimitOverride('t1', 'employees', 100, 'Enterprise expansion', 'staff-1');
      expect(mockPrisma.unscoped.tenantLimitOverride.upsert).toHaveBeenCalledWith({
        where: { tenantId_limitKey: { tenantId: 't1', limitKey: 'employees' } },
        create: {
          tenantId: 't1',
          limitKey: 'employees',
          value: 100,
          reason: 'Enterprise expansion',
          createdBy: 'staff-1',
        },
        update: {
          value: 100,
          reason: 'Enterprise expansion',
          createdBy: 'staff-1',
        },
      });
    });

    it('removes feature override', async () => {
      await service.removeFeatureOverride('t1', 'api_access');
      expect(mockPrisma.unscoped.tenantFeatureOverride.deleteMany).toHaveBeenCalledWith({
        where: { tenantId: 't1', featureKey: 'api_access' },
      });
    });

    it('removes limit override', async () => {
      await service.removeLimitOverride('t1', 'employees');
      expect(mockPrisma.unscoped.tenantLimitOverride.deleteMany).toHaveBeenCalledWith({
        where: { tenantId: 't1', limitKey: 'employees' },
      });
    });
  });
});
