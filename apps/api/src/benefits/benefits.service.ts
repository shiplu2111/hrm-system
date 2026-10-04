import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BenefitEnrollmentStatus,
  BenefitOpenEnrollmentStatus,
  BenefitPlanStatus,
  EmploymentStatus,
  Prisma,
  type BenefitDependentRelationship,
  type BenefitEnrollment,
  type BenefitEnrollmentDependent,
  type BenefitOpenEnrollmentPeriod,
  type BenefitPlan,
} from '@prisma/client';
import type {
  BenefitAdminSummary,
  BenefitEnrollmentDependentRecord,
  BenefitEnrollmentRecord,
  BenefitOpenEnrollmentPeriodRecord,
  BenefitPlanRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  AddBenefitEnrollmentDependentDto,
  CancelBenefitEnrollmentDto,
  CreateBenefitEnrollmentDto,
  CreateBenefitOpenEnrollmentDto,
  CreateBenefitPlanDto,
  ListBenefitEnrollmentsQueryDto,
  UpdateBenefitPlanDto,
} from './dto/benefits.dto';
import {
  decimalToNumber,
  findDependentRuleConflict,
  formatDateOnly,
  isWithinWindow,
  monthlyEmployeeCost,
  parseDateOnly,
  toDecimal,
  todayDateOnly,
  validateDependents,
  type PlanDependentRules,
} from './benefits.utils';

type PlanWithCounts = BenefitPlan & {
  _count: { enrollments: number };
  enrollments: { _count: { dependents: number } }[];
};

type EnrollmentWithRelations = BenefitEnrollment & {
  employee: { firstName: string; lastName: string; employeeNumber: string };
  benefitPlan: {
    name: string;
    category: BenefitPlan['category'];
    provider: string;
    planTier: string;
    employerContributionAmount: Prisma.Decimal | null;
    dependentContributionAmount: Prisma.Decimal | null;
  };
  dependents: BenefitEnrollmentDependent[];
};

type OpenEnrollmentWithRelations = BenefitOpenEnrollmentPeriod & {
  plans: { benefitPlanId: string }[];
  _count: { enrollments: number };
};

const ACTIVE_DEPENDENT = { status: 'active' as const };

function nullableText(value: string | null | undefined): string | null {
  return value ? value : null;
}

function dayBefore(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() - 1);
  return copy;
}

