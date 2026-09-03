import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PayrollAdjustmentStatus,
  PayrollRunStatus,
  type PayrollAdjustment,
} from '@prisma/client';
import type { PayrollAdjustmentRecord } from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreatePayrollAdjustmentDto,
  ListPayrollAdjustmentsQueryDto,
} from './dto/payroll-adjustments.dto';
import { PayrollCalculationService } from './payroll-calculation.service';
import { isPayrollRunLocked } from './payroll-run.utils';
import { computePayrollDelta } from './payroll-calculation.helpers';
import { formatDateOnly, formatMoney, parseDateOnly, parseMoney } from './payroll.utils';

@Injectable()
export class PayrollAdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly payrollCalculationService: PayrollCalculationService,
  ) {}

  async list(
    companyId: string,
    query: ListPayrollAdjustmentsQueryDto,
  ): Promise<PayrollAdjustmentRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const rows = await this.prisma.unscoped.payrollAdjustment.findMany({
      where: {
        companyId,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async get(companyId: string, adjustmentId: string): Promise<PayrollAdjustmentRecord> {
    const row = await this.findOrThrow(companyId, adjustmentId);
    return this.toRecord(row);
  }

  /**
   * Creates a retroactive adjustment for the difference vs a locked payroll run (§11).
   * Never mutates the original payroll_run row.
   */
  async create(
    companyId: string,
    dto: CreatePayrollAdjustmentDto,
    user: AuthenticatedUser,
  ): Promise<PayrollAdjustmentRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    const originalRun = await this.prisma.unscoped.payrollRun.findFirst({
      where: {
        id: dto.originalPayrollRunId,
        deletedAt: null,
        payrollPeriod: { companyId },
      },
      include: {
        payrollPeriod: {
          select: { id: true, startDate: true, endDate: true, companyId: true },
        },
      },
    });

    if (!originalRun) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Original payroll run not found',
      });
    }

    if (!isPayrollRunLocked(originalRun.status, originalRun.locked)) {
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          'Adjustments require a finalized or paid payroll run — edit the run directly instead',
      });
    }

    if (
      originalRun.status !== PayrollRunStatus.finalized &&
      originalRun.status !== PayrollRunStatus.paid
    ) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Original payroll run must be finalized or paid',
      });
    }

    if (dto.applyToPayrollPeriodId) {
      const applyPeriod = await this.prisma.unscoped.payrollPeriod.findFirst({
        where: { id: dto.applyToPayrollPeriodId, companyId },
      });
      if (!applyPeriod) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Apply-to payroll period not found',
        });
      }
    }

    const retroactiveFrom = dto.retroactiveFrom
      ? parseDateOnly(dto.retroactiveFrom, 'retroactiveFrom')
      : originalRun.payrollPeriod.startDate;
    const retroactiveTo = dto.retroactiveTo
      ? parseDateOnly(dto.retroactiveTo, 'retroactiveTo')
      : originalRun.payrollPeriod.endDate;

    if (retroactiveTo < retroactiveFrom) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'retroactiveTo must be on or after retroactiveFrom',
      });
    }

    const asOf = formatDateOnly(originalRun.payrollPeriod.endDate);
    const revised = await this.payrollCalculationService.compute({
      employeeId: originalRun.employeeId,
      asOf,
      structureOverrides: dto.structureOverrides,
    });

    const originalSnapshot = {
      grossPay: formatMoney(originalRun.grossPay),
      totalDeductions: formatMoney(originalRun.totalDeductions),
      netPay: formatMoney(originalRun.netPay),
    };

    const delta = computePayrollDelta(originalSnapshot, revised);

    const row = await this.prisma.unscoped.payrollAdjustment.create({
      data: {
        companyId,
        employeeId: originalRun.employeeId,
        originalPayrollRunId: originalRun.id,
        applyToPayrollPeriodId: dto.applyToPayrollPeriodId ?? null,
        retroactiveFrom,
        retroactiveTo,
        reason: dto.reason.trim(),
        originalGrossPay: originalRun.grossPay,
        originalTotalDeductions: originalRun.totalDeductions,
        originalNetPay: originalRun.netPay,
        revisedGrossPay: parseMoney(revised.grossPay),
        revisedTotalDeductions: parseMoney(revised.totalDeductions),
        revisedNetPay: parseMoney(revised.netPay),
        adjustmentGrossPay: parseMoney(delta.grossPay),
        adjustmentTotalDeductions: parseMoney(delta.totalDeductions),
        adjustmentNetPay: parseMoney(delta.netPay),
        status: PayrollAdjustmentStatus.draft,
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'payroll',
      recordId: row.id,
      newValue: {
        ...this.toRecord(row),
        originalRunSnapshot: originalSnapshot,
        revisedCalculation: revised,
      } as unknown as Record<string, unknown>,
    });

    return this.toRecord(row);
  }

  /** Mark adjustment to be picked up in the target payroll cycle (§11). */
  async apply(
    companyId: string,
    adjustmentId: string,
    user: AuthenticatedUser,
  ): Promise<PayrollAdjustmentRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.findOrThrow(companyId, adjustmentId);

    if (
      existing.status !== PayrollAdjustmentStatus.draft &&
      existing.status !== PayrollAdjustmentStatus.pending
    ) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `Adjustment in "${existing.status}" status cannot be applied`,
      });
    }

    const row = await this.prisma.unscoped.payrollAdjustment.update({
      where: { id: adjustmentId },
      data: {
        status: PayrollAdjustmentStatus.applied,
        appliedAt: new Date(),
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'update',
      module: 'payroll',
      recordId: row.id,
      oldValue: this.toRecord(existing) as unknown as Record<string, unknown>,
      newValue: this.toRecord(row) as unknown as Record<string, unknown>,
    });

    return this.toRecord(row);
  }

  async submit(
    companyId: string,
    adjustmentId: string,
    user: AuthenticatedUser,
  ): Promise<PayrollAdjustmentRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.findOrThrow(companyId, adjustmentId);

    if (existing.status !== PayrollAdjustmentStatus.draft) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only draft adjustments can be submitted',
      });
    }

    const row = await this.prisma.unscoped.payrollAdjustment.update({
      where: { id: adjustmentId },
      data: { status: PayrollAdjustmentStatus.pending },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'update',
      module: 'payroll',
      recordId: row.id,
      oldValue: this.toRecord(existing) as unknown as Record<string, unknown>,
      newValue: this.toRecord(row) as unknown as Record<string, unknown>,
    });

    return this.toRecord(row);
  }

  async cancel(
    companyId: string,
    adjustmentId: string,
    user: AuthenticatedUser,
  ): Promise<PayrollAdjustmentRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.findOrThrow(companyId, adjustmentId);

    if (existing.status === PayrollAdjustmentStatus.applied) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Applied adjustments cannot be cancelled',
      });
    }

    const row = await this.prisma.unscoped.payrollAdjustment.update({
      where: { id: adjustmentId },
      data: { status: PayrollAdjustmentStatus.cancelled },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'reject',
      module: 'payroll',
      recordId: row.id,
      oldValue: this.toRecord(existing) as unknown as Record<string, unknown>,
      newValue: this.toRecord(row) as unknown as Record<string, unknown>,
    });

    return this.toRecord(row);
  }

  private async findOrThrow(companyId: string, adjustmentId: string) {
    await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.prisma.unscoped.payrollAdjustment.findFirst({
      where: { id: adjustmentId, companyId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Payroll adjustment not found',
      });
    }
    return row;
  }

  private toRecord(row: PayrollAdjustment): PayrollAdjustmentRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      employeeId: row.employeeId,
      originalPayrollRunId: row.originalPayrollRunId,
      applyToPayrollPeriodId: row.applyToPayrollPeriodId,
      retroactiveFrom: formatDateOnly(row.retroactiveFrom),
      retroactiveTo: formatDateOnly(row.retroactiveTo),
      reason: row.reason,
      originalGrossPay: formatMoney(row.originalGrossPay),
      originalTotalDeductions: formatMoney(row.originalTotalDeductions),
      originalNetPay: formatMoney(row.originalNetPay),
      revisedGrossPay: formatMoney(row.revisedGrossPay),
      revisedTotalDeductions: formatMoney(row.revisedTotalDeductions),
      revisedNetPay: formatMoney(row.revisedNetPay),
      adjustmentGrossPay: formatMoney(row.adjustmentGrossPay),
      adjustmentTotalDeductions: formatMoney(row.adjustmentTotalDeductions),
      adjustmentNetPay: formatMoney(row.adjustmentNetPay),
      status: row.status,
      appliedAt: row.appliedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
