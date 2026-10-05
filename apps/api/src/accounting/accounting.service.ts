import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountingProvider,
  GlMappingPostingSide,
  PayrollJournalExportStatus,
  PayrollRunStatus,
  Prisma,
  type GlAccount,
  type GlPayrollMapping,
} from '@prisma/client';
import type {
  AccountingSyncJobRecord,
  GlAccountRecord,
  GlPayrollMappingRecord,
  GlSystemMappingKey,
  PayrollJournalExportRecord,
  PayrollJournalPreview,
} from '@hrm/shared-types';
import { GL_SYSTEM_MAPPING_LABELS } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { PayrollCalculationService } from '../payroll/payroll-calculation.service';
import { formatDateOnly, parseMoney } from '../payroll/payroll.utils';
import {
  GL_SYSTEM_KEYS,
  type GlAccountRef,
  type MappingLookup,
} from './accounting.constants';
import type {
  BulkUpsertGlPayrollMappingsDto,
  CreateGlAccountDto,
  UpdateGlAccountDto,
} from './dto/accounting.dto';
import { journalReferenceForPeriodEnd } from './gl-export-status.rules';
import { findDuplicate } from './gl-mapping.rules';
import {
  buildJournalFromAggregates,
  collectAggregatesFromPreview,
  journalToCsv,
  mergeAggregates,
  toJournalPreview,
} from './payroll-journal.builder';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
  );
}

