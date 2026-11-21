import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PlatformPlansService } from './platform-plans.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('PlatformPlansService', () => {
  let service: PlatformPlansService;
  let mockPrisma: any;
  let mockPlatformAudit: any;

  const mockPlan = {
    id: 'plan-starter-uuid',
    code: 'starter',
    name: 'Starter Plan',
    description: 'Great for small teams',
    rank: 1,
    isActive: true,
    isCustom: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    features: [
      { id: 'f-1', planId: 'plan-starter-uuid', featureKey: 'core_hr', enabled: true },
      { id: 'f-2', planId: 'plan-starter-uuid', featureKey: 'attendance', enabled: true },
      { id: 'f-3', planId: 'plan-starter-uuid', featureKey: 'api_access', enabled: false },
    ],
    limits: [
      { id: 'l-1', planId: 'plan-starter-uuid', limitKey: 'employees', value: 25 },
      { id: 'l-2', planId: 'plan-starter-uuid', limitKey: 'storage_gb', value: 5 },
    ],
    prices: [
      {
        id: 'p-1',
        planId: 'plan-starter-uuid',
        currency: 'USD',
        billingCycle: 'monthly',
        amount: 49.0,
        perSeatAmount: null,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        effectiveTo: null,
      },
    ],
  };

  beforeEach(async () => {
    mockPlatformAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      unscoped: {
        plan: {
          findMany: jest.fn().mockResolvedValue([mockPlan]),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        planLimit: {
          upsert: jest.fn(),
        },
        planFeature: {
          upsert: jest.fn(),
        },
        planPrice: {
          findFirst: jest.fn(),
          update: jest.fn(),
          create: jest.fn(),
        },
        $transaction: jest.fn(async (ops: any) => Promise.all(ops)),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformPlansService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlatformAuditService, useValue: mockPlatformAudit },
      ],
    }).compile();

    service = module.get<PlatformPlansService>(PlatformPlansService);
  });

  describe('listPlans', () => {
    it('returns all plans formatted with features, limits, and prices', async () => {
      const result = await service.listPlans();
      expect(mockPrisma.unscoped.plan.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('starter');
      expect(result[0].features).toHaveLength(3);
      expect(result[0].limits[0].value).toBe(25);
      expect(result[0].prices[0].amount).toBe(49);
    });
  });

  describe('getPlan', () => {
    it('returns the plan if found', async () => {
      mockPrisma.unscoped.plan.findUnique.mockResolvedValue(mockPlan);

      const result = await service.getPlan('plan-starter-uuid');
      expect(result.id).toBe('plan-starter-uuid');
      expect(result.name).toBe('Starter Plan');
    });

    it('throws NotFoundException if plan does not exist', async () => {
      mockPrisma.unscoped.plan.findUnique.mockResolvedValue(null);

      await expect(service.getPlan('unknown-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPlan', () => {
    it('creates a new plan with default features and limits', async () => {
      mockPrisma.unscoped.plan.findUnique.mockResolvedValue(null);
      mockPrisma.unscoped.plan.create.mockResolvedValue({
        ...mockPlan,
        id: 'new-plan-id',
        code: 'pro',
        name: 'Pro',
      });

      const result = await service.createPlan({
        code: 'pro',
        name: 'Pro',
        description: 'Professional tier',
        rank: 2,
        isActive: true,
      });

      expect(result.code).toBe('pro');
      expect(mockPrisma.unscoped.plan.create).toHaveBeenCalled();
      expect(mockPlatformAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'platform.plan_created',
          module: 'billing',
        }),
      );
    });

    it('throws ConflictException if code already exists', async () => {
      mockPrisma.unscoped.plan.findUnique.mockResolvedValue(mockPlan);

      await expect(
        service.createPlan({
          code: 'starter',
          name: 'Starter Copy',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('toggleFeature', () => {
    it('updates or creates a feature flag and logs audit', async () => {
      mockPrisma.unscoped.plan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.unscoped.planFeature.upsert.mockResolvedValue({
        id: 'f-3',
        planId: 'plan-starter-uuid',
        featureKey: 'api_access',
        enabled: true,
      });

      const result = await service.toggleFeature({
        planId: 'plan-starter-uuid',
        featureKey: 'api_access',
        enabled: true,
      });

      expect(result.enabled).toBe(true);
      expect(mockPrisma.unscoped.planFeature.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            planId_featureKey: {
              planId: 'plan-starter-uuid',
              featureKey: 'api_access',
            },
          },
        }),
      );
      expect(mockPlatformAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'platform.plan_feature_toggled',
        }),
      );
    });
  });

  describe('createPrice (Effective-Dating)', () => {
    it('closes current active price with effectiveTo and inserts new price', async () => {
      mockPrisma.unscoped.plan.findUnique.mockResolvedValue(mockPlan);

      const existingActivePrice = {
        id: 'p-1',
        planId: 'plan-starter-uuid',
        currency: 'USD',
        billingCycle: 'monthly',
        amount: 49.0,
        perSeatAmount: null,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        effectiveTo: null,
      };

      mockPrisma.unscoped.planPrice.findFirst.mockResolvedValue(existingActivePrice);

      const newEffectiveDate = '2026-07-01T00:00:00.000Z';
      const createdPrice = {
        id: 'p-2',
        planId: 'plan-starter-uuid',
        currency: 'USD',
        billingCycle: 'monthly',
        amount: 59.0,
        perSeatAmount: null,
        effectiveFrom: new Date(newEffectiveDate),
        effectiveTo: null,
      };
      mockPrisma.unscoped.planPrice.create.mockResolvedValue(createdPrice);

      const result = await service.createPrice('plan-starter-uuid', {
        currency: 'USD',
        billingCycle: 'monthly',
        amount: 59.0,
        effectiveFrom: newEffectiveDate,
      });

      // 1. Verify old active price was closed
      expect(mockPrisma.unscoped.planPrice.update).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: { effectiveTo: new Date(newEffectiveDate) },
      });

      // 2. Verify new price was created with effectiveFrom and effectiveTo = null
      expect(mockPrisma.unscoped.planPrice.create).toHaveBeenCalledWith({
        data: {
          planId: 'plan-starter-uuid',
          currency: 'USD',
          billingCycle: 'monthly',
          amount: 59.0,
          perSeatAmount: null,
          effectiveFrom: new Date(newEffectiveDate),
          effectiveTo: null,
        },
      });

      // 3. Verify audit log notes that existing subscribers are grandfathered
      expect(mockPlatformAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'platform.plan_price_scheduled',
          reason: expect.stringContaining('Existing subscribers grandfathered'),
        }),
      );

      expect(result.amount).toBe(59);
      expect(result.effectiveTo).toBeNull();
    });
  });
});
