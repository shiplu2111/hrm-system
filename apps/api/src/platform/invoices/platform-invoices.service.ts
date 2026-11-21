import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreditNoteView,
  InvoiceLineView,
  PaymentRecordView,
  PlatformInvoiceDetailView,
  PlatformInvoiceListItem,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../settings/mail.service';
import { SmtpSettingsService } from '../../settings/smtp-settings.service';
import { StorageService } from '../../storage/storage.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import {
  IssueCreditNoteDto,
  MarkInvoicePaidDto,
  QueryPlatformInvoicesDto,
  ResendInvoiceEmailDto,
} from './dto/platform-invoices.dto';
import { renderInvoicePdf } from './invoice-pdf.generator';

@Injectable()
export class PlatformInvoicesService {
  private readonly logger = new Logger(PlatformInvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: PlatformAuditService,
    private readonly smtpSettingsService: SmtpSettingsService,
    private readonly mailService: MailService,
  ) {}

  /**
   * List all platform invoices with comprehensive filters:
   * tenant, status, date range, amount range, and search.
   */
  async listInvoices(
    query: QueryPlatformInvoicesDto,
  ): Promise<PlatformInvoiceListItem[]> {
    const where: Prisma.InvoiceWhereInput = {};

    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    if (query.status) {
      where.status = query.status as any;
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { invoiceNumber: { contains: term, mode: 'insensitive' } },
        { tenant: { name: { contains: term, mode: 'insensitive' } } },
        { tenant: { subdomain: { contains: term, mode: 'insensitive' } } },
      ];
    }

    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) {
        where.createdAt.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        where.createdAt.lte = new Date(query.toDate);
      }
    }

    if (query.minAmount !== undefined || query.maxAmount !== undefined) {
      where.total = {};
      if (query.minAmount !== undefined) {
        where.total.gte = new Prisma.Decimal(query.minAmount);
      }
      if (query.maxAmount !== undefined) {
        where.total.lte = new Prisma.Decimal(query.maxAmount);
      }
    }

    const invoices = await this.prisma.unscoped.invoice.findMany({
      where,
      include: {
        tenant: {
          select: { id: true, name: true, subdomain: true },
        },
        subscription: {
          include: {
            plan: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ? Math.min(query.limit, 100) : 50,
      skip: query.page && query.limit ? (query.page - 1) * query.limit : 0,
    });

    return invoices.map((inv) => this.mapToListItem(inv));
  }

  /**
   * Get single invoice detail with lines, linked payments, and credit notes.
   */
  async getInvoiceDetail(id: string): Promise<PlatformInvoiceDetailView> {
    const inv = await this.prisma.unscoped.invoice.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, name: true, subdomain: true } },
        subscription: {
          include: {
            plan: { select: { id: true, name: true, code: true } },
          },
        },
        lines: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' } },
        creditNotes: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!inv) {
      throw new NotFoundException(`Invoice with ID '${id}' not found`);
    }

    let pdfUrl: string | null = null;
    if (inv.pdfKey) {
      try {
        pdfUrl = await this.storageService.getUrl(inv.pdfKey);
      } catch (e) {
        this.logger.warn(`Failed to resolve storage URL for key ${inv.pdfKey}: ${e}`);
      }
    }

    return this.mapToDetailView(inv, pdfUrl);
  }

  /**
   * Generate or retrieve invoice PDF stored via the FileStorage driver.
   */
  async getOrGeneratePdf(
    id: string,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const inv = await this.prisma.unscoped.invoice.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, name: true, subdomain: true } },
        lines: { orderBy: { createdAt: 'asc' } },
        creditNotes: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!inv) {
      throw new NotFoundException(`Invoice with ID '${id}' not found`);
    }

    const pdfKey =
      inv.pdfKey ??
      this.storageService.buildInvoicePdfKey(
        inv.tenantId,
        inv.id,
        `${inv.invoiceNumber}.pdf`,
      );

    let pdfBuffer: Buffer;

    const exists = await this.storageService.exists(pdfKey).catch(() => false);
    if (exists) {
      const readResult = await this.storageService.read(pdfKey);
      pdfBuffer = readResult.buffer;
    } else {
      pdfBuffer = await renderInvoicePdf({
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        currency: inv.currency,
        billingReason: inv.billingReason,
        issueDate: inv.createdAt.toLocaleDateString(),
        dueDate: inv.dueDate.toLocaleDateString(),
        paidAt: inv.paidAt ? inv.paidAt.toLocaleDateString() : null,
        paymentMethod: inv.paymentMethod,
        tenantName: inv.tenant.name,
        tenantSubdomain: inv.tenant.subdomain,
        tenantId: inv.tenantId,
        subtotal: Number(inv.subtotal),
        tax: Number(inv.tax),
        total: Number(inv.total),
        amountPaid: Number(inv.amountPaid),
        amountDue: Number(inv.amountDue),
        lines: inv.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitAmount: Number(l.unitAmount),
          amount: Number(l.amount),
        })),
        creditNotes: inv.creditNotes.map((cn) => ({
          creditNoteNumber: cn.creditNoteNumber,
          amount: Number(cn.amount),
        })),
      });

      await this.storageService.upload(
        pdfKey,
        pdfBuffer,
        {
          contentType: 'application/pdf',
          originalName: `${inv.invoiceNumber}.pdf`,
          size: pdfBuffer.length,
        },
        inv.tenantId,
      );

      await this.prisma.unscoped.invoice.update({
        where: { id },
        data: { pdfKey },
      });
    }

    return {
      buffer: pdfBuffer,
      filename: `${inv.invoiceNumber}.pdf`,
      mimeType: 'application/pdf',
    };
  }

  /**
   * Resend invoice email with attached PDF.
   */
  async resendInvoiceEmail(
    id: string,
    dto: ResendInvoiceEmailDto,
    actor: { id?: string; email: string; roleName: string },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; recipient: string; sent: boolean }> {
    const inv = await this.prisma.unscoped.invoice.findUnique({
      where: { id },
      include: {
        tenant: true,
      },
    });

    if (!inv) {
      throw new NotFoundException(`Invoice with ID '${id}' not found`);
    }

    // Determine recipient
    const recipient: string =
      dto.recipientEmail?.trim() ||
      (await this.prisma.unscoped.user.findFirst({
        where: {
          tenantId: inv.tenantId,
          isActive: true,
          role: {
            name: { in: ['Admin', 'Company Owner', 'admin', 'company_owner'] },
          },
        },
      }))?.email ||
      (inv.tenant as any).demoLeadEmail ||
      'billing@cmsnbd.com';

    // Ensure PDF exists
    const pdfData = await this.getOrGeneratePdf(id);

    const emailSubject = `[CMSN-HR] Invoice ${inv.invoiceNumber} for ${inv.tenant.name}`;
    const emailBody = `Dear ${inv.tenant.name} Team,

Please find attached your invoice ${inv.invoiceNumber} for ${inv.currency} ${Number(inv.total).toFixed(2)}.

Status: ${inv.status.toUpperCase()}
Due Date: ${inv.dueDate.toLocaleDateString()}
Amount Due: ${inv.currency} ${Number(inv.amountDue).toFixed(2)}

You can review your billing details and download receipts anytime in the CMSN-HR Portal under Settings > Billing.

Thank you for choosing CMSN-HR Platform.
Global Infrastructure Operations`;

    let sent = false;
    const smtpSettings = await this.smtpSettingsService.resolveDecryptedSettings(
      inv.tenantId,
    );

    if (smtpSettings) {
      try {
        await this.mailService.sendMail({
          settings: smtpSettings,
          to: recipient,
          subject: emailSubject,
          text: emailBody,
          html: `<div style="font-family:sans-serif;line-height:1.6;color:#1e293b;">
            <h2>Invoice ${inv.invoiceNumber}</h2>
            <p>${emailBody.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>
          </div>`,
          attachments: [
            {
              filename: pdfData.filename,
              content: pdfData.buffer,
              contentType: 'application/pdf',
            },
          ],
        });
        sent = true;
      } catch (e: any) {
        this.logger.warn(`Failed to dispatch invoice email via SMTP: ${e.message}`);
      }
    } else {
      this.logger.log(
        `SMTP not configured for tenant ${inv.tenantId}; email logged for recipient ${recipient}`,
      );
    }

    // Audit log
    await this.auditService.log({
      userId: actor.id,
      action: 'invoice_resend_email',
      module: 'billing',
      recordId: id,
      reason: `Resent invoice email to ${recipient}`,
      oldValue: null,
      newValue: {
        invoiceNumber: inv.invoiceNumber,
        recipient,
        sent,
        actorEmail: actor.email,
        actorRole: actor.roleName,
      },
      ipAddress,
      userAgent,
    });

    return { success: true, recipient, sent };
  }

  /**
   * Mark an invoice as paid manually with mandatory reason and audit logging.
   */
  async markAsPaidManually(
    id: string,
    dto: MarkInvoicePaidDto,
    actor: { id?: string; email: string; roleName: string },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformInvoiceDetailView> {
    if (!dto.reason || dto.reason.trim() === '') {
      throw new BadRequestException('A mandatory justification reason is required to mark an invoice as paid manually');
    }

    const inv = await this.prisma.unscoped.invoice.findUnique({
      where: { id },
      include: {
        tenant: true,
        subscription: true,
      },
    });

    if (!inv) {
      throw new NotFoundException(`Invoice with ID '${id}' not found`);
    }

    if (inv.status === 'paid' && Number(inv.amountDue) === 0) {
      throw new BadRequestException('This invoice is already fully paid');
    }

    const previousStatus = inv.status;
    const paidAmount = Number(inv.amountDue) > 0 ? inv.amountDue : inv.total;

    // 1. Update invoice
    const updated = await this.prisma.unscoped.invoice.update({
      where: { id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        amountPaid: inv.total,
        amountDue: new Prisma.Decimal(0.0),
        paidReason: dto.reason.trim(),
        paymentMethod: dto.paymentMethod ?? 'manual_bank_transfer',
      },
    });

    // 2. Create payment record
    await this.prisma.unscoped.payment.create({
      data: {
        tenantId: inv.tenantId,
        invoiceId: inv.id,
        subscriptionId: inv.subscriptionId,
        provider: 'manual',
        providerPaymentId: dto.reference ?? `manual-${Date.now()}`,
        amount: paidAmount,
        currency: inv.currency,
        status: 'succeeded',
        paidAt: new Date(),
      },
    });

    // 3. Reactivate subscription if it was past_due
    if (inv.subscriptionId && inv.subscription?.status === 'past_due') {
      await this.prisma.unscoped.subscription.update({
        where: { id: inv.subscriptionId },
        data: { status: 'active' },
      });
    }

    // 4. Invalidate old cached PDF so it re-renders with paid stamp
    if (inv.pdfKey) {
      await this.storageService.delete(inv.pdfKey).catch(() => {});
      await this.prisma.unscoped.invoice.update({
        where: { id },
        data: { pdfKey: null },
      });
    }

    // 5. Audit log
    await this.auditService.log({
      userId: actor.id,
      action: 'invoice_marked_paid_manual',
      module: 'billing',
      recordId: id,
      reason: dto.reason.trim(),
      oldValue: {
        status: previousStatus,
        amountDue: Number(inv.amountDue),
      },
      newValue: {
        status: 'paid',
        amountDue: 0.0,
        paidReason: dto.reason.trim(),
        paymentMethod: dto.paymentMethod ?? 'manual_bank_transfer',
        actorEmail: actor.email,
        actorRole: actor.roleName,
      },
      ipAddress,
      userAgent,
    });

    return this.getInvoiceDetail(id);
  }

  /**
   * Issue a credit note against an invoice with balance adjustment and audit logging.
   */
  async issueCreditNote(
    id: string,
    dto: IssueCreditNoteDto,
    actor: { id?: string; email: string; roleName: string },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformInvoiceDetailView> {
    if (!dto.reason || dto.reason.trim() === '') {
      throw new BadRequestException('A mandatory justification reason is required to issue a credit note');
    }

    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Credit note amount must be greater than zero');
    }

    const inv = await this.prisma.unscoped.invoice.findUnique({
      where: { id },
      include: {
        creditNotes: true,
        tenant: true,
        subscription: true,
      },
    });

    if (!inv) {
      throw new NotFoundException(`Invoice with ID '${id}' not found`);
    }

    const totalInvoiceAmount = Number(inv.total);
    const existingCreditsTotal = inv.creditNotes.reduce(
      (sum, cn) => sum + Number(cn.amount),
      0,
    );

    if (existingCreditsTotal + dto.amount > totalInvoiceAmount) {
      throw new BadRequestException(
        `Total credit notes (${(existingCreditsTotal + dto.amount).toFixed(
          2,
        )}) cannot exceed invoice total (${totalInvoiceAmount.toFixed(2)})`,
      );
    }

    const creditNoteNumber = `CN-${inv.invoiceNumber}-${inv.creditNotes.length + 1}`;
    const creditAmount = new Prisma.Decimal(dto.amount);

    // 1. Create CreditNote record
    await this.prisma.unscoped.creditNote.create({
      data: {
        tenantId: inv.tenantId,
        invoiceId: inv.id,
        creditNoteNumber,
        amount: creditAmount,
        currency: inv.currency,
        reason: dto.reason.trim(),
        status: 'issued',
        issuedBy: actor.email,
      },
    });

    // 2. Adjust invoice balance
    const currentDue = Number(inv.amountDue);
    if (currentDue > 0) {
      const newDue = Math.max(0, currentDue - dto.amount);
      await this.prisma.unscoped.invoice.update({
        where: { id },
        data: {
          amountDue: new Prisma.Decimal(newDue),
          status: newDue === 0 ? 'paid' : inv.status,
          paidAt: newDue === 0 && !inv.paidAt ? new Date() : inv.paidAt,
        },
      });
    } else if (inv.subscriptionId) {
      // If invoice was already paid, credit note adds to the subscription's credit balance
      await this.prisma.unscoped.subscription.update({
        where: { id: inv.subscriptionId },
        data: {
          creditBalance: {
            increment: creditAmount,
          },
        },
      });
    }

    // 3. Invalidate cached PDF so credit note appears on future downloads
    if (inv.pdfKey) {
      await this.storageService.delete(inv.pdfKey).catch(() => {});
      await this.prisma.unscoped.invoice.update({
        where: { id },
        data: { pdfKey: null },
      });
    }

    // 4. Audit log
    await this.auditService.log({
      userId: actor.id,
      action: 'invoice_credit_note_issued',
      module: 'billing',
      recordId: id,
      reason: dto.reason.trim(),
      oldValue: {
        existingCredits: existingCreditsTotal,
        amountDue: currentDue,
      },
      newValue: {
        creditNoteNumber,
        creditAmount: dto.amount,
        actorEmail: actor.email,
        actorRole: actor.roleName,
      },
      ipAddress,
      userAgent,
    });

    return this.getInvoiceDetail(id);
  }

  // --- Helper mappers ---

  private mapToListItem(inv: any): PlatformInvoiceListItem {
    return {
      id: inv.id,
      tenantId: inv.tenantId,
      tenantName: inv.tenant?.name ?? 'Unknown',
      tenantSubdomain: inv.tenant?.subdomain ?? 'unknown',
      subscriptionId: inv.subscriptionId,
      invoiceNumber: inv.invoiceNumber,
      currency: inv.currency,
      subtotal: Number(inv.subtotal),
      tax: Number(inv.tax),
      total: Number(inv.total),
      amountPaid: Number(inv.amountPaid),
      amountDue: Number(inv.amountDue),
      status: inv.status,
      billingReason: inv.billingReason,
      periodStart: inv.periodStart.toISOString(),
      periodEnd: inv.periodEnd.toISOString(),
      dueDate: inv.dueDate.toISOString(),
      paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
      pdfKey: inv.pdfKey ?? null,
      paidReason: inv.paidReason ?? null,
      paymentMethod: inv.paymentMethod ?? null,
      createdAt: inv.createdAt.toISOString(),
    };
  }

  private mapToDetailView(inv: any, pdfUrl: string | null): PlatformInvoiceDetailView {
    const base = this.mapToListItem(inv);
    return {
      ...base,
      pdfUrl,
      lines: (inv.lines ?? []).map((l: any): InvoiceLineView => ({
        id: l.id,
        tenantId: l.tenantId,
        invoiceId: l.invoiceId,
        description: l.description,
        quantity: l.quantity,
        unitAmount: Number(l.unitAmount),
        amount: Number(l.amount),
        createdAt: l.createdAt.toISOString(),
      })),
      payments: (inv.payments ?? []).map((p: any): PaymentRecordView => ({
        id: p.id,
        tenantId: p.tenantId,
        invoiceId: p.invoiceId,
        subscriptionId: p.subscriptionId,
        provider: p.provider,
        providerPaymentId: p.providerPaymentId,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        errorCode: p.errorCode,
        errorMessage: p.errorMessage,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
      })),
      creditNotes: (inv.creditNotes ?? []).map((cn: any): CreditNoteView => ({
        id: cn.id,
        tenantId: cn.tenantId,
        invoiceId: cn.invoiceId,
        creditNoteNumber: cn.creditNoteNumber,
        amount: Number(cn.amount),
        currency: cn.currency,
        reason: cn.reason,
        status: cn.status,
        issuedBy: cn.issuedBy,
        issuedAt: cn.issuedAt.toISOString(),
        createdAt: cn.createdAt.toISOString(),
      })),
    };
  }
}
