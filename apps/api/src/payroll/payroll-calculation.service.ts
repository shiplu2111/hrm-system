import { Injectable, NotFoundException } from '@nestjs/common';
import type { PayComponentCalculationType, Prisma } from '@prisma/client';
import type {
  PayrollAttendanceOverride,
  PayrollCalculationPreview,
  PayrollSalaryStructureOverride,
  PayrollSimulationAttendance,
  PayrollSimulationResult,
} from '@hrm/shared-types';
import { computePayrollFromStructures } from './payroll-calculation.core';
import {
  applyAttendanceOverride,
  applySalaryStructureOverrides,
  buildHypotheticalStructureRows,
  computePayrollDelta,
  summarizeAttendance,
} from './payroll-calculation.helpers';
import { PrismaService } from '../database/prisma.service';
import { PayrollContextService } from './payroll-context.service';
import { SuperannuationPayrollService } from './superannuation-payroll.service';
import {
  formatDateOnly,
  isEffectiveOn,
  parseDateOnly,
} from './payroll.utils';

export interface PayrollComputeOptions {
  employeeId: string;
  asOf?: string;
  structureOverrides?: PayrollSalaryStructureOverride[];
  /** Hypothetical component rules; callers must validate the formula first. */
  componentOverrides?: Array<{
    componentId: string;
    calculationType: PayComponentCalculationType;
    formula: Prisma.JsonValue | null;
  }>;
  attendanceOverride?: PayrollAttendanceOverride;
}

@Injectable()
export class PayrollCalculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payrollContext: PayrollContextService,
    private readonly superannuationPayroll: SuperannuationPayrollService,
  ) {}

  /**
   * Gross → Deductions → Net preview (PAYROLL_LOGIC.md §6).
   * Supports fixed, percentage, and sandboxed formula components (§5).
   */
  async preview(
    employeeId: string,
    asOf?: string,
  ): Promise<PayrollCalculationPreview> {
    return this.compute({ employeeId, asOf });
  }

  /** What-if mode — no payroll_run writes (PAYROLL_LOGIC.md §8). */
  async simulate(
    options: PayrollComputeOptions,
  ): Promise<PayrollSimulationResult> {
    const baseline = await this.computeDetailed({
      employeeId: options.employeeId,
      asOf: options.asOf,
    });
    const simulated = await this.computeDetailed(options);

    return {
      employeeId: options.employeeId,
      asOfDate: baseline.preview.asOfDate,
      baseline: baseline.preview,
      simulated: simulated.preview,
      delta: computePayrollDelta(baseline.preview, simulated.preview),
      attendance: { baseline: baseline.attendance, simulated: simulated.attendance },
    };
  }

  async compute(
    options: PayrollComputeOptions,
  ): Promise<PayrollCalculationPreview> {
    return (await this.computeDetailed(options)).preview;
  }

  private async computeDetailed(
    options: PayrollComputeOptions,
  ): Promise<{ preview: PayrollCalculationPreview; attendance: PayrollSimulationAttendance | null }> {
    const { employeeId, asOf, structureOverrides } = options;

    const employee = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true, companyId: true },
    });
    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const asOfDate = asOf
      ? parseDateOnly(asOf, 'asOf')
      : new Date(formatDateOnly(new Date()) + 'T00:00:00.000Z');

    const structures = await this.prisma.unscoped.salaryStructure.findMany({
      where: { employeeId },
      include: { component: true },
    });

    const effective = structures.filter((row) =>
      isEffectiveOn(row.effectiveFrom, row.effectiveTo, asOfDate),
    );
    const addedComponentIds = (structureOverrides ?? [])
      .filter((o) => o.componentId && !o.salaryStructureId && !o.remove)
      .map((o) => o.componentId as string);
    const addedComponents = addedComponentIds.length
      ? await this.prisma.unscoped.payComponent.findMany({
          where: { id: { in: addedComponentIds }, companyId: employee.companyId },
        })
      : [];
    const hypothetical = buildHypotheticalStructureRows(
      employeeId,
      asOfDate,
      effective,
      addedComponents,
      structureOverrides,
    );

    const active = applySalaryStructureOverrides(
      [...effective, ...hypothetical],
      structureOverrides,
    ).map((row) => {
      const rule = options.componentOverrides?.find((o) => o.componentId === row.componentId);
      return rule
        ? {
            ...row,
            component: {
              ...row.component,
              calculationType: rule.calculationType,
              formula: rule.formula,
            },
          }
        : row;
    });

    const superannuationRates =
      await this.superannuationPayroll.resolveRatesForEmployee(
        employeeId,
        asOfDate,
      );

    let attendance: PayrollSimulationAttendance | null = null;
    const preview = await computePayrollFromStructures({
      employeeId,
      companyId: employee.companyId,
      asOfDate,
      active,
      buildContext: async (opts) => {
        const context = applyAttendanceOverride(
          await this.payrollContext.buildContext(opts),
          options.attendanceOverride,
        );
        attendance = summarizeAttendance(context, opts.period);
        return context;
      },
      superannuationRates,
    });
    return { preview, attendance };
  }
}
