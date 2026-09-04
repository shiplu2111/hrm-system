import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  PayrollCalculationPreview,
  PayrollSalaryStructureOverride,
  PayrollSimulationResult,
} from '@hrm/shared-types';
import { computePayrollFromStructures } from './payroll-calculation.core';
import {
  applySalaryStructureOverrides,
  computePayrollDelta,
  type StructureRow,
} from './payroll-calculation.helpers';
import { PrismaService } from '../database/prisma.service';
import { PayrollContextService } from './payroll-context.service';
import {
  formatDateOnly,
  isEffectiveOn,
  parseDateOnly,
} from './payroll.utils';

export interface PayrollComputeOptions {
  employeeId: string;
  asOf?: string;
  structureOverrides?: PayrollSalaryStructureOverride[];
}

@Injectable()
export class PayrollCalculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payrollContext: PayrollContextService,
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
    const baseline = await this.compute({
      employeeId: options.employeeId,
      asOf: options.asOf,
    });
    const simulated = await this.compute(options);

    return {
      employeeId: options.employeeId,
      asOfDate: baseline.asOfDate,
      baseline,
      simulated,
      delta: computePayrollDelta(baseline, simulated),
    };
  }

  async compute(
    options: PayrollComputeOptions,
  ): Promise<PayrollCalculationPreview> {
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

    const active = applySalaryStructureOverrides(
      structures.filter((row) =>
        isEffectiveOn(row.effectiveFrom, row.effectiveTo, asOfDate),
      ),
      structureOverrides,
    );

    return this.computeFromStructures(
      employeeId,
      employee.companyId,
      asOfDate,
      active,
    );
  }

  private async computeFromStructures(
    employeeId: string,
    companyId: string,
    asOfDate: Date,
    active: StructureRow[],
  ): Promise<PayrollCalculationPreview> {
    return computePayrollFromStructures({
      employeeId,
      companyId,
      asOfDate,
      active,
      buildContext: (opts) => this.payrollContext.buildContext(opts),
    });
  }
}
