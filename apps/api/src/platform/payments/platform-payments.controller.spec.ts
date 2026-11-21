import { Test, TestingModule } from '@nestjs/testing';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { RefundTypeEnum } from './dto/platform-payments.dto';
import { PlatformPaymentsController } from './platform-payments.controller';
import { PlatformPaymentsService } from './platform-payments.service';

describe('PlatformPaymentsController', () => {
  let controller: PlatformPaymentsController;
  let service: PlatformPaymentsService;

  const mockService = {
    listPayments: jest.fn(),
    getPaymentDetail: jest.fn(),
    retryPayment: jest.fn(),
    refundPayment: jest.fn(),
    listDunningTenants: jest.fn(),
    retryDunningTenant: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformPaymentsController],
      providers: [
        {
          provide: PlatformPaymentsService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(PlatformAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PlatformPermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PlatformPaymentsController>(
      PlatformPaymentsController,
    );
    service = module.get<PlatformPaymentsService>(PlatformPaymentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listPayments', () => {
    it('should call service.listPayments and return wrapped response', async () => {
      const mockList = [{ id: 'pay-1', amount: 100, status: 'succeeded' }];
      mockService.listPayments.mockResolvedValue(mockList);

      const res = await controller.listPayments({ tenantId: 'tenant-1' });
      expect(res).toEqual({ data: mockList });
      expect(mockService.listPayments).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
      });
    });
  });

  describe('getPayment', () => {
    it('should call service.getPaymentDetail and return wrapped response', async () => {
      const mockDetail = { id: 'pay-1', amount: 100, refunds: [] };
      mockService.getPaymentDetail.mockResolvedValue(mockDetail);

      const res = await controller.getPayment('00000000-0000-0000-0000-000000000001');
      expect(res).toEqual({ data: mockDetail });
      expect(mockService.getPaymentDetail).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
      );
    });
  });

  describe('retryPayment', () => {
    it('should call service.retryPayment and return wrapped response', async () => {
      const mockResult = { success: true, message: 'Retry succeeded' };
      mockService.retryPayment.mockResolvedValue(mockResult);

      const req = { user: { id: 'user-1', email: 'owner@cmsnbd.com', role: 'Platform Owner' } };
      const res = await controller.retryPayment(
        '00000000-0000-0000-0000-000000000001',
        {},
        req,
      );

      expect(res).toEqual({ data: mockResult });
      expect(mockService.retryPayment).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
        { id: 'user-1', email: 'owner@cmsnbd.com', role: 'Platform Owner' },
        {},
      );
    });
  });

  describe('refundPayment', () => {
    it('should call service.refundPayment and return wrapped response', async () => {
      const mockDetail = { id: 'pay-1', status: 'refunded' };
      mockService.refundPayment.mockResolvedValue(mockDetail);

      const req = { user: { id: 'user-1', email: 'billing@cmsnbd.com', role: 'Billing Admin' } };
      const dto = {
        refundType: RefundTypeEnum.full,
        reason: 'Customer billing dispute resolved',
      };
      const res = await controller.refundPayment(
        '00000000-0000-0000-0000-000000000001',
        dto,
        req,
      );

      expect(res).toEqual({ data: mockDetail });
      expect(mockService.refundPayment).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
        { id: 'user-1', email: 'billing@cmsnbd.com', role: 'Billing Admin' },
        dto,
      );
    });
  });

  describe('listDunningTenants', () => {
    it('should call service.listDunningTenants and return wrapped response', async () => {
      const mockList = [{ tenantId: 'tenant-1', dunningStage: 'stage_2' }];
      mockService.listDunningTenants.mockResolvedValue(mockList);

      const res = await controller.listDunningTenants();
      expect(res).toEqual({ data: mockList });
      expect(mockService.listDunningTenants).toHaveBeenCalled();
    });
  });

  describe('retryDunningTenant', () => {
    it('should call service.retryDunningTenant and return wrapped response', async () => {
      const mockResult = { success: true, message: 'Recovery retry initiated' };
      mockService.retryDunningTenant.mockResolvedValue(mockResult);

      const req = { user: { id: 'user-1', email: 'owner@cmsnbd.com' } };
      const res = await controller.retryDunningTenant(
        '00000000-0000-0000-0000-000000000001',
        {},
        req,
      );

      expect(res).toEqual({ data: mockResult });
      expect(mockService.retryDunningTenant).toHaveBeenCalled();
    });
  });
});
