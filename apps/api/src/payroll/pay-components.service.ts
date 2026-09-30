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
import type { PayComponentRecord, PayComponentUsage } from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreatePayComponentDto,
  UpdatePayComponentDto,
} from './dto/pay-components.dto';
import {
  formatDateOnly,
  parseDateOnly,
  parseFormulaConfig,
  parsePayComponentFormula,
} from './payroll.utils';
import {
  PayFormulaValidationError,
  parsePayFormulaRule,
} from './formula/formula-validator';

@Injectable()
export class PayComponentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
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
      const row = await this.prisma.unscoped.payComponent.create({
        data: {
          companyId,
          name: dto.name.trim(),
          type: dto.type,
          calculationType: dto.calculationType,
          formula: (formula ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
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

    const row = await this.prisma.unscoped.payComponent.update({
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

    await this.prisma.unscoped.payComponent.delete({ where: { id: componentId } });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'delete',
      module: 'payroll',
      recordId: componentId,
      oldValue: this.toRecord(existing) as unknown as Record<string, unknown>,
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
