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
  Prisma,
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
  CreateBenefitEnrollmentDto,
  CreateBenefitOpenEnrollmentDto,
  CreateBenefitPlanDto,
  ListBenefitEnrollmentsQueryDto,
  UpdateBenefitPlanDto,
} from './dto/benefits.dto';
import {
  decimalToNumber,
  formatDateOnly,
  parseDateOnly,
  toDecimal,
} from './benefits.utils';

type PlanWithCounts = BenefitPlan & {
  _count: { enrollments: number };
};

type EnrollmentWithRelations = BenefitEnrollment & {
  employee: { firstName: string; lastName: string; employeeNumber: string };
  benefitPlan: { name: string };
  dependents: BenefitEnrollmentDependent[];
};

type OpenEnrollmentWithRelations = BenefitOpenEnrollmentPeriod & {
  plans: { benefitPlanId: string }[];
  _count: { enrollments: number };
};

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
            status: 'active',
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
    const openPeriod = await this.findCurrentOpenEnrollment(companyId);
    const openPlanIds = new Set(
      openPeriod?.plans.map((row) => row.benefitPlanId) ?? [],
    );

    const rows = await this.prisma.unscoped.benefitPlan.findMany({
      where: { companyId, deletedAt: null },
      include: {
        _count: {
          select: {
            enrollments: { where: { status: BenefitEnrollmentStatus.active } },
          },
        },
        enrollments: {
          where: { status: BenefitEnrollmentStatus.active },
          select: {
            _count: { select: { dependents: { where: { status: 'active' } } } },
          },
        },
      },
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

    const row = await this.prisma.unscoped.benefitPlan.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        name: dto.name.trim(),
        category: dto.category,
        provider: dto.provider.trim(),
        planTier: dto.planTier.trim(),
        description: dto.description?.trim() ?? null,
        employerContributionLabel: dto.employerContributionLabel?.trim() ?? null,
        employerContributionAmount: toDecimal(dto.employerContributionAmount),
        employeeContributionAmount: toDecimal(dto.employeeContributionAmount ?? 0)!,
        employeeContributionLabel: dto.employeeContributionLabel?.trim() ?? null,
        coverageLimitLabel: dto.coverageLimitLabel?.trim() ?? null,
        status: (dto.status as BenefitPlanStatus) ?? BenefitPlanStatus.draft,
      },
      include: {
        _count: {
          select: {
            enrollments: { where: { status: BenefitEnrollmentStatus.active } },
          },
        },
        enrollments: {
          where: { status: BenefitEnrollmentStatus.active },
          select: {
            _count: { select: { dependents: { where: { status: 'active' } } } },
          },
        },
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'benefits',
      recordId: row.id,
      newValue: this.toPlanRecord(row, new Set()) as unknown as Record<string, unknown>,
    });

    return this.toPlanRecord(row, new Set());
  }

  async updatePlan(
    planId: string,
    dto: UpdateBenefitPlanDto,
    user: AuthenticatedUser,
  ): Promise<BenefitPlanRecord> {
    const existing = await this.findPlanOrThrow(planId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    const row = await this.prisma.unscoped.benefitPlan.update({
      where: { id: planId },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.category != null ? { category: dto.category } : {}),
        ...(dto.provider != null ? { provider: dto.provider.trim() } : {}),
        ...(dto.planTier != null ? { planTier: dto.planTier.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() ?? null }
          : {}),
        ...(dto.employerContributionLabel !== undefined
          ? { employerContributionLabel: dto.employerContributionLabel?.trim() ?? null }
          : {}),
        ...(dto.employerContributionAmount !== undefined
          ? { employerContributionAmount: toDecimal(dto.employerContributionAmount) }
          : {}),
        ...(dto.employeeContributionAmount !== undefined
          ? { employeeContributionAmount: toDecimal(dto.employeeContributionAmount)! }
          : {}),
        ...(dto.employeeContributionLabel !== undefined
          ? { employeeContributionLabel: dto.employeeContributionLabel?.trim() ?? null }
          : {}),
        ...(dto.coverageLimitLabel !== undefined
          ? { coverageLimitLabel: dto.coverageLimitLabel?.trim() ?? null }
          : {}),
        ...(dto.status != null ? { status: dto.status as BenefitPlanStatus } : {}),
      },
      include: {
        _count: {
          select: {
            enrollments: { where: { status: BenefitEnrollmentStatus.active } },
          },
        },
        enrollments: {
          where: { status: BenefitEnrollmentStatus.active },
          select: {
            _count: { select: { dependents: { where: { status: 'active' } } } },
          },
        },
      },
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'benefits',
      recordId: planId,
      oldValue: this.toPlanRecord(existing, new Set()) as unknown as Record<string, unknown>,
      newValue: this.toPlanRecord(row, new Set()) as unknown as Record<string, unknown>,
    });

    const openPeriod = await this.findCurrentOpenEnrollment(existing.companyId);
    const openPlanIds = new Set(openPeriod?.plans.map((p) => p.benefitPlanId) ?? []);
    return this.toPlanRecord(row, openPlanIds);
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
    await this.assertEmployee(dto.employeeId, companyId);
    const plan = await this.findPlanOrThrow(dto.benefitPlanId);

    if (plan.companyId !== companyId || plan.deletedAt) {
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

    let openEnrollmentPeriodId = dto.openEnrollmentPeriodId ?? null;
    if (dto.enrollmentType === 'open_enrollment') {
      if (!openEnrollmentPeriodId) {
        const openPeriod = await this.findCurrentOpenEnrollment(companyId);
        openEnrollmentPeriodId = openPeriod?.id ?? null;
      }
      if (!openEnrollmentPeriodId) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'No open enrollment period is active for this company',
        });
      }
      await this.assertPlanInOpenEnrollment(openEnrollmentPeriodId, plan.id);
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
        notes: dto.notes?.trim() ?? null,
        enrolledAt: new Date(),
        dependents: dto.dependents?.length
          ? {
              create: dto.dependents.map((dep) => ({
                tenantId: company.tenantId,
                fullName: dep.fullName.trim(),
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

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'benefits',
      recordId: row.id,
      newValue: this.toEnrollmentRecord(row) as unknown as Record<string, unknown>,
    });

    return this.toEnrollmentRecord(row);
  }

  async cancelEnrollment(
    enrollmentId: string,
    user: AuthenticatedUser,
  ): Promise<BenefitEnrollmentRecord> {
    const existing = await this.findEnrollmentOrThrow(enrollmentId);
    await this.companyScope.assertCompanyInTenant(existing.companyId);

    if (existing.status === BenefitEnrollmentStatus.cancelled) {
      return this.toEnrollmentRecord(existing);
    }

    const row = await this.prisma.unscoped.benefitEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: BenefitEnrollmentStatus.cancelled,
        cancelledAt: new Date(),
        effectiveTo: existing.effectiveTo ?? new Date(),
        dependents: {
          updateMany: {
            where: { status: 'active' },
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
      oldValue: { status: existing.status },
      newValue: { status: row.status },
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

    await this.prisma.unscoped.benefitEnrollmentDependent.create({
      data: {
        tenantId: existing.tenantId,
        enrollmentId,
        fullName: dto.fullName.trim(),
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
      newValue: { dependentAdded: dto.fullName.trim() },
    });

    return this.toEnrollmentRecord(row);
  }

  private enrollmentInclude(): Prisma.BenefitEnrollmentInclude {
    return {
      employee: {
        select: { firstName: true, lastName: true, employeeNumber: true },
      },
      benefitPlan: { select: { name: true } },
      dependents: { orderBy: { createdAt: 'asc' } },
    };
  }

  private async findPlanOrThrow(planId: string) {
    const row = await this.prisma.unscoped.benefitPlan.findFirst({
      where: { id: planId, deletedAt: null },
      include: {
        _count: {
          select: {
            enrollments: { where: { status: BenefitEnrollmentStatus.active } },
          },
        },
        enrollments: {
          where: { status: BenefitEnrollmentStatus.active },
          select: {
            _count: { select: { dependents: { where: { status: 'active' } } } },
          },
        },
      },
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
      select: { id: true, tenantId: true },
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

  private async assertPlanInOpenEnrollment(
    periodId: string,
    benefitPlanId: string,
  ): Promise<void> {
    const period = await this.findOpenEnrollmentOrThrow(periodId);
    if (period.status !== BenefitOpenEnrollmentStatus.open) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Open enrollment period is not currently open',
      });
    }
    const linked = period.plans.some((p) => p.benefitPlanId === benefitPlanId);
    if (!linked) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Benefit plan is not included in the active open enrollment period',
      });
    }
  }

  private toPlanRecord(
    row: PlanWithCounts & {
      enrollments?: { _count: { dependents: number } }[];
    },
    openPlanIds: Set<string>,
  ): BenefitPlanRecord {
    const dependentCount =
      row.enrollments?.reduce(
        (sum, enrollment) => sum + enrollment._count.dependents,
        0,
      ) ?? 0;

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
      status: row.status,
      enrolledCount: row._count.enrollments,
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
      planIds: row.plans.map((p) => p.benefitPlanId),
      enrollmentCount: row._count.enrollments,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toEnrollmentRecord(row: EnrollmentWithRelations): BenefitEnrollmentRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      employeeId: row.employeeId,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      employeeNumber: row.employee.employeeNumber,
      benefitPlanId: row.benefitPlanId,
      benefitPlanName: row.benefitPlan.name,
      openEnrollmentPeriodId: row.openEnrollmentPeriodId,
      enrollmentType: row.enrollmentType,
      status: row.status,
      effectiveFrom: formatDateOnly(row.effectiveFrom),
      effectiveTo: row.effectiveTo ? formatDateOnly(row.effectiveTo) : null,
      employeeContributionAmount: decimalToNumber(row.employeeContributionAmount),
      beneficiarySharePercent: decimalToNumber(row.beneficiarySharePercent),
      notes: row.notes,
      enrolledAt: row.enrolledAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      dependents: row.dependents.map((dep) => this.toDependentRecord(dep)),
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
