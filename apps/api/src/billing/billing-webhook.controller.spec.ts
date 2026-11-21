import { Test, TestingModule } from '@nestjs/testing';
import { BillingWebhookController } from './billing-webhook.controller';
import { PrismaService } from '../database/prisma.service';
import { DunningService } from './dunning.service';
import { PAYMENT_PROVIDER } from './payment-provider/payment-provider.interface';
import { BadRequestException } from '@nestjs/common';

describe('BillingWebhookController', () => {
  let controller: BillingWebhookController;
  let mockPrisma: any;
  let mockDunningService: any;
  let mockPaymentProvider: any;

  beforeEach(async () => {
    mockDunningService = {
      handlePaymentSuccess: jest.fn().mockResolvedValue(undefined),
      handlePaymentFailure: jest.fn().mockResolvedValue(undefined),
    };

    mockPaymentProvider = {
      constructWebhookEvent: jest.fn().mockReturnValue({
        id: 'evt_stripe_123',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            customer: 'cus_123',
            metadata: { tenantId: 'tenant-1' },
          },
        },
        created: 1700000000,
      }),
    };

    mockPrisma = {
      unscoped: {
        paymentEvent: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'pe_1', eventId: 'evt_stripe_123', processed: false }),
          update: jest.fn().mockResolvedValue({ id: 'pe_1', processed: true }),
        },
        subscription: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'sub-1',
            tenantId: 'tenant-1',
            customerId: 'cus_123',
          }),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingWebhookController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DunningService, useValue: mockDunningService },
        { provide: PAYMENT_PROVIDER, useValue: mockPaymentProvider },
      ],
    }).compile();

    controller = module.get<BillingWebhookController>(BillingWebhookController);
  });

  it('rejects webhooks missing stripe-signature header', async () => {
    await expect(controller.handleStripeWebhook({ body: {} } as any, undefined)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('verifies signature and processes payment_succeeded event idempotently', async () => {
    const res = await controller.handleStripeWebhook(
      { rawBody: '{"id":"evt_stripe_123"}' } as any,
      't=1700000000,v1=test_sig',
    );

    expect(mockPaymentProvider.constructWebhookEvent).toHaveBeenCalled();
    expect(mockPrisma.unscoped.paymentEvent.create).toHaveBeenCalled();
    expect(mockDunningService.handlePaymentSuccess).toHaveBeenCalledWith('sub-1');
    expect(mockPrisma.unscoped.paymentEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ processed: true }),
      }),
    );
    expect(res).toEqual({ received: true, status: 'processed' });
  });

  it('returns early when an event was already processed (idempotent duplicate)', async () => {
    mockPrisma.unscoped.paymentEvent.findUnique.mockResolvedValue({
      id: 'pe_1',
      eventId: 'evt_stripe_123',
      processed: true,
    });

    const res = await controller.handleStripeWebhook(
      { rawBody: '{"id":"evt_stripe_123"}' } as any,
      't=1700000000,v1=test_sig',
    );

    expect(mockDunningService.handlePaymentSuccess).not.toHaveBeenCalled();
    expect(res).toEqual({ received: true, idempotent: true });
  });
});
