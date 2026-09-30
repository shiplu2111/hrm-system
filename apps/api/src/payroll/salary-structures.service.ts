import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PayComponentCalculationType,
  PayrollRunStatus,
  Prisma,
  type PayComponent,
  type SalaryStructure,
} from '@prisma/client';
import type {
  LockedPayrollPeriodSummary,
  ReviseSalaryStructureResult,
  SalaryStructureAmountConfig,
  SalaryStructurePayrollLock,
  SalaryStructureRecord,
} from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type {
  CreateSalaryStructureDto,
  ReviseSalaryStructureDto,
  UpdateSalaryStructureDto,
} from './dto/salary-structures.dto';
import {
  formatDateOnly,
  parseAmountConfig,
  parseDateOnly,
  parseFormulaConfig,
  parseMoney,
  rangesOverlap,
} from './payroll.utils';

interface DateRange {
  from: Date;
  to: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function sameAmountConfig(
  a: SalaryStructureAmountConfig,
  b: SalaryStructureAmountConfig,
): boolean {
  const norm = (c: SalaryStructureAmountConfig) =>
    JSON.stringify({
      amount: c.amount ? parseMoney(c.amount).toFixed(2) : null,
      percentage: c.percentage ?? null,
      hourly_rate: c.hourly_rate ?? null,
      ot_multiplier: c.ot_multiplier ?? null,
    });
  return norm(a) === norm(b);
}

/** Dates whose coverage differs between two ranges of the same row. */
export function changedDateRanges(oldRange: DateRange, newRange: DateRange): DateRange[] {
  const ranges: DateRange[] = [];
  if (oldRange.from.getTime() !== newRange.from.getTime()) {
    const early = oldRange.from < newRange.from ? oldRange.from : newRange.from;
    const late = oldRange.from < newRange.from ? newRange.from : oldRange.from;
    ranges.push({ from: early, to: addDays(late, -1) });
  }
  const oldTo = oldRange.to?.getTime() ?? null;
  const newTo = newRange.to?.getTime() ?? null;
  if (oldTo !== newTo) {
    const lower =
      oldTo === null ? newTo! : newTo === null ? oldTo : Math.min(oldTo, newTo);
    const upper = oldTo === null || newTo === null ? null : Math.max(oldTo, newTo);
    ranges.push({
      from: addDays(new Date(lower), 1),
      to: upper === null ? null : new Date(upper),
    });
  }
  return ranges;
}

@Injectable()
export class SalaryStructuresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    employeeId: string,
    asOf?: string,
  ): Promise<SalaryStructureRecord[]> {
    const employee = await this.assertEmployee(employeeId);
    const asOfDate = asOf ? parseDateOnly(asOf, 'asOf') : null;

    const rows = await this.prisma.unscoped.salaryStructure.findMany({
      where: {
        employeeId,
        ...(asOfDate
          ? {
              effectiveFrom: { lte: asOfDate },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
            }
          : {}),
      },
      include: { component: { select: { name: true, calculationType: true } } },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });

    return rows.map((row) => this.toRecord(row));
  }

  async create(
    employeeId: string,
    dto: CreateSalaryStructureDto,
    user: AuthenticatedUser,
  ): Promise<SalaryStructureRecord> {
    const employee = await this.assertEmployee(employeeId);
    const component = await this.prisma.unscoped.payComponent.findFirst({
      where: { id: dto.componentId, companyId: employee.companyId },
    });
    if (!component) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Pay component not found for this company',
      });
    }
    if (component.type !== dto.componentType) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'componentType does not match pay component type',
      });
    }
    const amountConfig = this.normalizeAmountForComponent(
      component,
      parseAmountConfig(dto.amountOrFormula ?? {}),
    );

    const effectiveFrom = parseDateOnly(dto.effectiveFrom, 'effectiveFrom');
    const effectiveTo = dto.effectiveTo
      ? parseDateOnly(dto.effectiveTo, 'effectiveTo')
      : null;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'effectiveTo must be on or after effectiveFrom',
      });
    }

    await this.assertNoOverlap(
      employeeId,
      dto.componentId,
      effectiveFrom,
      effectiveTo,
    );

    const row = await this.prisma.unscoped.salaryStructure.create({
      data: {
        employeeId,
        componentId: dto.componentId,
        componentType: dto.componentType,
        amountOrFormula: amountConfig as Prisma.InputJsonValue,
        effectiveFrom,
        effectiveTo,
      },
      include: { component: { select: { name: true, calculationType: true } } },
    });

    await this.auditService.log({
      tenantId: employee.tenantId,
      userId: user.id,
      action: 'create',
      module: 'payroll',
      recordId: row.id,
      newValue: this.toRecord(row) as unknown as Record<string, unknown>,
    });

    return this.toRecord(row);
  }

  async update(
    employeeId: string,
    structureId: string,
    dto: UpdateSalaryStructureDto,
    user: AuthenticatedUser,
  ): Promise<SalaryStructureRecord> {
    const employee = await this.assertEmployee(employeeId);
    const existing = await this.findOrThrow(employeeId, structureId);

    const component = await this.prisma.unscoped.payComponent.findUniqueOrThrow({
      where: { id: existing.componentId },
    });

    const existingConfig = parseAmountConfig(existing.amountOrFormula);
    const amountConfig =
      dto.amountOrFormula !== undefined
        ? this.normalizeAmountForComponent(
            component,
            parseAmountConfig(dto.amountOrFormula),
          )
        : existingConfig;

    const effectiveFrom = dto.effectiveFrom
      ? parseDateOnly(dto.effectiveFrom, 'effectiveFrom')
      : existing.effectiveFrom;
    const effectiveTo =
      dto.effectiveTo !== undefined
        ? dto.effectiveTo
          ? parseDateOnly(dto.effectiveTo, 'effectiveTo')
          : null
        : existing.effectiveTo;

    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'effectiveTo must be on or after effectiveFrom',
      });
    }

    await this.assertNoOverlap(
      employeeId,
      existing.componentId,
      effectiveFrom,
      effectiveTo,
      structureId,
    );

    const oldRange = { from: existing.effectiveFrom, to: existing.effectiveTo };
    const newRange = { from: effectiveFrom, to: effectiveTo };
    const affected = sameAmountConfig(existingConfig, amountConfig)
      ? changedDateRanges(oldRange, newRange)
      : [oldRange, newRange];
    await this.assertRangesUnlocked(employeeId, affected);

    const row = await this.prisma.unscoped.salaryStructure.update({
      where: { id: structureId },
      data: {
        ...(dto.amountOrFormula !== undefined
          ? { amountOrFormula: amountConfig as Prisma.InputJsonValue }
          : {}),
        ...(dto.effectiveFrom !== undefined ? { effectiveFrom } : {}),
        ...(dto.effectiveTo !== undefined ? { effectiveTo } : {}),
      },
      include: { component: { select: { name: true, calculationType: true } } },
    });

    await this.auditService.log({
      tenantId: employee.tenantId,
      userId: user.id,
      action: 'update',
      module: 'payroll',
      recordId: row.id,
      oldValue: this.toRecord(existing) as unknown as Record<string, unknown>,
      newValue: this.toRecord(row) as unknown as Record<string, unknown>,
    });

    return this.toRecord(row);
  }

  async remove(
    employeeId: string,
    structureId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const employee = await this.assertEmployee(employeeId);
    const existing = await this.findOrThrow(employeeId, structureId);
    await this.assertRangesUnlocked(employeeId, [
      { from: existing.effectiveFrom, to: existing.effectiveTo },
    ]);

    await this.prisma.unscoped.salaryStructure.delete({ where: { id: structureId } });

    await this.auditService.log({
      tenantId: employee.tenantId,
      userId: user.id,
      action: 'delete',
      module: 'payroll',
      recordId: structureId,
      oldValue: this.toRecord(existing) as unknown as Record<string, unknown>,
    });
  }

  async payrollLock(employeeId: string): Promise<SalaryStructurePayrollLock> {
    await this.assertEmployee(employeeId);
    const periods = await this.lockedPeriods(employeeId);
    return {
      lockedThrough: periods.length
        ? periods.reduce((max, p) => (p.endDate > max ? p.endDate : max), periods[0].endDate)
        : null,
      periods,
    };
  }

  /**
   * Effective-dated change (PAYROLL_LOGIC.md §11): the current row is closed the day
   * before `effectiveFrom` and a new row carries the new amount, so history is kept.
   */
  async revise(
    employeeId: string,
    structureId: string,
    dto: ReviseSalaryStructureDto,
    user: AuthenticatedUser,
  ): Promise<ReviseSalaryStructureResult> {
    const employee = await this.assertEmployee(employeeId);
    const existing = await this.findOrThrow(employeeId, structureId);
    const component = await this.prisma.unscoped.payComponent.findUniqueOrThrow({
      where: { id: existing.componentId },
    });

    const amountConfig = this.normalizeAmountForComponent(
      component,
      parseAmountConfig(dto.amountOrFormula),
    );
    if (sameAmountConfig(parseAmountConfig(existing.amountOrFormula), amountConfig)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'The new amount is the same as the current one',
      });
    }

    const effectiveFrom = parseDateOnly(dto.effectiveFrom, 'effectiveFrom');
    if (effectiveFrom <= existing.effectiveFrom) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'A revision must start after the current assignment starts — correct the entry instead',
      });
    }
    if (existing.effectiveTo && effectiveFrom > existing.effectiveTo) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'The revision date is after this assignment ends',
      });
    }

    const { closed, created } = await this.prisma.unscoped.$transaction(async (tx) => {
      const closedRow = await tx.salaryStructure.update({
        where: { id: structureId },
        data: { effectiveTo: addDays(effectiveFrom, -1) },
        include: { component: { select: { name: true, calculationType: true } } },
      });
      const createdRow = await tx.salaryStructure.create({
        data: {
          employeeId,
          componentId: existing.componentId,
          componentType: existing.componentType,
          amountOrFormula: amountConfig as Prisma.InputJsonValue,
          effectiveFrom,
          effectiveTo: existing.effectiveTo,
        },
        include: { component: { select: { name: true, calculationType: true } } },
      });

      await this.auditService.log(
        {
          tenantId: employee.tenantId,
          userId: user.id,
          action: 'update',
          module: 'payroll',
          recordId: closedRow.id,
          oldValue: this.toRecord(existing) as unknown as Record<string, unknown>,
          newValue: this.toRecord(closedRow) as unknown as Record<string, unknown>,
        },
        tx,
      );
      await this.auditService.log(
        {
          tenantId: employee.tenantId,
          userId: user.id,
          action: 'create',
          module: 'payroll',
          recordId: createdRow.id,
          newValue: {
            ...(this.toRecord(createdRow) as unknown as Record<string, unknown>),
            revisedFromStructureId: existing.id,
          },
        },
        tx,
      );
      return { closed: closedRow, created: createdRow };
    });

    return { closed: this.toRecord(closed), created: this.toRecord(created) };
  }

  /** Keeps only the inputs that apply to the component's calculation type. */
  private normalizeAmountForComponent(
    component: Pick<PayComponent, 'name' | 'calculationType' | 'formula'>,
    config: SalaryStructureAmountConfig,
  ): SalaryStructureAmountConfig {
    if (component.calculationType === PayComponentCalculationType.fixed) {
      if (!config.amount) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `"${component.name}" is a fixed component — an amount is required`,
        });
      }
      if (parseMoney(config.amount).isNegative()) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Amount cannot be negative',
        });
      }
      return { amount: parseMoney(config.amount).toFixed(2) };
    }
    if (component.calculationType === PayComponentCalculationType.percentage) {
      const defaults = parseFormulaConfig(component.formula);
      if (config.percentage === undefined && defaults?.percentage === undefined) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `"${component.name}" has no default rate — a percentage is required`,
        });
      }
      return config.percentage === undefined ? {} : { percentage: config.percentage };
    }
    return config;
  }

  private async lockedPeriods(employeeId: string): Promise<LockedPayrollPeriodSummary[]> {
    const runs = await this.prisma.unscoped.payrollRun.findMany({
      where: {
        employeeId,
        deletedAt: null,
        OR: [
          { locked: true },
          { status: { in: [PayrollRunStatus.finalized, PayrollRunStatus.paid] } },
        ],
      },
      select: {
        status: true,
        payrollPeriod: { select: { id: true, startDate: true, endDate: true } },
      },
      orderBy: { payrollPeriod: { startDate: 'asc' } },
    });
    return runs.map((run) => ({
      payrollPeriodId: run.payrollPeriod.id,
      startDate: formatDateOnly(run.payrollPeriod.startDate),
      endDate: formatDateOnly(run.payrollPeriod.endDate),
      runStatus: run.status,
    }));
  }

  /** In-place edits must not alter pay for finalized periods (PAYROLL_LOGIC.md §7, §11). */
  private async assertRangesUnlocked(
    employeeId: string,
    ranges: DateRange[],
  ): Promise<void> {
    if (ranges.length === 0) return;
    const periods = await this.lockedPeriods(employeeId);
    const hit = periods.find((period) =>
      ranges.some((range) =>
        rangesOverlap(
          range.from,
          range.to,
          parseDateOnly(period.startDate),
          parseDateOnly(period.endDate),
        ),
      ),
    );
    if (hit) {
      throw new ConflictException({
        code: 'PAYROLL_PERIOD_LOCKED',
        message: `Payroll for ${hit.startDate} – ${hit.endDate} is finalized. Record the change as a revision with a new effective date instead of editing history.`,
      });
    }
  }

  private async assertNoOverlap(
    employeeId: string,
    componentId: string,
    effectiveFrom: Date,
    effectiveTo: Date | null,
    excludeId?: string,
  ): Promise<void> {
    const siblings = await this.prisma.unscoped.salaryStructure.findMany({
      where: {
        employeeId,
        componentId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    for (const row of siblings) {
      if (
        rangesOverlap(
          effectiveFrom,
          effectiveTo,
          row.effectiveFrom,
          row.effectiveTo,
        )
      ) {
        throw new ConflictException({
          code: 'CONFLICT',
          message:
            'Salary structure dates overlap an existing assignment for this component',
        });
      }
    }
  }

  private async findOrThrow(employeeId: string, structureId: string) {
    const row = await this.prisma.unscoped.salaryStructure.findFirst({
      where: { id: structureId, employeeId },
      include: { component: { select: { name: true, calculationType: true } } },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Salary structure not found',
      });
    }
    return row;
  }

  private async assertEmployee(employeeId: string) {
    const row = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
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

  private toRecord(
    row: SalaryStructure & {
      component?: { name: string; calculationType: PayComponentCalculationType };
    },
  ): SalaryStructureRecord {
    return {
      id: row.id,
      employeeId: row.employeeId,
      componentType: row.componentType,
      componentId: row.componentId,
      componentName: row.component?.name,
      componentCalculationType: row.component?.calculationType,
      amountOrFormula: parseAmountConfig(row.amountOrFormula),
      effectiveFrom: formatDateOnly(row.effectiveFrom),
      effectiveTo: row.effectiveTo ? formatDateOnly(row.effectiveTo) : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
