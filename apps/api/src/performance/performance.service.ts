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
import {
  kpiMeasurementWindows,
  type BulkAssignKpiResult,
  type BulkAssignKpiSkippedItem,
  type EmployeeKpiAssignmentRecord,
  type KpiDefinitionRecord,
  type PerformanceGoalsSummary,
  type PerformanceReviewCycleRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { DataScopeService } from '../rbac/data-scope.service';
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
  assertCycleOpenForGoals,
  assertReviewNotLaunched,
  assertStatusTransition,
  assertTargetFieldsUnchanged,
  assertTargetValue,
  assertWeightWithinLimit,
  kpiAssignmentLockState,
  KPI_TARGET_FIELDS,
  resolveMeasurementPeriod,
  type CycleWindowSource,
  type ResolvedMeasurementPeriod,
} from './kpi-goal.rules';
import {
  assertCycleEditable,
  assertCycleStatusTransition,
  assertReviewDueDate,
} from './review-cycle.rules';
import {
  assertDateRange,
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

const LIVE_ASSIGNMENT_COUNT = {
  where: { status: { not: EmployeeKpiAssignmentStatus.cancelled } },
} satisfies Prisma.KpiDefinitionCountOutputTypeCountAssignmentsArgs;

const ASSIGNMENT_INCLUDE = {
  employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
  reviewCycle: { select: { name: true, status: true } },
  kpiDefinition: { select: { name: true } },
} satisfies Prisma.EmployeeKpiAssignmentInclude;

type AssignmentWithRelations = Prisma.EmployeeKpiAssignmentGetPayload<{
  include: typeof ASSIGNMENT_INCLUDE;
}>;

type PrismaReader = Pick<Prisma.TransactionClient, 'employeeKpiAssignment'>;

function dateKey(value: string, field: string): string {
  return formatDateOnly(parseDateOnly(value, field));
}

function reviewKey(reviewCycleId: string, employeeId: string): string {
  return `${reviewCycleId}:${employeeId}`;
}

@Injectable()
export class PerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly dataScope: DataScopeService,
  ) {}

  async getGoalsSummary(
    companyId: string,
    user: AuthenticatedUser,
  ): Promise<PerformanceGoalsSummary> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const employeeId = await this.dataScope.employeeIdFilter(user);

    const [activeCycleRow, kpiDefinitionCount, assignments] = await Promise.all([
      this.prisma.unscoped.performanceReviewCycle.findFirst({
        where: { companyId, status: PerformanceReviewCycleStatus.active },
        include: this.cycleInclude(employeeId),
        orderBy: { periodStart: 'desc' },
      }),
      this.prisma.unscoped.kpiDefinition.count({
        where: { companyId, isActive: true },
      }),
      this.prisma.unscoped.employeeKpiAssignment.findMany({
        where: {
          companyId,
          employeeId,
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

  async listReviewCycles(
    companyId: string,
    user: AuthenticatedUser,
  ): Promise<PerformanceReviewCycleRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.performanceReviewCycle.findMany({
      where: { companyId },
      include: this.cycleInclude(await this.dataScope.employeeIdFilter(user)),
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
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Cycle name is required' });
    }
    if (dto.status && dto.status !== PerformanceReviewCycleStatus.draft) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'New review cycles start as draft; launch the cycle to start it',
      });
    }
    const periodStart = parseDateOnly(dto.periodStart, 'periodStart');
    const periodEnd = parseDateOnly(dto.periodEnd, 'periodEnd');
    const reviewDueDate = parseDateOnly(dto.reviewDueDate, 'reviewDueDate');
    assertDateRange(periodStart, periodEnd, 'Review cycle period');
    assertReviewDueDate(formatDateOnly(periodStart), formatDateOnly(reviewDueDate));

    const row = await this.prisma.unscoped.performanceReviewCycle.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        name,
        description: dto.description?.trim() || null,
        periodStart,
        periodEnd,
        measurementPeriod: dto.measurementPeriod,
        reviewDueDate,
        status: PerformanceReviewCycleStatus.draft,
        requiresWorkflowApproval: dto.requiresWorkflowApproval ?? true,
        createdByUserId: user.id,
      },
      include: this.cycleInclude(),
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
    const existing = await this.getCycleOrThrow(cycleId, user.tenantId);
    const periodStart = dto.periodStart
      ? parseDateOnly(dto.periodStart, 'periodStart')
      : existing.periodStart;
    const periodEnd = dto.periodEnd
      ? parseDateOnly(dto.periodEnd, 'periodEnd')
      : existing.periodEnd;
    const reviewDueDate = dto.reviewDueDate
      ? parseDateOnly(dto.reviewDueDate, 'reviewDueDate')
      : existing.reviewDueDate;
    const name = dto.name !== undefined ? dto.name.trim() : existing.name;
    const description =
      dto.description !== undefined ? dto.description?.trim() || null : existing.description;
    const measurementPeriod = dto.measurementPeriod ?? existing.measurementPeriod;
    const requiresWorkflowApproval =
      dto.requiresWorkflowApproval ?? existing.requiresWorkflowApproval;
    const status = dto.status ?? existing.status;

    if (!name) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Cycle name is required' });
    }

    const before = {
      name: existing.name,
      description: existing.description,
      periodStart: formatDateOnly(existing.periodStart),
      periodEnd: formatDateOnly(existing.periodEnd),
      measurementPeriod: existing.measurementPeriod,
      reviewDueDate: formatDateOnly(existing.reviewDueDate),
      requiresWorkflowApproval: existing.requiresWorkflowApproval,
    };
    const after: typeof before = {
      name,
      description,
      periodStart: formatDateOnly(periodStart),
      periodEnd: formatDateOnly(periodEnd),
      measurementPeriod,
      reviewDueDate: formatDateOnly(reviewDueDate),
      requiresWorkflowApproval,
    };
    const changedFields = (Object.keys(before) as Array<keyof typeof before>).filter(
      (field) => before[field] !== after[field],
    );

    assertCycleEditable(existing, changedFields);
    assertCycleStatusTransition(existing.status, status);
    assertDateRange(periodStart, periodEnd, 'Review cycle period');
    assertReviewDueDate(after.periodStart, after.reviewDueDate);

    if (
      periodStart.getTime() !== existing.periodStart.getTime() ||
      periodEnd.getTime() !== existing.periodEnd.getTime()
    ) {
      const outside = await this.prisma.unscoped.employeeKpiAssignment.count({
        where: {
          reviewCycleId: cycleId,
          status: { not: EmployeeKpiAssignmentStatus.cancelled },
          OR: [
            { measurementPeriodStart: { lt: periodStart } },
            { measurementPeriodEnd: { gt: periodEnd } },
          ],
        },
      });
      if (outside > 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `${outside} KPI goal(s) fall outside the new cycle period; adjust or cancel them first`,
        });
      }
    }

    const row = await this.prisma.unscoped.performanceReviewCycle.update({
      where: { id: cycleId },
      data: {
        name,
        description,
        periodStart,
        periodEnd,
        measurementPeriod,
        reviewDueDate,
        status,
        requiresWorkflowApproval,
      },
      include: this.cycleInclude(await this.dataScope.employeeIdFilter(user)),
    });

    if (changedFields.length > 0 || status !== existing.status) {
      const pick = (source: typeof before) =>
        Object.fromEntries(changedFields.map((field) => [field, source[field]]));
      await this.auditService.log({
        tenantId: existing.tenantId,
        userId: user.id,
        action: 'update',
        module: 'performance',
        recordId: row.id,
        oldValue: { ...pick(before), status: existing.status },
        newValue: { ...pick(after), status },
      });
    }

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
      include: { _count: { select: { assignments: LIVE_ASSIGNMENT_COUNT } } },
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
    if (!dto.name.trim()) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'KPI name is required' });
    }

    try {
      const row = await this.prisma.unscoped.kpiDefinition.create({
        data: {
          tenantId: company.tenantId,
          companyId,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          category: dto.category?.trim() || null,
          unit: dto.unit,
          direction: dto.direction ?? 'higher_is_better',
          defaultTargetValue: toDecimal(dto.defaultTargetValue),
          createdByUserId: user.id,
        },
        include: { _count: { select: { assignments: LIVE_ASSIGNMENT_COUNT } } },
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
    const existing = await this.getDefinitionOrThrow(definitionId, user.tenantId);
    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'KPI name is required' });
    }

    try {
      const row = await this.prisma.unscoped.kpiDefinition.update({
        where: { id: definitionId },
        data: {
          name: dto.name?.trim(),
          description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
          category: dto.category !== undefined ? dto.category?.trim() || null : undefined,
          unit: dto.unit,
          direction: dto.direction,
          defaultTargetValue:
            dto.defaultTargetValue !== undefined
              ? dto.defaultTargetValue === null
                ? null
                : toDecimal(dto.defaultTargetValue)
              : undefined,
          isActive: dto.isActive,
        },
        include: { _count: { select: { assignments: LIVE_ASSIGNMENT_COUNT } } },
      });

      const before: Record<string, unknown> = {
        name: existing.name,
        description: existing.description,
        category: existing.category,
        unit: existing.unit,
        direction: existing.direction,
        defaultTargetValue: decimalToNumber(existing.defaultTargetValue),
        isActive: existing.isActive,
      };
      const after: Record<string, unknown> = {
        name: row.name,
        description: row.description,
        category: row.category,
        unit: row.unit,
        direction: row.direction,
        defaultTargetValue: decimalToNumber(row.defaultTargetValue),
        isActive: row.isActive,
      };
      const changedKeys = Object.keys(after).filter((key) => before[key] !== after[key]);
      if (changedKeys.length > 0) {
        await this.auditService.log({
          tenantId: existing.tenantId,
          userId: user.id,
          action: 'update',
          module: 'performance',
          recordId: row.id,
          oldValue: Object.fromEntries(changedKeys.map((key) => [key, before[key]])),
          newValue: Object.fromEntries(changedKeys.map((key) => [key, after[key]])),
        });
      }

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
    user: AuthenticatedUser,
  ): Promise<EmployeeKpiAssignmentRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    if (query.employeeId) {
      await this.dataScope.assertEmployeeInScope(user, query.employeeId);
    }

    const rows = await this.prisma.unscoped.employeeKpiAssignment.findMany({
      where: {
        companyId,
        reviewCycleId: query.reviewCycleId,
        employeeId: query.employeeId ?? (await this.dataScope.employeeIdFilter(user)),
        kpiDefinitionId: query.kpiDefinitionId,
        status: query.status,
      },
      include: ASSIGNMENT_INCLUDE,
      orderBy: [{ measurementPeriodStart: 'asc' }, { title: 'asc' }],
    });

    const launched = await this.launchedReviewKeys(
      [...new Set(rows.map((row) => row.reviewCycleId))],
      [...new Set(rows.map((row) => row.employeeId))],
    );
    return rows.map((row) =>
      this.toAssignmentRecord(row, launched.has(reviewKey(row.reviewCycleId, row.employeeId))),
    );
  }

  async createKpiAssignment(
    companyId: string,
    dto: CreateEmployeeKpiAssignmentDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeKpiAssignmentRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const cycle = await this.getCycleOrThrow(dto.reviewCycleId, company.tenantId);
    if (cycle.companyId !== companyId) {
      throw new NotFoundException('Review cycle not found');
    }
    assertCycleOpenForGoals(cycle.status);

    const employeeName = await this.assertEmployeeInCompany(dto.employeeId, companyId);
    await this.dataScope.assertEmployeeInScope(user, dto.employeeId);

    let definition: KpiDefinition | null = null;
    if (dto.kpiDefinitionId) {
      definition = await this.getDefinitionOrThrow(dto.kpiDefinitionId, company.tenantId);
      if (definition.companyId !== companyId) {
        throw new NotFoundException('KPI definition not found');
      }
      this.assertDefinitionActive(definition);
    }

    const title = (dto.title ?? definition?.name ?? '').trim();
    if (!title) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A goal title is required when no KPI from the library is selected',
      });
    }
    const direction = dto.direction ?? definition?.direction ?? 'higher_is_better';
    assertTargetValue(dto.targetValue, direction);

    const status = dto.status ?? EmployeeKpiAssignmentStatus.active;
    if (status !== EmployeeKpiAssignmentStatus.active && status !== EmployeeKpiAssignmentStatus.draft) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'New KPI goals start as active or draft',
      });
    }

    const launched = await this.launchedReviewKeys([cycle.id], [dto.employeeId]);
    assertReviewNotLaunched(launched.size > 0, employeeName);

    const period = resolveMeasurementPeriod(this.cycleWindowSource(cycle), {
      measurementPeriod: dto.measurementPeriod,
      start: dto.measurementPeriodStart
        ? dateKey(dto.measurementPeriodStart, 'measurementPeriodStart')
        : undefined,
      end: dto.measurementPeriodEnd
        ? dateKey(dto.measurementPeriodEnd, 'measurementPeriodEnd')
        : undefined,
    });

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      if (dto.weightPercent) {
        const totals = await this.weightTotals(tx, cycle.id, [dto.employeeId]);
        assertWeightWithinLimit(totals.get(dto.employeeId) ?? 0, dto.weightPercent, employeeName);
      }

      return tx.employeeKpiAssignment.create({
        data: {
          tenantId: company.tenantId,
          companyId,
          reviewCycleId: cycle.id,
          kpiDefinitionId: definition?.id ?? null,
          employeeId: dto.employeeId,
          assignedByUserId: user.id,
          title,
          description: dto.description?.trim() || definition?.description || null,
          unit: dto.unit ?? definition?.unit ?? 'count',
          direction,
          targetValue: toDecimal(dto.targetValue)!,
          currentValue: toDecimal(dto.currentValue),
          measurementPeriod: period.measurementPeriod,
          measurementPeriodStart: parseDateOnly(period.start, 'measurementPeriodStart'),
          measurementPeriodEnd: parseDateOnly(period.end, 'measurementPeriodEnd'),
          weightPercent: toDecimal(dto.weightPercent),
          status,
          notes: dto.notes?.trim() || null,
        },
        include: ASSIGNMENT_INCLUDE,
      });
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
        measurementPeriod: row.measurementPeriod,
        measurementPeriodStart: period.start,
        measurementPeriodEnd: period.end,
        weightPercent: decimalToNumber(row.weightPercent),
      },
    });

    return this.toAssignmentRecord(row, false);
  }

  async bulkAssignKpi(
    companyId: string,
    dto: BulkAssignKpiDto,
    user: AuthenticatedUser,
  ): Promise<BulkAssignKpiResult> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const cycle = await this.getCycleOrThrow(dto.reviewCycleId, company.tenantId);
    if (cycle.companyId !== companyId) {
      throw new NotFoundException('Review cycle not found');
    }
    assertCycleOpenForGoals(cycle.status);

    const definition = await this.getDefinitionOrThrow(dto.kpiDefinitionId, company.tenantId);
    if (definition.companyId !== companyId) {
      throw new NotFoundException('KPI definition not found');
    }
    this.assertDefinitionActive(definition);

    const targetValue = dto.targetValue ?? decimalToNumber(definition.defaultTargetValue);
    if (targetValue == null) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Enter a target value; this KPI has no default target',
      });
    }
    assertTargetValue(targetValue, definition.direction);

    const source = this.cycleWindowSource(cycle);
    let periods: ResolvedMeasurementPeriod[];
    if (dto.everyWindow) {
      const type = dto.measurementPeriod ?? cycle.measurementPeriod;
      if (type === 'custom') {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Choose a monthly, quarterly, semi-annual or annual period to assign every window',
        });
      }
      periods = kpiMeasurementWindows(source.periodStart, source.periodEnd, type).map((window) => ({
        measurementPeriod: type,
        start: window.start,
        end: window.end,
      }));
    } else {
      periods = [
        resolveMeasurementPeriod(source, {
          measurementPeriod: dto.measurementPeriod,
          start: dto.measurementPeriodStart
            ? dateKey(dto.measurementPeriodStart, 'measurementPeriodStart')
            : undefined,
          end: dto.measurementPeriodEnd
            ? dateKey(dto.measurementPeriodEnd, 'measurementPeriodEnd')
            : undefined,
        }),
      ];
    }

    const uniqueEmployeeIds = [...new Set(dto.employeeIds)];
    const employeeNames = new Map<string, string>();
    for (const employeeId of uniqueEmployeeIds) {
      employeeNames.set(employeeId, await this.assertEmployeeInCompany(employeeId, companyId));
      await this.dataScope.assertEmployeeInScope(user, employeeId);
    }

    const launched = await this.launchedReviewKeys([cycle.id], uniqueEmployeeIds);
    if (launched.size > 0) {
      const names = uniqueEmployeeIds
        .filter((id) => launched.has(reviewKey(cycle.id, id)))
        .map((id) => employeeNames.get(id));
      throw new BadRequestException({
        code: 'REVIEW_LAUNCHED',
        message: `Reviews for this cycle have already launched for ${names.join(', ')}; remove them from the selection, because new KPI goals would not be part of their review`,
      });
    }

    const result = await this.prisma.unscoped.$transaction(async (tx) => {
      const existing = await tx.employeeKpiAssignment.findMany({
        where: {
          reviewCycleId: cycle.id,
          kpiDefinitionId: definition.id,
          employeeId: { in: uniqueEmployeeIds },
          status: { not: EmployeeKpiAssignmentStatus.cancelled },
        },
        select: { employeeId: true, measurementPeriodStart: true, measurementPeriodEnd: true },
      });
      const taken = new Set(
        existing.map(
          (row) =>
            `${row.employeeId}:${formatDateOnly(row.measurementPeriodStart)}:${formatDateOnly(row.measurementPeriodEnd)}`,
        ),
      );

      const toCreate: Array<{ employeeId: string; period: ResolvedMeasurementPeriod }> = [];
      const skipped: BulkAssignKpiSkippedItem[] = [];
      for (const employeeId of uniqueEmployeeIds) {
        for (const period of periods) {
          if (taken.has(`${employeeId}:${period.start}:${period.end}`)) {
            skipped.push({
              employeeId,
              employeeName: employeeNames.get(employeeId) ?? '',
              measurementPeriodStart: period.start,
              measurementPeriodEnd: period.end,
              reason: 'already_assigned',
            });
          } else {
            toCreate.push({ employeeId, period });
          }
        }
      }

      if (dto.weightPercent) {
        const totals = await this.weightTotals(tx, cycle.id, uniqueEmployeeIds);
        for (const employeeId of uniqueEmployeeIds) {
          const newCount = toCreate.filter((item) => item.employeeId === employeeId).length;
          if (newCount === 0) continue;
          assertWeightWithinLimit(
            totals.get(employeeId) ?? 0,
            dto.weightPercent * newCount,
            employeeNames.get(employeeId) ?? 'The employee',
          );
        }
      }

      const created: AssignmentWithRelations[] = [];
      for (const item of toCreate) {
        created.push(
          await tx.employeeKpiAssignment.create({
            data: {
              tenantId: company.tenantId,
              companyId,
              reviewCycleId: cycle.id,
              kpiDefinitionId: definition.id,
              employeeId: item.employeeId,
              assignedByUserId: user.id,
              title: definition.name,
              description: definition.description,
              unit: definition.unit,
              direction: definition.direction,
              targetValue: toDecimal(targetValue)!,
              measurementPeriod: item.period.measurementPeriod,
              measurementPeriodStart: parseDateOnly(item.period.start, 'measurementPeriodStart'),
              measurementPeriodEnd: parseDateOnly(item.period.end, 'measurementPeriodEnd'),
              weightPercent: toDecimal(dto.weightPercent),
              status: EmployeeKpiAssignmentStatus.active,
              notes: dto.notes?.trim() || null,
            },
            include: ASSIGNMENT_INCLUDE,
          }),
        );
      }
      return { created, skipped };
    });

    for (const row of result.created) {
      await this.auditService.log({
        tenantId: company.tenantId,
        userId: user.id,
        action: 'create',
        module: 'performance',
        recordId: row.id,
        newValue: {
          employeeId: row.employeeId,
          title: row.title,
          targetValue,
          measurementPeriod: row.measurementPeriod,
          measurementPeriodStart: formatDateOnly(row.measurementPeriodStart),
          measurementPeriodEnd: formatDateOnly(row.measurementPeriodEnd),
          bulk: true,
        },
      });
    }

    return {
      created: result.created.map((row) => this.toAssignmentRecord(row, false)),
      skipped: result.skipped,
    };
  }

  async updateKpiAssignment(
    assignmentId: string,
    dto: UpdateEmployeeKpiAssignmentDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeKpiAssignmentRecord> {
    const existing = await this.getAssignmentOrThrow(assignmentId, user.tenantId);
    await this.dataScope.assertEmployeeInScope(user, existing.employeeId);
    const cycle = await this.getCycleOrThrow(existing.reviewCycleId, existing.tenantId);
    assertCycleOpenForGoals(cycle.status);

    const launched = await this.launchedReviewKeys([cycle.id], [existing.employeeId]);
    const reviewLaunched = launched.size > 0;

    const existingStart = formatDateOnly(existing.measurementPeriodStart);
    const existingEnd = formatDateOnly(existing.measurementPeriodEnd);
    const periodTouched =
      dto.measurementPeriod !== undefined ||
      dto.measurementPeriodStart !== undefined ||
      dto.measurementPeriodEnd !== undefined;
    const period: ResolvedMeasurementPeriod = periodTouched
      ? resolveMeasurementPeriod(this.cycleWindowSource(cycle), {
          measurementPeriod: dto.measurementPeriod ?? existing.measurementPeriod,
          start: dto.measurementPeriodStart
            ? dateKey(dto.measurementPeriodStart, 'measurementPeriodStart')
            : existingStart,
          end: dto.measurementPeriodEnd
            ? dateKey(dto.measurementPeriodEnd, 'measurementPeriodEnd')
            : existingEnd,
        })
      : { measurementPeriod: existing.measurementPeriod, start: existingStart, end: existingEnd };

    const title = dto.title !== undefined ? dto.title.trim() : existing.title;
    if (!title) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Goal title is required' });
    }
    const existingTarget = decimalToNumber(existing.targetValue);
    const existingWeight = decimalToNumber(existing.weightPercent);
    const nextWeight = dto.weightPercent !== undefined ? dto.weightPercent : existingWeight;

    const changed: Array<(typeof KPI_TARGET_FIELDS)[number]> = [];
    if (title !== existing.title) changed.push('title');
    if (dto.targetValue !== undefined && dto.targetValue !== existingTarget) changed.push('targetValue');
    if (period.measurementPeriod !== existing.measurementPeriod) changed.push('measurementPeriod');
    if (period.start !== existingStart) changed.push('measurementPeriodStart');
    if (period.end !== existingEnd) changed.push('measurementPeriodEnd');
    if (nextWeight !== existingWeight) changed.push('weightPercent');
    if (reviewLaunched) {
      assertTargetFieldsUnchanged(changed);
    }

    if (dto.targetValue !== undefined) {
      assertTargetValue(dto.targetValue, existing.direction);
    }
    const nextStatus = dto.status ?? existing.status;
    assertStatusTransition(existing.status, nextStatus);

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      if (
        nextStatus !== EmployeeKpiAssignmentStatus.cancelled &&
        nextWeight &&
        nextWeight !== existingWeight
      ) {
        const totals = await this.weightTotals(tx, cycle.id, [existing.employeeId], assignmentId);
        assertWeightWithinLimit(
          totals.get(existing.employeeId) ?? 0,
          nextWeight,
          await this.employeeName(existing.employeeId),
        );
      }

      return tx.employeeKpiAssignment.update({
        where: { id: assignmentId },
        data: {
          title,
          description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
          targetValue: dto.targetValue !== undefined ? toDecimal(dto.targetValue) : undefined,
          currentValue: dto.currentValue !== undefined ? toDecimal(dto.currentValue) : undefined,
          measurementPeriod: period.measurementPeriod,
          measurementPeriodStart: parseDateOnly(period.start, 'measurementPeriodStart'),
          measurementPeriodEnd: parseDateOnly(period.end, 'measurementPeriodEnd'),
          weightPercent:
            dto.weightPercent === null
              ? null
              : dto.weightPercent !== undefined
                ? toDecimal(dto.weightPercent)
                : undefined,
          notes: dto.notes !== undefined ? dto.notes?.trim() || null : undefined,
          status: nextStatus,
        },
        include: ASSIGNMENT_INCLUDE,
      });
    });

    const snapshot = (value: EmployeeKpiAssignment): Record<string, unknown> => ({
      title: value.title,
      targetValue: decimalToNumber(value.targetValue),
      currentValue: decimalToNumber(value.currentValue),
      measurementPeriod: value.measurementPeriod,
      measurementPeriodStart: formatDateOnly(value.measurementPeriodStart),
      measurementPeriodEnd: formatDateOnly(value.measurementPeriodEnd),
      weightPercent: decimalToNumber(value.weightPercent),
      status: value.status,
      notes: value.notes,
      description: value.description,
    });
    const before = snapshot(existing);
    const after = snapshot(row);
    const changedKeys = Object.keys(after).filter((key) => before[key] !== after[key]);
    if (changedKeys.length > 0) {
      await this.auditService.log({
        tenantId: existing.tenantId,
        userId: user.id,
        action: 'update',
        module: 'performance',
        recordId: row.id,
        oldValue: Object.fromEntries(changedKeys.map((key) => [key, before[key]])),
        newValue: Object.fromEntries(changedKeys.map((key) => [key, after[key]])),
      });
    }

    return this.toAssignmentRecord(row, reviewLaunched);
  }

  private cycleInclude(employeeId?: { in: string[] }) {
    const where = { employeeId };
    return {
      _count: {
        select: {
          kpiAssignments: { where },
          participants: { where },
          reviews: { where },
        },
      },
      kpiAssignments: { where, select: { status: true } },
      reviews: { where, select: { status: true } },
    } satisfies Prisma.PerformanceReviewCycleInclude;
  }

  private cycleWindowSource(cycle: PerformanceReviewCycle): CycleWindowSource {
    return {
      periodStart: formatDateOnly(cycle.periodStart),
      periodEnd: formatDateOnly(cycle.periodEnd),
      measurementPeriod: cycle.measurementPeriod,
    };
  }

  private assertDefinitionActive(definition: KpiDefinition): void {
    if (!definition.isActive) {
      throw new BadRequestException({
        code: 'INVALID_KPI',
        message: `"${definition.name}" is inactive; reactivate it in the KPI library before assigning`,
      });
    }
  }

  /** Reviews that have launched (not cancelled) for any of the given cycle/employee pairs. */
  private async launchedReviewKeys(
    reviewCycleIds: string[],
    employeeIds: string[],
  ): Promise<Set<string>> {
    if (reviewCycleIds.length === 0 || employeeIds.length === 0) return new Set();
    const rows = await this.prisma.unscoped.employeePerformanceReview.findMany({
      where: {
        reviewCycleId: { in: reviewCycleIds },
        employeeId: { in: employeeIds },
        status: { not: EmployeePerformanceReviewStatus.cancelled },
      },
      select: { reviewCycleId: true, employeeId: true },
    });
    return new Set(rows.map((row) => reviewKey(row.reviewCycleId, row.employeeId)));
  }

  /** Sum of non-cancelled KPI weights per employee in a cycle. */
  private async weightTotals(
    client: PrismaReader,
    reviewCycleId: string,
    employeeIds: string[],
    excludeAssignmentId?: string,
  ): Promise<Map<string, number>> {
    const rows = await client.employeeKpiAssignment.findMany({
      where: {
        reviewCycleId,
        employeeId: { in: employeeIds },
        status: { not: EmployeeKpiAssignmentStatus.cancelled },
        ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}),
      },
      select: { employeeId: true, weightPercent: true },
    });
    const totals = new Map<string, number>();
    for (const row of rows) {
      totals.set(
        row.employeeId,
        (totals.get(row.employeeId) ?? 0) + (decimalToNumber(row.weightPercent) ?? 0),
      );
    }
    return totals;
  }

  private async getCycleOrThrow(
    cycleId: string,
    tenantId: string | null,
  ): Promise<PerformanceReviewCycle> {
    const row = tenantId
      ? await this.prisma.unscoped.performanceReviewCycle.findFirst({
          where: { id: cycleId, tenantId },
        })
      : null;
    if (!row) {
      throw new NotFoundException('Review cycle not found');
    }
    return row;
  }

  private async getDefinitionOrThrow(
    definitionId: string,
    tenantId: string | null,
  ): Promise<KpiDefinition> {
    const row = tenantId
      ? await this.prisma.unscoped.kpiDefinition.findFirst({
          where: { id: definitionId, tenantId },
        })
      : null;
    if (!row) {
      throw new NotFoundException('KPI definition not found');
    }
    return row;
  }

  private async getAssignmentOrThrow(
    assignmentId: string,
    tenantId: string | null,
  ): Promise<EmployeeKpiAssignment> {
    const row = tenantId
      ? await this.prisma.unscoped.employeeKpiAssignment.findFirst({
          where: { id: assignmentId, tenantId },
        })
      : null;
    if (!row) {
      throw new NotFoundException('KPI assignment not found');
    }
    return row;
  }

  /** Returns the employee's display name. */
  private async assertEmployeeInCompany(
    employeeId: string,
    companyId: string,
  ): Promise<string> {
    const employee = await this.prisma.unscoped.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { firstName: true, lastName: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found in company');
    }
    return `${employee.firstName} ${employee.lastName}`.trim();
  }

  private async employeeName(employeeId: string): Promise<string> {
    const employee = await this.prisma.unscoped.employee.findUnique({
      where: { id: employeeId },
      select: { firstName: true, lastName: true },
    });
    return employee ? `${employee.firstName} ${employee.lastName}`.trim() : 'The employee';
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
    reviewLaunched: boolean,
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
      lockState: kpiAssignmentLockState(row.reviewCycle.status, reviewLaunched),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