type MappingWithAccount = GlPayrollMapping & {
  glAccount: GlAccount;
  payComponent?: { id: string; name: string; type: string } | null;
};

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly payrollCalculation: PayrollCalculationService,
  ) {}

  async listGlAccounts(
    companyId: string,
    includeInactive = false,
  ): Promise<GlAccountRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const rows = await this.prisma.unscoped.glAccount.findMany({
      where: { companyId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ code: 'asc' }],
      include: {
        _count: {
          select: {
            payrollMappings: true,
            contractorMappings: true,
            costCentreMappings: true,
          },
        },
      },
    });
    return rows.map((row) => ({
      ...this.toGlAccountRecord(row),
      mappingCount:
        row._count.payrollMappings +
        row._count.contractorMappings +
        row._count.costCentreMappings,
    }));
  }

  async createGlAccount(
    companyId: string,
    dto: CreateGlAccountDto,
    user: AuthenticatedUser,
  ): Promise<GlAccountRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const code = dto.code.trim();
    let row: GlAccount;
    try {
      row = await this.prisma.unscoped.glAccount.create({
        data: {
          tenantId: company.tenantId,
          companyId,
          code,
          name: dto.name.trim(),
          accountType: dto.accountType,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw this.duplicateCodeError(code);
      throw error;
    }

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'accounting',
      recordId: row.id,
      newValue: this.toGlAccountRecord(row) as unknown as Record<string, unknown>,
    });

    return this.toGlAccountRecord(row);
  }

  async updateGlAccount(
    accountId: string,
    dto: UpdateGlAccountDto,
    user: AuthenticatedUser,
  ): Promise<GlAccountRecord> {
    const existing = await this.findGlAccountOrThrow(accountId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    if (dto.isActive === false && existing.isActive) {
      const inUse = await this.countAccountMappings(accountId);
      if (inUse > 0) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: `${existing.code} (${existing.name}) is used by ${inUse} mapping${inUse === 1 ? '' : 's'} — map those to another account before deactivating it`,
        });
      }
    }
    if (dto.accountType != null && dto.accountType !== 'expense') {
      const costCentreUses = await this.prisma.unscoped.glCostCentreMapping.count({
        where: { glAccountId: accountId },
      });
      if (costCentreUses > 0) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: `${existing.code} is used by cost-centre overrides, which must post to an expense account`,
        });
      }
    }

    let row: GlAccount;
    try {
      row = await this.prisma.unscoped.glAccount.update({
        where: { id: accountId },
        data: {
          ...(dto.code != null ? { code: dto.code.trim() } : {}),
          ...(dto.name != null ? { name: dto.name.trim() } : {}),
          ...(dto.accountType != null ? { accountType: dto.accountType } : {}),
          ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw this.duplicateCodeError(dto.code!.trim());
      throw error;
    }

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'accounting',
      recordId: accountId,
      oldValue: this.toGlAccountRecord(existing) as unknown as Record<string, unknown>,
      newValue: this.toGlAccountRecord(row) as unknown as Record<string, unknown>,
    });

    return this.toGlAccountRecord(row);
  }

  async listPayrollMappings(companyId: string): Promise<GlPayrollMappingRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const [components, mappings] = await Promise.all([
      this.prisma.unscoped.payComponent.findMany({
        where: { companyId },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.unscoped.glPayrollMapping.findMany({
        where: { companyId },
        include: {
          glAccount: true,
          payComponent: { select: { id: true, name: true, type: true } },
        },
      }),
    ]);

    const byComponentId = new Map(
      mappings
        .filter((row) => row.payComponentId)
        .map((row) => [row.payComponentId!, row as MappingWithAccount]),
    );
    const bySystemKey = new Map(
      mappings
        .filter((row) => row.systemKey)
        .map((row) => [row.systemKey!, row as MappingWithAccount]),
    );

    const records: GlPayrollMappingRecord[] = components.map((component) => {
      const mapped = byComponentId.get(component.id);
      if (mapped) {
        return this.toMappingRecord(mapped);
      }
      return this.virtualMapping(companyId, {
        payComponentId: component.id,
        payComponentName: component.name,
        payComponentType: component.type,
        postingSide: component.type === 'earning' ? 'debit' : 'credit',
      });
    });

    for (const systemKey of Object.values(GL_SYSTEM_KEYS)) {
      const mapped = bySystemKey.get(systemKey);
      if (mapped) {
        records.push(this.toMappingRecord(mapped));
        continue;
      }
      records.push(
        this.virtualMapping(companyId, {
          systemKey,
          postingSide:
            systemKey === GL_SYSTEM_KEYS.NET_PAY ||
            systemKey === GL_SYSTEM_KEYS.EMPLOYER_SUPER_LIABILITY
              ? 'credit'
              : 'debit',
        }),
      );
    }

    return records;
  }

  async upsertPayrollMappings(
    companyId: string,
    dto: BulkUpsertGlPayrollMappingsDto,
    user: AuthenticatedUser,
  ): Promise<GlPayrollMappingRecord[]> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const removals = dto.remove ?? [];
    const refs = [...dto.mappings, ...removals];

    for (const ref of refs) {
      if (!ref.payComponentId && !ref.systemKey) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Each mapping requires payComponentId or systemKey',
        });
      }
      if (ref.payComponentId && ref.systemKey) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Mapping cannot specify both payComponentId and systemKey',
        });
      }
    }

    const refKey = (ref: { payComponentId?: string; systemKey?: string }) =>
      ref.payComponentId
        ? `component:${ref.payComponentId.toLowerCase()}`
        : `system:${ref.systemKey}`;
    if (findDuplicate(refs, refKey)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Each pay component or system line can only appear once per save',
      });
    }

    const componentIds = [
      ...new Set(refs.map((ref) => ref.payComponentId).filter(Boolean) as string[]),
    ];
    const components = componentIds.length
      ? await this.prisma.unscoped.payComponent.findMany({
          where: { id: { in: componentIds }, companyId },
          select: { id: true, name: true },
        })
      : [];
    if (components.length !== componentIds.length) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Pay component not found in this company',
      });
    }

    const accountIds = [...new Set(dto.mappings.map((mapping) => mapping.glAccountId))];
    const accounts = accountIds.length
      ? await this.prisma.unscoped.glAccount.findMany({
          where: { id: { in: accountIds }, companyId },
        })
      : [];
    if (accounts.length !== accountIds.length) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'GL account not found in this company',
      });
    }
    const inactive = accounts.find((account) => !account.isActive);
    if (inactive) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `GL account ${inactive.code} (${inactive.name}) is inactive`,
      });
    }

    const existing = await this.prisma.unscoped.glPayrollMapping.findMany({
      where: { companyId },
      include: { glAccount: { select: { code: true } } },
    });
    const existingByRef = new Map(
      existing.map((row) => [
        refKey({
          payComponentId: row.payComponentId ?? undefined,
          systemKey: row.systemKey ?? undefined,
        }),
        row,
      ]),
    );
    const componentNames = new Map(components.map((row) => [row.id.toLowerCase(), row.name]));
    const accountCodes = new Map(accounts.map((row) => [row.id, row.code]));
    const sourceLabel = (ref: { payComponentId?: string; systemKey?: string }) =>
      ref.payComponentId
        ? (componentNames.get(ref.payComponentId.toLowerCase()) ?? ref.payComponentId)
        : GL_SYSTEM_MAPPING_LABELS[ref.systemKey as GlSystemMappingKey];

    const changes: Array<{ source: string; from: string | null; to: string | null }> = [];
    for (const mapping of dto.mappings) {
      const before = existingByRef.get(refKey(mapping));
      const to = accountCodes.get(mapping.glAccountId) ?? null;
      if (before?.glAccount.code !== to || before?.postingSide !== mapping.postingSide) {
        changes.push({ source: sourceLabel(mapping), from: before?.glAccount.code ?? null, to });
      }
    }
    for (const removal of removals) {
      const before = existingByRef.get(refKey(removal));
      if (before) {
        changes.push({ source: sourceLabel(removal), from: before.glAccount.code, to: null });
      }
    }

    await this.prisma.unscoped.$transaction(async (tx) => {
      for (const removal of removals) {
        await tx.glPayrollMapping.deleteMany({
          where: removal.payComponentId
            ? { companyId, payComponentId: removal.payComponentId }
            : { companyId, systemKey: removal.systemKey! },
        });
      }

      for (const mapping of dto.mappings) {
        if (mapping.payComponentId) {
          await tx.glPayrollMapping.upsert({
            where: {
              companyId_payComponentId: {
                companyId,
                payComponentId: mapping.payComponentId,
              },
            },
            create: {
              tenantId: company.tenantId,
              companyId,
              payComponentId: mapping.payComponentId,
              postingSide: mapping.postingSide as GlMappingPostingSide,
              glAccountId: mapping.glAccountId,
            },
            update: {
              postingSide: mapping.postingSide as GlMappingPostingSide,
              glAccountId: mapping.glAccountId,
            },
          });
          continue;
        }

        await tx.glPayrollMapping.upsert({
          where: {
            companyId_systemKey: {
              companyId,
              systemKey: mapping.systemKey!,
            },
          },
          create: {
            tenantId: company.tenantId,
            companyId,
            systemKey: mapping.systemKey!,
            postingSide: mapping.postingSide as GlMappingPostingSide,
            glAccountId: mapping.glAccountId,
          },
          update: {
            postingSide: mapping.postingSide as GlMappingPostingSide,
            glAccountId: mapping.glAccountId,
          },
        });
      }
    });

    if (changes.length > 0) {
      await this.auditService.log({
        tenantId: company.tenantId,
        userId: user.id,
        action: 'update',
        module: 'accounting',
        recordId: companyId,
        newValue: { payrollMappingChanges: changes },
      });
    }

    return this.listPayrollMappings(companyId);
  }

  async previewJournalForPeriod(
    companyId: string,
    periodId: string,
  ): Promise<PayrollJournalPreview> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const period = await this.findPeriodOrThrow(companyId, periodId);
    const lookup = await this.loadMappingLookup(companyId);
    const runs = await this.loadExportableRuns(periodId);
    const asOf = formatDateOnly(period.endDate);

    const aggregateBatches = [];
    for (const run of runs) {
      const preview = await this.payrollCalculation.preview(
        run.employeeId,
        asOf,
      );
      aggregateBatches.push(
        ...collectAggregatesFromPreview(preview, run.employee.costCentre ?? null),
      );
    }

    const aggregates = mergeAggregates(aggregateBatches);
    const periodLabel = `${formatDateOnly(period.startDate)} – ${formatDateOnly(period.endDate)}`;
    const referenceNumber = this.buildReferenceNumber(period.endDate);

    const built = buildJournalFromAggregates({
      aggregates,
      lookup,
      periodLabel,
    });

    return toJournalPreview({
      payrollPeriodId: periodId,
      periodLabel,
      postingDate: asOf,
      runCount: runs.length,
      referenceNumber,
      built,
    });
  }

  async exportJournalForPeriod(
    companyId: string,
    periodId: string,
    user?: AuthenticatedUser,
    provider?: AccountingProvider,
    triggeredByUserId?: string,
  ): Promise<PayrollJournalExportRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const journal = await this.previewJournalForPeriod(companyId, periodId);

    const hasErrors =
      journal.unmapped.length > 0 || !journal.balanced || journal.runCount === 0;
    const errorMessage =
      journal.runCount === 0
        ? 'No finalized or paid payroll runs found for this period'
        : journal.unmapped.length > 0
          ? `${journal.unmapped.length} payroll component(s) are not mapped to GL accounts`
          : !journal.balanced
            ? 'Journal debits and credits do not balance'
            : null;

    const csvContent =
      journal.lines.length > 0
        ? journalToCsv(journal, journal.referenceNumber)
        : null;

    const row = await this.prisma.unscoped.payrollJournalExport.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        payrollPeriodId: periodId,
        referenceNumber: journal.referenceNumber,
        status: hasErrors
          ? PayrollJournalExportStatus.failed
          : PayrollJournalExportStatus.completed,
        provider: provider ?? null,
        journalData: journal as unknown as Prisma.InputJsonValue,
        totalDebit: parseMoney(journal.totalDebit),
        totalCredit: parseMoney(journal.totalCredit),
        unmappedCount: journal.unmapped.length,
        errorMessage,
        exportedByUserId: user?.id ?? triggeredByUserId ?? null,
        exportedAt: hasErrors ? null : new Date(),
      },
    });

    if (user) {
      await this.auditService.log({
        tenantId: company.tenantId,
        userId: user.id,
        action: hasErrors ? 'update' : 'finalize',
        module: 'accounting',
        recordId: row.id,
        newValue: {
          referenceNumber: journal.referenceNumber,
          status: row.status,
          unmappedCount: journal.unmapped.length,
          provider: provider ?? null,
        },
      });
    }

    return this.toExportRecord(row, journal, csvContent);
  }

  async listAccountingSyncJobs(
    companyId: string,
    payrollPeriodId?: string,
  ): Promise<AccountingSyncJobRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const rows = await this.prisma.unscoped.accountingSyncJob.findMany({
      where: {
        companyId,
        ...(payrollPeriodId ? { payrollPeriodId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 30,
    });

    return rows.map((row) => ({
      id: row.id,
      companyId: row.companyId,
      payrollPeriodId: row.payrollPeriodId,
      provider: row.provider,
      status: row.status,
      attempts: row.attempts,
      errorMessage: row.errorMessage,
      externalJournalId: row.externalJournalId,
      payrollJournalExportId: row.payrollJournalExportId,
      queuedAt: row.queuedAt.toISOString(),
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      failedAt: row.failedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async listJournalExports(
    companyId: string,
    periodId?: string,
  ): Promise<PayrollJournalExportRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const rows = await this.prisma.unscoped.payrollJournalExport.findMany({
      where: {
        companyId,
        ...(periodId ? { payrollPeriodId: periodId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 20,
    });

    return rows.map((row) => {
      const journal = row.journalData as unknown as PayrollJournalPreview;
      return this.toExportRecord(
        row,
        journal,
        row.status === PayrollJournalExportStatus.completed
          ? journalToCsv(journal, row.referenceNumber)
          : null,
      );
    });
  }

  private virtualMapping(
    companyId: string,
    input: {
      payComponentId?: string;
      payComponentName?: string;
      payComponentType?: 'earning' | 'deduction';
      systemKey?: GlSystemMappingKey;
      postingSide: 'debit' | 'credit';
    },
  ): GlPayrollMappingRecord {
    const suffix = input.payComponentId ?? input.systemKey ?? 'unknown';
    return {
      id: `virtual-${suffix}`,
      companyId,
      payComponentId: input.payComponentId ?? null,
      payComponentName: input.payComponentName ?? null,
      payComponentType: input.payComponentType ?? null,
      systemKey: input.systemKey ?? null,
      postingSide: input.postingSide,
      glAccountId: '',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
  }

  private async loadExportableRuns(periodId: string) {
    return this.prisma.unscoped.payrollRun.findMany({
      where: {
        payrollPeriodId: periodId,
        deletedAt: null,
        status: { in: [PayrollRunStatus.finalized, PayrollRunStatus.paid] },
      },
      select: {
        id: true,
        employeeId: true,
        employee: {
          select: { costCentre: { select: { id: true, code: true, name: true } } },
        },
      },
    });
  }

  private async loadMappingLookup(companyId: string): Promise<MappingLookup> {
    const [mappings, costCentreMappings] = await Promise.all([
      this.prisma.unscoped.glPayrollMapping.findMany({
        where: { companyId },
        include: { glAccount: true },
      }),
      this.prisma.unscoped.glCostCentreMapping.findMany({
        where: { companyId },
        include: { glAccount: { select: { code: true, name: true } } },
      }),
    ]);

    const byCostCentre = new Map<string, Map<string, GlAccountRef>>();
    for (const row of costCentreMappings) {
      const overrides = byCostCentre.get(row.costCentreId) ?? new Map<string, GlAccountRef>();
      overrides.set(row.sourceKey, {
        glAccountCode: row.glAccount.code,
        glAccountName: row.glAccount.name,
      });
      byCostCentre.set(row.costCentreId, overrides);
    }

    const byComponentId = new Map<
      string,
      { glAccountCode: string; glAccountName: string; postingSide: 'debit' | 'credit' }
    >();
    const bySystemKey = new Map<
      string,
      { glAccountCode: string; glAccountName: string; postingSide: 'debit' | 'credit' }
    >();

    for (const row of mappings) {
      const resolved = {
        glAccountCode: row.glAccount.code,
        glAccountName: row.glAccount.name,
        postingSide: row.postingSide as 'debit' | 'credit',
      };
      if (row.payComponentId) {
        byComponentId.set(row.payComponentId, resolved);
      }
      if (row.systemKey) {
        bySystemKey.set(row.systemKey, resolved);
      }
    }

    return { byComponentId, bySystemKey, byCostCentre };
  }

  private buildReferenceNumber(endDate: Date): string {
    return journalReferenceForPeriodEnd(endDate);
  }

  private async countAccountMappings(accountId: string): Promise<number> {
    const [payroll, contractor, costCentre] = await Promise.all([
      this.prisma.unscoped.glPayrollMapping.count({ where: { glAccountId: accountId } }),
      this.prisma.unscoped.glContractorMapping.count({ where: { glAccountId: accountId } }),
      this.prisma.unscoped.glCostCentreMapping.count({ where: { glAccountId: accountId } }),
    ]);
    return payroll + contractor + costCentre;
  }

  private duplicateCodeError(code: string): ConflictException {
    return new ConflictException({
      code: 'CONFLICT',
      message: `GL account code ${code} already exists in this company`,
    });
  }

  private async findGlAccountOrThrow(accountId: string): Promise<GlAccount> {
    const row = await this.prisma.unscoped.glAccount.findUnique({
      where: { id: accountId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'GL account not found',
      });
    }
    return row;
  }

  private async findPeriodOrThrow(companyId: string, periodId: string) {
    const row = await this.prisma.unscoped.payrollPeriod.findFirst({
      where: { id: periodId, companyId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Payroll period not found',
      });
    }
    return row;
  }

  private toGlAccountRecord(row: GlAccount): GlAccountRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      code: row.code,
      name: row.name,
      accountType: row.accountType,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toMappingRecord(row: MappingWithAccount): GlPayrollMappingRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      payComponentId: row.payComponentId,
      payComponentName: row.payComponent?.name ?? null,
      payComponentType:
        (row.payComponent?.type as 'earning' | 'deduction' | undefined) ?? null,
      systemKey: row.systemKey as GlSystemMappingKey | null,
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
      payrollPeriodId: string;
      referenceNumber: string;
      status: PayrollJournalExportStatus;
      provider?: AccountingProvider | null;
      unmappedCount: number;
      errorMessage: string | null;
      externalReferenceId?: string | null;
      exportedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      totalDebit: Prisma.Decimal;
      totalCredit: Prisma.Decimal;
    },
    journal: PayrollJournalPreview,
    csvContent: string | null,
  ): PayrollJournalExportRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      payrollPeriodId: row.payrollPeriodId,
      referenceNumber: row.referenceNumber,
      status: row.status,
      provider: row.provider ?? null,
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
