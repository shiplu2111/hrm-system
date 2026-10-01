import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  AuditAction,
  EmploymentStatus,
  PayrollPeriodStatus,
  PayrollRunStatus,
  Prisma,
  type PayrollRun,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  PAYROLL_RUN_CONFIRMED_TARGETS,
  type GeneratePayrollRunsResult,
  type PayrollBulkFailure,
  type PayrollBulkResult,
  type PayrollCalculationPreview,
  type PayrollEmployeeRef,
  type PayrollRunBreakdown,
  type PayrollRunRecord,
  type PayrollRunStatus as SharedPayrollRunStatus,
  type PayrollRunTransitionResult,
} from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  BulkPayrollRunTransitionDto,
  CalculatePayrollRunsDto,
  CreatePayrollRunDto,
  GeneratePayrollRunsDto,
  ListPayrollRunsQueryDto,
  PayrollRunTransitionDto,
} from './dto/payroll-runs.dto';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayslipService } from './payslip.service';
import { PermissionsService } from '../rbac/permissions.service';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import { buildPayrollFinalizedVariables } from '../notifications/notification.helpers';
import { LoanPayrollService } from '../loans/loan-payroll.service';
import {
  assertPayrollRunTransition,
  auditActionForPayrollTransition,
  canRecalculatePayrollRun,
  derivePayrollPeriodStatus,
  forEachLimited,
  isPayrollRunLocked,
  requiredPermissionForPayrollTransition,
  sumRunAmounts,
} from './payroll-run.utils';
import { formatDateOnly, formatMoney, parseMoney } from './payroll.utils';
import { AccountingSyncQueueService } from '../accounting/accounting-sync-queue.service';
import { CurrencyPayrollService } from '../currency/currency-payroll.service';

type RunWithRelations = PayrollRun & {
  employee: {
    employeeNumber: string;
    firstName: string;
    lastName: string;
  };
  payrollPeriod: {
    id: string;
    companyId: string;
    endDate: Date;
  };
};

type Company = { tenantId: string };

/** Keeps period-wide calculation from flooding the connection pool. */
const BULK_CONCURRENCY = 4;

const PAYABLE_EMPLOYMENT: EmploymentStatus[] = [EmploymentStatus.active, EmploymentStatus.on_leave];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function isFinalizedWithErrors(error: unknown): boolean {
  if (!(error instanceof ConflictException)) return false;
  const response = error.getResponse();
  return typeof response === 'object' && (response as { code?: string }).code === 'FINALIZED_WITH_ERRORS';
}

