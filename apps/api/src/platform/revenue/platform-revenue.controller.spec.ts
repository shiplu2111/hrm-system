import { Test, TestingModule } from '@nestjs/testing';
import { PlatformRevenueController } from './platform-revenue.controller';
import { PlatformRevenueService } from './platform-revenue.service';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';

describe('PlatformRevenueController', () => {
  let controller: PlatformRevenueController;
  let serviceMock: any;

  beforeEach(async () => {
    serviceMock = {
      getRevenueReport: jest.fn().mockResolvedValue({
        asOf: '2026-11-21T00:00:00Z',
        currency: 'USD',
        currentMrr: 640.65,
        currentArr: 7687.8,
        netNewMrrThisMonth: 640.65,
        growthRatePercent: 100,
        customerChurnRate: 0,
        revenueChurnRate: 0,
        totalActiveSubscriptions: 2,
        monthlyMovements: [],
        revenueByPlan: [],
        revenueByCountry: [],
      }),
      exportRevenueCsv: jest.fn().mockResolvedValue('=== PLATFORM REVENUE REPORT ===\n'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformRevenueController],
      providers: [
        { provide: PlatformRevenueService, useValue: serviceMock },
      ],
    })
      .overrideGuard(PlatformAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PlatformPermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PlatformRevenueController>(
      PlatformRevenueController,
    );
  });

  it('getRevenueReport returns envelope with revenue report data', async () => {
    const res = await controller.getRevenueReport();
    expect(res.data.currentMrr).toBe(640.65);
    expect(res.data.currentArr).toBe(7687.8);
    expect(serviceMock.getRevenueReport).toHaveBeenCalled();
  });

  it('exportRevenueCsv sets CSV headers and sends content', async () => {
    const resMock: any = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await controller.exportRevenueCsv(resMock);
    expect(serviceMock.exportRevenueCsv).toHaveBeenCalled();
    expect(resMock.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    expect(resMock.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('attachment; filename="platform-revenue-report-'),
    );
    expect(resMock.status).toHaveBeenCalledWith(200);
    expect(resMock.send).toHaveBeenCalledWith('=== PLATFORM REVENUE REPORT ===\n');
  });
});
