import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PayrollJournalExportStatus,
  Prisma,
  type GlContractorMapping,
  type GlAccount,
} from '@prisma/client';
import type {
  ContractorJournalExportRecord,
  ContractorJournalPreview,
  GlContractorMappingRecord,
  GlContractorSystemMappingKey,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { formatDateOnly, parseMoney } from '../payroll/payroll.utils';
import type { MappingLookup } from './accounting.constants';
import {
  buildContractorJournal,
  contractorJournalToCsv,
  toContractorJournalPreview,
} from './contractor-journal.builder';

export const GL_CONTRACTOR_SYSTEM_KEYS = {
  EXPENSE: 'contractor_expense' as GlContractorSystemMappingKey,
  PAYABLE: 'contractor_payable' as GlContractorSystemMappingKey,
};

type MappingWithAccount = GlContractorMapping & { glAccount: GlAccount };

@Injectable()
export class ContractorAccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async listContractorMappings(
    companyId: string,
  ): Promise<GlContractorMappingRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const mappings = await this.prisma.unscoped.glContractorMapping.findMany({
      where: { companyId },
      include: { glAccount: true },
    });

    const byKey = new Map(
      mappings.map((row) => [row.systemKey, row as MappingWithAccount]),
    );

    return Object.values(GL_CONTRACTOR_SYSTEM_KEYS).map((systemKey) => {
      const mapped = byKey.get(systemKey);
      if (mapped) {
        return this.toMappingRecord(mapped);
      }
      return this.virtualMapping(companyId, systemKey);
    });
  }

  async upsertContractorMappings(
    companyId: string,
    mappings: Array<{
      systemKey: GlContractorSystemMappingKey;
      postingSide: 'debit' | 'credit';
      glAccountId: string;
    }>,
    user: AuthenticatedUser,
  ): Promise<GlContractorMappingRecord[]> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    for (const mapping of mappings) {
      const glAccount = await this.prisma.unscoped.glAccount.findFirst({
        where: { id: mapping.glAccountId, companyId },
      });
      if (!glAccount) {
        throw new NotFoundException('GL account not found in this company');
      }
    }

    await this.prisma.unscoped.$transaction(async (tx) => {
      for (const mapping of mappings) {
        await tx.glContractorMapping.upsert({
          where: {
            companyId_systemKey: {
              companyId,
              systemKey: mapping.systemKey,
            },
          },
          create: {
            tenantId: company.tenantId,
            companyId,
            systemKey: mapping.systemKey,
            postingSide: mapping.postingSide,
            glAccountId: mapping.glAccountId,
          },
          update: {
            postingSide: mapping.postingSide,
            glAccountId: mapping.glAccountId,
          },
        });
      }
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'update',
      module: 'accounting',
      recordId: companyId,
      newValue: { contractorMappingsUpdated: mappings.length },
    });

    return this.listContractorMappings(companyId);
  }

  async previewJournalForBatch(
    batchId: string,
  ): Promise<ContractorJournalPreview> {
    const batch = await this.loadPaidBatchOrThrow(batchId);
    return this.buildPreview(batch);
  }

  async exportJournalForBatch(
    batchId: string,
    user?: AuthenticatedUser,
  ): Promise<ContractorJournalExportRecord> {
    const batch = await this.loadPaidBatchOrThrow(batchId);
    const journal = await this.buildPreview(batch);

    const hasErrors =
      journal.unmapped.length > 0 || !journal.balanced || journal.invoiceCount === 0;
    const errorMessage =
      journal.invoiceCount === 0
        ? 'No paid invoices found in this batch'
        : journal.unmapped.length > 0
          ? `${journal.unmapped.length} contractor payment line(s) are not mapped to GL accounts`
          : !journal.balanced
            ? 'Journal debits and credits do not balance'
            : null;

    const existing = await this.prisma.unscoped.contractorJournalExport.findUnique({
      where: { contractorPaymentBatchId: batchId },
    });

    const csvContent =
      journal.lines.length > 0 && !hasErrors
        ? contractorJournalToCsv(journal)
        : null;

    const row = existing
      ? await this.prisma.unscoped.contractorJournalExport.update({
          where: { id: existing.id },
          data: {
            referenceNumber: journal.referenceNumber,
            status: hasErrors
              ? PayrollJournalExportStatus.failed
              : PayrollJournalExportStatus.completed,
            journalData: journal as unknown as Prisma.InputJsonValue,
            totalDebit: parseMoney(journal.totalDebit),
            totalCredit: parseMoney(journal.totalCredit),
            unmappedCount: journal.unmapped.length,
            errorMessage,
            exportedByUserId: user?.id ?? existing.exportedByUserId,
            exportedAt: hasErrors ? null : new Date(),
          },
        })
      : await this.prisma.unscoped.contractorJournalExport.create({
          data: {
            tenantId: batch.tenantId,
            companyId: batch.companyId,
            contractorPaymentBatchId: batchId,
            referenceNumber: journal.referenceNumber,
            status: hasErrors
              ? PayrollJournalExportStatus.failed
              : PayrollJournalExportStatus.completed,
            journalData: journal as unknown as Prisma.InputJsonValue,
            totalDebit: parseMoney(journal.totalDebit),
            totalCredit: parseMoney(journal.totalCredit),
            unmappedCount: journal.unmapped.length,
            errorMessage,
            exportedByUserId: user?.id ?? null,
            exportedAt: hasErrors ? null : new Date(),
          },
        });

    if (user) {
      await this.auditService.log({
        tenantId: batch.tenantId,
        userId: user.id,
        action: hasErrors ? 'update' : 'finalize',
        module: 'accounting',
        recordId: row.id,
        newValue: {
          referenceNumber: journal.referenceNumber,
          status: row.status,
          contractorPaymentBatchId: batchId,
        },
      });
    }

    return this.toExportRecord(row, journal, csvContent);
  }

  async listContractorJournalExports(
    companyId: string,
  ): Promise<ContractorJournalExportRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const rows = await this.prisma.unscoped.contractorJournalExport.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return rows.map((row) => {
      const journal = row.journalData as unknown as ContractorJournalPreview;
      return this.toExportRecord(
        row,
        journal,
        row.status === PayrollJournalExportStatus.completed
          ? contractorJournalToCsv(journal)
          : null,
      );
    });
  }

  private async buildPreview(batch: Awaited<ReturnType<typeof this.loadPaidBatchOrThrow>>) {
    const lookup = await this.loadContractorMappingLookup(batch.companyId);
    const items = batch.items.map((item) => ({
      invoiceId: item.contractorInvoice.id,
      invoiceNumber: item.contractorInvoice.invoiceNumber,
      contractorName:
        item.contractorInvoice.contractor.displayName ??
        item.contractorInvoice.contractor.legalName,
      amount: item.amount.toFixed(2),
    }));

    const postingDate = formatDateOnly(batch.paidAt ?? new Date());
    const built = buildContractorJournal({
      items,
      lookup,
      batchReference: batch.referenceNumber,
      postingDate,
    });

    return toContractorJournalPreview({
      contractorPaymentBatchId: batch.id,
      batchReference: batch.referenceNumber,
      postingDate,
      referenceNumber: `CJE-${batch.referenceNumber}`,
      built,
    });
  }

  private async loadPaidBatchOrThrow(batchId: string) {
    const batch = await this.prisma.unscoped.contractorPaymentBatch.findUnique({
      where: { id: batchId },
      include: {
        items: {
          include: {
            contractorInvoice: {
              include: {
                contractor: {
                  select: { legalName: true, displayName: true },
                },
              },
            },
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Contractor payment batch not found');
    }
    await this.companyScope.assertCompanyInTenant(batch.companyId);

    if (batch.status !== 'paid') {
      throw new BadRequestException(
        'Contractor journal export requires a paid payment batch',
      );
    }

    return batch;
  }

  private async loadContractorMappingLookup(
    companyId: string,
  ): Promise<MappingLookup> {
    const mappings = await this.prisma.unscoped.glContractorMapping.findMany({
      where: { companyId },
      include: { glAccount: true },
    });

    const bySystemKey = new Map<
      string,
      { glAccountCode: string; glAccountName: string; postingSide: 'debit' | 'credit' }
    >();

    for (const row of mappings) {
      bySystemKey.set(row.systemKey, {
        glAccountCode: row.glAccount.code,
        glAccountName: row.glAccount.name,
        postingSide: row.postingSide as 'debit' | 'credit',
      });
    }

    return { byComponentId: new Map(), bySystemKey };
  }

  private virtualMapping(
    companyId: string,
    systemKey: GlContractorSystemMappingKey,
  ): GlContractorMappingRecord {
    return {
      id: `virtual-${systemKey}`,
      companyId,
      systemKey,
      postingSide: systemKey === GL_CONTRACTOR_SYSTEM_KEYS.EXPENSE ? 'debit' : 'credit',
      glAccountId: '',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
  }

  private toMappingRecord(row: MappingWithAccount): GlContractorMappingRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      systemKey: row.systemKey as GlContractorSystemMappingKey,
      postingSide: row.postingSide,
      glAccountId: row.glAccountId,
      glAccountCode: row.glAccount.code,
      glAccountName: row.glAccount.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toExportRecord(
    row: {
      id: string;
      companyId: string;
      contractorPaymentBatchId: string;
      referenceNumber: string;
      status: PayrollJournalExportStatus;
      unmappedCount: number;
      errorMessage: string | null;
      externalReferenceId?: string | null;
      exportedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      totalDebit: Prisma.Decimal;
      totalCredit: Prisma.Decimal;
    },
    journal: ContractorJournalPreview,
    csvContent: string | null,
  ): ContractorJournalExportRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      contractorPaymentBatchId: row.contractorPaymentBatchId,
      referenceNumber: row.referenceNumber,
      status: row.status,
      provider: null,
      journal,
      totalDebit: row.totalDebit.toFixed(2),
      totalCredit: row.totalCredit.toFixed(2),
      unmappedCount: row.unmappedCount,
      errorMessage: row.errorMessage,
      externalReferenceId: row.externalReferenceId ?? null,
      csvContent,
      exportedAt: row.exportedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
