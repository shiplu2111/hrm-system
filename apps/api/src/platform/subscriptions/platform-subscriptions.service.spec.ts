import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PlatformSubscriptionsService } from './platform-subscriptions.service';

describe('PlatformSubscriptionsService', () => {
  let service: PlatformSubscriptionsService;

  const mockSub = {
    id: 'sub-1',
    tenantId: 'tenant-1',
    planId: 'plan-starter',
    pendingPlanId: null,
    status: 'active',
    billingCycle: 'monthly',
    currency: 'USD',
    currentPeriodStart: new Date('2026-11-01'),
    currentPeriodEnd: new Date('2026-12-01'),
    trialEndsAt: null,
    discountPercent: null,
    discountReason: null,
    creditBalance: new Prisma.Decimal(0),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    cancelReason: null,
    pausedAt: null,
    pauseReason: null,
    nextBillingAt: new Date('2026-12-01'),
    createdAt: new Date('2026-11-01'),
    tenant: {
      id: 'tenant-1',
      name: 'Acme Corp',
      subdomain: 'acme',
    },
    plan: {
      id: 'plan-starter',
      code: 'starter',
      name: 'Starter',
      prices: [
        {
          id: 'price-1',
          currency: 'USD',
          billingCycle: 'monthly',
          amount: new Prisma.Decimal(49.0),
          perSeatAmount: new Prisma.Decimal(2.0),
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
        },
      ],
      limits: [
        { id: 'lim-1', planId: 'plan-starter', limitKey: 'employees', value: 50 },
      ],
      features: [
        { id: 'f-1', planId: 'plan-starter', featureKey: 'core_hr', enabled: true },
      ],
    },
    pendingPlan: null,
    changes: [],
    invoices: [],
  };

  const mockBusinessPlan = {
    id: 'plan-business',
    code: 'business',
    name: 'Business',
  };

  const mockPrisma = {
    unscoped: {
      subscription: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      employee: {
        groupBy: jest.fn(),
        count: jest.fn(),
      },
      plan: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      tenant: {
        update: jest.fn(),
      },
      subscriptionChange: {
        create: jest.fn(),
      },
      $transaction: jest.fn((arr) => Promise.all(arr)),
    },
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformSubscriptionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlatformAuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<PlatformSubscriptionsService>(
      PlatformSubscriptionsService,
    );
  });

  describe('listSubscriptions', () => {
    it('returns formatted subscriptions list with employee count', async () => {
      mockPrisma.unscoped.subscription.findMany.mockResolvedValue([mockSub]);
      mockPrisma.unscoped.employee.groupBy.mockResolvedValue([
        { tenantId: 'tenant-1', _count: { id: 12 } },
      ]);

      const res = await service.listSubscriptions();
      expect(res).toHaveLength(1);
      expect(res[0].tenantName).toBe('Acme Corp');
      expect(res[0].planCode).toBe('starter');
      expect(res[0].baseAmount).toBe(49);
      expect(res[0].employeeCount).toBe(12);
    });

    it('filters by search term', async () => {
      mockPrisma.unscoped.subscription.findMany.mockResolvedValue([mockSub]);
      mockPrisma.unscoped.employee.groupBy.mockResolvedValue([]);

      const res = await service.listSubscriptions({ search: 'nomatch' });
      expect(res).toHaveLength(0);

      const resMatch = await service.listSubscriptions({ search: 'acme' });
      expect(resMatch).toHaveLength(1);
    });
  });

  describe('getSubscriptionDetail', () => {
    it('returns detail view including changes, limits, and features', async () => {
      mockPrisma.unscoped.subscription.findUnique.mockResolvedValue(mockSub);
      mockPrisma.unscoped.employee.count.mockResolvedValue(15);
      mockPrisma.unscoped.plan.findMany.mockResolvedValue([]);

      const detail = await service.getSubscriptionDetail('sub-1');
      expect(detail.id).toBe('sub-1');
      expect(detail.employeeCount).toBe(15);
      expect(detail.features).toHaveLength(1);
    });

    it('throws NotFoundException if subscription not found', async () => {
      mockPrisma.unscoped.subscription.findUnique.mockResolvedValue(null);
      await expect(service.getSubscriptionDetail('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('changePlan', () => {
    it('throws BadRequest if target plan is same as current plan', async () => {
      mockPrisma.unscoped.subscription.findUnique.mockResolvedValue(mockSub);
      mockPrisma.unscoped.plan.findFirst.mockResolvedValue(mockSub.plan);

      await expect(
        service.changePlan('sub-1', { targetPlanId: 'plan-starter' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('executes immediate plan change and records change audit', async () => {
      mockPrisma.unscoped.subscription.findUnique
        .mockResolvedValueOnce(mockSub)
        .mockResolvedValueOnce({
          ...mockSub,
          planId: 'plan-business',
          plan: { ...mockSub.plan, id: 'plan-business', code: 'business', name: 'Business' },
        });
      mockPrisma.unscoped.plan.findFirst.mockResolvedValue(mockBusinessPlan);
      mockPrisma.unscoped.employee.count.mockResolvedValue(10);
      mockPrisma.unscoped.plan.findMany.mockResolvedValue([]);

      const updated = await service.changePlan(
        'sub-1',
        { targetPlanId: 'plan-business', effectiveImmediately: true, reason: 'Customer upgrade' },
        { id: 'admin-1', email: 'admin@platform.com', roleName: 'Platform Admin' },
      );

      expect(mockPrisma.unscoped.$transaction).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBSCRIPTION_PLAN_CHANGE' }),
      );
      expect(updated.planCode).toBe('business');
    });

    it('schedules pendingPlanId when effectiveImmediately is false', async () => {
      mockPrisma.unscoped.subscription.findUnique
        .mockResolvedValueOnce(mockSub)
        .mockResolvedValueOnce({
          ...mockSub,
          pendingPlanId: 'plan-business',
          pendingPlan: mockBusinessPlan,
        });
      mockPrisma.unscoped.plan.findFirst.mockResolvedValue(mockBusinessPlan);
      mockPrisma.unscoped.employee.count.mockResolvedValue(10);
      mockPrisma.unscoped.plan.findMany.mockResolvedValue([]);

      const updated = await service.changePlan(
        'sub-1',
        { targetPlanId: 'plan-business', effectiveImmediately: false, reason: 'Downgrade at cycle end' },
      );

      expect(mockPrisma.unscoped.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { pendingPlanId: 'plan-business' },
        }),
      );
      expect(updated.pendingPlan?.code).toBe('business');
    });
  });

  describe('extendTrial', () => {
    it('throws BadRequest if reason is missing', async () => {
      await expect(
        service.extendTrial('sub-1', { reason: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('extends trial date and logs audit', async () => {
      mockPrisma.unscoped.subscription.findUnique
        .mockResolvedValueOnce(mockSub)
        .mockResolvedValueOnce({ ...mockSub, status: 'trialing', trialEndsAt: new Date('2026-12-15') });
      mockPrisma.unscoped.employee.count.mockResolvedValue(5);
      mockPrisma.unscoped.plan.findMany.mockResolvedValue([]);

      const updated = await service.extendTrial('sub-1', {
        days: 14,
        reason: 'Proof of concept evaluation',
      });

      expect(mockPrisma.unscoped.subscription.update).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBSCRIPTION_TRIAL_EXTEND' }),
      );
      expect(updated.status).toBe('trialing');
    });
  });

  describe('applyDiscountOrCredit', () => {
    it('throws BadRequest if reason is empty', async () => {
      await expect(
        service.applyDiscountOrCredit('sub-1', { discountPercent: 10, reason: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('applies percentage discount', async () => {
      mockPrisma.unscoped.subscription.findUnique
        .mockResolvedValueOnce(mockSub)
        .mockResolvedValueOnce({ ...mockSub, discountPercent: new Prisma.Decimal(20) });
      mockPrisma.unscoped.employee.count.mockResolvedValue(5);
      mockPrisma.unscoped.plan.findMany.mockResolvedValue([]);

      const updated = await service.applyDiscountOrCredit('sub-1', {
        discountPercent: 20,
        reason: 'Partner discount',
      });

      expect(mockPrisma.unscoped.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discountPercent: new Prisma.Decimal(20),
            discountReason: 'Partner discount',
          }),
        }),
      );
      expect(updated.discountPercent).toBe(20);
    });

    it('applies fixed credit amount', async () => {
      mockPrisma.unscoped.subscription.findUnique
        .mockResolvedValueOnce(mockSub)
        .mockResolvedValueOnce({ ...mockSub, creditBalance: new Prisma.Decimal(50) });
      mockPrisma.unscoped.employee.count.mockResolvedValue(5);
      mockPrisma.unscoped.plan.findMany.mockResolvedValue([]);

      const updated = await service.applyDiscountOrCredit('sub-1', {
        creditAmount: 50,
        reason: 'Outage SLA credit',
      });

      expect(mockPrisma.unscoped.subscription.update).toHaveBeenCalled();
      expect(updated.creditBalance).toBe(50);
    });
  });

  describe('pause and resume', () => {
    it('pauses subscription with reason', async () => {
      mockPrisma.unscoped.subscription.findUnique
        .mockResolvedValueOnce(mockSub)
        .mockResolvedValueOnce({ ...mockSub, status: 'paused' });
      mockPrisma.unscoped.employee.count.mockResolvedValue(5);
      mockPrisma.unscoped.plan.findMany.mockResolvedValue([]);

      const updated = await service.pauseSubscription('sub-1', {
        reason: 'Seasonal pause requested by tenant',
      });

      expect(mockPrisma.unscoped.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'paused' }),
        }),
      );
      expect(updated.status).toBe('paused');
    });

    it('resumes paused subscription', async () => {
      const pausedSub = { ...mockSub, status: 'paused', pausedAt: new Date() };
      mockPrisma.unscoped.subscription.findUnique
        .mockResolvedValueOnce(pausedSub)
        .mockResolvedValueOnce({ ...mockSub, status: 'active', pausedAt: null });
      mockPrisma.unscoped.employee.count.mockResolvedValue(5);
      mockPrisma.unscoped.plan.findMany.mockResolvedValue([]);

      const updated = await service.resumeSubscription('sub-1', {
        reason: 'Resumed operations',
      });

      expect(mockPrisma.unscoped.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'active', pausedAt: null }),
        }),
      );
      expect(updated.status).toBe('active');
    });
  });

  describe('cancelSubscription', () => {
    it('cancels immediately when cancelImmediately is true', async () => {
      mockPrisma.unscoped.subscription.findUnique
        .mockResolvedValueOnce(mockSub)
        .mockResolvedValueOnce({ ...mockSub, status: 'cancelled' });
      mockPrisma.unscoped.employee.count.mockResolvedValue(5);
      mockPrisma.unscoped.plan.findMany.mockResolvedValue([]);

      const updated = await service.cancelSubscription('sub-1', {
        cancelImmediately: true,
        reason: 'Customer requested immediate closure',
      });

      expect(mockPrisma.unscoped.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'cancelled' }),
        }),
      );
      expect(updated.status).toBe('cancelled');
    });

    it('schedules cancellation at period end when cancelImmediately is false', async () => {
      mockPrisma.unscoped.subscription.findUnique
        .mockResolvedValueOnce(mockSub)
        .mockResolvedValueOnce({ ...mockSub, cancelAtPeriodEnd: true });
      mockPrisma.unscoped.employee.count.mockResolvedValue(5);
      mockPrisma.unscoped.plan.findMany.mockResolvedValue([]);

      const updated = await service.cancelSubscription('sub-1', {
        cancelImmediately: false,
        reason: 'Non-renewal notice',
      });

      expect(mockPrisma.unscoped.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cancelAtPeriodEnd: true }),
        }),
      );
      expect(updated.cancelAtPeriodEnd).toBe(true);
    });
  });
});