@Injectable()
export class BenefitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async getSummary(companyId: string): Promise<BenefitAdminSummary> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const [activePlanCount, activeEnrollments, dependentCoverageCount, openPeriod] =
      await Promise.all([
        this.prisma.unscoped.benefitPlan.count({
          where: { companyId, deletedAt: null, status: BenefitPlanStatus.active },
        }),
        this.prisma.unscoped.benefitEnrollment.findMany({
          where: { companyId, status: BenefitEnrollmentStatus.active },
          select: {
            benefitPlan: { select: { employerContributionAmount: true } },
          },
        }),
        this.prisma.unscoped.benefitEnrollmentDependent.count({
          where: {
            ...ACTIVE_DEPENDENT,
            enrollment: { companyId, status: BenefitEnrollmentStatus.active },
          },
        }),
        this.findCurrentOpenEnrollment(companyId),
      ]);

    const monthlyEmployerSubsidy = activeEnrollments.reduce((sum, row) => {
      const amount = decimalToNumber(row.benefitPlan.employerContributionAmount) ?? 0;
      return sum + amount;
    }, 0);

    return {
      activePlanCount,
      activeEnrollmentCount: activeEnrollments.length,
      dependentCoverageCount,
      monthlyEmployerSubsidy,
      openEnrollmentPeriod: openPeriod ? this.toOpenEnrollmentRecord(openPeriod) : null,
    };
  }

  async listPlans(companyId: string): Promise<BenefitPlanRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const openPlanIds = await this.openPlanIds(companyId);

    const rows = await this.prisma.unscoped.benefitPlan.findMany({
      where: { companyId, deletedAt: null },
      include: this.planInclude(),
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });

    return rows.map((row) => this.toPlanRecord(row, openPlanIds));
  }

  async createPlan(
    companyId: string,
    dto: CreateBenefitPlanDto,
    user: AuthenticatedUser,
  ): Promise<BenefitPlanRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    if (dto.status === 'inactive') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'New plans start as draft or active',
      });
    }
    await this.assertUniquePlanName(companyId, dto.name, dto.planTier);

    const allowsDependents = dto.allowsDependents ?? true;
    const row = await this.prisma.unscoped.benefitPlan.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        name: dto.name,
        category: dto.category,
        provider: dto.provider,
        planTier: dto.planTier,
        description: nullableText(dto.description),
        employerContributionLabel: nullableText(dto.employerContributionLabel),
        employerContributionAmount: toDecimal(dto.employerContributionAmount),
        employeeContributionAmount: toDecimal(dto.employeeContributionAmount ?? 0)!,
        employeeContributionLabel: nullableText(dto.employeeContributionLabel),
        coverageLimitLabel: nullableText(dto.coverageLimitLabel),
        allowsDependents,
        maxDependents: allowsDependents ? (dto.maxDependents ?? null) : null,
        eligibleRelationships: allowsDependents
          ? (dto.eligibleRelationships ?? [])
          : [],
        dependentContributionAmount: allowsDependents
          ? toDecimal(dto.dependentContributionAmount)
          : undefined,
        status: (dto.status as BenefitPlanStatus) ?? BenefitPlanStatus.draft,
      },
      include: this.planInclude(),
    });

    const record = this.toPlanRecord(row, new Set());
    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'benefits',
      recordId: row.id,
      newValue: record as unknown as Record<string, unknown>,
    });

    return record;
  }

  async updatePlan(
    planId: string,
    dto: UpdateBenefitPlanDto,
    user: AuthenticatedUser,
  ): Promise<BenefitPlanRecord> {
    const existing = await this.findPlanOrThrow(planId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    if (dto.status === 'draft' && existing.status !== BenefitPlanStatus.draft && existing._count.enrollments > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A plan with enrollments cannot go back to draft; deactivate it instead',
      });
    }

    if (dto.category != null && dto.category !== existing.category && existing._count.enrollments > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: "A plan's category cannot change once employees are enrolled; create a new plan instead",
      });
    }

    const name = dto.name ?? existing.name;
    const planTier = dto.planTier ?? existing.planTier;
    if (name !== existing.name || planTier !== existing.planTier) {
      await this.assertUniquePlanName(existing.companyId, name, planTier, planId);
    }

    const allowsDependents = dto.allowsDependents ?? existing.allowsDependents;
    const rules: PlanDependentRules = {
      name,
      category: dto.category ?? existing.category,
      allowsDependents,
      maxDependents: !allowsDependents
        ? null
        : dto.maxDependents !== undefined
          ? dto.maxDependents
          : existing.maxDependents,
      eligibleRelationships: !allowsDependents
        ? []
        : (dto.eligibleRelationships ?? existing.eligibleRelationships),
    };

    if (
      dto.allowsDependents !== undefined ||
      dto.maxDependents !== undefined ||
      dto.eligibleRelationships !== undefined
    ) {
      const active = await this.prisma.unscoped.benefitEnrollment.findMany({
        where: { benefitPlanId: planId, status: BenefitEnrollmentStatus.active },
        select: {
          dependents: {
            where: ACTIVE_DEPENDENT,
            select: { fullName: true, relationship: true },
          },
        },
      });
      const conflict = findDependentRuleConflict(
        rules,
        active.map((row) => row.dependents),
      );
      if (conflict) {
        throw new ConflictException({ code: 'CONFLICT', message: conflict });
      }
    }

    const row = await this.prisma.unscoped.benefitPlan.update({
      where: { id: planId },
      data: {
        ...(dto.name != null ? { name: dto.name } : {}),
        ...(dto.category != null ? { category: dto.category } : {}),
        ...(dto.provider != null ? { provider: dto.provider } : {}),
        ...(dto.planTier != null ? { planTier: dto.planTier } : {}),
        ...(dto.description !== undefined
          ? { description: nullableText(dto.description) }
          : {}),
        ...(dto.employerContributionLabel !== undefined
          ? { employerContributionLabel: nullableText(dto.employerContributionLabel) }
          : {}),
        ...(dto.employerContributionAmount !== undefined
          ? { employerContributionAmount: toDecimal(dto.employerContributionAmount) ?? null }
          : {}),
        ...(dto.employeeContributionAmount != null
          ? { employeeContributionAmount: toDecimal(dto.employeeContributionAmount)! }
          : {}),
        ...(dto.employeeContributionLabel !== undefined
          ? { employeeContributionLabel: nullableText(dto.employeeContributionLabel) }
          : {}),
        ...(dto.coverageLimitLabel !== undefined
          ? { coverageLimitLabel: nullableText(dto.coverageLimitLabel) }
          : {}),
        allowsDependents,
        maxDependents: rules.maxDependents,
        eligibleRelationships: rules.eligibleRelationships as BenefitDependentRelationship[],
        ...(!allowsDependents
          ? { dependentContributionAmount: null }
          : dto.dependentContributionAmount !== undefined
            ? { dependentContributionAmount: toDecimal(dto.dependentContributionAmount) ?? null }
            : {}),
        ...(dto.status != null ? { status: dto.status as BenefitPlanStatus } : {}),
      },
      include: this.planInclude(),
    });

    const openPlanIds = await this.openPlanIds(existing.companyId);
    const record = this.toPlanRecord(row, openPlanIds);

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'benefits',
      recordId: planId,
      oldValue: this.toPlanRecord(existing, openPlanIds) as unknown as Record<string, unknown>,
      newValue: record as unknown as Record<string, unknown>,
    });

    return record;
  }

  async listOpenEnrollments(
    companyId: string,
  ): Promise<BenefitOpenEnrollmentPeriodRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.benefitOpenEnrollmentPeriod.findMany({
      where: { companyId },
      include: {
        plans: { select: { benefitPlanId: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ startDate: 'desc' }],
    });

    return rows.map((row) => this.toOpenEnrollmentRecord(row));
  }

  async createOpenEnrollment(
    companyId: string,
    dto: CreateBenefitOpenEnrollmentDto,
    user: AuthenticatedUser,
  ): Promise<BenefitOpenEnrollmentPeriodRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const startDate = parseDateOnly(dto.startDate, 'startDate');
    const endDate = parseDateOnly(dto.endDate, 'endDate');

    if (endDate < startDate) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Open enrollment end date must be on or after start date',
      });
    }

    await this.assertPlansInCompany(companyId, dto.planIds);

    const row = await this.prisma.unscoped.benefitOpenEnrollmentPeriod.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        startDate,
        endDate,
        plans: {
          create: dto.planIds.map((benefitPlanId) => ({ benefitPlanId })),
        },
      },
      include: {
        plans: { select: { benefitPlanId: true } },
        _count: { select: { enrollments: true } },
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'benefits',
      recordId: row.id,
      newValue: this.toOpenEnrollmentRecord(row) as unknown as Record<string, unknown>,
    });

    return this.toOpenEnrollmentRecord(row);
  }

  async openEnrollmentPeriod(
    periodId: string,
    user: AuthenticatedUser,
  ): Promise<BenefitOpenEnrollmentPeriodRecord> {
    const existing = await this.findOpenEnrollmentOrThrow(periodId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    if (existing.status === BenefitOpenEnrollmentStatus.open) {
      return this.toOpenEnrollmentRecord(existing);
    }
    if (
      existing.status === BenefitOpenEnrollmentStatus.closed ||
      existing.status === BenefitOpenEnrollmentStatus.cancelled
    ) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `Cannot open a ${existing.status} enrollment period`,
      });
    }

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      await tx.benefitOpenEnrollmentPeriod.updateMany({
        where: {
          companyId: existing.companyId,
          status: BenefitOpenEnrollmentStatus.open,
          id: { not: periodId },
        },
        data: {
          status: BenefitOpenEnrollmentStatus.closed,
          closedAt: new Date(),
        },
      });

      return tx.benefitOpenEnrollmentPeriod.update({
        where: { id: periodId },
        data: {
          status: BenefitOpenEnrollmentStatus.open,
          openedAt: new Date(),
        },
        include: {
          plans: { select: { benefitPlanId: true } },
          _count: { select: { enrollments: true } },
        },
      });
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'benefits',
      recordId: periodId,
      oldValue: { status: existing.status },
      newValue: { status: row.status },
    });

    return this.toOpenEnrollmentRecord(row);
  }

  async closeEnrollmentPeriod(
    periodId: string,
    user: AuthenticatedUser,
  ): Promise<BenefitOpenEnrollmentPeriodRecord> {
    const existing = await this.findOpenEnrollmentOrThrow(periodId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    if (existing.status !== BenefitOpenEnrollmentStatus.open) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only open enrollment periods can be closed',
      });
    }

    const row = await this.prisma.unscoped.benefitOpenEnrollmentPeriod.update({
      where: { id: periodId },
      data: {
        status: BenefitOpenEnrollmentStatus.closed,
        closedAt: new Date(),
      },
      include: {
        plans: { select: { benefitPlanId: true } },
        _count: { select: { enrollments: true } },
      },
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'benefits',
      recordId: periodId,
      oldValue: { status: existing.status },
      newValue: { status: row.status },
    });

    return this.toOpenEnrollmentRecord(row);
  }

  async listEnrollments(
    companyId: string,
    query: ListBenefitEnrollmentsQueryDto,
  ): Promise<BenefitEnrollmentRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.benefitEnrollment.findMany({
      where: {
        companyId,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.benefitPlanId ? { benefitPlanId: query.benefitPlanId } : {}),
        ...(query.status ? { status: query.status as BenefitEnrollmentStatus } : {}),
      },
      include: this.enrollmentInclude(),
      orderBy: [{ createdAt: 'desc' }],
    });

    return rows.map((row) => this.toEnrollmentRecord(row));
  }

  async createEnrollment(
    companyId: string,
    dto: CreateBenefitEnrollmentDto,
    user: AuthenticatedUser,
  ): Promise<BenefitEnrollmentRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const employee = await this.assertEmployee(dto.employeeId, companyId);
    const plan = await this.findPlanOrThrow(dto.benefitPlanId);

    if (plan.companyId !== companyId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Benefit plan not found in this company',
      });
    }
    if (plan.status !== BenefitPlanStatus.active) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Enrollments are only allowed for active benefit plans',
      });
    }
    if (employee.employmentStatus === EmploymentStatus.terminated) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Terminated employees cannot be enrolled in benefits',
      });
    }

    const effectiveFrom = parseDateOnly(dto.effectiveFrom, 'effectiveFrom');
    const effectiveTo = dto.effectiveTo
      ? parseDateOnly(dto.effectiveTo, 'effectiveTo')
      : null;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Effective end date must be on or after effective start date',
      });
    }
    if (effectiveFrom < employee.hireDate) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Coverage cannot start before the employee's hire date (${formatDateOnly(employee.hireDate)})`,
      });
    }
    if (dto.enrollmentType === 'life_event' && !dto.notes) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Describe the life event, for example marriage or the birth of a child',
      });
    }

    let openEnrollmentPeriodId: string | null = null;
    if (dto.enrollmentType === 'open_enrollment') {
      openEnrollmentPeriodId = await this.assertOpenEnrollmentAccepting(
        companyId,
        plan.id,
        dto.openEnrollmentPeriodId,
      );
    }

    const duplicate = await this.prisma.unscoped.benefitEnrollment.findFirst({
      where: {
        employeeId: dto.employeeId,
        benefitPlanId: dto.benefitPlanId,
        status: BenefitEnrollmentStatus.active,
      },
    });
    if (duplicate) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Employee already has an active enrollment for this benefit plan',
      });
    }

    validateDependents(plan, [], dto.dependents ?? []);

    const row = await this.prisma.unscoped.benefitEnrollment.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        employeeId: dto.employeeId,
        benefitPlanId: dto.benefitPlanId,
        openEnrollmentPeriodId,
        enrollmentType: dto.enrollmentType,
        status: BenefitEnrollmentStatus.active,
        effectiveFrom,
        effectiveTo,
        employeeContributionAmount:
          toDecimal(dto.employeeContributionAmount) ??
          plan.employeeContributionAmount,
        beneficiarySharePercent: toDecimal(dto.beneficiarySharePercent),
        notes: nullableText(dto.notes),
        enrolledAt: new Date(),
        dependents: dto.dependents?.length
          ? {
              create: dto.dependents.map((dep) => ({
                tenantId: company.tenantId,
                fullName: dep.fullName,
                relationship: dep.relationship,
                dateOfBirth: dep.dateOfBirth
                  ? parseDateOnly(dep.dateOfBirth, 'dateOfBirth')
                  : null,
                beneficiarySharePercent: toDecimal(dep.beneficiarySharePercent),
              })),
            }
          : undefined,
      },
      include: this.enrollmentInclude(),
    });

    const record = this.toEnrollmentRecord(row);
    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'benefits',
      recordId: row.id,
      newValue: record as unknown as Record<string, unknown>,
    });

    return record;
  }

  async cancelEnrollment(
    enrollmentId: string,
    dto: CancelBenefitEnrollmentDto,
    user: AuthenticatedUser,
  ): Promise<BenefitEnrollmentRecord> {
    const existing = await this.findEnrollmentOrThrow(enrollmentId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    if (existing.status !== BenefitEnrollmentStatus.active) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only active enrollments can be cancelled',
      });
    }

    let endDate = dto.endDate
      ? parseDateOnly(dto.endDate, 'endDate')
      : todayDateOnly();
    if (existing.effectiveTo && endDate > existing.effectiveTo) {
      endDate = existing.effectiveTo;
    }
    // Cancelling before coverage starts means it never started.
    const effectiveTo =
      endDate < existing.effectiveFrom ? dayBefore(existing.effectiveFrom) : endDate;

    const reasonNote = dto.reason ? `Cancelled: ${dto.reason}` : null;
    const row = await this.prisma.unscoped.benefitEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: BenefitEnrollmentStatus.cancelled,
        cancelledAt: new Date(),
        effectiveTo,
        ...(reasonNote
          ? { notes: existing.notes ? `${existing.notes}\n${reasonNote}` : reasonNote }
          : {}),
        dependents: {
          updateMany: {
            where: ACTIVE_DEPENDENT,
            data: { status: 'cancelled' },
          },
        },
      },
      include: this.enrollmentInclude(),
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'benefits',
      recordId: enrollmentId,
      oldValue: {
        status: existing.status,
        effectiveTo: existing.effectiveTo ? formatDateOnly(existing.effectiveTo) : null,
      },
      newValue: {
        status: row.status,
        effectiveTo: formatDateOnly(effectiveTo),
        reason: dto.reason ?? null,
      },
    });

    return this.toEnrollmentRecord(row);
  }

  async addDependent(
    enrollmentId: string,
    dto: AddBenefitEnrollmentDependentDto,
    user: AuthenticatedUser,
  ): Promise<BenefitEnrollmentRecord> {
    const existing = await this.findEnrollmentOrThrow(enrollmentId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    if (existing.status !== BenefitEnrollmentStatus.active) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Dependents can only be added to active enrollments',
      });
    }

    const plan = await this.findPlanOrThrow(existing.benefitPlanId);
    validateDependents(
      plan,
      existing.dependents
        .filter((dep) => dep.status === 'active')
        .map((dep) => ({
          fullName: dep.fullName,
          relationship: dep.relationship,
          beneficiarySharePercent: decimalToNumber(dep.beneficiarySharePercent),
        })),
      [dto],
    );

    const created = await this.prisma.unscoped.benefitEnrollmentDependent.create({
      data: {
        tenantId: existing.tenantId,
        enrollmentId,
        fullName: dto.fullName,
        relationship: dto.relationship,
        dateOfBirth: dto.dateOfBirth
          ? parseDateOnly(dto.dateOfBirth, 'dateOfBirth')
          : null,
        beneficiarySharePercent: toDecimal(dto.beneficiarySharePercent),
      },
    });

    const row = await this.findEnrollmentOrThrow(enrollmentId);

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'benefits',
      recordId: enrollmentId,
      newValue: { dependentAdded: this.toDependentRecord(created) },
    });

    return this.toEnrollmentRecord(row);
  }

  async removeDependent(
    enrollmentId: string,
    dependentId: string,
    user: AuthenticatedUser,
  ): Promise<BenefitEnrollmentRecord> {
    const existing = await this.findEnrollmentOrThrow(enrollmentId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    const dependent = existing.dependents.find((dep) => dep.id === dependentId);
    if (!dependent) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Dependent not found on this enrollment',
      });
    }
    if (existing.status !== BenefitEnrollmentStatus.active || dependent.status !== 'active') {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Only active dependents on active enrollments can be removed',
      });
    }

    await this.prisma.unscoped.benefitEnrollmentDependent.update({
      where: { id: dependentId },
      data: { status: 'cancelled' },
    });
    const row = await this.findEnrollmentOrThrow(enrollmentId);

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'benefits',
      recordId: enrollmentId,
      oldValue: { dependent: this.toDependentRecord(dependent) },
      newValue: { dependentRemoved: dependentId },
    });

    return this.toEnrollmentRecord(row);
  }

  private planInclude() {
    return {
      _count: { select: { enrollments: true } },
      enrollments: {
        where: { status: BenefitEnrollmentStatus.active },
        select: {
          _count: { select: { dependents: { where: ACTIVE_DEPENDENT } } },
        },
      },
    } satisfies Prisma.BenefitPlanInclude;
  }

  private enrollmentInclude() {
    return {
      employee: {
        select: { firstName: true, lastName: true, employeeNumber: true },
      },
      benefitPlan: {
        select: {
          name: true,
          category: true,
          provider: true,
          planTier: true,
          employerContributionAmount: true,
          dependentContributionAmount: true,
        },
      },
      dependents: { orderBy: { createdAt: 'asc' } },
    } satisfies Prisma.BenefitEnrollmentInclude;
  }

  private async openPlanIds(companyId: string): Promise<Set<string>> {
    const openPeriod = await this.findCurrentOpenEnrollment(companyId);
    if (!openPeriod || !isWithinWindow(openPeriod.startDate, openPeriod.endDate, todayDateOnly())) {
      return new Set();
    }
    return new Set(openPeriod.plans.map((row) => row.benefitPlanId));
  }

  private async assertUniquePlanName(
    companyId: string,
    name: string,
    planTier: string,
    excludeId?: string,
  ) {
    const clash = await this.prisma.unscoped.benefitPlan.findFirst({
      where: {
        companyId,
        deletedAt: null,
        name: { equals: name, mode: 'insensitive' },
        planTier: { equals: planTier, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `A ${planTier} plan named "${name}" already exists`,
      });
    }
  }

  private async findPlanOrThrow(planId: string): Promise<PlanWithCounts> {
    const row = await this.prisma.unscoped.benefitPlan.findFirst({
      where: { id: planId, deletedAt: null },
      include: this.planInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Benefit plan not found',
      });
    }
    return row;
  }

  private async findOpenEnrollmentOrThrow(
    periodId: string,
  ): Promise<OpenEnrollmentWithRelations> {
    const row = await this.prisma.unscoped.benefitOpenEnrollmentPeriod.findUnique({
      where: { id: periodId },
      include: {
        plans: { select: { benefitPlanId: true } },
        _count: { select: { enrollments: true } },
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Open enrollment period not found',
      });
    }
    return row;
  }

  private async findCurrentOpenEnrollment(
    companyId: string,
  ): Promise<OpenEnrollmentWithRelations | null> {
    return this.prisma.unscoped.benefitOpenEnrollmentPeriod.findFirst({
      where: {
        companyId,
        status: BenefitOpenEnrollmentStatus.open,
      },
      include: {
        plans: { select: { benefitPlanId: true } },
        _count: { select: { enrollments: true } },
      },
    });
  }

  private async findEnrollmentOrThrow(
    enrollmentId: string,
  ): Promise<EnrollmentWithRelations> {
    const row = await this.prisma.unscoped.benefitEnrollment.findUnique({
      where: { id: enrollmentId },
      include: this.enrollmentInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Benefit enrollment not found',
      });
    }
    return row;
  }

  private async assertEmployee(employeeId: string, companyId: string) {
    const employee = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true, tenantId: true, hireDate: true, employmentStatus: true },
    });
    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found in this company',
      });
    }
    return employee;
  }

  private async assertPlansInCompany(companyId: string, planIds: string[]) {
    if (planIds.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'At least one benefit plan must be linked to open enrollment',
      });
    }
    const count = await this.prisma.unscoped.benefitPlan.count({
      where: {
        companyId,
        deletedAt: null,
        id: { in: planIds },
        status: BenefitPlanStatus.active,
      },
    });
    if (count !== planIds.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'All linked benefit plans must be active plans in this company',
      });
    }
  }

  /** The period id for an open-enrollment election, or a 400 explaining why it isn't allowed. */
  private async assertOpenEnrollmentAccepting(
    companyId: string,
    benefitPlanId: string,
    periodId: string | undefined,
  ): Promise<string> {
    const period = periodId
      ? await this.findOpenEnrollmentOrThrow(periodId)
      : await this.findCurrentOpenEnrollment(companyId);

    if (!period || period.companyId !== companyId || period.status !== BenefitOpenEnrollmentStatus.open) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No open enrollment period is active for this company',
      });
    }
    const today = todayDateOnly();
    if (today > period.endDate) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${period.name} ended on ${formatDateOnly(period.endDate)}; use a new hire, life event or admin enrollment instead`,
      });
    }
    if (today < period.startDate) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${period.name} opens on ${formatDateOnly(period.startDate)}`,
      });
    }
    if (!period.plans.some((p) => p.benefitPlanId === benefitPlanId)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Benefit plan is not included in the active open enrollment period',
      });
    }
    return period.id;
  }

  private toPlanRecord(
    row: PlanWithCounts,
    openPlanIds: Set<string>,
  ): BenefitPlanRecord {
    const dependentCount = row.enrollments.reduce(
      (sum, enrollment) => sum + enrollment._count.dependents,
      0,
    );

    return {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      category: row.category,
      provider: row.provider,
      planTier: row.planTier,
      description: row.description,
      employerContributionLabel: row.employerContributionLabel,
      employerContributionAmount: decimalToNumber(row.employerContributionAmount),
      employeeContributionAmount: decimalToNumber(row.employeeContributionAmount) ?? 0,
      employeeContributionLabel: row.employeeContributionLabel,
      coverageLimitLabel: row.coverageLimitLabel,
      allowsDependents: row.allowsDependents,
      maxDependents: row.maxDependents,
      eligibleRelationships: row.eligibleRelationships,
      dependentContributionAmount: decimalToNumber(row.dependentContributionAmount),
      status: row.status,
      hasEnrollments: row._count.enrollments > 0,
      enrolledCount: row.enrollments.length,
      dependentCount,
      inOpenEnrollment: openPlanIds.has(row.id),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toOpenEnrollmentRecord(
    row: OpenEnrollmentWithRelations,
  ): BenefitOpenEnrollmentPeriodRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      description: row.description,
      startDate: formatDateOnly(row.startDate),
      endDate: formatDateOnly(row.endDate),
      status: row.status,
      openedAt: row.openedAt?.toISOString() ?? null,
      closedAt: row.closedAt?.toISOString() ?? null,
      acceptingEnrollments:
        row.status === BenefitOpenEnrollmentStatus.open &&
        isWithinWindow(row.startDate, row.endDate),
      planIds: row.plans.map((p) => p.benefitPlanId),
      enrollmentCount: row._count.enrollments,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toEnrollmentRecord(row: EnrollmentWithRelations): BenefitEnrollmentRecord {
    const employeeContribution = decimalToNumber(row.employeeContributionAmount);
    const activeDependents = row.dependents.filter((dep) => dep.status === 'active').length;

    return {
      id: row.id,
      companyId: row.companyId,
      employeeId: row.employeeId,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      employeeNumber: row.employee.employeeNumber,
      benefitPlanId: row.benefitPlanId,
      benefitPlanName: row.benefitPlan.name,
      benefitPlanCategory: row.benefitPlan.category,
      benefitPlanProvider: row.benefitPlan.provider,
      benefitPlanTier: row.benefitPlan.planTier,
      openEnrollmentPeriodId: row.openEnrollmentPeriodId,
      enrollmentType: row.enrollmentType,
      status: row.status,
      effectiveFrom: formatDateOnly(row.effectiveFrom),
      effectiveTo: row.effectiveTo ? formatDateOnly(row.effectiveTo) : null,
      employeeContributionAmount: employeeContribution,
      beneficiarySharePercent: decimalToNumber(row.beneficiarySharePercent),
      notes: row.notes,
      enrolledAt: row.enrolledAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      dependents: row.dependents.map((dep) => this.toDependentRecord(dep)),
      monthlyEmployeeCost: monthlyEmployeeCost(
        employeeContribution,
        decimalToNumber(row.benefitPlan.dependentContributionAmount),
        activeDependents,
      ),
      monthlyEmployerCost: decimalToNumber(row.benefitPlan.employerContributionAmount),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDependentRecord(
    row: BenefitEnrollmentDependent,
  ): BenefitEnrollmentDependentRecord {
    return {
      id: row.id,
      enrollmentId: row.enrollmentId,
      fullName: row.fullName,
      relationship: row.relationship,
      dateOfBirth: row.dateOfBirth ? formatDateOnly(row.dateOfBirth) : null,
      beneficiarySharePercent: decimalToNumber(row.beneficiarySharePercent),
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
