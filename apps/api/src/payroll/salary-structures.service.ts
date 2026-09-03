import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PayComponentCalculationType,
  Prisma,
  type SalaryStructure,
} from '@prisma/client';
import type { SalaryStructureRecord } from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type {
  CreateSalaryStructureDto,
  UpdateSalaryStructureDto,
} from './dto/salary-structures.dto';
import {
  formatDateOnly,
  parseAmountConfig,
  parseDateOnly,
  rangesOverlap,
} from './payroll.utils';

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
    const amountConfig = parseAmountConfig(dto.amountOrFormula ?? {});
    this.validateAmountForComponent(component.calculationType, amountConfig);

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

    const amountConfig =
      dto.amountOrFormula !== undefined
        ? parseAmountConfig(dto.amountOrFormula)
        : parseAmountConfig(existing.amountOrFormula);
    if (dto.amountOrFormula !== undefined) {
      this.validateAmountForComponent(component.calculationType, amountConfig);
    }

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

  private validateAmountForComponent(
    calculationType: PayComponentCalculationType,
    config: ReturnType<typeof parseAmountConfig>,
  ): void {
    if (calculationType === PayComponentCalculationType.fixed) {
      if (!config.amount) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Fixed components require amountOrFormula.amount',
        });
      }
      return;
    }
    if (calculationType === PayComponentCalculationType.percentage) {
      if (config.percentage === undefined) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message:
            'Percentage components require amountOrFormula.percentage (or a default on the pay component)',
        });
      }
      return;
    }
    if (calculationType === PayComponentCalculationType.formula) {
      return;
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
