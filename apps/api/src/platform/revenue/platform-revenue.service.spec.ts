import { Test, TestingModule } from '@nestjs/testing';
import { PlatformRevenueService } from './platform-revenue.service';
import { PrismaService } from '../../database/prisma.service';

describe('PlatformRevenueService', () => {
  let service: PlatformRevenueService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      unscoped: {
        subscription: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'sub-1',
              tenantId: 'tenant-1',
              planId: 'plan-starter',
              status: 'active',
              billingCycle: 'monthly',
              discountPercent: 10,
              createdAt: new Date('2026-11-01T00:00:00Z'),
              canceledAt: null,
              plan: {
                id: 'plan-starter',
                code: 'starter',
                name: 'Starter Plan',
                prices: [{ billingCycle: 'monthly', amount: 100 }],
              },
              tenant: {
                id: 'tenant-1',
                name: 'Tenant 1',
                companies: [
                  {
                    country: {
                      isoCode: 'USA',
                      name: 'United States',
                    },
                  },
                ],
              },
            },
            {
              id: 'sub-2',
              tenantId: 'tenant-2',
              planId: 'plan-enterprise',
              status: 'active',
              billingCycle: 'annual',
              discountPercent: null,
              createdAt: new Date('2026-11-05T00:00:00Z'),
              canceledAt: null,
              plan: {
                id: 'plan-enterprise',
                code: 'enterprise',
                name: 'Enterprise Plan',
                prices: [{ billingCycle: 'annual', amount: 1200 }],
              },
              tenant: {
                id: 'tenant-2',
                name: 'Tenant 2',
                companies: [
                  {
                    country: {
                      isoCode: 'AUS',
                      name: 'Australia',
                    },
                  },
                ],
              },
            },
            {
              id: 'sub-3',
              tenantId: 'tenant-3',
              planId: 'plan-starter',
              status: 'canceled',
              billingCycle: 'monthly',
              discountPercent: null,
              createdAt: new Date('2026-10-01T00:00:00Z'),
              canceledAt: new Date('2026-11-10T00:00:00Z'),
              plan: {
                id: 'plan-starter',
                code: 'starter',
                name: 'Starter Plan',
                prices: [{ billingCycle: 'monthly', amount: 50 }],
              },
              tenant: {
                id: 'tenant-3',
                name: 'Tenant 3',
                companies: [],
              },
            },
          ]),
        },
        subscriptionChange: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'chg-1',
              subscriptionId: 'sub-3',
              action: 'cancel',
              amount: 50,
              createdAt: new Date('2026-11-10T00:00:00Z'),
            },
          ]),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformRevenueService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<PlatformRevenueService>(PlatformRevenueService);
  });

  describe('computeSubscriptionMrr', () => {
    it('returns 0 for canceled subscriptions', () => {
      const mrr = service.computeSubscriptionMrr({
        status: 'canceled',
        billingCycle: 'monthly',
        plan: { prices: [{ billingCycle: 'monthly', amount: 100 }] },
      });
      expect(mrr).toBe(0);
    });

    it('correctly calculates monthly pricing with discount', () => {
      const mrr = service.computeSubscriptionMrr({
        status: 'active',
        billingCycle: 'monthly',
        discountPercent: 20,
        plan: { prices: [{ billingCycle: 'monthly', amount: 100 }] },
      });
      expect(mrr).toBe(80);
    });

    it('correctly calculates annual pricing divided by 12', () => {
      const mrr = service.computeSubscriptionMrr({
        status: 'active',
        billingCycle: 'annual',
        plan: { prices: [{ billingCycle: 'annual', amount: 1200 }] },
      });
      expect(mrr).toBe(100);
    });
  });

  describe('getRevenueReport', () => {
    it('computes aggregated MRR, ARR, and active subscriptions', async () => {
      const report = await service.getRevenueReport();
      // sub-1: 100 * (1 - 0.1) = 90
      // sub-2: 1200 / 12 = 100
      // sub-3: canceled = 0
      // Total MRR = 190, ARR = 2280
      expect(report.currentMrr).toBe(190);
      expect(report.currentArr).toBe(2280);
      expect(report.totalActiveSubscriptions).toBe(2);
      expect(report.currency).toBe('USD');
    });

    it('returns revenue by plan breakdown', async () => {
      const report = await service.getRevenueReport();
      expect(report.revenueByPlan.length).toBe(2);

      const enterprise = report.revenueByPlan.find(
        (p) => p.planCode === 'enterprise',
      );
      expect(enterprise).toBeDefined();
      expect(enterprise?.totalMrr).toBe(100);
      expect(enterprise?.activeSubscriptionsCount).toBe(1);

      const starter = report.revenueByPlan.find(
        (p) => p.planCode === 'starter',
      );
      expect(starter).toBeDefined();
      expect(starter?.totalMrr).toBe(90);
    });

    it('returns revenue by country breakdown', async () => {
      const report = await service.getRevenueReport();
      expect(report.revenueByCountry.length).toBe(2);

      const usa = report.revenueByCountry.find((c) => c.countryCode === 'USA');
      expect(usa).toBeDefined();
      expect(usa?.totalMrr).toBe(90);

      const aus = report.revenueByCountry.find((c) => c.countryCode === 'AUS');
      expect(aus).toBeDefined();
      expect(aus?.totalMrr).toBe(100);
    });

    it('generates exactly 12 monthly movement cohorts', async () => {
      const report = await service.getRevenueReport();
      expect(report.monthlyMovements.length).toBe(12);

      const lastMonth = report.monthlyMovements[11];
      expect(lastMonth.endingMrr).toBe(190);
      expect(lastMonth.churnedSubscriptionsCount).toBe(1);
    });

    it('calculates customer churn rate correctly', async () => {
      const report = await service.getRevenueReport();
      // 1 churned / (2 active + 1 churned) = 33.3%
      expect(report.customerChurnRate).toBe(33.3);
    });
  });

  describe('exportRevenueCsv', () => {
    it('generates formatted CSV string containing summary and all sections', async () => {
      const csv = await service.exportRevenueCsv();
      expect(csv).toContain('=== PLATFORM REVENUE REPORT ===');
      expect(csv).toContain('Current MRR,190.00');
      expect(csv).toContain('Current ARR,2280.00');
      expect(csv).toContain('=== MONTHLY REVENUE MOVEMENTS (LAST 12 MONTHS) ===');
      expect(csv).toContain('=== REVENUE BY SUBSCRIPTION PLAN ===');
      expect(csv).toContain('=== REVENUE BY COUNTRY ===');
      expect(csv).toContain('"Starter Plan"');
      expect(csv).toContain('"Enterprise Plan"');
      expect(csv).toContain('"United States"');
      expect(csv).toContain('"Australia"');
    });
  });
});
