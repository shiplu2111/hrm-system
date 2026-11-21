import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../settings/mail.service';
import { SmtpSettingsService } from '../../settings/smtp-settings.service';
import { StorageService } from '../../storage/storage.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PlatformInvoicesService } from './platform-invoices.service';

describe('PlatformInvoicesService', () => {
  let service: PlatformInvoicesService;

  const mockInvoice = {
    id: 'inv-1',
    tenantId: 'tenant-1',
    subscriptionId: 'sub-1',
    invoiceNumber: 'INV-2026-001',
    currency: 'USD',
    subtotal: new Prisma.Decimal(59.0),
    tax: new Prisma.Decimal(0.0),
    total: new Prisma.Decimal(59.0),
    amountPaid: new Prisma.Decimal(0.0),
    amountDue: new Prisma.Decimal(59.0),
    status: 'open',
    billingReason: 'subscription_cycle',
    periodStart: new Date('2026-11-01'),
    periodEnd: new Date('2026-12-01'),
    dueDate: new Date('2026-12-01'),
    paidAt: null,
    pdfKey: null,
    paidReason: null,
    paymentMethod: null,
    createdAt: new Date('2026-11-01'),
    tenant: {
      id: 'tenant-1',
      name: 'Acme Corp',
      subdomain: 'acme',
    },
    subscription: {
      id: 'sub-1',
      status: 'active',
      plan: {
        id: 'plan-starter',
        name: 'Starter',
        code: 'starter',
      },
    },
    lines: [
      {
        id: 'line-1',
        tenantId: 'tenant-1',
        invoiceId: 'inv-1',
        description: 'Starter Plan Base Fee',
        quantity: 1,
        unitAmount: new Prisma.Decimal(49.0),
        amount: new Prisma.Decimal(49.0),
        createdAt: new Date('2026-11-01'),
      },
      {
        id: 'line-2',
        tenantId: 'tenant-1',
        invoiceId: 'inv-1',
        description: 'Employee seats',
        quantity: 5,
        unitAmount: new Prisma.Decimal(2.0),
        amount: new Prisma.Decimal(10.0),
        createdAt: new Date('2026-11-01'),
      },
    ],
    payments: [],
    creditNotes: [],
  };

  const mockPrisma = {
    unscoped: {
      invoice: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        create: jest.fn(),
      },
      creditNote: {
        create: jest.fn(),
      },
      subscription: {
        update: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
    },
  };

  const mockStorage = {
    buildInvoicePdfKey: jest.fn().mockReturnValue('tenant-1/invoices/inv-1/INV-2026-001.pdf'),
    exists: jest.fn().mockResolvedValue(false),
    upload: jest.fn().mockResolvedValue('tenant-1/invoices/inv-1/INV-2026-001.pdf'),
    read: jest.fn().mockResolvedValue({ buffer: Buffer.from('%PDF-mock'), meta: {} }),
    getUrl: jest.fn().mockResolvedValue('http://storage.local/inv-1.pdf'),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const mockAudit = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockSmtp = {
    resolveDecryptedSettings: jest.fn().mockResolvedValue(null),
  };

  const mockMail = {
    sendMail: jest.fn().mockResolvedValue(undefined),
  };

  const mockActor = {
    id: 'staff-1',
    email: 'billing.admin@cmsnbd.com',
    roleName: 'Billing Admin',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformInvoicesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
        { provide: PlatformAuditService, useValue: mockAudit },
        { provide: SmtpSettingsService, useValue: mockSmtp },
        { provide: MailService, useValue: mockMail },
      ],
    }).compile();

    service = module.get<PlatformInvoicesService>(PlatformInvoicesService);
    jest.clearAllMocks();
  });

  describe('listInvoices', () => {
    it('returns formatted invoices list applying filters', async () => {
      mockPrisma.unscoped.invoice.findMany.mockResolvedValueOnce([mockInvoice]);

      const result = await service.listInvoices({
        status: 'open' as any,
        minAmount: 50,
        maxAmount: 100,
        search: 'acme',
      });

      expect(mockPrisma.unscoped.invoice.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].invoiceNumber).toBe('INV-2026-001');
      expect(result[0].tenantName).toBe('Acme Corp');
      expect(result[0].total).toBe(59);
    });
  });

  describe('getInvoiceDetail', () => {
    it('returns detail view including lines, payments, and credit notes', async () => {
      mockPrisma.unscoped.invoice.findUnique.mockResolvedValueOnce(mockInvoice);

      const result = await service.getInvoiceDetail('inv-1');
      expect(result.id).toBe('inv-1');
      expect(result.lines).toHaveLength(2);
      expect(result.lines[0].description).toBe('Starter Plan Base Fee');
      expect(result.amountDue).toBe(59);
    });

    it('throws NotFoundException if invoice is missing', async () => {
      mockPrisma.unscoped.invoice.findUnique.mockResolvedValueOnce(null);
      await expect(service.getInvoiceDetail('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getOrGeneratePdf', () => {
    it('generates PDF and stores via FileStorage driver if not yet cached', async () => {
      mockPrisma.unscoped.invoice.findUnique.mockResolvedValueOnce(mockInvoice);
      mockPrisma.unscoped.invoice.update.mockResolvedValueOnce({
        ...mockInvoice,
        pdfKey: 'tenant-1/invoices/inv-1/INV-2026-001.pdf',
      });

      const result = await service.getOrGeneratePdf('inv-1');

      expect(result.filename).toBe('INV-2026-001.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(mockStorage.upload).toHaveBeenCalled();
      expect(mockPrisma.unscoped.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: { pdfKey: 'tenant-1/invoices/inv-1/INV-2026-001.pdf' },
        }),
      );
    });
  });

  describe('markAsPaidManually', () => {
    it('throws BadRequest if reason is missing', async () => {
      await expect(
        service.markAsPaidManually('inv-1', { reason: '' }, mockActor),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks open invoice as paid, logs payment, and audit records event', async () => {
      mockPrisma.unscoped.invoice.findUnique
        .mockResolvedValueOnce(mockInvoice) // for initial fetch
        .mockResolvedValueOnce({
          ...mockInvoice,
          status: 'paid',
          amountPaid: new Prisma.Decimal(59.0),
          amountDue: new Prisma.Decimal(0.0),
          paidAt: new Date(),
        }); // for getInvoiceDetail after update

      mockPrisma.unscoped.invoice.update.mockResolvedValueOnce({
        ...mockInvoice,
        status: 'paid',
      });
      mockPrisma.unscoped.payment.create.mockResolvedValueOnce({ id: 'pmt-1' });

      const result = await service.markAsPaidManually(
        'inv-1',
        {
          reason: 'Manual wire transfer received per settlement advice',
          paymentMethod: 'bank_wire',
          reference: 'WIRE-998822',
        },
        mockActor,
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(mockPrisma.unscoped.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({
            status: 'paid',
            paidReason: 'Manual wire transfer received per settlement advice',
            paymentMethod: 'bank_wire',
          }),
        }),
      );
      expect(mockPrisma.unscoped.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provider: 'manual',
            status: 'succeeded',
            amount: mockInvoice.amountDue,
          }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'invoice_marked_paid_manual',
          module: 'billing',
          recordId: 'inv-1',
          reason: 'Manual wire transfer received per settlement advice',
        }),
      );
      expect(result.status).toBe('paid');
    });

    it('reactivates past_due subscription to active when invoice is marked paid', async () => {
      const pastDueInvoice = {
        ...mockInvoice,
        status: 'past_due',
        subscription: { id: 'sub-1', status: 'past_due' },
      };

      mockPrisma.unscoped.invoice.findUnique
        .mockResolvedValueOnce(pastDueInvoice)
        .mockResolvedValueOnce({ ...pastDueInvoice, status: 'paid', amountDue: new Prisma.Decimal(0) });

      mockPrisma.unscoped.invoice.update.mockResolvedValueOnce(pastDueInvoice);
      mockPrisma.unscoped.payment.create.mockResolvedValueOnce({});
      mockPrisma.unscoped.subscription.update.mockResolvedValueOnce({});

      await service.markAsPaidManually(
        'inv-1',
        { reason: 'Overdue invoice wire settled' },
        mockActor,
      );

      expect(mockPrisma.unscoped.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { status: 'active' },
      });
    });
  });

  describe('issueCreditNote', () => {
    it('throws BadRequest if reason is missing', async () => {
      await expect(
        service.issueCreditNote('inv-1', { amount: 20, reason: '' }, mockActor),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequest if credit amount exceeds total invoice amount', async () => {
      mockPrisma.unscoped.invoice.findUnique.mockResolvedValueOnce(mockInvoice);
      await expect(
        service.issueCreditNote(
          'inv-1',
          { amount: 100, reason: 'Too large credit' },
          mockActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('issues credit note, adjusts invoice balance, and audit logs', async () => {
      mockPrisma.unscoped.invoice.findUnique
        .mockResolvedValueOnce(mockInvoice)
        .mockResolvedValueOnce({
          ...mockInvoice,
          amountDue: new Prisma.Decimal(39.0),
          creditNotes: [
            {
              id: 'cn-1',
              tenantId: 'tenant-1',
              invoiceId: 'inv-1',
              creditNoteNumber: 'CN-INV-2026-001-1',
              amount: new Prisma.Decimal(20.0),
              currency: 'USD',
              reason: 'Goodwill compensation for downtime',
              status: 'issued',
              issuedBy: mockActor.email,
              issuedAt: new Date(),
              createdAt: new Date(),
            },
          ],
        });

      mockPrisma.unscoped.creditNote.create.mockResolvedValueOnce({ id: 'cn-1' });
      mockPrisma.unscoped.invoice.update.mockResolvedValueOnce({});

      const result = await service.issueCreditNote(
        'inv-1',
        { amount: 20, reason: 'Goodwill compensation for downtime' },
        mockActor,
      );

      expect(mockPrisma.unscoped.creditNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoiceId: 'inv-1',
            amount: new Prisma.Decimal(20),
            reason: 'Goodwill compensation for downtime',
          }),
        }),
      );

      expect(mockPrisma.unscoped.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({
            amountDue: new Prisma.Decimal(39),
          }),
        }),
      );

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'invoice_credit_note_issued',
          module: 'billing',
          recordId: 'inv-1',
          reason: 'Goodwill compensation for downtime',
        }),
      );

      expect(result.creditNotes).toHaveLength(1);
    });
  });

  describe('resendInvoiceEmail', () => {
    it('resends email and logs audit entry', async () => {
      mockPrisma.unscoped.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.unscoped.user.findFirst.mockResolvedValueOnce({
        email: 'owner@acme.test',
      });
      mockPrisma.unscoped.invoice.update.mockResolvedValue(mockInvoice);

      const result = await service.resendInvoiceEmail(
        'inv-1',
        {},
        mockActor,
      );

      expect(result.success).toBe(true);
      expect(result.recipient).toBe('owner@acme.test');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'invoice_resend_email',
          module: 'billing',
          recordId: 'inv-1',
        }),
      );
    });
  });
});
