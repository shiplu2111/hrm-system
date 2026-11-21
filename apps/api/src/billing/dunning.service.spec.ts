import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { PlatformAuditService } from '../platform/audit/platform-audit.service';
import { MailService } from '../settings/mail.service';
import { SmtpSettingsService } from '../settings/smtp-settings.service';
import { BillingInvoicingService } from './billing-invoicing.service';
import { DunningService } from './dunning.service';

describe('DunningService', () => {
  let service: DunningService;
  let mockPrisma: any;
  let mockPlatformAudit: any;
  let mockInvoicingService: any;
  let mockMailService: any;
  let mockSmtpSettingsService: any;

  const mockInvoice = {
    id: 'inv-1',
    tenantId: 'tenant-1',
    invoiceNumber: 'INV-202611-ACME-1001',
    total: 99.0,
    currency: 'USD',
    tenant: { id: 'tenant-1', name: 'Acme Corp', status: 'active' },
    subscription: {
      id: 'sub-1',
      dunningStep: 0,
      status: 'active',
      nextBillingAt: new Date('2026-11-20'),
    },
  };

  beforeEach(async () => {
    mockPlatformAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    mockInvoicingService = {};
    mockMailService = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };
    mockSmtpSettingsService = {
      getDecryptedSettings: jest.fn().mockResolvedValue(null),
    };

    mockPrisma = {
      unscoped: {
        invoice: {
          findUnique: jest.fn().mockResolvedValue(mockInvoice),
        },
        subscription: {
          update: jest.fn().mockResolvedValue({ id: 'sub-1' }),
          findUnique: jest.fn().mockResolvedValue({
            id: 'sub-1',
            tenantId: 'tenant-1',
            status: 'past_due',
            tenant: { id: 'tenant-1', name: 'Acme Corp', status: 'suspended', suspensionReason: 'Subscription past due' },
          }),
        },
        tenant: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'tenant-1',
            name: 'Acme Corp',
            status: 'active',
            suspensionMode: null,
          }),
          update: jest.fn().mockResolvedValue({ id: 'tenant-1' }),
        },
        user: {
          findFirst: jest.fn().mockResolvedValue({
            email: 'admin@acme.com',
            name: 'Acme Admin',
          }),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DunningService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BillingInvoicingService, useValue: mockInvoicingService },
        { provide: PlatformAuditService, useValue: mockPlatformAudit },
        { provide: MailService, useValue: mockMailService },
        { provide: SmtpSettingsService, useValue: mockSmtpSettingsService },
      ],
    }).compile();

    service = module.get<DunningService>(DunningService);
  });

  describe('handlePaymentFailure (1-3-7 retry progression)', () => {
    it('advances from Step 0 to Step 1 (Day 1 retry)', async () => {
      await service.handlePaymentFailure('inv-1', 'Insufficient funds');

      expect(mockPrisma.unscoped.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({
            dunningStep: 1,
            status: 'active',
          }),
        }),
      );
      expect(mockPlatformAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'billing.dunning_step_advanced',
        }),
      );
    });

    it('advances from Step 1 to Step 2 (Day 3 retry, marks past_due)', async () => {
      mockPrisma.unscoped.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        subscription: { ...mockInvoice.subscription, dunningStep: 1 },
      });

      await service.handlePaymentFailure('inv-1', 'Card declined');

      expect(mockPrisma.unscoped.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({
            dunningStep: 2,
            status: 'past_due',
          }),
        }),
      );
    });

    it('advances from Step 2 to Step 3 (Day 7 final retry)', async () => {
      mockPrisma.unscoped.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        subscription: { ...mockInvoice.subscription, dunningStep: 2, status: 'past_due' },
      });

      await service.handlePaymentFailure('inv-1', 'Card expired');

      expect(mockPrisma.unscoped.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({
            dunningStep: 3,
            status: 'past_due',
          }),
        }),
      );
    });

    it('advances from Step 3 to Step 4 (Starts 3-day grace period)', async () => {
      mockPrisma.unscoped.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        subscription: { ...mockInvoice.subscription, dunningStep: 3, status: 'past_due' },
      });

      await service.handlePaymentFailure('inv-1', 'Gateway error');

      expect(mockPrisma.unscoped.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({
            dunningStep: 4,
          }),
        }),
      );
      expect(mockPlatformAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'billing.dunning_grace_period_started',
        }),
      );
    });

    it('applies read-only suspension on grace period expiry (never data deletion)', async () => {
      mockPrisma.unscoped.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        subscription: { ...mockInvoice.subscription, dunningStep: 4, status: 'past_due' },
      });

      await service.handlePaymentFailure('inv-1', 'Final decline');

      expect(mockPrisma.unscoped.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-1' },
          data: expect.objectContaining({
            status: 'suspended',
            suspensionMode: 'read_only',
          }),
        }),
      );
      expect(mockPlatformAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'billing.tenant_read_only_suspended',
        }),
      );
    });
  });

  describe('handlePaymentSuccess (Recovery)', () => {
    it('resets dunning and lifts billing-related suspension', async () => {
      await service.handlePaymentSuccess('sub-1');

      expect(mockPrisma.unscoped.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: {
          status: 'active',
          dunningStep: 0,
          lastDunningAt: null,
        },
      });

      expect(mockPrisma.unscoped.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: {
          status: 'active',
          suspensionMode: null,
          suspensionReason: null,
          suspendedAt: null,
        },
      });

      expect(mockPlatformAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'billing.dunning_resolved',
        }),
      );
    });
  });
});
