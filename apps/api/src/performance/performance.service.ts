import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeKpiAssignmentStatus,
  PerformanceReviewCycleStatus,
  EmployeePerformanceReviewStatus,
  Prisma,
  type EmployeeKpiAssignment,
  type KpiDefinition,
  type PerformanceReviewCycle,
} from '@prisma/client';
import type {
  EmployeeKpiAssignmentRecord,
  KpiDefinitionRecord,
  PerformanceGoalsSummary,
  PerformanceReviewCycleRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  BulkAssignKpiDto,
  CreateEmployeeKpiAssignmentDto,
  CreateKpiDefinitionDto,
  CreatePerformanceReviewCycleDto,
  ListEmployeeKpiAssignmentsQueryDto,
  ListKpiDefinitionsQueryDto,
  UpdateEmployeeKpiAssignmentDto,
  UpdateKpiDefinitionDto,
  UpdatePerformanceReviewCycleDto,
} from './dto/performance.dto';
import {
  assertDateRange,
  assertWithinCycle,
  computeKpiProgressPercent,
  decimalToNumber,
  formatDateOnly,
  parseDateOnly,
  toDecimal,
} from './performance.utils';

type CycleWithCounts = PerformanceReviewCycle & {
  _count: {
    kpiAssignments: number;
    participants: number;
    reviews: number;
  };
  kpiAssignments: { status: EmployeeKpiAssignmentStatus }[];
  reviews: { status: EmployeePerformanceReviewStatus }[];
};

type DefinitionWithCounts = KpiDefinition & {
  _count: { assignments: number };
};

type AssignmentWithRelations = EmployeeKpiAssignment & {
  employee: { firstName: string; lastName: string; employeeNumber: string };
  reviewCycle: { name: string };
  kpiDefinition: { name: string } | null;
};

