import { Test, TestingModule } from '@nestjs/testing';
import { PlatformDashboardService } from './platform-dashboard.service';
import { PrismaService } from '../../database/prisma.service';

describe('PlatformDashboardService', () => {
  let service: PlatformDashboardService;
  let mockPrisma: any;

  const mockTenants = [
    {
      id: 'tenant-1',
      name: 'Acme Corp',
      subdomain: 'acme',
      planId: 'business',
      status: 'active',
      createdAt: new Date(),
      _count: { employees: 850 }, // 85% of 1000 -> approaching limit
    },
    {
      id: 'tenant-2',
      name: 'TechFlow Labs',
      subdomain: 'techflow',
      planId: 'starter',
      status: 'active',
      createdAt: new Date(),
      _count: { employees: 210 }, // 84% of 250 -> approaching limit
    },
    {
      id: 'tenant-3',
      name: 'Small Startup',
      subdomain: 'startup',
      planId: 'starter',
      status: 'active',
      createdAt: new Date(),
      _count: { employees: 40 }, // 16% of 250 -> NOT approaching
    },
    {
      id: 'tenant-4',
      name: 'Trial Co',
      subdomain: 'trialco',
      planId: 'trial',
      status: 'active',
      createdAt: new Date(),
      _count: { employees: 10 },
    },
    {
      id: 'tenant-5',
      name: 'Suspended Org',
      subdomain: 'suspended',
      planId: 'starter',
      status: 'suspended',
      createdAt: new Date(),
      _count: { employees: 5 },
    },
    {
      id: 'tenant-6',
      name: 'Cancelled Inc',
      subdomain: 'cancelled',
      planId: 'free',
      status: 'cancelled',
      createdAt: new Date(),
      _count: { employees: 0 },
    },
  ];

  beforeEach(async () => {
    mockPrisma = {
      unscoped: {
        tenant: {
          findMany: jest.fn().mockResolvedValue(mockTenants),
        },
        employee: {
          count: jest.fn().mockResolvedValue(1115),
        },
        supportTicket: {
          count: jest.fn().mockResolvedValue(7),
        },
        platformLoginHistory: {
          count: jest.fn().mockImplementation(({ where }) => {
            if (where?.status) {
              // failed attempts
              return Promise.resolve(2);
            }
            // total attempts
            return Promise.resolve(100);
          }),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformDashboardService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<PlatformDashboardService>(PlatformDashboardService);
  });

  describe('getDashboardAggregates', () => {
    it('aggregates tenants by lifecycle status accurately', async () => {
      const { data } = await service.getDashboardAggregates(true);

      expect(data.tenantsByStatus).toEqual({
        trial: 1,
        active: 3,
        suspended: 1,
        cancelled: 1,
        total: 6,
      });
    });

    it('returns total active employees across all tenants', async () => {
      const { data } = await service.getDashboardAggregates(true);
      expect(data.totalActiveEmployees).toBe(1115);
      expect(mockPrisma.unscoped.employee.count).toHaveBeenCalledWith({
        where: {
          employmentStatus: 'active',
          deletedAt: null,
        },
      });
    });

    it('returns 0 for MRR and ARR until Stage F exists', async () => {
      const { data } = await service.getDashboardAggregates(true);
      expect(data.mrr).toBe(0);
      expect(data.arr).toBe(0);
    });

    it('returns exactly 12 weekly cohorts for new tenants', async () => {
      const { data } = await service.getDashboardAggregates(true);
      expect(data.newTenantsPerWeek).toHaveLength(12);

      // Verify structure of weekly data
      const firstWeek = data.newTenantsPerWeek[0];
      expect(firstWeek).toHaveProperty('weekStart');
      expect(firstWeek).toHaveProperty('weekEnd');
      expect(firstWeek).toHaveProperty('count');
      expect(firstWeek).toHaveProperty('weekLabel');
    });

    it('identifies tenants approaching plan capacity limits (>= 80%) sorted descending', async () => {
      const { data } = await service.getDashboardAggregates(true);

      // Acme: 850/1000 = 85%
      // TechFlow: 210/250 = 84%
      // Small Startup: 40/250 = 16% (excluded)
      expect(data.tenantsApproachingLimits).toHaveLength(2);
      expect(data.tenantsApproachingLimits[0].subdomain).toBe('acme');
      expect(data.tenantsApproachingLimits[0].usagePercentage).toBe(85);
      expect(data.tenantsApproachingLimits[1].subdomain).toBe('techflow');
      expect(data.tenantsApproachingLimits[1].usagePercentage).toBe(84);
    });

    it('returns 0 for failed payments count until Stage F exists', async () => {
      const { data } = await service.getDashboardAggregates(true);
      expect(data.failedPaymentsCount).toBe(0);
    });

    it('returns open support tickets count', async () => {
      const { data } = await service.getDashboardAggregates(true);
      expect(data.openSupportTicketsCount).toBe(7);
      expect(mockPrisma.unscoped.supportTicket.count).toHaveBeenCalledWith({
        where: {
          status: {
            in: ['open', 'in_progress', 'waiting'],
          },
        },
      });
    });

    it('computes last-24h error rate percentage', async () => {
      const { data } = await service.getDashboardAggregates(true);
      // 2 failed out of 100 total = 2.0%
      expect(data.last24hErrorRate).toBe(2);
    });

    it('populates needsAttention list with over limit and expiring trials', async () => {
      const { data } = await service.getDashboardAggregates(true);
      expect(data.needsAttention).toBeDefined();
      expect(Array.isArray(data.needsAttention)).toBe(true);
      expect(data.needsAttention.some((i) => i.type === 'over_limit')).toBe(true);
    });

    it('returns graceful zero metrics for empty platform with no tenants', async () => {
      mockPrisma.unscoped.tenant.findMany.mockResolvedValueOnce([]);
      mockPrisma.unscoped.employee.count.mockResolvedValueOnce(0);
      mockPrisma.unscoped.supportTicket.count.mockResolvedValueOnce(0);

      const { data } = await service.getDashboardAggregates(true);
      expect(data.tenantsByStatus.total).toBe(0);
      expect(data.tenantsByStatus.active).toBe(0);
      expect(data.totalActiveEmployees).toBe(0);
      expect(data.tenantsApproachingLimits).toHaveLength(0);
      expect(data.needsAttention).toHaveLength(0);
      expect(data.newTenantsPerWeek).toHaveLength(12);
      expect(data.newTenantsPerWeek.every((w) => w.count === 0)).toBe(true);
    });

    it('serves cached results for 60 seconds on subsequent calls', async () => {
      // First call (cache miss)
      const call1 = await service.getDashboardAggregates(true);
      expect(call1.cached).toBe(false);

      // Second call without forceRefresh (cache hit)
      const call2 = await service.getDashboardAggregates(false);
      expect(call2.cached).toBe(true);
      expect(call2.data.tenantsByStatus).toEqual(call1.data.tenantsByStatus);

      // Prisma should not have been called again on cache hit
      expect(mockPrisma.unscoped.tenant.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sub-endpoints', () => {
    it('returns tenants by status from getTenantsByStatus', async () => {
      const statusCounts = await service.getTenantsByStatus();
      expect(statusCounts.total).toBe(6);
      expect(statusCounts.active).toBe(3);
    });

    it('returns 12 weekly cohorts from getNewTenantsPerWeek', async () => {
      const weeks = await service.getNewTenantsPerWeek();
      expect(weeks).toHaveLength(12);
    });

    it('returns approaching limit tenants from getTenantsApproachingLimits', async () => {
      const approaching = await service.getTenantsApproachingLimits();
      expect(approaching.length).toBeGreaterThan(0);
      expect(approaching[0].usagePercentage).toBeGreaterThanOrEqual(80);
    });
  });
});
