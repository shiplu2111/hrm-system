import {
  BadRequestException,
  Injectable,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import type { ContractorPaymentBatch } from '@prisma/client';
import type { ContractorPaymentBatchRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ContractorAccountingService } from '../accounting/contractor-accounting.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type { CreateContractorPaymentBatchDto } from './dto/contractors.dto';
import { generateContractorPaymentBatchReference } from './contractor.utils';
import { formatMoney } from '../payroll/payroll.utils';

@Injectable()
export class ContractorPaymentBatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    @Inject(forwardRef(() => ContractorAccountingService))
    private readonly contractorAccounting: ContractorAccountingService,
  ) {}

  async list(companyId: string): Promise<ContractorPaymentBatchRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.contractorPaymentBatch.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return rows.map((row) => this.toRecord(row));
  }

  async createFromApprovedInvoices(
    companyId: string,
    dto: CreateContractorPaymentBatchDto,
    user: AuthenticatedUser,
  ): Promise<ContractorPaymentBatchRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    const invoices = await this.prisma.unscoped.contractorInvoice.findMany({
      where: {
        companyId,
        status: 'approved',
        ...(dto.invoiceIds?.length ? { id: { in: dto.invoiceIds } } : {}),
        paymentBatchItem: null,
      },
    });

    if (invoices.length === 0) {
      throw new BadRequestException('No approved invoices available for payment batch');
    }

    const totalAmount = invoices.reduce(
      (sum, invoice) => sum.plus(invoice.amount),
      new Decimal(0),
    );
    const currency = invoices[0]?.currency ?? 'AUD';
    const year = new Date().getUTCFullYear();
    const count = await this.prisma.unscoped.contractorPaymentBatch.count({
      where: {
        companyId,
        createdAt: {
          gte: new Date(Date.UTC(year, 0, 1)),
          lt: new Date(Date.UTC(year + 1, 0, 1)),
        },
      },
    });

    const batch = await this.prisma.unscoped.$transaction(async (tx) => {
      const created = await tx.contractorPaymentBatch.create({
        data: {
          tenantId: company.tenantId,
          companyId,
          referenceNumber: generateContractorPaymentBatchReference(count, year),
          status: 'pending',
          totalAmount,
          currency,
          itemCount: invoices.length,
          submittedAt: new Date(),
          createdByUserId: user.id,
        },
      });

      await tx.contractorPaymentBatchItem.createMany({
        data: invoices.map((invoice) => ({
          tenantId: company.tenantId,
          paymentBatchId: created.id,
          contractorInvoiceId: invoice.id,
          contractorId: invoice.contractorId,
          amount: invoice.amount,
          status: 'pending' as const,
        })),
      });

      await tx.contractorInvoice.updateMany({
        where: { id: { in: invoices.map((i) => i.id) } },
        data: { status: 'scheduled' },
      });

      return created;
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'contractors',
      recordId: batch.id,
      newValue: {
        referenceNumber: batch.referenceNumber,
        itemCount: batch.itemCount,
        totalAmount: formatMoney(batch.totalAmount),
      },
    });

    return this.toRecord(batch);
  }

  async markPaid(batchId: string, user: AuthenticatedUser): Promise<ContractorPaymentBatchRecord> {
    const batch = await this.prisma.unscoped.contractorPaymentBatch.findUnique({
      where: { id: batchId },
      include: { items: true },
    });
    if (!batch) {
      throw new BadRequestException('Payment batch not found');
    }
    await this.companyScope.assertCompanyInTenant(batch.companyId);

    if (batch.status !== 'pending') {
      throw new BadRequestException('Only pending batches can be marked paid');
    }

    const paidAt = new Date();
    const updated = await this.prisma.unscoped.$transaction(async (tx) => {
      const row = await tx.contractorPaymentBatch.update({
        where: { id: batchId },
        data: { status: 'paid', paidAt },
      });

      await tx.contractorPaymentBatchItem.updateMany({
        where: { paymentBatchId: batchId },
        data: { status: 'paid' },
      });

      await tx.contractorInvoice.updateMany({
        where: { id: { in: batch.items.map((item) => item.contractorInvoiceId) } },
        data: { status: 'paid', paidAt },
      });

      return row;
    });

    await this.auditService.log({
      tenantId: batch.tenantId,
      userId: user.id,
      action: 'finalize',
      module: 'contractors',
      recordId: batch.id,
      newValue: { status: 'paid', paidAt: paidAt.toISOString() },
    });

    await this.contractorAccounting.exportJournalForBatch(batchId, user).catch(() => {
      /* GL export failure is recorded on contractor_journal_exports; payment still completes */
    });

    const exportRow = await this.prisma.unscoped.contractorJournalExport.findUnique({
      where: { contractorPaymentBatchId: batchId },
      select: { id: true },
    });

    return this.toRecord(updated, exportRow?.id ?? null);
  }

  private toRecord(
    row: ContractorPaymentBatch,
    journalExportId: string | null = null,
  ): ContractorPaymentBatchRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      referenceNumber: row.referenceNumber,
      status: row.status,
      totalAmount: formatMoney(row.totalAmount),
      currency: row.currency,
      itemCount: row.itemCount,
      transactionReference: row.transactionReference,
      paidAt: row.paidAt?.toISOString() ?? null,
      journalExportId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
