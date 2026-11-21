import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionBillingQueueService } from './subscription-billing-queue.service';
import { PrismaService } from '../database/prisma.service';
import { BillingInvoicingService } from './billing-invoicing.service';
import { DunningService } from './dunning.service';

describe('SubscriptionBillingQueueService', () => {
  let service: SubscriptionBillingQueueService;
  let mockPrisma: any;
  let mockInvoicingService: any;
  let mockDunningService: any;

  beforeEach(async () => {
    mockInvoicingService = {
      generateCycleInvoice: jest.fn().mockResolvedValue({ id: 'inv-1', total: 49.0 }),
      chargeInvoice: jest.fn().mockResolvedValue({ success: true, chargeResult: { status: 'succeeded' } }),
    };

    mockDunningService = {
      handlePaymentSuccess: jest.fn().mockResolvedValue(undefined),
      handlePaymentFailure: jest.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      unscoped: {
        subscription: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'sub-1',
              tenantId: 'tenant-1',
              status: 'active',
              billingCycle: 'monthly',
              currentPeriodStart: new Date('2026-10-01'),
              currentPeriodEnd: new Date('2026-11-01'),
              nextBillingAt: new Date('2026-11-01'),
              tenant: { name: 'Acme Corp' },
            },
          ]),
          findUnique: jest.fn().mockResolvedValue({
            id: 'sub-1',
            tenantId: 'tenant-1',
            status: 'active',
            billingCycle: 'monthly',
            currentPeriodStart: new Date('2026-10-01'),
            currentPeriodEnd: new Date('2026-11-01'),
            nextBillingAt: new Date('2026-11-01'),
            tenant: { name: 'Acme Corp' },
          }),
          update: jest.fn().mockResolvedValue({ id: 'sub-1' }),
        },
        tenant: {
          update: jest.fn().mockResolvedValue({ id: 'tenant-1' }),
        },
        $transaction: jest.fn().mockImplementation((arr) => Promise.all(arr)),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionBillingQueueService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BillingInvoicingService, useValue: mockInvoicingService },
        { provide: DunningService, useValue: mockDunningService },
      ],
    }).compile();

    service = module.get<SubscriptionBillingQueueService>(SubscriptionBillingQueueService);
  });

  describe('billSingleSubscription', () => {
    it('generates invoice, charges provider, and advances subscription cycle on success', async () => {
      const res = await service.billSingleSubscription('sub-1');

      expect(res.success).toBe(true);
      expect(mockInvoicingService.generateCycleInvoice).toHaveBeenCalledWith('sub-1');
      expect(mockInvoicingService.chargeInvoice).toHaveBeenCalledWith('inv-1');
      expect(mockPrisma.unscoped.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({
            status: 'active',
            dunningStep: 0,
          }),
        }),
      );
      expect(mockDunningService.handlePaymentSuccess).toHaveBeenCalledWith('sub-1');
    });

    it('initiates dunning sequence if charge fails', async () => {
      mockInvoicingService.chargeInvoice.mockResolvedValue({
        success: false,
        chargeResult: { status: 'failed', errorMessage: 'Card expired' },
      });

      const res = await service.billSingleSubscription('sub-1');

      expect(res.success).toBe(false);
      expect(mockDunningService.handlePaymentFailure).toHaveBeenCalledWith('inv-1', 'Card expired');
    });
  });

  describe('processCycleBilling', () => {
    it('processes all subscriptions due for monthly billing', async () => {
      const result = await service.processCycleBilling();

      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
    });
  });
});
