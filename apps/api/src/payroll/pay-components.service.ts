import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PayComponentCalculationType,
  Prisma,
  type PayComponent,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type {
  PayComponentImpactEmployee,
  PayComponentImpactFailure,
  PayComponentImpactResult,
  PayComponentRecord,
  PayComponentUsage,
  PayrollTotals,
} from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreatePayComponentDto,
  PayComponentImpactDto,
  UpdatePayComponentDto,
} from './dto/pay-components.dto';
import {
  formatDateOnly,
  formatMoney,
  parseDateOnly,
  parseFormulaConfig,
  parseMoney,
  parsePayComponentFormula,
} from './payroll.utils';
import {
  PayFormulaValidationError,
  parsePayFormulaRule,
} from './formula/formula-validator';
import { computePayrollDelta } from './payroll-calculation.helpers';
import { PayrollCalculationService } from './payroll-calculation.service';

const ZERO = new Decimal(0);
/** Keeps a company-wide preview from flooding the connection pool. */
const IMPACT_CONCURRENCY = 4;

function pickTotals(preview: PayrollTotals): PayrollTotals {
  return {
    grossPay: preview.grossPay,
    totalDeductions: preview.totalDeductions,
    netPay: preview.netPay,
  };
}

function toTotals(sum: { gross: Decimal; deductions: Decimal; net: Decimal }): PayrollTotals {
  return {
    grossPay: formatMoney(sum.gross),
    totalDeductions: formatMoney(sum.deductions),
    netPay: formatMoney(sum.net),
  };
}

