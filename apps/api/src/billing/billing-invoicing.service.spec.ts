import { Test, TestingModule } from '@nestjs/testing';
import { EmploymentStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { BillingInvoicingService } from './billing-invoicing.service';
import { PAYMENT_PROVIDER } from './payment-provider/payment-provider.interface';

describe('BillingInvoicingService', () => {
  let service: BillingInvoicingService;
  let mockPrisma: any;
  let mockPaymentProvider: any;

  const mockPlan = {
    id: 'plan-starter-uuid',
    code: 'starter',
    name: 'Starter',
    limits: [{ limitKey: 'employees', value: 25 }],
  };

  const mockPrice = {
    id: 'price-starter-usd',
    planId: 'plan-starter-uuid',
    currency: 'USD',
    billingCycle: 'monthly',
    amount: 49.0,
    perSeatAmount: 2.0,
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
  };

  beforeEach(async () => {
    mockPaymentProvider = {
      charge: jest.fn().mockResolvedValue({
        success: true,
        status: 'succeeded',
        providerPaymentId: 'pi_test_12345',
        amount: 59.0,
        currency: 'USD',
      }),
    };

    mockPrisma = {
      unscoped: {
        employee: {
          count: jest.fn().mockResolvedValue(15),
        },
        plan: {
          findUnique: jest.fn().mockResolvedValue(mockPlan),
        },
        planPrice: {
          findFirst: jest.fn().mockResolvedValue(mockPrice),
        },
        subscription: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'sub-1',
            tenantId: 'tenant-1',
            planId: 'plan-starter-uuid',
            currency: 'USD',
            billingCycle: 'monthly',
            currentPeriodStart: new Date('2026-11-01'),
            currentPeriodEnd: new Date('2026-12-01'),
            plan: mockPlan,
            tenant: { id: 'tenant-1', name: 'Acme Corp', subdomain: 'acme' },
          }),
        },
        invoice: {
          create: jest.fn().mockImplementation(({ data }) => ({
            id: 'inv-1',
            ...data,
            lines: data.lines.create,
          })),
          findUnique: jest.fn(),
          update: jest.fn().mockResolvedValue({ id: 'inv-1', status: 'paid' }),
        },
        payment: {
          create: jest.fn().mockImplementation(({ data }) => ({
            id: 'pay-1',
            ...data,
          })),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingInvoicingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PAYMENT_PROVIDER, useValue: mockPaymentProvider },
      ],
    }).compile();

    service = module.get<BillingInvoicingService>(BillingInvoicingService);
  });

  describe('countActiveSeats', () => {
    it('counts non-terminated, non-deleted employees holding active seats', async () => {
      const seats = await service.countActiveSeats('tenant-1');
      expect(seats).toBe(15);
      expect(mockPrisma.unscoped.employee.count).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          employmentStatus: { not: EmploymentStatus.terminated },
          deletedAt: null,
        },
      });
    });
  });

  describe('calculateCycleAmounts', () => {
    it('applies base fee plus extra seats above included threshold', async () => {
      // 15 seats total, 10 included in base threshold, 5 extra @ $2.00 = $10.00 extra
      // Base fee = $49.00 -> Total = $59.00
      const calc = await service.calculateCycleAmounts('plan-starter-uuid', 'USD', 'monthly', 15);

      expect(calc.baseAmount).toBe(49.0);
      expect(calc.perSeatAmount).toBe(2.0);
      expect(calc.includedSeats).toBe(10);
      expect(calc.billableExtraSeats).toBe(5);
      expect(calc.extraSeatsAmount).toBe(10.0);
      expect(calc.subtotal).toBe(59.0);
      expect(calc.total).toBe(59.0);
    });

    it('charges only base fee when active seats do not exceed included threshold', async () => {
      const calc = await service.calculateCycleAmounts('plan-starter-uuid', 'USD', 'monthly', 8);

      expect(calc.baseAmount).toBe(49.0);
      expect(calc.billableExtraSeats).toBe(0);
      expect(calc.extraSeatsAmount).toBe(0);
      expect(calc.total).toBe(49.0);
    });
  });

  describe('generateCycleInvoice', () => {
    it('generates an invoice with line items for base and extra seats', async () => {
      const invoice = await service.generateCycleInvoice('sub-1');

      expect(invoice).toBeDefined();
      expect(invoice.currency).toBe('USD');
      expect(Number(invoice.total)).toBe(59.0);
      expect(invoice.lines).toHaveLength(2);
      expect(invoice.lines[0].description).toContain('base subscription fee');
      expect(invoice.lines[1].description).toContain('above included threshold');
    });
  });

  describe('chargeInvoice', () => {
    it('charges payment provider with idempotency key and records payment', async () => {
      mockPrisma.unscoped.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        tenantId: 'tenant-1',
        subscriptionId: 'sub-1',
        invoiceNumber: 'INV-202611-ACME-1001',
        total: 59.0,
        currency: 'USD',
        subscription: { customerId: 'cus_123', paymentMethodId: 'pm_123', dunningStep: 0 },
        tenant: { name: 'Acme Corp' },
      });

      const res = await service.chargeInvoice('inv-1');

      expect(res.success).toBe(true);
      expect(mockPaymentProvider.charge).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 59.0,
          currency: 'USD',
          idempotencyKey: 'inv_inv-1_0',
        }),
      );
      expect(mockPrisma.unscoped.payment.create).toHaveBeenCalled();
      expect(mockPrisma.unscoped.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({ status: 'paid' }),
        }),
      );
    });
  });
});
