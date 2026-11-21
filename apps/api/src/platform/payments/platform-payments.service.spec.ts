import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { RefundTypeEnum } from './dto/platform-payments.dto';
import { PlatformPaymentsService } from './platform-payments.service';

describe('PlatformPaymentsService', () => {
  let service: PlatformPaymentsService;

  const mockPayment = {
    id: 'pay-1',
    tenantId: 'tenant-1',
    invoiceId: 'inv-1',
    subscriptionId: 'sub-1',
    provider: 'stripe',
    providerPaymentId: 'ch_test_123',
    idempotencyKey: 'idem-1',
    amount: new Prisma.Decimal(150.0),
    amountRefunded: new Prisma.Decimal(0.0),
    currency: 'USD',
    status: PaymentStatus.succeeded,
    errorCode: null,
    errorMessage: null,
    refundReason: null,
    refundedAt: null,
    paymentMethod: 'card',
    retryCount: 0,
    lastRetryAt: null,
    paidAt: new Date('2026-11-15'),
    createdAt: new Date('2026-11-15'),
    updatedAt: new Date('2026-11-15'),
    tenant: {
      id: 'tenant-1',
      name: 'Acme Corporation',
      subdomain: 'acme',
      status: 'active',
      suspensionMode: null,
    },
    invoice: {
      id: 'inv-1',
      invoiceNumber: 'INV-2026-001',
      total: new Prisma.Decimal(150.0),
      amountPaid: new Prisma.Decimal(150.0),
      amountDue: new Prisma.Decimal(0.0),
      status: 'paid',
      billingReason: 'subscription_cycle',
    },
    subscription: {
      id: 'sub-1',
      status: 'active',
      dunningStep: 0,
      lastDunningAt: null,
    },
    refunds: [],
  };

  const mockFailedPayment = {
    ...mockPayment,
    id: 'pay-failed',
    status: PaymentStatus.failed,
    errorCode: 'card_declined',
    errorMessage: 'The card was declined by the issuing bank.',
    paidAt: null,
    invoice: {
      ...mockPayment.invoice,
      status: 'open',
      amountPaid: new Prisma.Decimal(0.0),
      amountDue: new Prisma.Decimal(150.0),
    },
    subscription: {
      id: 'sub-1',
      status: 'past_due',
      dunningStep: 2,
      lastDunningAt: new Date('2026-11-18'),
    },
  };

  const mockUnscoped: any = {
    payment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    paymentRefund: {
      create: jest.fn(),
    },
    invoice: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    subscription: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    tenant: {
      update: jest.fn(),
    },
    $transaction: jest.fn((cb: any) => cb(mockUnscoped)),
  };

  const mockPrismaService = {
    unscoped: mockUnscoped,
  };

  const mockAudit = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformPaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PlatformAuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<PlatformPaymentsService>(PlatformPaymentsService);
  });

  describe('listPayments', () => {
    it('should list payments with filters and mapping', async () => {
      mockUnscoped.payment.findMany.mockResolvedValue([
        {
          ...mockPayment,
          _count: { refunds: 0 },
        },
      ]);

      const result = await service.listPayments({
        tenantId: 'tenant-1',
        search: 'Acme',
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pay-1');
      expect(result[0].amount).toBe(150);
      expect(result[0].status).toBe('succeeded');
      expect(result[0].tenantName).toBe('Acme Corporation');
      expect(mockUnscoped.payment.findMany).toHaveBeenCalled();
    });
  });

  describe('getPaymentDetail', () => {
    it('should return full payment detail with refunds and invoice', async () => {
      mockUnscoped.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        refunds: [
          {
            id: 'ref-1',
            paymentId: 'pay-1',
            tenantId: 'tenant-1',
            amount: new Prisma.Decimal(50.0),
            currency: 'USD',
            reason: 'Partial customer refund request',
            refundedBy: 'admin@cmsnbd.com',
            status: 'succeeded',
            providerRefundId: 're_123',
            createdAt: new Date('2026-11-19'),
          },
        ],
      });

      const detail = await service.getPaymentDetail('pay-1');
      expect(detail.id).toBe('pay-1');
      expect(detail.refunds).toHaveLength(1);
      expect(detail.refunds[0].amount).toBe(50);
      expect(detail.invoice?.invoiceNumber).toBe('INV-2026-001');
    });

    it('should throw NotFoundException if payment does not exist', async () => {
      mockUnscoped.payment.findUnique.mockResolvedValue(null);
      await expect(service.getPaymentDetail('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('retryPayment', () => {
    it('should successfully retry a failed payment, settle invoice, and restore tenant', async () => {
      mockUnscoped.payment.findUnique
        .mockResolvedValueOnce(mockFailedPayment)
        .mockResolvedValueOnce({
          ...mockFailedPayment,
          status: PaymentStatus.succeeded,
          retryCount: 1,
          errorCode: null,
          errorMessage: null,
          refunds: [],
        });

      const actor = { id: 'admin-1', email: 'owner@cmsnbd.com' };
      const res = await service.retryPayment('pay-failed', actor);

      expect(res.success).toBe(true);
      expect(mockUnscoped.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-failed' },
          data: expect.objectContaining({
            status: PaymentStatus.succeeded,
            errorCode: null,
            errorMessage: null,
          }),
        }),
      );
      expect(mockUnscoped.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({ status: 'paid' }),
        }),
      );
      expect(mockUnscoped.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({ status: 'active', dunningStep: 0 }),
        }),
      );
      expect(mockUnscoped.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-1' },
          data: expect.objectContaining({ status: 'active', suspensionMode: null }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'payment_retry_succeeded',
        }),
      );
    });

    it('should advance dunning sequence when retry simulation fails', async () => {
      mockUnscoped.payment.findUnique
        .mockResolvedValueOnce(mockFailedPayment)
        .mockResolvedValueOnce({
          ...mockFailedPayment,
          status: PaymentStatus.failed,
          retryCount: 2,
          refunds: [],
        });

      const actor = { id: 'admin-1', email: 'owner@cmsnbd.com' };
      const res = await service.retryPayment('pay-failed', actor, {
        simulateFailure: true,
        failureReason: 'Insufficient funds on card',
      });

      expect(res.success).toBe(false);
      expect(mockUnscoped.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({ dunningStep: 3, status: 'past_due' }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'payment_retry_failed',
        }),
      );
    });

    it('should throw BadRequestException if retrying an already succeeded payment', async () => {
      mockUnscoped.payment.findUnique.mockResolvedValue(mockPayment);
      const actor = { id: 'admin-1', email: 'owner@cmsnbd.com' };

      await expect(service.retryPayment('pay-1', actor)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('refundPayment', () => {
    it('should process a full refund and update payment status to refunded', async () => {
      mockUnscoped.payment.findUnique
        .mockResolvedValueOnce(mockPayment)
        .mockResolvedValueOnce({
          ...mockPayment,
          amountRefunded: new Prisma.Decimal(150.0),
          status: PaymentStatus.refunded,
          refunds: [
            {
              id: 'ref-1',
              paymentId: 'pay-1',
              tenantId: 'tenant-1',
              amount: new Prisma.Decimal(150.0),
              currency: 'USD',
              reason: 'Customer requested full refund',
              refundedBy: 'admin@cmsnbd.com',
              status: 'succeeded',
              providerRefundId: 're_123',
              createdAt: new Date(),
            },
          ],
        });

      const actor = { id: 'admin-1', email: 'billing@cmsnbd.com' };
      const res = await service.refundPayment('pay-1', actor, {
        refundType: RefundTypeEnum.full,
        reason: 'Customer requested full refund',
      });

      expect(mockUnscoped.paymentRefund.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: expect.any(Prisma.Decimal),
            reason: 'Customer requested full refund',
          }),
        }),
      );
      expect(mockUnscoped.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1' },
          data: expect.objectContaining({
            status: PaymentStatus.refunded,
            amountRefunded: expect.any(Prisma.Decimal),
          }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'payment_refund_issued',
        }),
      );
    });

    it('should process a partial refund and set status to partially_refunded', async () => {
      mockUnscoped.payment.findUnique
        .mockResolvedValueOnce(mockPayment)
        .mockResolvedValueOnce({
          ...mockPayment,
          amountRefunded: new Prisma.Decimal(60.0),
          status: PaymentStatus.partially_refunded,
          refunds: [],
        });

      const actor = { id: 'admin-1', email: 'billing@cmsnbd.com' };
      await service.refundPayment('pay-1', actor, {
        refundType: RefundTypeEnum.partial,
        amount: 60.0,
        reason: 'Goodwill discount adjustment',
      });

      expect(mockUnscoped.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentStatus.partially_refunded,
          }),
        }),
      );
    });

    it('should reject refund if reason is missing or shorter than 5 chars', async () => {
      mockUnscoped.payment.findUnique.mockResolvedValue(mockPayment);
      const actor = { id: 'admin-1', email: 'billing@cmsnbd.com' };

      await expect(
        service.refundPayment('pay-1', actor, {
          refundType: RefundTypeEnum.full,
          reason: 'abc',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject partial refund exceeding available balance', async () => {
      mockUnscoped.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        amountRefunded: new Prisma.Decimal(100.0), // 50 available
      });
      const actor = { id: 'admin-1', email: 'billing@cmsnbd.com' };

      await expect(
        service.refundPayment('pay-1', actor, {
          refundType: RefundTypeEnum.partial,
          amount: 75.0,
          reason: 'Too much requested',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listDunningTenants', () => {
    it('should map past_due subscriptions into structured dunning stages', async () => {
      mockUnscoped.subscription.findMany.mockResolvedValue([
        {
          id: 'sub-dunning',
          tenantId: 'tenant-dunning',
          planId: 'plan-pro',
          status: 'past_due',
          dunningStep: 2,
          lastDunningAt: new Date(),
          billingCycle: 'monthly',
          currency: 'USD',
          tenant: {
            id: 'tenant-dunning',
            name: 'Globex Industries',
            subdomain: 'globex',
            status: 'active',
            suspensionMode: null,
          },
          plan: {
            id: 'plan-pro',
            name: 'Professional',
            tier: 'pro',
          },
          invoices: [
            {
              id: 'inv-dunning-1',
              total: new Prisma.Decimal(250.0),
              amountDue: new Prisma.Decimal(250.0),
              status: 'past_due',
              dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            },
          ],
          payments: [
            {
              id: 'pay-fail-1',
              amount: new Prisma.Decimal(250.0),
              currency: 'USD',
              status: PaymentStatus.failed,
              errorCode: 'insufficient_funds',
              errorMessage: 'Insufficient funds in the cardholder account.',
              createdAt: new Date(),
            },
          ],
        },
      ]);

      const result = await service.listDunningTenants();
      expect(result).toHaveLength(1);
      expect(result[0].tenantName).toBe('Globex Industries');
      expect(result[0].dunningStep).toBe(2);
      expect(result[0].dunningStage).toBe('stage_2');
      expect(result[0].totalOutstandingAmount).toBe(250);
      expect(result[0].latestFailedPayment?.errorCode).toBe('insufficient_funds');
    });
  });
});