@Injectable()
export class PayrollRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly payrollCalculationService: PayrollCalculationService,
    private readonly permissionsService: PermissionsService,
    private readonly payslipService: PayslipService,
    private readonly notificationEngine: NotificationEngineService,
    private readonly loanPayrollService: LoanPayrollService,
    @Inject(forwardRef(() => AccountingSyncQueueService))
    private readonly accountingSyncQueue: AccountingSyncQueueService,
    private readonly currencyPayroll: CurrencyPayrollService,
  ) {}

  async listForPeriod(
    companyId: string,
    periodId: string,
    query: ListPayrollRunsQueryDto,
  ): Promise<PayrollRunRecord[]> {
    await this.assertPeriod(companyId, periodId);
    const rows = await this.prisma.unscoped.payrollRun.findMany({
      where: {
        payrollPeriodId: periodId,
        deletedAt: null,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: this.runInclude(),
      orderBy: [{ employee: { employeeNumber: 'asc' } }],
    });
    return rows.map((row) => this.toRecord(row));
  }

  async get(companyId: string, runId: string): Promise<PayrollRunRecord> {
    const row = await this.findRunOrThrow(companyId, runId);
    return this.toRecord(row);
  }

  /** Earnings and deductions behind a run's totals. */
  async breakdown(companyId: string, runId: string): Promise<PayrollRunBreakdown> {
    const row = await this.findRunOrThrow(companyId, runId);
    const run = this.toRecord(row);
    if (row.calculationSnapshot) {
      return {
        run,
        source: 'snapshot',
        calculation: row.calculationSnapshot as unknown as PayrollCalculationPreview,
      };
    }
    try {
      const calculation = await this.payrollCalculationService.preview(
        row.employeeId,
        formatDateOnly(row.payrollPeriod.endDate),
      );
      return { run, source: 'live', calculation };
    } catch (error) {
      return { run, source: 'live', calculation: null, error: errorMessage(error) };
    }
  }

  async create(
    companyId: string,
    periodId: string,
    dto: CreatePayrollRunDto,
    user: AuthenticatedUser,
  ): Promise<PayrollRunRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    await this.assertPeriod(companyId, periodId);

    const employee = await this.prisma.scoped.employee.findFirst({
      where: { id: dto.employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found in this company',
      });
    }

    const existing = await this.prisma.unscoped.payrollRun.findFirst({
      where: {
        payrollPeriodId: periodId,
        employeeId: dto.employeeId,
        deletedAt: null,
        status: { not: PayrollRunStatus.cancelled },
      },
    });
    if (existing) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'An active payroll run already exists for this employee in the period',
      });
    }

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      const created = await tx.payrollRun.create({
        data: this.draftRunData(periodId, dto.employeeId),
        include: this.runInclude(),
      });
      await this.auditService.log(
        {
          tenantId: company.tenantId,
          userId: user.id,
          action: 'create',
          module: 'payroll',
          recordId: created.id,
          newValue: this.toRecord(created) as unknown as Record<string, unknown>,
        },
        tx,
      );
      return created;
    });

    await this.syncPeriodStatus(periodId, company, user);
    return this.toRecord(row);
  }

  /**
   * Creates draft runs for every payable employee with a salary structure in the period.
   * Employees already paid for overlapping dates in another period are skipped.
   */
  async generate(
    companyId: string,
    periodId: string,
    dto: GeneratePayrollRunsDto,
    user: AuthenticatedUser,
  ): Promise<GeneratePayrollRunsResult> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const period = await this.assertPeriod(companyId, periodId);

    const employees = await this.prisma.scoped.employee.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(dto.employeeIds
          ? { id: { in: dto.employeeIds } }
          : { employmentStatus: { in: PAYABLE_EMPLOYMENT } }),
      },
      select: { id: true, employeeNumber: true, firstName: true, lastName: true },
      orderBy: { employeeNumber: 'asc' },
    });
    if (dto.employeeIds && employees.length !== new Set(dto.employeeIds).size) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Some employees were not found in this company',
      });
    }
    const ref = (e: (typeof employees)[number]): PayrollEmployeeRef => ({
      employeeId: e.id,
      employeeNumber: e.employeeNumber,
      fullName: `${e.firstName} ${e.lastName}`.trim(),
    });
    const ids = employees.map((e) => e.id);

    const [structured, activeRuns] = await Promise.all([
      this.prisma.unscoped.salaryStructure.findMany({
        where: {
          employeeId: { in: ids },
          effectiveFrom: { lte: period.endDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }],
        },
        select: { employeeId: true },
        distinct: ['employeeId'],
      }),
      this.prisma.unscoped.payrollRun.findMany({
        where: {
          employeeId: { in: ids },
          deletedAt: null,
          status: { not: PayrollRunStatus.cancelled },
          payrollPeriod: {
            companyId,
            startDate: { lte: period.endDate },
            endDate: { gte: period.startDate },
          },
        },
        select: {
          employeeId: true,
          payrollPeriodId: true,
          payrollPeriod: { select: { startDate: true, endDate: true } },
        },
      }),
    ]);
    const withStructure = new Set(structured.map((s) => s.employeeId));
    const runByEmployee = new Map(activeRuns.map((r) => [r.employeeId, r]));

    const result: GeneratePayrollRunsResult = {
      created: [],
      alreadyIncluded: 0,
      withoutSalaryStructure: [],
      inOverlappingPeriod: [],
    };
    const toCreate: typeof employees = [];
    for (const employee of employees) {
      const run = runByEmployee.get(employee.id);
      if (run?.payrollPeriodId === periodId) {
        result.alreadyIncluded += 1;
      } else if (run) {
        result.inOverlappingPeriod.push({
          ...ref(employee),
          periodStartDate: formatDateOnly(run.payrollPeriod.startDate),
          periodEndDate: formatDateOnly(run.payrollPeriod.endDate),
        });
      } else if (!withStructure.has(employee.id)) {
        result.withoutSalaryStructure.push(ref(employee));
      } else {
        toCreate.push(employee);
      }
    }

    if (toCreate.length > 0) {
      const rows = await this.prisma.unscoped.$transaction(async (tx) => {
        const created: RunWithRelations[] = [];
        for (const employee of toCreate) {
          const row = await tx.payrollRun.create({
            data: this.draftRunData(periodId, employee.id),
            include: this.runInclude(),
          });
          await this.auditService.log(
            {
              tenantId: company.tenantId,
              userId: user.id,
              action: 'create',
              module: 'payroll',
              recordId: row.id,
              newValue: this.toRecord(row) as unknown as Record<string, unknown>,
            },
            tx,
          );
          created.push(row);
        }
        return created;
      });
      result.created = rows.map((row) => this.toRecord(row));
      await this.syncPeriodStatus(periodId, company, user);
    }

    return result;
  }

  async calculate(
    companyId: string,
    runId: string,
    user: AuthenticatedUser,
  ): Promise<PayrollRunRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.findRunOrThrow(companyId, runId);
    const row = await this.calculateRun(companyId, company, existing, user);
    await this.syncPeriodStatus(existing.payrollPeriodId, company, user);
    return this.toRecord(row);
  }

  /** Calculates every recalculable run of a period (or the given runs); failures don't stop the rest. */
  async calculateMany(
    companyId: string,
    periodId: string,
    dto: CalculatePayrollRunsDto,
    user: AuthenticatedUser,
  ): Promise<PayrollBulkResult> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    await this.assertPeriod(companyId, periodId);

    const runs = await this.prisma.unscoped.payrollRun.findMany({
      where: {
        payrollPeriodId: periodId,
        deletedAt: null,
        ...(dto.runIds
          ? { id: { in: dto.runIds } }
          : { status: { in: [PayrollRunStatus.draft, PayrollRunStatus.calculated, PayrollRunStatus.under_review] } }),
      },
      include: this.runInclude(),
      orderBy: [{ employee: { employeeNumber: 'asc' } }],
    });
    if (dto.runIds && runs.length !== new Set(dto.runIds).size) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Some payroll runs were not found in this period',
      });
    }

    const result: PayrollBulkResult = { succeeded: [], failed: [] };
    await forEachLimited(runs, BULK_CONCURRENCY, async (run) => {
      try {
        const row = await this.calculateRun(companyId, company, run, user);
        result.succeeded.push(this.toRecord(row));
      } catch (error) {
        result.failed.push(this.toFailure(run, error));
      }
    });
    if (runs.length > 0) await this.syncPeriodStatus(periodId, company, user);
    return this.sortBulkResult(result);
  }

  async transition(
    companyId: string,
    runId: string,
    dto: PayrollRunTransitionDto,
    user: AuthenticatedUser,
  ): Promise<PayrollRunTransitionResult> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.findRunOrThrow(companyId, runId);
    const previousStatus = existing.status as SharedPayrollRunStatus;
    const targetStatus = dto.targetStatus as SharedPayrollRunStatus;

    if (previousStatus === targetStatus) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Payroll run is already in the requested status',
      });
    }

    assertPayrollRunTransition(previousStatus, targetStatus);
    await this.permissionsService.assertPermission(
      user,
      'payroll',
      requiredPermissionForPayrollTransition(targetStatus),
    );

    let row: RunWithRelations;
    try {
      row = await this.applyTransition(companyId, company, existing, targetStatus, user);
    } catch (error) {
      if (isFinalizedWithErrors(error)) {
        this.enqueueAccounting(companyId, company, existing.payrollPeriodId, user);
        await this.syncPeriodStatus(existing.payrollPeriodId, company, user);
      }
      throw error;
    }
    if (targetStatus === 'finalized') this.enqueueAccounting(companyId, company, row.payrollPeriodId, user);
    await this.syncPeriodStatus(row.payrollPeriodId, company, user);

    return {
      run: this.toRecord(row),
      previousStatus,
      newStatus: targetStatus,
    };
  }

  /**
   * Moves every run of a period in `fromStatus` (or the given runs) to `targetStatus`.
   * Approving, finalizing and paying require the count and totals the user confirmed;
   * if the runs changed since, nothing happens (UI_GUIDELINES.md §5).
   */
  async transitionMany(
    companyId: string,
    periodId: string,
    dto: BulkPayrollRunTransitionDto,
    user: AuthenticatedUser,
  ): Promise<PayrollBulkResult> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    await this.assertPeriod(companyId, periodId);
    const fromStatus = dto.fromStatus as SharedPayrollRunStatus;
    const targetStatus = dto.targetStatus as SharedPayrollRunStatus;

    assertPayrollRunTransition(fromStatus, targetStatus);
    await this.permissionsService.assertPermission(
      user,
      'payroll',
      requiredPermissionForPayrollTransition(targetStatus),
    );

    const runs = await this.prisma.unscoped.payrollRun.findMany({
      where: {
        payrollPeriodId: periodId,
        deletedAt: null,
        status: dto.fromStatus,
        ...(dto.runIds ? { id: { in: dto.runIds } } : {}),
      },
      include: this.runInclude(),
      orderBy: [{ employee: { employeeNumber: 'asc' } }],
    });
    if (dto.runIds && runs.length !== new Set(dto.runIds).size) {
      throw new ConflictException({
        code: 'STALE_REVIEW',
        message: 'Some of the selected employees changed status since you reviewed them. Refresh and review again.',
      });
    }
    if (runs.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `No payroll runs are in "${fromStatus.replace('_', ' ')}" status`,
      });
    }

    if (PAYROLL_RUN_CONFIRMED_TARGETS.includes(targetStatus)) {
      if (!dto.expected) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Confirm the employee count and totals before this step',
        });
      }
      const totals = sumRunAmounts(runs);
      if (
        dto.expected.runCount !== runs.length ||
        !parseMoney(dto.expected.grossPay).equals(parseMoney(totals.grossPay)) ||
        !parseMoney(dto.expected.netPay).equals(parseMoney(totals.netPay))
      ) {
        throw new ConflictException({
          code: 'STALE_REVIEW',
          message: `The payroll changed since you reviewed it (now ${runs.length} employees, gross ${totals.grossPay}, net ${totals.netPay}). Review the new figures and confirm again.`,
        });
      }
    }

    const result: PayrollBulkResult = { succeeded: [], failed: [] };
    let anyFinalized = false;
    await forEachLimited(runs, BULK_CONCURRENCY, async (run) => {
      try {
        const row = await this.applyTransition(companyId, company, run, targetStatus, user);
        result.succeeded.push(this.toRecord(row));
        anyFinalized = true;
      } catch (error) {
        anyFinalized ||= isFinalizedWithErrors(error);
        result.failed.push(this.toFailure(run, error));
      }
    });

    if (targetStatus === 'finalized' && anyFinalized) {
      this.enqueueAccounting(companyId, company, periodId, user);
    }
    await this.syncPeriodStatus(periodId, company, user);
    return this.sortBulkResult(result);
  }

  private async calculateRun(
    companyId: string,
    company: Company,
    existing: RunWithRelations,
    user: AuthenticatedUser,
  ): Promise<RunWithRelations> {
    if (isPayrollRunLocked(existing.status, existing.locked)) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Finalized payroll runs cannot be recalculated (RULES.md §3)',
      });
    }

    if (!canRecalculatePayrollRun(existing.status)) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `Payroll runs in "${existing.status}" status cannot be recalculated`,
      });
    }

    const preview = await this.payrollCalculationService.preview(
      existing.employeeId,
      formatDateOnly(existing.payrollPeriod.endDate),
    );

    const currencySnapshot = await this.currencyPayroll.buildPayrollCurrencySnapshot({
      tenantId: company.tenantId,
      companyId,
      employeeId: existing.employeeId,
      asOfDate: existing.payrollPeriod.endDate,
      grossPay: preview.grossPay,
      totalDeductions: preview.totalDeductions,
      netPay: preview.netPay,
    });

    const previousStatus = existing.status;
    const nextStatus = PayrollRunStatus.calculated;
    if (previousStatus !== PayrollRunStatus.draft && previousStatus !== PayrollRunStatus.calculated) {
      assertPayrollRunTransition(previousStatus as SharedPayrollRunStatus, 'calculated');
    }

    const snapshot = { ...preview, currency: currencySnapshot };

    return this.prisma.unscoped.$transaction(async (tx) => {
      const updated = await tx.payrollRun.update({
        where: { id: existing.id },
        data: {
          grossPay: parseMoney(preview.grossPay),
          totalDeductions: parseMoney(preview.totalDeductions),
          netPay: parseMoney(preview.netPay),
          payCurrency: currencySnapshot.payCurrency,
          baseCurrency: currencySnapshot.baseCurrency,
          exchangeRate: parseMoney(currencySnapshot.exchangeRate),
          exchangeRateId: currencySnapshot.exchangeRateId ?? null,
          exchangeRateDate: existing.payrollPeriod.endDate,
          grossPayBase: parseMoney(currencySnapshot.grossPayBase),
          totalDeductionsBase: parseMoney(currencySnapshot.totalDeductionsBase),
          netPayBase: parseMoney(currencySnapshot.netPayBase),
          calculationSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          status: nextStatus,
        },
        include: this.runInclude(),
      });

      await tx.superannuationContribution.deleteMany({
        where: { payrollRunId: existing.id },
      });

      if (preview.superannuation) {
        await tx.superannuationContribution.create({
          data: {
            payrollRunId: existing.id,
            employeeContribution: parseMoney(preview.superannuation.employeeContribution),
            employerContribution: parseMoney(preview.superannuation.employerContribution),
          },
        });
      }

      await this.logTransition(
        {
          tenantId: company.tenantId,
          userId: user.id,
          runId: existing.id,
          previousStatus,
          newStatus: nextStatus,
          oldRecord: existing,
          newRecord: updated,
          action: 'update',
          note: 'recalculated',
          calculation: preview,
        },
        tx,
      );

      return updated;
    });
  }

  /** Caller checks the transition is allowed and the user may perform it. */
  private async applyTransition(
    companyId: string,
    company: Company,
    existing: RunWithRelations,
    targetStatus: SharedPayrollRunStatus,
    user: AuthenticatedUser,
  ): Promise<RunWithRelations> {
    if (isPayrollRunLocked(existing.status, existing.locked) && targetStatus !== 'paid') {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Finalized payroll runs are locked — use adjustment records for corrections (RULES.md §3)',
      });
    }

    const updateData: Prisma.PayrollRunUpdateInput = {
      status: targetStatus as PayrollRunStatus,
    };

    if (targetStatus === 'finalized') {
      if (!existing.exchangeRateDate || existing.exchangeRate == null) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message:
            'Payroll run must be calculated before finalize so the exchange rate is locked to the period end date',
        });
      }
      updateData.locked = true;
      updateData.finalizedAt = new Date();
    }

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      // Guards against a concurrent transition of the same run.
      const { count } = await tx.payrollRun.updateMany({
        where: { id: existing.id, status: existing.status },
        data: { status: targetStatus as PayrollRunStatus },
      });
      if (count === 0) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'This payroll run changed status while the action was in progress',
        });
      }
      const updated = await tx.payrollRun.update({
        where: { id: existing.id },
        data: updateData,
        include: this.runInclude(),
      });
      await this.logTransition(
        {
          tenantId: company.tenantId,
          userId: user.id,
          runId: existing.id,
          previousStatus: existing.status,
          newStatus: updated.status,
          oldRecord: existing,
          newRecord: updated,
          action: auditActionForPayrollTransition(targetStatus),
        },
        tx,
      );
      return updated;
    });

    if (targetStatus === 'finalized') {
      try {
        await this.finalizeFollowUps(companyId, company, row, user);
      } catch (error) {
        throw new ConflictException({
          code: 'FINALIZED_WITH_ERRORS',
          message: `Finalized and locked, but a follow-up step failed: ${errorMessage(error)}`,
        });
      }
    }

    return row;
  }

  /** Payslip, loan settlement and notification for a run that was just finalized. */
  private async finalizeFollowUps(
    companyId: string,
    company: Company,
    row: RunWithRelations,
    user: AuthenticatedUser,
  ): Promise<void> {
    await this.payslipService.generateForPayrollRun(row.id, company.tenantId, user.id);

    const period = await this.prisma.unscoped.payrollPeriod.findUniqueOrThrow({
      where: { id: row.payrollPeriodId },
      select: { startDate: true, endDate: true },
    });

    await this.loanPayrollService.settleDueInstallments({
      employeeId: row.employeeId,
      payrollRunId: row.id,
      periodFrom: period.startDate,
      periodTo: period.endDate,
    });

    await this.notificationEngine.emit({
      tenantId: company.tenantId,
      companyId,
      eventType: 'payroll.finalized',
      subjectEmployeeId: row.employeeId,
      variables: buildPayrollFinalizedVariables({
        employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
        periodName: `${formatDateOnly(period.startDate)} – ${formatDateOnly(period.endDate)}`,
        netPay: formatMoney(row.netPay),
      }),
      payload: {
        payrollRunId: row.id,
        employeeId: row.employeeId,
        eventType: 'payroll.finalized',
      },
    });
  }

  private enqueueAccounting(
    companyId: string,
    company: Company,
    payrollPeriodId: string,
    user: AuthenticatedUser,
  ): void {
    void this.accountingSyncQueue.enqueuePeriodSync({
      companyId,
      tenantId: company.tenantId,
      payrollPeriodId,
      triggeredByUserId: user.id,
    });
  }

  /** Keeps the period's status in line with its runs (see derivePayrollPeriodStatus). */
  private async syncPeriodStatus(
    periodId: string,
    company: Company,
    user: AuthenticatedUser,
  ): Promise<void> {
    const [period, runs] = await Promise.all([
      this.prisma.unscoped.payrollPeriod.findUniqueOrThrow({ where: { id: periodId } }),
      this.prisma.unscoped.payrollRun.findMany({
        where: { payrollPeriodId: periodId, deletedAt: null },
        select: { status: true },
      }),
    ]);
    const next = derivePayrollPeriodStatus(
      runs.map((r) => r.status as SharedPayrollRunStatus),
    ) as PayrollPeriodStatus;
    if (period.status === next) return;

    await this.prisma.unscoped.$transaction(async (tx) => {
      await tx.payrollPeriod.update({ where: { id: periodId }, data: { status: next } });
      await this.auditService.log(
        {
          tenantId: company.tenantId,
          userId: user.id,
          action: 'update',
          module: 'payroll',
          recordId: periodId,
          oldValue: { status: period.status },
          newValue: { status: next, reason: 'payroll run status changed' },
        },
        tx,
      );
    });
  }

  private async logTransition(
    input: {
      tenantId: string;
      userId: string;
      runId: string;
      previousStatus: PayrollRunStatus;
      newStatus: PayrollRunStatus;
      oldRecord: RunWithRelations;
      newRecord: RunWithRelations;
      action: AuditAction | 'update' | 'approve' | 'finalize' | 'reject';
      note?: string;
      calculation?: unknown;
    },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const oldSnapshot = this.toRecord(input.oldRecord);
    const newSnapshot = this.toRecord(input.newRecord);

    await this.auditService.log(
      {
        tenantId: input.tenantId,
        userId: input.userId,
        action: input.action as AuditAction,
        module: 'payroll',
        recordId: input.runId,
        oldValue: {
          ...oldSnapshot,
          transition: {
            from: input.previousStatus,
            to: input.newStatus,
            ...(input.note ? { note: input.note } : {}),
          },
        } as unknown as Record<string, unknown>,
        newValue: {
          ...newSnapshot,
          ...(input.calculation ? { calculation: input.calculation } : {}),
        } as unknown as Record<string, unknown>,
      },
      tx,
    );
  }

  private draftRunData(periodId: string, employeeId: string) {
    return {
      payrollPeriodId: periodId,
      employeeId,
      grossPay: new Decimal(0),
      totalDeductions: new Decimal(0),
      netPay: new Decimal(0),
      status: PayrollRunStatus.draft,
      locked: false,
    };
  }

  private toFailure(run: RunWithRelations, error: unknown): PayrollBulkFailure {
    return {
      runId: run.id,
      employeeId: run.employeeId,
      employeeNumber: run.employee.employeeNumber,
      employeeName: `${run.employee.firstName} ${run.employee.lastName}`.trim(),
      message: errorMessage(error),
    };
  }

  private sortBulkResult(result: PayrollBulkResult): PayrollBulkResult {
    const byNumber = (a: { employeeNumber?: string }, b: { employeeNumber?: string }) =>
      (a.employeeNumber ?? '').localeCompare(b.employeeNumber ?? '');
    result.succeeded.sort(byNumber);
    result.failed.sort(byNumber);
    return result;
  }

  private runInclude() {
    return {
      employee: {
        select: { employeeNumber: true, firstName: true, lastName: true },
      },
      payrollPeriod: {
        select: { id: true, companyId: true, endDate: true },
      },
    } as const;
  }

  private async assertPeriod(companyId: string, periodId: string) {
    await this.companyScope.assertCompanyInTenant(companyId);
    const period = await this.prisma.unscoped.payrollPeriod.findFirst({
      where: { id: periodId, companyId },
    });
    if (!period) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Payroll period not found',
      });
    }
    return period;
  }

  private async findRunOrThrow(
    companyId: string,
    runId: string,
  ): Promise<RunWithRelations> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.prisma.unscoped.payrollRun.findFirst({
      where: {
        id: runId,
        deletedAt: null,
        payrollPeriod: { companyId },
      },
      include: this.runInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Payroll run not found',
      });
    }
    return row;
  }

  private toRecord(row: RunWithRelations): PayrollRunRecord {
    return {
      id: row.id,
      payrollPeriodId: row.payrollPeriodId,
      employeeId: row.employeeId,
      employeeNumber: row.employee?.employeeNumber,
      employeeName: row.employee
        ? `${row.employee.firstName} ${row.employee.lastName}`.trim()
        : undefined,
      grossPay: formatMoney(row.grossPay),
      totalDeductions: formatMoney(row.totalDeductions),
      netPay: formatMoney(row.netPay),
      status: row.status as SharedPayrollRunStatus,
      locked: row.locked,
      payCurrency: row.payCurrency,
      baseCurrency: row.baseCurrency,
      exchangeRate: row.exchangeRate != null ? formatMoney(row.exchangeRate) : null,
      exchangeRateId: row.exchangeRateId,
      exchangeRateDate: row.exchangeRateDate
        ? formatDateOnly(row.exchangeRateDate)
        : null,
      grossPayBase: row.grossPayBase != null ? formatMoney(row.grossPayBase) : null,
      totalDeductionsBase:
        row.totalDeductionsBase != null
          ? formatMoney(row.totalDeductionsBase)
          : null,
      netPayBase: row.netPayBase != null ? formatMoney(row.netPayBase) : null,
      hasBreakdown: row.calculationSnapshot != null,
      finalizedAt: row.finalizedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
