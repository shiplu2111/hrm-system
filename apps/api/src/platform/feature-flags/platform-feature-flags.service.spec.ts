import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../database/prisma.service';
import type { PlatformAuditService } from '../audit/platform-audit.service';
import type { FeatureGateService } from '../../billing/feature-gate.service';
import { PlatformFeatureFlagsService } from './platform-feature-flags.service';

describe('PlatformFeatureFlagsService', () => {
  let service: PlatformFeatureFlagsService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockFeatureGate: any;

  beforeEach(() => {
    mockPrisma = {
      unscoped: {
        platformFeatureFlag: {
          findMany: jest.fn(),
          findFirst: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        tenantFeatureOverride: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
        },
      },
    };

    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mockFeatureGate = {
      setFeatureOverride: jest.fn().mockResolvedValue(undefined),
      removeFeatureOverride: jest.fn().mockResolvedValue(undefined),
      evaluateFeature: jest.fn(),
    };

    service = new PlatformFeatureFlagsService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as PlatformAuditService,
      mockFeatureGate as unknown as FeatureGateService,
    );
  });

  describe('Flags CRUD & Audit', () => {
    it('lists all platform feature flags', async () => {
      mockPrisma.unscoped.platformFeatureFlag.findMany.mockResolvedValue([
        {
          id: 'flag-1',
          key: 'beta_ai',
          description: 'AI test',
          defaultState: false,
          rolloutPercentage: 25,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const flags = await service.listFlags();
      expect(flags).toHaveLength(1);
      expect(flags[0].key).toBe('beta_ai');
      expect(flags[0].rolloutPercentage).toBe(25);
    });

    it('creates a feature flag and records platform audit log', async () => {
      mockPrisma.unscoped.platformFeatureFlag.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.platformFeatureFlag.create.mockResolvedValue({
        id: 'flag-2',
        key: 'new_payroll_calc',
        description: 'New engine',
        defaultState: false,
        rolloutPercentage: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.createFlag(
        {
          key: 'new_payroll_calc',
          description: 'New engine',
          defaultState: false,
          rolloutPercentage: 10,
        },
        { id: 'admin-1', email: 'admin@platform.com' },
        '127.0.0.1',
        'Jest/Node',
      );

      expect(res.key).toBe('new_payroll_calc');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-1',
          action: 'platform_feature_flag.create',
          module: 'feature_flags',
          recordId: 'new_payroll_calc',
        }),
      );
    });

    it('throws ConflictException when creating flag with duplicate key', async () => {
      mockPrisma.unscoped.platformFeatureFlag.findUnique.mockResolvedValue({ id: 'exists' });

      await expect(
        service.createFlag({ key: 'duplicate_key' }),
      ).rejects.toThrow(ConflictException);
    });

    it('updates a feature flag and records platform audit log with oldValue and newValue', async () => {
      mockPrisma.unscoped.platformFeatureFlag.findUnique.mockResolvedValue({
        id: 'flag-3',
        key: 'roster_v2',
        description: 'Old desc',
        defaultState: false,
        rolloutPercentage: 10,
      });

      mockPrisma.unscoped.platformFeatureFlag.update.mockResolvedValue({
        id: 'flag-3',
        key: 'roster_v2',
        description: 'New desc',
        defaultState: true,
        rolloutPercentage: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.updateFlag(
        'roster_v2',
        { description: 'New desc', defaultState: true, rolloutPercentage: 50 },
        { id: 'admin-1' },
      );

      expect(res.rolloutPercentage).toBe(50);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'platform_feature_flag.update',
          module: 'feature_flags',
          recordId: 'roster_v2',
          oldValue: expect.objectContaining({ rolloutPercentage: 10 }),
          newValue: expect.objectContaining({ rolloutPercentage: 50, defaultState: true }),
        }),
      );
    });

    it('deletes a feature flag and records platform audit log', async () => {
      mockPrisma.unscoped.platformFeatureFlag.findUnique.mockResolvedValue({
        id: 'flag-4',
        key: 'deprecated_flag',
        description: 'To delete',
        defaultState: false,
        rolloutPercentage: 0,
      });

      await service.deleteFlag('deprecated_flag', { id: 'admin-1' });

      expect(mockPrisma.unscoped.platformFeatureFlag.delete).toHaveBeenCalledWith({
        where: { key: 'deprecated_flag' },
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'platform_feature_flag.delete',
          module: 'feature_flags',
          recordId: 'deprecated_flag',
        }),
      );
    });
  });

  describe('Tenant Overrides Management & Audit', () => {
    it('lists overrides for tenant, identifying active vs expired', async () => {
      const yesterday = new Date(Date.now() - 86400000);
      const nextMonth = new Date(Date.now() + 30 * 86400000);

      mockPrisma.unscoped.tenantFeatureOverride.findMany.mockResolvedValue([
        {
          id: 'ov-1',
          tenantId: 'tenant-1',
          featureKey: 'api_access',
          enabled: true,
          reason: 'VIP contract',
          expiresAt: nextMonth,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ov-2',
          tenantId: 'tenant-1',
          featureKey: 'beta_module',
          enabled: true,
          reason: 'Old trial',
          expiresAt: yesterday,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const overrides = await service.listTenantOverrides('tenant-1');
      expect(overrides).toHaveLength(2);
      expect(overrides[0].isExpired).toBe(false);
      expect(overrides[1].isExpired).toBe(true);
    });

    it('sets tenant override by delegating to featureGateService', async () => {
      mockPrisma.unscoped.tenantFeatureOverride.findUnique.mockResolvedValue({
        id: 'ov-3',
        tenantId: 'tenant-1',
        featureKey: 'custom_reports',
        enabled: true,
        reason: 'Requested by account team',
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.setTenantOverride(
        'tenant-1',
        {
          key: 'custom_reports',
          value: true,
          reason: 'Requested by account team',
        },
        { id: 'admin-1', email: 'admin@platform.com' },
      );

      expect(mockFeatureGate.setFeatureOverride).toHaveBeenCalledWith(
        'tenant-1',
        'custom_reports',
        true,
        'Requested by account team',
        'admin-1',
        undefined,
        'admin@platform.com',
      );
      expect(res.key).toBe('custom_reports');
      expect(res.value).toBe(true);
    });

    it('removes tenant override by delegating to featureGateService', async () => {
      await service.removeTenantOverride('tenant-1', 'custom_reports', { id: 'admin-1' });

      expect(mockFeatureGate.removeFeatureOverride).toHaveBeenCalledWith(
        'tenant-1',
        'custom_reports',
        'admin-1',
        expect.any(String),
      );
    });

    it('evaluates feature using 3-tier order', async () => {
      mockFeatureGate.evaluateFeature.mockResolvedValue({
        key: 'roster',
        enabled: true,
        source: 'flag_rollout',
        bucket: 15,
        rolloutPercentage: 25,
      });

      const res = await service.evaluateFeature('tenant-1', 'roster');
      expect(res.enabled).toBe(true);
      expect(res.source).toBe('flag_rollout');
      expect(res.bucket).toBe(15);
    });
  });
});