@Injectable()
export class PerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async getGoalsSummary(companyId: string): Promise<PerformanceGoalsSummary> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const [activeCycleRow, kpiDefinitionCount, assignments] = await Promise.all([
      this.prisma.unscoped.performanceReviewCycle.findFirst({
        where: { companyId, status: PerformanceReviewCycleStatus.active },
        include: {
          _count: {
            select: { kpiAssignments: true, participants: true, reviews: true },
          },
          kpiAssignments: { select: { status: true } },
          reviews: { select: { status: true } },
        },
        orderBy: { periodStart: 'desc' },
      }),
      this.prisma.unscoped.kpiDefinition.count({
        where: { companyId, isActive: true },
      }),
      this.prisma.unscoped.employeeKpiAssignment.findMany({
        where: {
          companyId,
          status: EmployeeKpiAssignmentStatus.active,
        },
        select: {
          targetValue: true,
          currentValue: true,
          direction: true,
        },
      }),
    ]);

    const progressValues = assignments
      .map((row) =>
        computeKpiProgressPercent(
          decimalToNumber(row.targetValue) ?? 0,
          decimalToNumber(row.currentValue),
          row.direction,
        ),
      )
      .filter((value): value is number => value != null);

    const onTrackCount = progressValues.filter((value) => value >= 65).length;
    const atRiskCount = progressValues.length - onTrackCount;

    return {
      activeCycle: activeCycleRow
        ? this.toCycleRecord(activeCycleRow as CycleWithCounts)
        : null,
      kpiDefinitionCount,
      activeAssignmentCount: assignments.length,
      onTrackCount,
      atRiskCount,
      averageProgressPercent:
        progressValues.length > 0
          ? Math.round(
              progressValues.reduce((sum, value) => sum + value, 0) /
                progressValues.length,
            )
          : null,
    };
  }

  async listReviewCycles(companyId: string): Promise<PerformanceReviewCycleRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.performanceReviewCycle.findMany({
      where: { companyId },
      include: {
        _count: {
          select: { kpiAssignments: true, participants: true, reviews: true },
        },
        kpiAssignments: { select: { status: true } },
        reviews: { select: { status: true } },
      },
      orderBy: [{ periodStart: 'desc' }, { name: 'asc' }],
    });

    return rows.map((row) => this.toCycleRecord(row as CycleWithCounts));
  }

  async createReviewCycle(
    companyId: string,
    dto: CreatePerformanceReviewCycleDto,
    user: AuthenticatedUser,
  ): Promise<PerformanceReviewCycleRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const periodStart = parseDateOnly(dto.periodStart, 'periodStart');
    const periodEnd = parseDateOnly(dto.periodEnd, 'periodEnd');
    const reviewDueDate = parseDateOnly(dto.reviewDueDate, 'reviewDueDate');
    assertDateRange(periodStart, periodEnd, 'Review cycle period');

    const row = await this.prisma.unscoped.performanceReviewCycle.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        periodStart,
        periodEnd,
        measurementPeriod: dto.measurementPeriod,
        reviewDueDate,
        status: dto.status ?? PerformanceReviewCycleStatus.draft,
        requiresWorkflowApproval: dto.requiresWorkflowApproval ?? true,
        createdByUserId: user.id,
      },
      include: {
        _count: {
          select: { kpiAssignments: true, participants: true, reviews: true },
        },
        kpiAssignments: { select: { status: true } },
        reviews: { select: { status: true } },
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'performance',
      recordId: row.id,
      newValue: { name: row.name, status: row.status },
    });

    return this.toCycleRecord(row as CycleWithCounts);
  }

  async updateReviewCycle(
    cycleId: string,
    dto: UpdatePerformanceReviewCycleDto,
    user: AuthenticatedUser,
  ): Promise<PerformanceReviewCycleRecord> {
    const existing = await this.getCycleOrThrow(cycleId);
    const periodStart = dto.periodStart
      ? parseDateOnly(dto.periodStart, 'periodStart')
      : existing.periodStart;
    const periodEnd = dto.periodEnd
      ? parseDateOnly(dto.periodEnd, 'periodEnd')
      : existing.periodEnd;
    assertDateRange(periodStart, periodEnd, 'Review cycle period');

    const row = await this.prisma.unscoped.performanceReviewCycle.update({
      where: { id: cycleId },
      data: {
        name: dto.name?.trim(),
        description: dto.description !== undefined ? dto.description?.trim() ?? null : undefined,
        periodStart,
        periodEnd,
        measurementPeriod: dto.measurementPeriod,
        reviewDueDate: dto.reviewDueDate
          ? parseDateOnly(dto.reviewDueDate, 'reviewDueDate')
          : undefined,
        status: dto.status,
        requiresWorkflowApproval: dto.requiresWorkflowApproval,
      },
      include: {
        _count: {
          select: { kpiAssignments: true, participants: true, reviews: true },
        },
        kpiAssignments: { select: { status: true } },
        reviews: { select: { status: true } },
      },
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'performance',
      recordId: row.id,
      oldValue: { status: existing.status },
      newValue: { status: row.status },
    });

    return this.toCycleRecord(row as CycleWithCounts);
  }

  async listKpiDefinitions(
    companyId: string,
    query: ListKpiDefinitionsQueryDto,
  ): Promise<KpiDefinitionRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.kpiDefinition.findMany({
      where: {
        companyId,
        ...(query.activeOnly ? { isActive: true } : {}),
      },
      include: { _count: { select: { assignments: true } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    return rows.map((row) => this.toDefinitionRecord(row as DefinitionWithCounts));
  }

  async createKpiDefinition(
    companyId: string,
    dto: CreateKpiDefinitionDto,
    user: AuthenticatedUser,
  ): Promise<KpiDefinitionRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    try {
      const row = await this.prisma.unscoped.kpiDefinition.create({
        data: {
          tenantId: company.tenantId,
          companyId,
          name: dto.name.trim(),
          description: dto.description?.trim() ?? null,
          category: dto.category?.trim() ?? null,
          unit: dto.unit,
          direction: dto.direction ?? 'higher_is_better',
          defaultTargetValue: toDecimal(dto.defaultTargetValue),
          createdByUserId: user.id,
        },
        include: { _count: { select: { assignments: true } } },
      });

      await this.auditService.log({
        tenantId: company.tenantId,
        userId: user.id,
        action: 'create',
        module: 'performance',
        recordId: row.id,
        newValue: { name: row.name, unit: row.unit },
      });

      return this.toDefinitionRecord(row as DefinitionWithCounts);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'DUPLICATE_KPI',
          message: 'A KPI with this name already exists for the company',
        });
      }
      throw error;
    }
  }

  async updateKpiDefinition(
    definitionId: string,
    dto: UpdateKpiDefinitionDto,
    user: AuthenticatedUser,
  ): Promise<KpiDefinitionRecord> {
    const existing = await this.getDefinitionOrThrow(definitionId);

    try {
      const row = await this.prisma.unscoped.kpiDefinition.update({
        where: { id: definitionId },
        data: {
          name: dto.name?.trim(),
          description: dto.description !== undefined ? dto.description?.trim() ?? null : undefined,
          category: dto.category !== undefined ? dto.category?.trim() ?? null : undefined,
          unit: dto.unit,
          direction: dto.direction,
          defaultTargetValue:
            dto.defaultTargetValue !== undefined
              ? toDecimal(dto.defaultTargetValue)
              : undefined,
          isActive: dto.isActive,
        },
        include: { _count: { select: { assignments: true } } },
      });

      await this.auditService.log({
        tenantId: existing.tenantId,
        userId: user.id,
        action: 'update',
        module: 'performance',
        recordId: row.id,
        oldValue: { isActive: existing.isActive },
        newValue: { isActive: row.isActive },
      });

      return this.toDefinitionRecord(row as DefinitionWithCounts);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'DUPLICATE_KPI',
          message: 'A KPI with this name already exists for the company',
        });
      }
      throw error;
    }
  }

  async listKpiAssignments(
    companyId: string,
    query: ListEmployeeKpiAssignmentsQueryDto,
  ): Promise<EmployeeKpiAssignmentRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.employeeKpiAssignment.findMany({
      where: {
        companyId,
        reviewCycleId: query.reviewCycleId,
        employeeId: query.employeeId,
        kpiDefinitionId: query.kpiDefinitionId,
        status: query.status,
      },
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeNumber: true },
        },
        reviewCycle: { select: { name: true } },
        kpiDefinition: { select: { name: true } },
      },
      orderBy: [{ measurementPeriodEnd: 'asc' }, { title: 'asc' }],
    });

    return rows.map((row) => this.toAssignmentRecord(row as AssignmentWithRelations));
  }

  async createKpiAssignment(
    companyId: string,
    dto: CreateEmployeeKpiAssignmentDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeKpiAssignmentRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const cycle = await this.getCycleOrThrow(dto.reviewCycleId);
    if (cycle.companyId !== companyId) {
      throw new NotFoundException('Review cycle not found');
    }

    await this.assertEmployeeInCompany(dto.employeeId, companyId);

    let definition: KpiDefinition | null = null;
    if (dto.kpiDefinitionId) {
      definition = await this.getDefinitionOrThrow(dto.kpiDefinitionId);
      if (definition.companyId !== companyId) {
        throw new NotFoundException('KPI definition not found');
      }
    }

    const measurementPeriodStart = dto.measurementPeriodStart
      ? parseDateOnly(dto.measurementPeriodStart, 'measurementPeriodStart')
      : cycle.periodStart;
    const measurementPeriodEnd = dto.measurementPeriodEnd
      ? parseDateOnly(dto.measurementPeriodEnd, 'measurementPeriodEnd')
      : cycle.periodEnd;
    assertDateRange(measurementPeriodStart, measurementPeriodEnd, 'Measurement period');
    assertWithinCycle(measurementPeriodStart, cycle.periodStart, cycle.periodEnd, 'Measurement period start');
    assertWithinCycle(measurementPeriodEnd, cycle.periodStart, cycle.periodEnd, 'Measurement period end');

    const row = await this.prisma.unscoped.employeeKpiAssignment.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        reviewCycleId: cycle.id,
        kpiDefinitionId: definition?.id ?? null,
        employeeId: dto.employeeId,
        assignedByUserId: user.id,
        title: (dto.title ?? definition?.name ?? 'KPI Goal').trim(),
        description: dto.description?.trim() ?? definition?.description ?? null,
        unit: dto.unit ?? definition?.unit ?? 'count',
        direction: dto.direction ?? definition?.direction ?? 'higher_is_better',
        targetValue: toDecimal(dto.targetValue)!,
        currentValue: toDecimal(dto.currentValue),
        measurementPeriod: dto.measurementPeriod ?? cycle.measurementPeriod,
        measurementPeriodStart,
        measurementPeriodEnd,
        weightPercent: toDecimal(dto.weightPercent),
        status: dto.status ?? EmployeeKpiAssignmentStatus.active,
        notes: dto.notes?.trim() ?? null,
      },
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeNumber: true },
        },
        reviewCycle: { select: { name: true } },
        kpiDefinition: { select: { name: true } },
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'performance',
      recordId: row.id,
      newValue: {
        employeeId: row.employeeId,
        title: row.title,
        targetValue: decimalToNumber(row.targetValue),
      },
    });

    return this.toAssignmentRecord(row as AssignmentWithRelations);
  }

  async bulkAssignKpi(
    companyId: string,
    dto: BulkAssignKpiDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeKpiAssignmentRecord[]> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const cycle = await this.getCycleOrThrow(dto.reviewCycleId);
    if (cycle.companyId !== companyId) {
      throw new NotFoundException('Review cycle not found');
    }

    const definition = await this.getDefinitionOrThrow(dto.kpiDefinitionId);
    if (definition.companyId !== companyId || !definition.isActive) {
      throw new BadRequestException({
        code: 'INVALID_KPI',
        message: 'KPI definition is not active for this company',
      });
    }

    const targetValue =
      dto.targetValue ?? decimalToNumber(definition.defaultTargetValue);
    if (targetValue == null || targetValue <= 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Target value is required for bulk assignment',
      });
    }

    const measurementPeriodStart = dto.measurementPeriodStart
      ? parseDateOnly(dto.measurementPeriodStart, 'measurementPeriodStart')
      : cycle.periodStart;
    const measurementPeriodEnd = dto.measurementPeriodEnd
      ? parseDateOnly(dto.measurementPeriodEnd, 'measurementPeriodEnd')
      : cycle.periodEnd;
    assertDateRange(measurementPeriodStart, measurementPeriodEnd, 'Measurement period');
    assertWithinCycle(measurementPeriodStart, cycle.periodStart, cycle.periodEnd, 'Measurement period start');
    assertWithinCycle(measurementPeriodEnd, cycle.periodStart, cycle.periodEnd, 'Measurement period end');

    const uniqueEmployeeIds = [...new Set(dto.employeeIds)];
    for (const employeeId of uniqueEmployeeIds) {
      await this.assertEmployeeInCompany(employeeId, companyId);
    }

    const created = await this.prisma.unscoped.$transaction(async (tx) => {
      const rows: AssignmentWithRelations[] = [];
      for (const employeeId of uniqueEmployeeIds) {
        const existing = await tx.employeeKpiAssignment.findFirst({
          where: {
            reviewCycleId: cycle.id,
            kpiDefinitionId: definition.id,
            employeeId,
            status: { not: EmployeeKpiAssignmentStatus.cancelled },
          },
        });
        if (existing) {
          continue;
        }

        const row = await tx.employeeKpiAssignment.create({
          data: {
            tenantId: company.tenantId,
            companyId,
            reviewCycleId: cycle.id,
            kpiDefinitionId: definition.id,
            employeeId,
            assignedByUserId: user.id,
            title: definition.name,
            description: definition.description,
            unit: definition.unit,
            direction: definition.direction,
            targetValue: toDecimal(targetValue)!,
            measurementPeriod: cycle.measurementPeriod,
            measurementPeriodStart,
            measurementPeriodEnd,
            weightPercent: toDecimal(dto.weightPercent),
            status: EmployeeKpiAssignmentStatus.active,
          },
          include: {
            employee: {
              select: { firstName: true, lastName: true, employeeNumber: true },
            },
            reviewCycle: { select: { name: true } },
            kpiDefinition: { select: { name: true } },
          },
        });
        rows.push(row as AssignmentWithRelations);
      }
      return rows;
    });

    for (const row of created) {
      await this.auditService.log({
        tenantId: company.tenantId,
        userId: user.id,
        action: 'create',
        module: 'performance',
        recordId: row.id,
        newValue: { employeeId: row.employeeId, bulk: true },
      });
    }

    return created.map((row) => this.toAssignmentRecord(row));
  }

  async updateKpiAssignment(
    assignmentId: string,
    dto: UpdateEmployeeKpiAssignmentDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeKpiAssignmentRecord> {
    const existing = await this.getAssignmentOrThrow(assignmentId);
    const cycle = await this.getCycleOrThrow(existing.reviewCycleId);

    const measurementPeriodStart = dto.measurementPeriodStart
      ? parseDateOnly(dto.measurementPeriodStart, 'measurementPeriodStart')
      : existing.measurementPeriodStart;
    const measurementPeriodEnd = dto.measurementPeriodEnd
      ? parseDateOnly(dto.measurementPeriodEnd, 'measurementPeriodEnd')
      : existing.measurementPeriodEnd;
    assertDateRange(measurementPeriodStart, measurementPeriodEnd, 'Measurement period');
    assertWithinCycle(measurementPeriodStart, cycle.periodStart, cycle.periodEnd, 'Measurement period start');
    assertWithinCycle(measurementPeriodEnd, cycle.periodStart, cycle.periodEnd, 'Measurement period end');

    const row = await this.prisma.unscoped.employeeKpiAssignment.update({
      where: { id: assignmentId },
      data: {
        title: dto.title?.trim(),
        description: dto.description !== undefined ? dto.description?.trim() ?? null : undefined,
        targetValue: dto.targetValue !== undefined ? toDecimal(dto.targetValue) : undefined,
        currentValue: dto.currentValue !== undefined ? toDecimal(dto.currentValue) : undefined,
        measurementPeriod: dto.measurementPeriod,
        measurementPeriodStart,
        measurementPeriodEnd,
        weightPercent:
          dto.weightPercent !== undefined ? toDecimal(dto.weightPercent) : undefined,
        notes: dto.notes !== undefined ? dto.notes?.trim() ?? null : undefined,
        status: dto.status,
      },
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeNumber: true },
        },
        reviewCycle: { select: { name: true } },
        kpiDefinition: { select: { name: true } },
      },
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'performance',
      recordId: row.id,
      oldValue: {
        currentValue: decimalToNumber(existing.currentValue),
        status: existing.status,
      },
      newValue: {
        currentValue: decimalToNumber(row.currentValue),
        status: row.status,
      },
    });

    return this.toAssignmentRecord(row as AssignmentWithRelations);
  }

  private async getCycleOrThrow(cycleId: string): Promise<PerformanceReviewCycle> {
    const row = await this.prisma.unscoped.performanceReviewCycle.findUnique({
      where: { id: cycleId },
    });
    if (!row) {
      throw new NotFoundException('Review cycle not found');
    }
    return row;
  }

  private async getDefinitionOrThrow(definitionId: string): Promise<KpiDefinition> {
    const row = await this.prisma.unscoped.kpiDefinition.findUnique({
      where: { id: definitionId },
    });
    if (!row) {
      throw new NotFoundException('KPI definition not found');
    }
    return row;
  }

  private async getAssignmentOrThrow(
    assignmentId: string,
  ): Promise<EmployeeKpiAssignment> {
    const row = await this.prisma.unscoped.employeeKpiAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!row) {
      throw new NotFoundException('KPI assignment not found');
    }
    return row;
  }

  private async assertEmployeeInCompany(
    employeeId: string,
    companyId: string,
  ): Promise<void> {
    const employee = await this.prisma.unscoped.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found in company');
    }
  }

  private toCycleRecord(row: CycleWithCounts): PerformanceReviewCycleRecord {
    const completedAssignmentCount = row.kpiAssignments.filter(
      (assignment) => assignment.status === EmployeeKpiAssignmentStatus.completed,
    ).length;
    const completedReviewCount = row.reviews.filter(
      (review) => review.status === EmployeePerformanceReviewStatus.approved,
    ).length;

    return {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      description: row.description,
      periodStart: formatDateOnly(row.periodStart),
      periodEnd: formatDateOnly(row.periodEnd),
      measurementPeriod: row.measurementPeriod,
      reviewDueDate: formatDateOnly(row.reviewDueDate),
      status: row.status,
      requiresWorkflowApproval: row.requiresWorkflowApproval,
      launchedAt: row.launchedAt?.toISOString() ?? null,
      participantCount: row._count.participants,
      reviewCount: row._count.reviews,
      completedReviewCount,
      assignmentCount: row._count.kpiAssignments,
      completedAssignmentCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDefinitionRecord(row: DefinitionWithCounts): KpiDefinitionRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      description: row.description,
      category: row.category,
      unit: row.unit,
      direction: row.direction,
      defaultTargetValue: decimalToNumber(row.defaultTargetValue),
      isActive: row.isActive,
      assignmentCount: row._count.assignments,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toAssignmentRecord(
    row: AssignmentWithRelations,
  ): EmployeeKpiAssignmentRecord {
    const targetValue = decimalToNumber(row.targetValue) ?? 0;
    const currentValue = decimalToNumber(row.currentValue);

    return {
      id: row.id,
      companyId: row.companyId,
      reviewCycleId: row.reviewCycleId,
      reviewCycleName: row.reviewCycle.name,
      kpiDefinitionId: row.kpiDefinitionId,
      kpiDefinitionName: row.kpiDefinition?.name ?? null,
      employeeId: row.employeeId,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      employeeNumber: row.employee.employeeNumber,
      title: row.title,
      description: row.description,
      unit: row.unit,
      direction: row.direction,
      targetValue,
      currentValue,
      progressPercent: computeKpiProgressPercent(
        targetValue,
        currentValue,
        row.direction,
      ),
      measurementPeriod: row.measurementPeriod,
      measurementPeriodStart: formatDateOnly(row.measurementPeriodStart),
      measurementPeriodEnd: formatDateOnly(row.measurementPeriodEnd),
      weightPercent: decimalToNumber(row.weightPercent),
      status: row.status,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
