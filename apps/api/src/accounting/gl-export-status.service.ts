import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import type {
  ContractorJournalPreview,
  GlContractorExpenseSummary,
  GlExportKind,
  GlExportStatusDetail,
  GlExportStatusList,
  GlExportStatusRecord,
  PayrollJournalPreview,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { formatDateOnly, formatMoney } from '../payroll/payroll.utils';
import { AccountingSyncQueueService } from './accounting-sync-queue.service';
import { contractorJournalToCsv } from './contractor-journal.builder';
import type { ListGlExportsQueryDto } from './dto/accounting.dto';
import {
  deriveExportOutcome,
  finalizeExportRows,
  journalReferenceForPeriodEnd,
  matchesOutcomeFilter,
  summarizeExportRows,
  type GlExportDraftRow,
} from './gl-export-status.rules';
import { journalToCsv } from './payroll-journal.builder';

/** Exports are monthly per period/batch, so this covers years of history per company. */
const HISTORY_LIMIT = 500;
const DEFAULT_PAGE_SIZE = 25;

type JournalSnapshot = {
  postingDate?: string;
  balanced?: boolean;
  lines?: PayrollJournalPreview['lines'];
  unmapped?: PayrollJournalPreview['unmapped'];
};

@Injectable()
export class GlExportStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly syncQueue: AccountingSyncQueueService,
  ) {}

  async list(companyId: string, query: ListGlExportsQueryDto): Promise<GlExportStatusList> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const queueAvailable = this.syncQueue.isAvailable();
    const [rows, contractorExpense] = await Promise.all([
      this.loadRows(companyId, queueAvailable),
      this.loadContractorExpenseSummaryBase(companyId),
    ]);
    const filtered = rows.filter(
      (row) =>
        (!query.kind || row.kind === query.kind) && matchesOutcomeFilter(row, query.outcome),
    );
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const page = query.page ?? 1;

    let totalExportedAmount = new Decimal(0);
    let succeededCount = 0;
    let failedCount = 0;
    for (const row of rows) {
      if (row.kind !== 'contractor' || row.superseded) continue;
      if (row.outcome === 'succeeded') {
        succeededCount += 1;
        if (row.totalDebit) totalExportedAmount = totalExportedAmount.plus(row.totalDebit);
      } else if (row.outcome === 'failed') {
        failedCount += 1;
      }
    }

    return {
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      summary: summarizeExportRows(rows, queueAvailable),
      contractorExpense: {
        ...contractorExpense,
        totalExportedAmount: formatMoney(totalExportedAmount),
        succeededCount,
        failedCount,
      },
      page,
      pageSize,
      total: filtered.length,
    };
  }

  async detail(
    companyId: string,
    kind: GlExportKind,
    exportId: string,
  ): Promise<GlExportStatusDetail> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const journalData =
      kind === 'payroll'
        ? (
            await this.prisma.unscoped.payrollJournalExport.findFirst({
              where: { id: exportId, companyId },
              select: { journalData: true, referenceNumber: true },
            })
          )
        : (
            await this.prisma.unscoped.contractorJournalExport.findFirst({
              where: { id: exportId, companyId },
              select: { journalData: true, referenceNumber: true },
            })
          );
    if (!journalData) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Export not found' });
    }

    const rows = await this.loadRows(companyId, this.syncQueue.isAvailable());
    const row = rows.find((item) => item.id === `${kind}:${exportId}`);
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Export not found' });
    }

    const journal = journalData.journalData as unknown as JournalSnapshot;
    let csvContent: string | null = null;
    if (row.canDownloadCsv) {
      csvContent =
        kind === 'payroll'
          ? journalToCsv(
              journalData.journalData as unknown as PayrollJournalPreview,
              journalData.referenceNumber,
            )
          : contractorJournalToCsv(
              journalData.journalData as unknown as ContractorJournalPreview,
            );
    }

    return {
      ...row,
      postingDate: journal.postingDate ?? null,
      balanced: journal.balanced ?? false,
      lines: journal.lines ?? [],
      unmapped: journal.unmapped ?? [],
      csvContent,
    };
  }

  async retrySync(
    companyId: string,
    syncJobId: string,
    user: AuthenticatedUser,
  ): Promise<GlExportStatusRecord | null> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const job = await this.prisma.unscoped.accountingSyncJob.findFirst({
      where: { id: syncJobId, companyId },
    });
    if (!job) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sync job not found' });
    }
    if (job.status !== 'failed') {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `This sync is ${job.status} — only failed syncs can be retried`,
      });
    }
    const newer = await this.prisma.unscoped.accountingSyncJob.findFirst({
      where: {
        companyId,
        payrollPeriodId: job.payrollPeriodId,
        provider: job.provider,
        createdAt: { gt: job.createdAt },
      },
      select: { id: true },
    });
    if (newer) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'A newer sync exists for this payroll period — retry that one instead',
      });
    }
    if (!this.syncQueue.isAvailable()) {
      throw new ServiceUnavailableException({
        code: 'QUEUE_UNAVAILABLE',
        message:
          'Background jobs are not running on the server, so the sync cannot be retried right now. Export the journal as CSV instead.',
      });
    }

    await this.syncQueue.retrySyncJob(job.id);

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'update',
      module: 'accounting',
      recordId: job.id,
      oldValue: { status: job.status, errorMessage: job.errorMessage, attempts: job.attempts },
      newValue: { status: 'queued', retriedManually: true },
    });

    const rows = await this.loadRows(companyId, true);
    return (
      rows.find(
        (row) => row.syncJobId === job.id || row.id === `sync:${job.id}`,
      ) ?? null
    );
  }

  private async loadRows(
    companyId: string,
    queueAvailable: boolean,
  ): Promise<GlExportStatusRecord[]> {
    const [payrollExports, contractorExports, syncJobs] = await Promise.all([
      this.prisma.unscoped.payrollJournalExport.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: HISTORY_LIMIT,
      }),
      this.prisma.unscoped.contractorJournalExport.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: HISTORY_LIMIT,
        include: { contractorPaymentBatch: { select: { referenceNumber: true } } },
      }),
      this.prisma.unscoped.accountingSyncJob.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: HISTORY_LIMIT,
      }),
    ]);

    const periodIds = [
      ...new Set([
        ...payrollExports.map((row) => row.payrollPeriodId),
        ...syncJobs.map((row) => row.payrollPeriodId),
      ]),
    ];
    const userIds = [
      ...new Set(
        [...payrollExports, ...contractorExports]
          .map((row) => row.exportedByUserId)
          .filter(Boolean) as string[],
      ),
    ];
    const [periods, users] = await Promise.all([
      periodIds.length
        ? this.prisma.unscoped.payrollPeriod.findMany({
            where: { id: { in: periodIds }, companyId },
            select: { id: true, startDate: true, endDate: true },
          })
        : [],
      userIds.length
        ? this.prisma.unscoped.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              email: true,
              employee: { select: { firstName: true, lastName: true } },
            },
          })
        : [],
    ]);

    const periodById = new Map(periods.map((period) => [period.id, period]));
    const periodLabel = (periodId: string) => {
      const period = periodById.get(periodId);
      return period
        ? `${formatDateOnly(period.startDate)} – ${formatDateOnly(period.endDate)}`
        : 'Unknown period';
    };
    const userName = new Map(
      users.map((user) => [
        user.id,
        user.employee
          ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
          : user.email,
      ]),
    );
    const exportIds = new Set(payrollExports.map((row) => row.id));
    const jobByExportId = new Map(
      syncJobs
        .filter((job) => job.payrollJournalExportId)
        .map((job) => [job.payrollJournalExportId!, job]),
    );

    const drafts: GlExportDraftRow[] = [];

    for (const row of payrollExports) {
      const job = jobByExportId.get(row.id) ?? null;
      const outcome = deriveExportOutcome({
        exportStatus: row.status,
        syncStatus: job?.status ?? null,
      });
      const journal = row.journalData as unknown as JournalSnapshot;
      drafts.push({
        id: `payroll:${row.id}`,
        kind: 'payroll',
        expenseCategory: 'payroll',
        destination: row.provider ?? 'csv',
        outcome,
        exportId: row.id,
        syncJobId: job?.id ?? null,
        referenceNumber: row.referenceNumber,
        subjectLabel: periodLabel(row.payrollPeriodId),
        payrollPeriodId: row.payrollPeriodId,
        contractorPaymentBatchId: null,
        totalDebit: row.totalDebit.toFixed(2),
        totalCredit: row.totalCredit.toFixed(2),
        lineCount: journal.lines?.length ?? 0,
        unmappedCount: row.unmappedCount,
        errorMessage:
          outcome === 'failed'
            ? (job?.status === 'failed' ? job.errorMessage : null) ?? row.errorMessage
            : null,
        externalReferenceId: row.externalReferenceId ?? job?.externalJournalId ?? null,
        exportedByName: row.exportedByUserId
          ? (userName.get(row.exportedByUserId) ?? null)
          : null,
        automatic: row.provider != null,
        syncAttempts: job?.attempts ?? null,
        startedAt: row.createdAt.toISOString(),
        finishedAt:
          outcome === 'in_progress'
            ? null
            : (job?.completedAt ?? job?.failedAt ?? row.exportedAt ?? row.updatedAt).toISOString(),
      });
    }

    for (const job of syncJobs) {
      if (job.payrollJournalExportId && exportIds.has(job.payrollJournalExportId)) continue;
      const period = periodById.get(job.payrollPeriodId);
      const outcome = deriveExportOutcome({ exportStatus: null, syncStatus: job.status });
      drafts.push({
        id: `sync:${job.id}`,
        kind: 'payroll',
        expenseCategory: 'payroll',
        destination: job.provider,
        outcome,
        exportId: null,
        syncJobId: job.id,
        referenceNumber: period ? journalReferenceForPeriodEnd(period.endDate) : '—',
        subjectLabel: periodLabel(job.payrollPeriodId),
        payrollPeriodId: job.payrollPeriodId,
        contractorPaymentBatchId: null,
        totalDebit: null,
        totalCredit: null,
        lineCount: 0,
        unmappedCount: 0,
        errorMessage: outcome === 'failed' ? job.errorMessage : null,
        externalReferenceId: job.externalJournalId,
        exportedByName: null,
        automatic: true,
        syncAttempts: job.attempts,
        startedAt: job.createdAt.toISOString(),
        finishedAt: (job.completedAt ?? job.failedAt)?.toISOString() ?? null,
      });
    }

    for (const row of contractorExports) {
      const outcome = deriveExportOutcome({ exportStatus: row.status, syncStatus: null });
      const journal = row.journalData as unknown as ContractorJournalPreview;
      drafts.push({
        id: `contractor:${row.id}`,
        kind: 'contractor',
        expenseCategory: 'contractor_expense',
        invoiceCount: journal.invoiceCount ?? null,
        destination: row.provider ?? 'csv',
        outcome,
        exportId: row.id,
        syncJobId: null,
        referenceNumber: row.referenceNumber,
        subjectLabel: `Contractor batch ${row.contractorPaymentBatch.referenceNumber}`,
        payrollPeriodId: null,
        contractorPaymentBatchId: row.contractorPaymentBatchId,
        totalDebit: row.totalDebit.toFixed(2),
        totalCredit: row.totalCredit.toFixed(2),
        lineCount: journal.lines?.length ?? 0,
        unmappedCount: row.unmappedCount,
        errorMessage: outcome === 'failed' ? row.errorMessage : null,
        externalReferenceId: row.externalReferenceId,
        exportedByName: row.exportedByUserId
          ? (userName.get(row.exportedByUserId) ?? null)
          : null,
        automatic: false,
        syncAttempts: null,
        startedAt: row.createdAt.toISOString(),
        finishedAt:
          outcome === 'in_progress' ? null : (row.exportedAt ?? row.updatedAt).toISOString(),
      });
    }

    return finalizeExportRows(drafts, queueAvailable);
  }

  private async loadContractorExpenseSummaryBase(
    companyId: string,
  ): Promise<
    Pick<
      GlContractorExpenseSummary,
      | 'categoryKey'
      | 'mappedExpenseAccount'
      | 'mappedPayableAccount'
      | 'unexportedPaidBatchCount'
      | 'unexportedPaidInvoiceCount'
      | 'unexportedPaidAmount'
    >
  > {
    const [mappings, unexportedBatches, unbatchedPaidInvoices] = await Promise.all([
      this.prisma.unscoped.glContractorMapping.findMany({
        where: { companyId },
        include: { glAccount: { select: { code: true, name: true } } },
      }),
      this.prisma.unscoped.contractorPaymentBatch.aggregate({
        where: {
          companyId,
          status: 'paid',
          journalExport: null,
        },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.unscoped.contractorInvoice.aggregate({
        where: {
          companyId,
          status: 'paid',
          paymentBatchItem: null,
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    const expenseMap = mappings.find((m) => m.systemKey === 'contractor_expense');
    const payableMap = mappings.find((m) => m.systemKey === 'contractor_payable');

    const unexportedTotal = new Decimal(unexportedBatches._sum.totalAmount ?? 0).plus(
      new Decimal(unbatchedPaidInvoices._sum.amount ?? 0),
    );

    return {
      categoryKey: 'contractor_expense',
      mappedExpenseAccount: expenseMap
        ? `${expenseMap.glAccount.code} · ${expenseMap.glAccount.name}`
        : null,
      mappedPayableAccount: payableMap
        ? `${payableMap.glAccount.code} · ${payableMap.glAccount.name}`
        : null,
      unexportedPaidBatchCount: unexportedBatches._count._all,
      unexportedPaidInvoiceCount: unbatchedPaidInvoices._count._all,
      unexportedPaidAmount: formatMoney(unexportedTotal),
    };
  }
}
