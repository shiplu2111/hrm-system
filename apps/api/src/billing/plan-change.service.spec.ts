import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PlanChangeService } from './plan-change.service';

describe('PlanChangeService', () => {
  let service: PlanChangeService;
  let mockPrisma: any;
  let mockInvoicing: any;
  let mockFeatureGate: any;
  let mockAudit: any;

  const mockStarterPlan = {
    id: 'plan-starter-id',
    code: 'starter',
    name: 'Starter',
    rank: 1,
    limits: [{ limitKey: 'employees', value: 50 }, { limitKey: 'storage_gb', value: 10 }],
    features: [
      { featureKey: 'core_hr', enabled: true },
      { featureKey: 'attendance', enabled: true },
      { featureKey: 'leave', enabled: true },
      { featureKey: 'basic_payroll', enabled: true },
    ],
    prices: [{ currency: 'USD', billingCycle: 'monthly', amount: 49 }],
  };

  const mockBusinessPlan = {
    id: 'plan-business-id',
    code: 'business',
    name: 'Business',
    rank: 2,
    limits: [{ limitKey: 'employees', value: 250 }, { limitKey: 'storage_gb', value: 50 }],
    features: [
      { featureKey: 'core_hr', enabled: true },
      { featureKey: 'attendance', enabled: true },
      { featureKey: 'leave', enabled: true },
      { featureKey: 'basic_payroll', enabled: true },
      { featureKey: 'roster', enabled: true },
      { featureKey: 'timesheets', enabled: true },
      { featureKey: 'advanced_reports', enabled: true },
    ],
    prices: [{ currency: 'USD', billingCycle: 'monthly', amount: 199 }],
  };

  const mockEnterprisePlan = {
    id: 'plan-enterprise-id',
    code: 'enterprise',
    name: 'Enterprise',
    rank: 3,
    limits: [{ limitKey: 'employees', value: null }, { limitKey: 'storage_gb', value: null }],
    features: [
      { featureKey: 'core_hr', enabled: true },
      { featureKey: 'attendance', enabled: true },
      { featureKey: 'leave', enabled: true },
      { featureKey: 'basic_payroll', enabled: true },
      { featureKey: 'roster', enabled: true },
      { featureKey: 'timesheets', enabled: true },
      { featureKey: 'advanced_reports', enabled: true },
      { featureKey: 'api_access', enabled: true },
      { featureKey: 'sso', enabled: true },
      { featureKey: 'advanced_workflow', enabled: true },
      { featureKey: 'custom_payroll_rules', enabled: true },
    ],
    prices: [{ currency: 'USD', billingCycle: 'monthly', amount: 599 }],
  };

  const mockTenant = {
    id: 'tenant-123',
    planId: 'plan-starter-id',
    status: 'active',
    subdomain: 'demo',
  };

  let mockSubscription: any;

  beforeEach(() => {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 10);
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 20); // 20 days remaining out of 30

    mockSubscription = {
      id: 'sub-123',
      tenantId: 'tenant-123',
      planId: 'plan-starter-id',
      status: 'active',
      billingCycle: 'monthly',
      currency: 'USD',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextBillingAt: periodEnd,
      pendingPlanId: null,
      plan: mockStarterPlan,
      tenant: mockTenant,
    };

    mockPrisma = {
      unscoped: {
        plan: {
          findUnique: jest.fn().mockImplementation(({ where }) => {
            if (where.code === 'starter' || where.id === 'plan-starter-id') return Promise.resolve(mockStarterPlan);
            if (where.code === 'business' || where.id === 'plan-business-id') return Promise.resolve(mockBusinessPlan);
            if (where.code === 'enterprise' || where.id === 'plan-enterprise-id') return Promise.resolve(mockEnterprisePlan);
            return Promise.resolve(null);
          }),
          findUniqueOrThrow: jest.fn().mockImplementation(({ where }) => {
            if (where.code === 'starter' || where.id === 'plan-starter-id') return Promise.resolve(mockStarterPlan);
            if (where.code === 'business' || where.id === 'plan-business-id') return Promise.resolve(mockBusinessPlan);
            if (where.code === 'enterprise' || where.id === 'plan-enterprise-id') return Promise.resolve(mockEnterprisePlan);
            throw new Error('Plan not found');
          }),
          findFirst: jest.fn().mockResolvedValue(mockStarterPlan),
        },
        tenant: {
          findUnique: jest.fn().mockResolvedValue(mockTenant),
          update: jest.fn().mockResolvedValue({ ...mockTenant, planId: 'plan-business-id' }),
        },
        subscription: {
          findFirst: jest.fn().mockImplementation(() => Promise.resolve({ ...mockSubscription })),
          update: jest.fn().mockResolvedValue({ ...mockSubscription }),
        },
        invoice: {
          create: jest.fn().mockResolvedValue({ id: 'inv-prorated-123', total: 100 }),
        },
        company: { count: jest.fn().mockResolvedValue(1) },
        shift: { count: jest.fn().mockResolvedValue(0) },
        timesheetEntry: { count: jest.fn().mockResolvedValue(0) },
        tenantApiKey: { count: jest.fn().mockResolvedValue(0) },
        tenantSetting: { findFirst: jest.fn().mockResolvedValue(null) },
        workflowDefinition: { count: jest.fn().mockResolvedValue(0) },
        payrollRule: { count: jest.fn().mockResolvedValue(0) },
        attendanceRecord: { count: jest.fn().mockResolvedValue(0) },
        leaveRequest: { count: jest.fn().mockResolvedValue(0) },
        payrollRun: { count: jest.fn().mockResolvedValue(0) },
        $transaction: jest.fn().mockImplementation((arr) => Promise.all(arr)),
      },
    };

    mockInvoicing = {
      countActiveSeats: jest.fn().mockResolvedValue(15),
      calculateCycleAmounts: jest.fn().mockImplementation((planId) => {
        if (planId === 'plan-starter-id') {
          return Promise.resolve({ total: 49.00, subtotal: 49.00, currency: 'USD' });
        }
        if (planId === 'plan-business-id') {
          return Promise.resolve({ total: 199.00, subtotal: 199.00, currency: 'USD' });
        }
        return Promise.resolve({ total: 599.00, subtotal: 599.00, currency: 'USD' });
      }),
      chargeInvoice: jest.fn().mockResolvedValue({ success: true }),
    };

    mockFeatureGate = {
      getCurrentUsage: jest.fn().mockResolvedValue(2.5),
    };

    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    service = new PlanChangeService(
      mockPrisma as any,
      mockInvoicing as any,
      mockFeatureGate as any,
      mockAudit as any,
    );
  });

  describe('previewPlanChange', () => {
    it('returns changeType same when target plan is current plan', async () => {
      const preview = await service.previewPlanChange('tenant-123', 'starter');
      expect(preview.changeType).toBe('same');
      expect(preview.proratedAmount).toBe(0);
      expect(preview.allowed).toBe(true);
    });

    it('calculates prorated charge and immediate effect on upgrade', async () => {
      const preview = await service.previewPlanChange('tenant-123', 'business');
      expect(preview.changeType).toBe('upgrade');
      expect(preview.isUpgrade).toBe(true);
      expect(preview.immediate).toBe(true);
      expect(preview.allowed).toBe(true);
      expect(preview.blockReasons).toHaveLength(0);
      expect(preview.daysRemaining).toBeGreaterThan(0);
      // Price diff: 199 - 49 = 150. For ~20/30 days remaining, prorated ~ 100
      expect(preview.proratedAmount).toBeGreaterThan(0);
      expect(preview.proratedAmount).toBeLessThanOrEqual(150);
    });

    it('blocks downgrade when active employee seats exceed target plan limit', async () => {
      // Current on Business (limit 250), active seats = 65, target is Starter (limit 50)
      mockSubscription.planId = 'plan-business-id';
      mockSubscription.plan = mockBusinessPlan as any;
      mockInvoicing.countActiveSeats.mockResolvedValue(65);

      const preview = await service.previewPlanChange('tenant-123', 'starter');
      expect(preview.changeType).toBe('downgrade');
      expect(preview.isDowngrade).toBe(true);
      expect(preview.immediate).toBe(false);
      expect(preview.allowed).toBe(false);
      expect(preview.blockReasons.length).toBeGreaterThan(0);
      expect(preview.blockReasons[0]).toContain('65 active employee seats');
      expect(preview.blockReasons[0]).toContain('50');
    });

    it('blocks downgrade when tenant actively uses features removed in lower tier', async () => {
      // Current on Business, target is Starter (removes roster and timesheets)
      mockSubscription.planId = 'plan-business-id';
      mockSubscription.plan = mockBusinessPlan as any;
      mockInvoicing.countActiveSeats.mockResolvedValue(20);
      mockPrisma.unscoped.shift.count.mockResolvedValue(12); // active shifts exist

      const preview = await service.previewPlanChange('tenant-123', 'starter');
      expect(preview.changeType).toBe('downgrade');
      expect(preview.allowed).toBe(false);
      expect(preview.blockReasons.some((r: string) => r.includes('Shift Rostering'))).toBe(true);
    });

    it('blocks downgrade from Enterprise to Business if active API keys exist', async () => {
      mockSubscription.planId = 'plan-enterprise-id';
      mockSubscription.plan = mockEnterprisePlan as any;
      mockInvoicing.countActiveSeats.mockResolvedValue(50);
      mockPrisma.unscoped.tenantApiKey.count.mockResolvedValue(2);

      const preview = await service.previewPlanChange('tenant-123', 'business');
      expect(preview.changeType).toBe('downgrade');
      expect(preview.allowed).toBe(false);
      expect(preview.blockReasons.some((r: string) => r.includes('API key'))).toBe(true);
    });

    it('allows downgrade if no limits or features are violated, scheduled at next renewal', async () => {
      mockSubscription.planId = 'plan-business-id';
      mockSubscription.plan = mockBusinessPlan as any;
      mockInvoicing.countActiveSeats.mockResolvedValue(20); // within 50
      mockPrisma.unscoped.shift.count.mockResolvedValue(0);
      mockPrisma.unscoped.timesheetEntry.count.mockResolvedValue(0);

      const preview = await service.previewPlanChange('tenant-123', 'starter');
      expect(preview.changeType).toBe('downgrade');
      expect(preview.allowed).toBe(true);
      expect(preview.blockReasons).toHaveLength(0);
      expect(preview.immediate).toBe(false);
      expect(preview.effectiveDate).toBe(mockSubscription.currentPeriodEnd.toISOString());
    });
  });

  describe('executePlanChange', () => {
    it('throws ForbiddenException with reasons when downgrade is blocked', async () => {
      mockSubscription.planId = 'plan-business-id';
      mockSubscription.plan = mockBusinessPlan as any;
      mockInvoicing.countActiveSeats.mockResolvedValue(75);

      await expect(service.executePlanChange('tenant-123', 'starter')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('schedules pendingPlanId when downgrade is allowed', async () => {
      mockSubscription.planId = 'plan-business-id';
      mockSubscription.plan = mockBusinessPlan as any;
      mockInvoicing.countActiveSeats.mockResolvedValue(20);

      const result = await service.executePlanChange('tenant-123', 'starter');
      expect(result.success).toBe(true);
      expect(result.changeType).toBe('downgrade');
      expect(result.effectiveImmediately).toBe(false);
      expect(mockPrisma.unscoped.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { pendingPlanId: 'plan-starter-id' },
        }),
      );
      expect(mockAudit.log).toHaveBeenCalled();
    });

    it('charges prorated amount and updates plan immediately on upgrade', async () => {
      const result = await service.executePlanChange('tenant-123', 'business');
      expect(result.success).toBe(true);
      expect(result.changeType).toBe('upgrade');
      expect(result.effectiveImmediately).toBe(true);
      expect(mockPrisma.unscoped.invoice.create).toHaveBeenCalled();
      expect(mockInvoicing.chargeInvoice).toHaveBeenCalled();
      expect(mockPrisma.unscoped.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ planId: 'plan-business-id' }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalled();
    });
  });
});
