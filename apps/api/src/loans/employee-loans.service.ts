import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeLoanStatus,
  LoanInstallmentStatus,
  PayrollRunStatus,
  Prisma,
  type EmployeeLoan,
  type LoanInstallment,
} from '@prisma/client';
import type {
  EmployeeLoanDetailRecord,
  EmployeeLoanRecord,
  LoanInstallmentRecord,
  LoanPayPeriodDeduction,
  LoanPayPeriodRef,
  LoanPayrollRunRef,
  LoanScheduleRow,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { PermissionsService } from '../rbac/permissions.service';
import type {
  ApproveEmployeeLoanDto,
  CreateEmployeeLoanDto,
  ListEmployeeLoansQueryDto,
  RejectEmployeeLoanDto,
} from './dto/loan.dto';
import { LoanPayrollService } from './loan-payroll.service';
import {
  addMonthsUtc,
  buildInstallmentSchedule,
  buildLoanReferenceNumber,
  calculateLoanTotals,
  classifyInstallmentRecovery,
  findCoveringPeriod,
  formatDateValue,
  parseDateString,
  periodDeductionState,
  roundMoney,
  type InstallmentRecovery,
} from './loan.utils';

function todayUtc(): Date {
  return parseDateString(formatDateValue(new Date()));
}

type LoanWithRelations = EmployeeLoan & {
  employee: { firstName: string; lastName: string; employeeNumber: string };
  installments: LoanInstallment[];
};

@Injectable()
export class EmployeeLoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly loanPayroll: LoanPayrollService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(
    companyId: string,
    query: ListEmployeeLoansQueryDto,
  ): Promise<EmployeeLoanRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.employeeLoan.findMany({
      where: {
        companyId,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.loanKind ? { loanKind: query.loanKind } : {}),
      },
      include: this.defaultInclude(),
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    return rows.map((row) => this.toRecord(row));
  }

  async get(loanId: string): Promise<EmployeeLoanDetailRecord> {
    const row = await this.findOrThrow(loanId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    return this.toDetailRecord(row);
  }

  async create(
    companyId: string,
    dto: CreateEmployeeLoanDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeLoanRecord> {
    const employee = await this.assertEmployee(dto.employeeId, companyId);
    if (dto.approve === true) {
      await this.permissions.assertPermission(user, 'payroll', 'approve');
      this.assertNotOwnLoan(dto.employeeId, user);
      if (dto.firstDueDate) this.parseFirstDueDate(dto.firstDueDate);
    }
    const totals = calculateLoanTotals(
      dto.principalAmount,
      dto.interestRatePercent ?? 0,
      dto.tenorMonths,
    );

    const count = await this.prisma.unscoped.employeeLoan.count({
      where: { companyId },
    });
    const referenceNumber = buildLoanReferenceNumber(count);

    const row = await this.prisma.unscoped.employeeLoan.create({
      data: {
        tenantId: employee.tenantId,
        companyId,
        employeeId: dto.employeeId,
        referenceNumber,
        loanKind: dto.loanKind,
        purposeLabel: dto.purposeLabel?.trim() ?? null,
        principalAmount: new Prisma.Decimal(dto.principalAmount),
        interestRatePercent: new Prisma.Decimal(dto.interestRatePercent ?? 0),
        tenorMonths: dto.tenorMonths,
        monthlyInstallment: new Prisma.Decimal(totals.monthlyInstallment),
        totalRepayable: new Prisma.Decimal(totals.totalRepayable),
        remainingBalance: new Prisma.Decimal(totals.totalRepayable),
        deductFromPayroll: dto.deductFromPayroll ?? true,
        notes: dto.notes?.trim() ?? null,
        status: EmployeeLoanStatus.pending_approval,
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: employee.tenantId,
      userId: user.id,
      action: 'create',
      module: 'payroll',
      recordId: row.id,
      newValue: this.toRecord(row) as unknown as Record<string, unknown>,
    });

    if (dto.approve === true) {
      return this.approve(row.id, user, {
        firstDueDate: dto.firstDueDate,
      });
    }

    return this.toRecord(row);
  }

  async approve(
    loanId: string,
    user: AuthenticatedUser,
    options?: ApproveEmployeeLoanDto,
  ): Promise<EmployeeLoanRecord> {
    const existing = await this.findOrThrow(loanId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);
    this.assertNotOwnLoan(existing.employeeId, user);

    if (existing.status !== EmployeeLoanStatus.pending_approval) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only pending loans can be approved',
      });
    }

    const firstDueDate = options?.firstDueDate
      ? this.parseFirstDueDate(options.firstDueDate)
      : addMonthsUtc(todayUtc(), 1);

    const schedule = buildInstallmentSchedule({
      principal: Number(existing.principalAmount),
      interestRatePercent: Number(existing.interestRatePercent),
      tenorMonths: existing.tenorMonths,
      firstDueDate,
    });

    const payComponentId = await this.loanPayroll.ensureLoanDeductionComponent(
      existing.companyId,
    );
    const salaryStructureId = existing.deductFromPayroll
      ? await this.loanPayroll.ensureLoanSalaryStructure({
          employeeId: existing.employeeId,
          payComponentId,
          effectiveFrom: firstDueDate,
        })
      : null;

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      await tx.loanInstallment.createMany({
        data: schedule.map((item) => ({
          loanId: existing.id,
          tenantId: existing.tenantId,
          installmentNumber: item.installmentNumber,
          dueDate: item.dueDate,
          principalPortion: new Prisma.Decimal(item.principalPortion),
          interestPortion: new Prisma.Decimal(item.interestPortion),
          totalDue: new Prisma.Decimal(item.totalDue),
        })),
      });

      return tx.employeeLoan.update({
        where: { id: loanId },
        data: {
          status: EmployeeLoanStatus.active,
          approvedAt: new Date(),
          disbursedAt: new Date(),
          firstDueDate,
          payComponentId,
          salaryStructureId,
        },
        include: this.defaultInclude(),
      });
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'approve',
      module: 'payroll',
      recordId: loanId,
      newValue: { status: 'active', installments: schedule.length },
    });

    return this.toRecord(row);
  }

  async reject(
    loanId: string,
    user: AuthenticatedUser,
    dto: RejectEmployeeLoanDto,
  ): Promise<EmployeeLoanRecord> {
    const existing = await this.findOrThrow(loanId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);
    this.assertNotOwnLoan(existing.employeeId, user);

    if (existing.status !== EmployeeLoanStatus.pending_approval) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only pending loans can be rejected',
      });
    }

    const row = await this.prisma.unscoped.employeeLoan.update({
      where: { id: loanId },
      data: {
        status: EmployeeLoanStatus.rejected,
        rejectedAt: new Date(),
        rejectionReason: dto.reason,
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'reject',
      module: 'payroll',
      recordId: loanId,
      newValue: { status: 'rejected', reason: dto.reason },
    });

    return this.toRecord(row);
  }

  private assertNotOwnLoan(employeeId: string, user: AuthenticatedUser): void {
    if (user.employeeId && user.employeeId === employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You cannot approve or reject your own loan or advance request',
      });
    }
  }

  private parseFirstDueDate(value: string): Date {
    const date = parseDateString(value.slice(0, 10));
    if (date < todayUtc()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'The first installment date cannot be in the past',
      });
    }
    return date;
  }

  private async assertEmployee(employeeId: string, companyId: string) {
    const row = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true, tenantId: true, companyId: true },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }
    return row;
  }

  private async findOrThrow(loanId: string): Promise<LoanWithRelations> {
    const row = await this.prisma.unscoped.employeeLoan.findUnique({
      where: { id: loanId },
      include: this.defaultInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee loan not found',
      });
    }
    return row;
  }

  private defaultInclude() {
    return {
      employee: {
        select: { firstName: true, lastName: true, employeeNumber: true },
      },
      installments: { orderBy: { installmentNumber: 'asc' as const } },
    };
  }

  private async toDetailRecord(row: LoanWithRelations): Promise<EmployeeLoanDetailRecord> {
    const base = this.toRecord(row);
    const today = formatDateValue(todayUtc());
    const projected = row.status === EmployeeLoanStatus.pending_approval;

    const drafts = projected
      ? buildInstallmentSchedule({
          principal: Number(row.principalAmount),
          interestRatePercent: Number(row.interestRatePercent),
          tenorMonths: row.tenorMonths,
          firstDueDate: addMonthsUtc(todayUtc(), 1),
        }).map((item) => ({
          id: null as string | null,
          installmentNumber: item.installmentNumber,
          dueDate: formatDateValue(item.dueDate),
          principalPortion: item.principalPortion,
          interestPortion: item.interestPortion,
          totalDue: item.totalDue,
          status: null as LoanInstallmentStatus | null,
          paidAt: null as string | null,
          payrollRunId: null as string | null,
        }))
      : row.installments.map((item) => ({
          id: item.id as string | null,
          installmentNumber: item.installmentNumber,
          dueDate: formatDateValue(item.dueDate),
          principalPortion: Number(item.principalPortion),
          interestPortion: Number(item.interestPortion),
          totalDue: Number(item.totalDue),
          status: item.status as LoanInstallmentStatus | null,
          paidAt: item.paidAt?.toISOString() ?? null,
          payrollRunId: item.payrollRunId,
        }));

    const { periods, runsByPeriod, runsById } = await this.loadPayrollContext(
      row,
      drafts.map((d) => d.dueDate),
      drafts.flatMap((d) => (d.payrollRunId ? [d.payrollRunId] : [])),
    );

    let balance = Number(row.totalRepayable);
    const schedule: LoanScheduleRow[] = drafts.map((draft) => {
      balance = roundMoney(balance - draft.totalDue);
      const linkedRun = draft.payrollRunId ? runsById.get(draft.payrollRunId) : undefined;
      const period = linkedRun?.period ?? findCoveringPeriod(periods, draft.dueDate);
      const run = linkedRun?.run ?? (period ? (runsByPeriod.get(period.id) ?? null) : null);
      const recovery = projected
        ? ('projected' as const)
        : classifyInstallmentRecovery({
            status: draft.status ?? 'scheduled',
            dueDate: draft.dueDate,
            deductFromPayroll: row.deductFromPayroll,
            period,
            run,
            today,
          });
      return {
        installmentId: draft.id,
        installmentNumber: draft.installmentNumber,
        dueDate: draft.dueDate,
        principalPortion: draft.principalPortion,
        interestPortion: draft.interestPortion,
        totalDue: draft.totalDue,
        balanceAfter: Math.max(balance, 0),
        status: draft.status,
        paidAt: draft.paidAt,
        recovery,
        payPeriod: period,
        payrollRun: projected ? null : run,
      };
    });

    const byPeriod = new Map<string, LoanScheduleRow[]>();
    for (const item of schedule) {
      if (projected || !item.payPeriod || item.recovery === 'manual' || item.recovery === 'skipped') continue;
      const list = byPeriod.get(item.payPeriod.id) ?? [];
      list.push(item);
      byPeriod.set(item.payPeriod.id, list);
    }
    const payrollDeductions: LoanPayPeriodDeduction[] = [...byPeriod.values()]
      .map((items) => ({
        payPeriod: items[0].payPeriod!,
        payrollRun: items[0].payrollRun,
        installmentNumbers: items.map((i) => i.installmentNumber),
        amount: roundMoney(items.reduce((sum, i) => sum + i.totalDue, 0)),
        state: periodDeductionState(items.map((i) => i.recovery as InstallmentRecovery)),
      }))
      .sort((a, b) => a.payPeriod.startDate.localeCompare(b.payPeriod.startDate));

    const paid = schedule.filter((i) => i.recovery === 'recovered');
    return {
      ...base,
      scheduleIsProjected: projected,
      schedule,
      payrollDeductions,
      principalRepaid: roundMoney(paid.reduce((sum, i) => sum + i.principalPortion, 0)),
      interestRepaid: roundMoney(paid.reduce((sum, i) => sum + i.interestPortion, 0)),
    };
  }

  /** Pay periods covering the due dates, and the employee's payroll run in each. */
  private async loadPayrollContext(row: LoanWithRelations, dueDates: string[], linkedRunIds: string[]) {
    const periods: LoanPayPeriodRef[] = [];
    const runsByPeriod = new Map<string, LoanPayrollRunRef>();
    const runsById = new Map<string, { run: LoanPayrollRunRef; period: LoanPayPeriodRef }>();
    if (dueDates.length === 0) return { periods, runsByPeriod, runsById };

    const sorted = [...dueDates].sort();
    const periodRows = await this.prisma.unscoped.payrollPeriod.findMany({
      where: {
        companyId: row.companyId,
        startDate: { lte: parseDateString(sorted[sorted.length - 1]) },
        endDate: { gte: parseDateString(sorted[0]) },
      },
      orderBy: { startDate: 'asc' },
    });
    periods.push(...periodRows.map((p) => this.toPeriodRef(p)));

    const runRows = await this.prisma.unscoped.payrollRun.findMany({
      where: {
        deletedAt: null,
        OR: [
          {
            employeeId: row.employeeId,
            payrollPeriodId: { in: periodRows.map((p) => p.id) },
            status: { not: PayrollRunStatus.cancelled },
          },
          ...(linkedRunIds.length ? [{ id: { in: linkedRunIds } }] : []),
        ],
      },
      include: { payrollPeriod: true },
      orderBy: { createdAt: 'asc' },
    });
    for (const run of runRows) {
      const ref: LoanPayrollRunRef = {
        id: run.id,
        status: run.status,
        netPay: Number(run.netPay),
        totalDeductions: Number(run.totalDeductions),
        finalizedAt: run.finalizedAt?.toISOString() ?? null,
      };
      runsById.set(run.id, { run: ref, period: this.toPeriodRef(run.payrollPeriod) });
      if (run.employeeId === row.employeeId && run.status !== PayrollRunStatus.cancelled) {
        runsByPeriod.set(run.payrollPeriodId, ref);
      }
    }
    return { periods, runsByPeriod, runsById };
  }

  private toPeriodRef(period: {
    id: string;
    startDate: Date;
    endDate: Date;
    paymentDate: Date;
    status: LoanPayPeriodRef['status'];
  }): LoanPayPeriodRef {
    return {
      id: period.id,
      startDate: formatDateValue(period.startDate),
      endDate: formatDateValue(period.endDate),
      paymentDate: formatDateValue(period.paymentDate),
      status: period.status,
    };
  }

  private toRecord(row: LoanWithRelations): EmployeeLoanRecord {
    const today = formatDateValue(todayUtc());
    const scheduled = row.installments.filter((i) => i.status === LoanInstallmentStatus.scheduled);
    const next = scheduled.find((i) => formatDateValue(i.dueDate) >= today);
    const overdue = scheduled.filter((i) => formatDateValue(i.dueDate) < today);
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      employeeId: row.employeeId,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      employeeNumber: row.employee.employeeNumber,
      referenceNumber: row.referenceNumber,
      loanKind: row.loanKind,
      purposeLabel: row.purposeLabel,
      principalAmount: Number(row.principalAmount),
      interestRatePercent: Number(row.interestRatePercent),
      tenorMonths: row.tenorMonths,
      monthlyInstallment: Number(row.monthlyInstallment),
      totalRepayable: Number(row.totalRepayable),
      repaidAmount: Number(row.repaidAmount),
      remainingBalance: Number(row.remainingBalance),
      installmentsPaid: row.installmentsPaid,
      installmentsTotal: row.tenorMonths,
      deductFromPayroll: row.deductFromPayroll,
      status: row.status,
      firstDueDate: row.firstDueDate ? formatDateValue(row.firstDueDate) : null,
      disbursedAt: row.disbursedAt?.toISOString() ?? null,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      rejectedAt: row.rejectedAt?.toISOString() ?? null,
      payComponentId: row.payComponentId,
      salaryStructureId: row.salaryStructureId,
      notes: row.notes,
      rejectionReason: row.rejectionReason,
      nextDueDate: next ? formatDateValue(next.dueDate) : null,
      nextDueAmount: next ? Number(next.totalDue) : null,
      overdueInstallments: overdue.length,
      overdueAmount: roundMoney(overdue.reduce((sum, i) => sum + Number(i.totalDue), 0)),
      installments: row.installments.map((item) => this.toInstallmentRecord(item)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toInstallmentRecord(row: LoanInstallment): LoanInstallmentRecord {
    return {
      id: row.id,
      loanId: row.loanId,
      installmentNumber: row.installmentNumber,
      dueDate: formatDateValue(row.dueDate),
      principalPortion: Number(row.principalPortion),
      interestPortion: Number(row.interestPortion),
      totalDue: Number(row.totalDue),
      status: row.status,
      paidAt: row.paidAt?.toISOString() ?? null,
      payrollRunId: row.payrollRunId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
