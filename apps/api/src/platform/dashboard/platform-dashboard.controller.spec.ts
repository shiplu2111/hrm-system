import { Test, TestingModule } from '@nestjs/testing';
import { PlatformDashboardController } from './platform-dashboard.controller';
import { PlatformDashboardService } from './platform-dashboard.service';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import type { PlatformDashboardView } from '@hrm/shared-types';

describe('PlatformDashboardController', () => {
  let controller: PlatformDashboardController;
  let mockService: any;

  const mockView: PlatformDashboardView = {
    asOf: new Date().toISOString(),
    tenantsByStatus: {
      trial: 2,
      active: 10,
      suspended: 1,
      cancelled: 0,
      total: 13,
    },
    totalActiveEmployees: 4200,
    mrr: 0,
    arr: 0,
    newTenantsPerWeek: [],
    tenantsApproachingLimits: [],
    needsAttention: [],
    failedPaymentsCount: 0,
    openSupportTicketsCount: 3,
    last24hErrorRate: 0.5,
    cached: false,
    cachedAt: new Date().toISOString(),
    cacheTtlSeconds: 60,
  };

  beforeEach(async () => {
    mockService = {
      getDashboardAggregates: jest
        .fn()
        .mockResolvedValue({ data: mockView, cached: false }),
      getTenantsByStatus: jest
        .fn()
        .mockResolvedValue(mockView.tenantsByStatus),
      getNewTenantsPerWeek: jest
        .fn()
        .mockResolvedValue(mockView.newTenantsPerWeek),
      getTenantsApproachingLimits: jest
        .fn()
        .mockResolvedValue(mockView.tenantsApproachingLimits),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformDashboardController],
      providers: [
        {
          provide: PlatformDashboardService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(PlatformAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PlatformPermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PlatformDashboardController>(
      PlatformDashboardController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDashboard', () => {
    it('returns envelope with data and caching metadata', async () => {
      const response = await controller.getDashboard('false');

      expect(response.data).toEqual(mockView);
      expect(response.meta).toMatchObject({
        cached: false,
        cacheTtlSeconds: 60,
      });
      expect(mockService.getDashboardAggregates).toHaveBeenCalledWith(false);
    });

    it('passes forceRefresh true when refresh=true query is provided', async () => {
      await controller.getDashboard('true');
      expect(mockService.getDashboardAggregates).toHaveBeenCalledWith(true);
    });
  });

  describe('getOverview', () => {
    it('delegates to getDashboard as alias', async () => {
      const response = await controller.getOverview();
      expect(response.data).toEqual(mockView);
    });
  });

  describe('getTenantsByStatus', () => {
    it('returns tenant status breakdown', async () => {
      const response = await controller.getTenantsByStatus();
      expect(response.data).toEqual(mockView.tenantsByStatus);
    });
  });

  describe('getNewTenantsWeekly', () => {
    it('returns weekly growth trend', async () => {
      const response = await controller.getNewTenantsWeekly();
      expect(response.data).toEqual(mockView.newTenantsPerWeek);
    });
  });

  describe('getPlanLimits', () => {
    it('returns approaching limit tenants', async () => {
      const response = await controller.getPlanLimits();
      expect(response.data).toEqual(mockView.tenantsApproachingLimits);
    });
  });
});