@Injectable()
export class PayComponentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly payrollCalculation: PayrollCalculationService,
  ) {}

  async list(companyId: string): Promise<PayComponentRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const rows = await this.prisma.unscoped.payComponent.findMany({
      where: { companyId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    const usage = await this.usageByComponent(rows.map((row) => row.id));
    return rows.map((row) => ({
      ...this.toRecord(row),
      usage: usage.get(row.id) ?? { activeEmployeeCount: 0, assignmentCount: 0 },
    }));
  }

  private async usageByComponent(
    componentIds: string[],
  ): Promise<Map<string, PayComponentUsage>> {
    const result = new Map<string, PayComponentUsage>();
    if (componentIds.length === 0) return result;

    const today = parseDateOnly(formatDateOnly(new Date()));
    const assignments = await this.prisma.unscoped.salaryStructure.findMany({
      where: { componentId: { in: componentIds } },
      select: { componentId: true, employeeId: true, effectiveTo: true },
    });

    const activeEmployees = new Map<string, Set<string>>();
    for (const row of assignments) {
      const entry = result.get(row.componentId) ?? {
        activeEmployeeCount: 0,
        assignmentCount: 0,
      };
      entry.assignmentCount += 1;
      result.set(row.componentId, entry);
      if (!row.effectiveTo || row.effectiveTo >= today) {
        const set = activeEmployees.get(row.componentId) ?? new Set<string>();
        set.add(row.employeeId);
        activeEmployees.set(row.componentId, set);
      }
    }
    for (const [componentId, employees] of activeEmployees) {
      const entry = result.get(componentId);
      if (entry) entry.activeEmployeeCount = employees.size;
    }
    return result;
  }

  private async assertNameAvailable(
    companyId: string,
    type: PayComponent['type'],
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const clash = await this.prisma.unscoped.payComponent.findFirst({
      where: {
        companyId,
        type,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `A ${type} component named "${name}" already exists`,
      });
    }
  }

  async create(
    companyId: string,
    dto: CreatePayComponentDto,
    user: AuthenticatedUser,
  ): Promise<PayComponentRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    this.assertSupportedCalculationType(dto.calculationType);
    const formula = this.buildFormula(dto.calculationType, dto.formula);
    await this.assertNameAvailable(companyId, dto.type, dto.name.trim());

    try {
      const row = await this.prisma.unscoped.$transaction(async (tx) => {
        const created = await tx.payComponent.create({
          data: {
            companyId,
            name: dto.name.trim(),
            type: dto.type,
            calculationType: dto.calculationType,
            formula: (formula ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          },
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

      return this.toRecord(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Pay component with this name already exists',
        });
      }
      throw error;
    }
  }

  async update(
    companyId: string,
    componentId: string,
    dto: UpdatePayComponentDto,
    user: AuthenticatedUser,
  ): Promise<PayComponentRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.findOrThrow(companyId, componentId);
    const nextType = dto.calculationType ?? existing.calculationType;
    this.assertSupportedCalculationType(nextType);

    if (nextType !== existing.calculationType) {
      const usage = await this.prisma.unscoped.salaryStructure.count({
        where: { componentId },
      });
      if (usage > 0) {
        throw new ConflictException({
          code: 'CONFLICT',
          message:
            'Calculation type cannot change while the component is assigned to employees — create a new component instead',
        });
      }
    }
    if (dto.name !== undefined) {
      await this.assertNameAvailable(
        companyId,
        existing.type,
        dto.name.trim(),
        componentId,
      );
    }

    const typeChanged = nextType !== existing.calculationType;
    const formulaTouched = dto.formula !== undefined || typeChanged;
    const formula = formulaTouched
      ? this.buildFormula(nextType, dto.formula ?? undefined)
      : (existing.formula as Prisma.JsonValue | null);

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      const updated = await tx.payComponent.update({
        where: { id: componentId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.calculationType !== undefined
            ? { calculationType: dto.calculationType }
            : {}),
          ...(formulaTouched
            ? { formula: (formula ?? Prisma.JsonNull) as Prisma.InputJsonValue }
            : {}),
        },
      });
      await this.auditService.log(
        {
          tenantId: company.tenantId,
          userId: user.id,
          action: 'update',
          module: 'payroll',
          recordId: updated.id,
          oldValue: this.toRecord(existing) as unknown as Record<string, unknown>,
          newValue: this.toRecord(updated) as unknown as Record<string, unknown>,
        },
        tx,
      );
      return updated;
    });

    return this.toRecord(row);
  }

  /**
   * Company-wide what-if for a rule change: every employee with an effective
   * assignment is recalculated with and without the proposed rule. Read-only.
   */
  async impact(
    companyId: string,
    componentId: string,
    dto: PayComponentImpactDto,
  ): Promise<PayComponentImpactResult> {
    const existing = await this.findOrThrow(companyId, componentId);
    const nextType = dto.calculationType ?? existing.calculationType;
    const typeChanged = nextType !== existing.calculationType;
    if (typeChanged) {
      const usage = await this.prisma.unscoped.salaryStructure.count({
        where: { componentId },
      });
      if (usage > 0) {
        throw new ConflictException({
          code: 'CONFLICT',
          message:
            'Calculation type cannot change while the component is assigned to employees — create a new component instead',
        });
      }
    }
    const formula =
      dto.formula !== undefined || typeChanged
        ? this.buildFormula(nextType, dto.formula ?? undefined)
        : (existing.formula as Prisma.JsonValue | null);

    const asOfDate = dto.asOf
      ? parseDateOnly(dto.asOf, 'asOf')
      : parseDateOnly(formatDateOnly(new Date()));
    const asOf = formatDateOnly(asOfDate);

    const assignments = await this.prisma.unscoped.salaryStructure.findMany({
      where: {
        componentId,
        effectiveFrom: { lte: asOfDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
        employee: { deletedAt: null },
      },
      select: {
        employee: {
          select: { id: true, employeeNumber: true, firstName: true, lastName: true },
        },
      },
    });
    const employees = [
      ...new Map(assignments.map((a) => [a.employee.id, a.employee])).values(),
    ].sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber));

    const override = [
      { componentId, calculationType: nextType, formula: formula as Prisma.JsonValue | null },
    ];
    const rows: PayComponentImpactEmployee[] = [];
    const failures: PayComponentImpactFailure[] = [];
    const totals = {
      baseline: { gross: ZERO, deductions: ZERO, net: ZERO },
      simulated: { gross: ZERO, deductions: ZERO, net: ZERO },
    };
    let baseCurrency: string | null = null;

    const queue = [...employees];
    const worker = async () => {
      for (let employee = queue.shift(); employee; employee = queue.shift()) {
        const identity = {
          employeeId: employee.id,
          employeeNumber: employee.employeeNumber,
          fullName: `${employee.firstName} ${employee.lastName}`.trim(),
        };
        try {
          const result = await this.payrollCalculation.simulate({
            employeeId: employee.id,
            asOf,
            componentOverrides: override,
          });
          baseCurrency ??= result.baseline.currency?.baseCurrency ?? null;
          for (const side of ['baseline', 'simulated'] as const) {
            const preview = result[side];
            const fx = preview.currency;
            totals[side].gross = totals[side].gross.plus(
              parseMoney(fx?.grossPayBase ?? preview.grossPay),
            );
            totals[side].deductions = totals[side].deductions.plus(
              parseMoney(fx?.totalDeductionsBase ?? preview.totalDeductions),
            );
            totals[side].net = totals[side].net.plus(
              parseMoney(fx?.netPayBase ?? preview.netPay),
            );
          }
          rows.push({
            ...identity,
            payCurrency: result.baseline.currency?.payCurrency ?? null,
            baseline: pickTotals(result.baseline),
            simulated: pickTotals(result.simulated),
            delta: result.delta,
          });
        } catch (error) {
          failures.push({
            ...identity,
            message: error instanceof Error ? error.message : 'Calculation failed',
          });
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(IMPACT_CONCURRENCY, employees.length) }, worker),
    );

    rows.sort((a, b) => {
      const diff = parseMoney(b.delta.netPay).abs().comparedTo(parseMoney(a.delta.netPay).abs());
      return diff !== 0 ? diff : a.employeeNumber.localeCompare(b.employeeNumber);
    });
    failures.sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber));

    const baseline = toTotals(totals.baseline);
    const simulated = toTotals(totals.simulated);
    return {
      componentId,
      asOfDate: asOf,
      employeeCount: employees.length,
      baseCurrency,
      baseline,
      simulated,
      delta: computePayrollDelta(baseline, simulated),
      employees: rows,
      failures,
    };
  }

  async remove(
    companyId: string,
    componentId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const existing = await this.findOrThrow(companyId, componentId);

    const usage = await this.prisma.unscoped.salaryStructure.count({
      where: { componentId },
    });
    if (usage > 0) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Pay component is assigned to employees and cannot be deleted',
      });
    }

    await this.prisma.unscoped.$transaction(async (tx) => {
      await tx.payComponent.delete({ where: { id: componentId } });
      await this.auditService.log(
        {
          tenantId: company.tenantId,
          userId: user.id,
          action: 'delete',
          module: 'payroll',
          recordId: componentId,
          oldValue: this.toRecord(existing) as unknown as Record<string, unknown>,
        },
        tx,
      );
    });
  }

  private assertSupportedCalculationType(type: PayComponentCalculationType): void {
    if (type === PayComponentCalculationType.formula) {
      return;
    }
    if (type === PayComponentCalculationType.percentage) {
      return;
    }
  }

  private buildFormula(
    calculationType: PayComponentCalculationType,
    formula?: Record<string, unknown>,
  ) {
    if (calculationType === PayComponentCalculationType.fixed) {
      return null;
    }
    if (calculationType === PayComponentCalculationType.formula) {
      if (!formula) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Formula components require a structured formula rule (version: 1)',
        });
      }
      try {
        return parsePayFormulaRule(formula);
      } catch (error) {
        if (error instanceof PayFormulaValidationError) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: error.message,
          });
        }
        throw error;
      }
    }
    const parsed = parseFormulaConfig(formula ?? { base: 'basic' });
    if (!parsed?.base) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Percentage components require formula.base (basic or gross)',
      });
    }
    return parsed;
  }

  private async findOrThrow(companyId: string, componentId: string) {
    await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.prisma.unscoped.payComponent.findFirst({
      where: { id: componentId, companyId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Pay component not found',
      });
    }
    return row;
  }

  private toRecord(row: PayComponent): PayComponentRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      type: row.type,
      calculationType: row.calculationType,
      formula: parsePayComponentFormula(row.formula),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
