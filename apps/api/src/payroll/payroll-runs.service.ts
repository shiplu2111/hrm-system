import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  PayrollRunStatus,
  Prisma,
  type PayrollRun,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type {
  PayrollRunRecord,
  PayrollRunStatus as SharedPayrollRunStatus,
  PayrollRunTransitionResult,
} from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreatePayrollRunDto,
  ListPayrollRunsQueryDto,
  PayrollRunTransitionDto,
} from './dto/payroll-runs.dto';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayslipService } from './payslip.service';
import { PermissionsService } from '../rbac/permissions.service';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import { buildPayrollFinalizedVariables } from '../notifications/notification.helpers';
import {
  assertPayrollRunTransition,
  auditActionForPayrollTransition,
  canRecalculatePayrollRun,
  isPayrollRunLocked,
  requiredPermissionForPayrollTransition,
} from './payroll-run.utils';
import { formatDateOnly, formatMoney, parseMoney } from './payroll.utils';

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

    const row = await this.prisma.unscoped.payrollRun.create({
      data: {
        payrollPeriodId: periodId,
        employeeId: dto.employeeId,
        grossPay: new Decimal(0),
        totalDeductions: new Decimal(0),
        netPay: new Decimal(0),
        status: PayrollRunStatus.draft,
        locked: false,
      },
      include: this.runInclude(),
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'payroll',
      recordId: row.id,
      newValue: this.toRecord(row) as unknown as Record<string, unknown>,
    });

    return this.toRecord(row);
  }

  async calculate(
    companyId: string,
    runId: string,
    user: AuthenticatedUser,
  ): Promise<PayrollRunRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.findRunOrThrow(companyId, runId);

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

    const previousStatus = existing.status;
    const nextStatus =
      previousStatus === PayrollRunStatus.draft
        ? PayrollRunStatus.calculated
        : PayrollRunStatus.calculated;

    if (previousStatus !== PayrollRunStatus.draft) {
      assertPayrollRunTransition(
        previousStatus as SharedPayrollRunStatus,
        'calculated',
      );
    }

    const row = await this.prisma.unscoped.payrollRun.update({
      where: { id: runId },
      data: {
        grossPay: parseMoney(preview.grossPay),
        totalDeductions: parseMoney(preview.totalDeductions),
        netPay: parseMoney(preview.netPay),
        status: nextStatus,
      },
      include: this.runInclude(),
    });

    await this.logTransition({
      tenantId: company.tenantId,
      userId: user.id,
      runId,
      previousStatus,
      newStatus: nextStatus,
      oldRecord: existing,
      newRecord: row,
      action: 'update',
      note: 'recalculated',
      calculation: preview,
    });

    return this.toRecord(row);
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

    if (isPayrollRunLocked(existing.status, existing.locked)) {
      if (targetStatus !== 'paid') {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Finalized payroll runs are locked — use adjustment records for corrections (RULES.md §3)',
        });
      }
    }

    const updateData: Prisma.PayrollRunUpdateInput = {
      status: targetStatus as PayrollRunStatus,
    };

    if (targetStatus === 'finalized') {
      updateData.locked = true;
      updateData.finalizedAt = new Date();
    }

    const row = await this.prisma.unscoped.payrollRun.update({
      where: { id: runId },
      data: updateData,
      include: this.runInclude(),
    });

    const auditAction = auditActionForPayrollTransition(targetStatus);

    await this.logTransition({
      tenantId: company.tenantId,
      userId: user.id,
      runId,
      previousStatus: existing.status,
      newStatus: row.status,
      oldRecord: existing,
      newRecord: row,
      action: auditAction,
    });

    if (targetStatus === 'finalized') {
      await this.payslipService.generateForPayrollRun(
        runId,
        company.tenantId,
        user.id,
      );

      const period = await this.prisma.unscoped.payrollPeriod.findUniqueOrThrow({
        where: { id: row.payrollPeriodId },
        select: { startDate: true, endDate: true },
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
          payrollRunId: runId,
          employeeId: row.employeeId,
          eventType: 'payroll.finalized',
        },
      });
    }

    return {
      run: this.toRecord(row),
      previousStatus,
      newStatus: targetStatus,
    };
  }

  private async logTransition(input: {
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
  }): Promise<void> {
    const oldSnapshot = this.toRecord(input.oldRecord);
    const newSnapshot = this.toRecord(input.newRecord);

    await this.auditService.log({
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
    });
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
      finalizedAt: row.finalizedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
