import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeKpiAssignmentStatus,
  EmployeePerformanceReviewStatus,
  EmploymentStatus,
  Prisma,
  type EmployeePerformanceReview,
  type PerformanceReviewCycle,
  type PerformanceReviewCycleStatus,
} from '@prisma/client';
import {
  assessmentCompletion,
  ratingLabelForScore,
  roundRating,
  type EmployeePerformanceReviewRecord,
  type PerformanceAssessmentPayload,
  type PerformanceAssessmentSide,
  type PerformanceReviewParticipantRecord,
  type PromotionRecommendationStatus,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  ExecutePromotionFromReviewDto,
  ListEmployeePerformanceReviewsQueryDto,
  SaveManagerAssessmentDto,
  SavePromotionRecommendationDto,
  SaveReviewOutcomeDto,
  SaveSelfAssessmentDto,
  SetReviewCycleParticipantsDto,
  WorkflowReviewActionDto,
} from './dto/performance.dto';
import {
  applyAssessmentPatch,
  emptyAssessmentPayload,
  managerAssessmentView,
  parseAssessmentPayload,
  RATED_KPI_STATUSES,
  syncKpiItems,
  type ReviewKpiGoal,
} from './performance-assessment.utils';
import { DataScopeService } from '../rbac/data-scope.service';
import { PermissionsService } from '../rbac/permissions.service';
import { Performance360Service } from './performance-360.service';
import { PerformanceLifecycleService } from './performance-lifecycle.service';
import { PerformanceReviewWorkflowService } from './performance-review-workflow.service';
import { computeOverallRating } from './performance-rating.utils';
import { normalize360Summary } from './performance-360.utils';
import { decimalToNumber, formatDateOnly, toDecimal } from './performance.utils';
import {
  assertCanCalibrate,
  assertPromotionConvertible,
  assertRecommendationAwaitingDecision,
  assertRecommendationEditable,
  assertRecommendationSubmittable,
  noteWithRejection,
} from './promotion.rules';
import {
  assertCycleInProgress,
  assertCycleLaunchable,
  assertCycleOpenForParticipants,
} from './review-cycle.rules';

type ReviewWithRelations = EmployeePerformanceReview & {
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string;
    hireDate?: Date;
    designationId?: string | null;
    designation?: { name: string } | null;
  };
  manager: { firstName: string; lastName: string } | null;
  reviewCycle: {
    name: string;
    requiresWorkflowApproval: boolean;
    status: PerformanceReviewCycleStatus;
    reviewDueDate: Date;
  };
  recommendedDesignation?: { name: string } | null;
};

const SELF_EDITABLE_STATUSES: EmployeePerformanceReviewStatus[] = [
  EmployeePerformanceReviewStatus.not_started,
  EmployeePerformanceReviewStatus.self_assessment_draft,
];

const MANAGER_EDITABLE_STATUSES: EmployeePerformanceReviewStatus[] = [
  EmployeePerformanceReviewStatus.self_submitted,
  EmployeePerformanceReviewStatus.manager_review,
  EmployeePerformanceReviewStatus.returned,
];

const REVIEW_GOAL_SELECT = {
  id: true,
  reviewCycleId: true,
  employeeId: true,
  title: true,
  unit: true,
  direction: true,
  targetValue: true,
  currentValue: true,
  weightPercent: true,
  measurementPeriodStart: true,
  measurementPeriodEnd: true,
  status: true,
} satisfies Prisma.EmployeeKpiAssignmentSelect;

function personName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

function goalKey(reviewCycleId: string, employeeId: string): string {
  return `${reviewCycleId}:${employeeId}`;
}

function nameList(names: string[]): string {
  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}

@Injectable()
export class PerformanceReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly reviewWorkflow: PerformanceReviewWorkflowService,
    private readonly feedback360: Performance360Service,
    private readonly performanceLifecycle: PerformanceLifecycleService,
    private readonly permissions: PermissionsService,
    private readonly dataScope: DataScopeService,
  ) {}

  async listParticipants(
    companyId: string,
    cycleId: string,
    user: AuthenticatedUser,
  ): Promise<PerformanceReviewParticipantRecord[]> {
    await this.assertCycleInCompany(cycleId, companyId);
    const employeeId = await this.dataScope.employeeIdFilter(user);

    const [rows, reviews, goals] = await Promise.all([
      this.prisma.unscoped.performanceReviewParticipant.findMany({
        where: { companyId, reviewCycleId: cycleId, employeeId },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employeeNumber: true,
              managerId: true,
              department: { select: { name: true } },
              manager: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: [{ employee: { firstName: 'asc' } }, { employee: { lastName: 'asc' } }],
      }),
      this.prisma.unscoped.employeePerformanceReview.findMany({
        where: { reviewCycleId: cycleId, employeeId },
        select: { id: true, employeeId: true, status: true },
      }),
      this.prisma.unscoped.employeeKpiAssignment.findMany({
        where: {
          reviewCycleId: cycleId,
          employeeId,
          status: { not: EmployeeKpiAssignmentStatus.cancelled },
        },
        select: { employeeId: true, status: true, weightPercent: true },
      }),
    ]);

    const reviewByEmployee = new Map(reviews.map((row) => [row.employeeId, row]));
    const goalStats = new Map<string, { rated: number; draft: number; weight: number }>();
    for (const goal of goals) {
      const stats = goalStats.get(goal.employeeId) ?? { rated: 0, draft: 0, weight: 0 };
      if (goal.status === EmployeeKpiAssignmentStatus.draft) stats.draft += 1;
      else stats.rated += 1;
      stats.weight += decimalToNumber(goal.weightPercent) ?? 0;
      goalStats.set(goal.employeeId, stats);
    }

    return rows.map((row) => {
      const review = reviewByEmployee.get(row.employeeId);
      const stats = goalStats.get(row.employeeId);
      return {
        id: row.id,
        reviewCycleId: row.reviewCycleId,
        employeeId: row.employeeId,
        employeeName: personName(row.employee),
        employeeNumber: row.employee.employeeNumber,
        departmentName: row.employee.department?.name ?? null,
        managerEmployeeId: row.employee.managerId,
        managerName: row.employee.manager ? personName(row.employee.manager) : null,
        reviewId: review?.id ?? null,
        reviewStatus: review?.status ?? null,
        ratedKpiCount: stats?.rated ?? 0,
        draftKpiCount: stats?.draft ?? 0,
        kpiWeightTotal: Math.round((stats?.weight ?? 0) * 100) / 100,
      };
    });
  }

  async setParticipants(
    companyId: string,
    cycleId: string,
    dto: SetReviewCycleParticipantsDto,
    user: AuthenticatedUser,
  ): Promise<PerformanceReviewParticipantRecord[]> {
    const cycle = await this.assertCycleInCompany(cycleId, companyId);
    assertCycleOpenForParticipants(cycle.status);

    const uniqueEmployeeIds = [...new Set(dto.employeeIds)];
    const scopeFilter = await this.dataScope.employeeIdFilter(user);
    const current = await this.prisma.unscoped.performanceReviewParticipant.findMany({
      where: { reviewCycleId: cycleId, employeeId: scopeFilter },
      select: { employeeId: true },
    });
    const currentIds = new Set(current.map((row) => row.employeeId));
    const addedIds = uniqueEmployeeIds.filter((id) => !currentIds.has(id));
    const removedIds = [...currentIds].filter((id) => !uniqueEmployeeIds.includes(id));

    const employees = await this.prisma.unscoped.employee.findMany({
      where: { id: { in: uniqueEmployeeIds }, companyId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, employmentStatus: true },
    });
    const employeeById = new Map(employees.map((row) => [row.id, row]));
    const missing = uniqueEmployeeIds.find((id) => !employeeById.has(id));
    if (missing) {
      throw new NotFoundException(`Employee ${missing} not found in company`);
    }
    const leavers = addedIds
      .map((id) => employeeById.get(id)!)
      .filter(
        (row) =>
          row.employmentStatus === EmploymentStatus.terminated ||
          row.employmentStatus === EmploymentStatus.inactive,
      );
    if (leavers.length > 0) {
      throw new BadRequestException({
        code: 'EMPLOYEE_NOT_ACTIVE',
        message: `${nameList(leavers.map(personName))} ${leavers.length === 1 ? 'is' : 'are'} no longer employed, so cannot join the review cycle`,
      });
    }
    for (const employeeId of addedIds) {
      await this.dataScope.assertEmployeeInScope(user, employeeId);
    }

    if (removedIds.length > 0) {
      const reviewed = await this.prisma.unscoped.employeePerformanceReview.findMany({
        where: {
          reviewCycleId: cycleId,
          employeeId: { in: removedIds },
          status: { not: EmployeePerformanceReviewStatus.cancelled },
        },
        select: { employee: { select: { firstName: true, lastName: true } } },
      });
      if (reviewed.length > 0) {
        const names = reviewed.map((row) => personName(row.employee));
        throw new BadRequestException({
          code: 'PARTICIPANT_HAS_REVIEW',
          message: `${nameList(names)} already ${names.length === 1 ? 'has a review' : 'have reviews'} in this cycle, so cannot be removed`,
        });
      }
    }

    await this.prisma.unscoped.$transaction(async (tx) => {
      if (removedIds.length > 0) {
        await tx.performanceReviewParticipant.deleteMany({
          where: { reviewCycleId: cycleId, employeeId: { in: removedIds } },
        });
      }
      if (addedIds.length > 0) {
        await tx.performanceReviewParticipant.createMany({
          data: addedIds.map((employeeId) => ({
            tenantId: cycle.tenantId,
            companyId,
            reviewCycleId: cycleId,
            employeeId,
          })),
          skipDuplicates: true,
        });
      }
    });

    if (addedIds.length > 0 || removedIds.length > 0) {
      await this.auditService.log({
        tenantId: cycle.tenantId,
        userId: user.id,
        action: 'update',
        module: 'performance',
        recordId: cycleId,
        newValue: {
          participantsAdded: addedIds.length,
          participantsRemoved: removedIds.length,
          participantCount: uniqueEmployeeIds.length,
        },
      });
    }

    return this.listParticipants(companyId, cycleId, user);
  }

  /** Creates reviews for participants who don't have one; safe to run again after adding people. */
  async launchReviewCycle(
    companyId: string,
    cycleId: string,
    user: AuthenticatedUser,
  ): Promise<{ participantCount: number; reviewCount: number; createdCount: number }> {
    const cycle = await this.assertCycleInCompany(cycleId, companyId);
    assertCycleLaunchable(cycle.status);

    const participants = await this.prisma.unscoped.performanceReviewParticipant.findMany({
      where: { reviewCycleId: cycleId },
      include: {
        employee: { select: { id: true, managerId: true } },
      },
    });

    if (participants.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Add at least one participating employee before launching',
      });
    }
    for (const participant of participants) {
      await this.dataScope.assertEmployeeInScope(user, participant.employeeId);
    }

    const existing = await this.prisma.unscoped.employeePerformanceReview.findMany({
      where: { reviewCycleId: cycleId },
      select: { employeeId: true },
    });
    const reviewed = new Set(existing.map((row) => row.employeeId));
    const pending = participants.filter((participant) => !reviewed.has(participant.employeeId));
    const goals = await this.goalsByEmployee(
      cycleId,
      pending.map((participant) => participant.employeeId),
    );

    await this.prisma.unscoped.$transaction(async (tx) => {
      for (const participant of pending) {
        const selfAssessment = emptyAssessmentPayload();
        selfAssessment.kpiAssessments = syncKpiItems(
          [],
          goals.get(goalKey(cycleId, participant.employeeId)) ?? [],
        );
        await tx.employeePerformanceReview.create({
          data: {
            tenantId: cycle.tenantId,
            companyId,
            reviewCycleId: cycleId,
            employeeId: participant.employeeId,
            managerEmployeeId: participant.employee.managerId,
            status: EmployeePerformanceReviewStatus.not_started,
            selfAssessment: selfAssessment as unknown as Prisma.InputJsonValue,
            managerAssessment: emptyAssessmentPayload() as unknown as Prisma.InputJsonValue,
          },
        });
      }
      await tx.performanceReviewCycle.update({
        where: { id: cycleId },
        data: {
          status: 'active',
          launchedAt: cycle.launchedAt ?? new Date(),
        },
      });
    });

    await this.auditService.log({
      tenantId: cycle.tenantId,
      userId: user.id,
      action: 'create',
      module: 'performance',
      recordId: cycleId,
      newValue: { launched: true, reviewsCreated: pending.length },
    });

    return {
      participantCount: participants.length,
      reviewCount: existing.length + pending.length,
      createdCount: pending.length,
    };
  }

  async listReviews(
    companyId: string,
    query: ListEmployeePerformanceReviewsQueryDto,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    if (query.employeeId) {
      await this.dataScope.assertEmployeeInScope(user, query.employeeId);
    }

    const rows = (await this.prisma.unscoped.employeePerformanceReview.findMany({
      where: {
        companyId,
        reviewCycleId: query.reviewCycleId,
        employeeId: query.employeeId ?? (await this.dataScope.employeeIdFilter(user)),
        status: query.status as EmployeePerformanceReviewStatus | undefined,
        managerEmployeeId: query.managerEmployeeId,
      },
      include: this.reviewInclude(),
      orderBy: [{ updatedAt: 'desc' }],
    })) as ReviewWithRelations[];

    const live = rows.filter((row) => this.kpiItemsLive(row));
    const [goals, counts] = await Promise.all([
      this.goalsForReviews(live),
      this.feedback360.countsForReviews(rows.map((row) => row.id)),
    ]);
    return Promise.all(
      rows.map((row) =>
        this.toReviewRecord(
          row,
          goals.get(goalKey(row.reviewCycleId, row.employeeId)) ?? [],
          counts.get(row.id) ?? { invited: 0, submitted: 0 },
        ),
      ),
    );
  }

  async getReview(
    reviewId: string,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const row = await this.getReviewOrThrow(reviewId, user.tenantId);
    await this.dataScope.assertEmployeeInScope(user, row.employeeId);
    return this.toReviewRecord(row, await this.reviewGoals(row));
  }

  async saveSelfAssessment(
    reviewId: string,
    dto: SaveSelfAssessmentDto,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId, user.tenantId);
    await this.assertCanEditSelf(review, user);
    this.assertSelfEditable(review);

    const goals = await this.reviewGoals(review);
    const next = applyAssessmentPatch(this.currentSelf(review, goals), 'self', {
      competencies: dto.competencies,
      kpiAssessments: dto.kpiAssessments,
      overallComment: dto.overallSelfComment,
    });

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: {
        selfAssessment: next as unknown as Prisma.InputJsonValue,
        status: EmployeePerformanceReviewStatus.self_assessment_draft,
      },
      include: this.reviewInclude(),
    });

    return this.toReviewRecord(row as ReviewWithRelations, goals);
  }

  async submitSelfAssessment(
    reviewId: string,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId, user.tenantId);
    await this.assertCanEditSelf(review, user);
    this.assertSelfEditable(review);

    const goals = await this.reviewGoals(review);
    const selfAssessment = this.currentSelf(review, goals);
    this.assertComplete(selfAssessment, 'self');

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: {
        selfAssessment: selfAssessment as unknown as Prisma.InputJsonValue,
        status: EmployeePerformanceReviewStatus.self_submitted,
        selfSubmittedAt: new Date(),
        returnReason: null,
        returnedAt: null,
      },
      include: this.reviewInclude(),
    });

    await this.auditService.log({
      tenantId: review.tenantId,
      userId: user.id,
      action: 'update',
      module: 'performance',
      recordId: reviewId,
      newValue: { selfSubmitted: true, onBehalf: user.employeeId !== review.employeeId },
    });

    return this.toReviewRecord(row as ReviewWithRelations, goals);
  }

  async saveManagerAssessment(
    reviewId: string,
    dto: SaveManagerAssessmentDto,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId, user.tenantId);
    await this.assertCanEditManager(review, user);
    assertCycleInProgress(review.reviewCycle.status);

    if (!MANAGER_EDITABLE_STATUSES.includes(review.status)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          review.status === EmployeePerformanceReviewStatus.not_started ||
          review.status === EmployeePerformanceReviewStatus.self_assessment_draft
            ? 'The manager assessment opens once the employee submits their self-assessment'
            : 'Manager assessment cannot be edited in the current review status',
      });
    }

    const goals = await this.reviewGoals(review);
    const selfAssessment = this.currentSelf(review, goals);
    const next = applyAssessmentPatch(
      managerAssessmentView(selfAssessment, parseAssessmentPayload(review.managerAssessment)),
      'manager',
      {
        competencies: dto.competencies,
        kpiAssessments: dto.kpiAssessments,
        overallComment: dto.overallManagerComment,
      },
    );

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: {
        selfAssessment: selfAssessment as unknown as Prisma.InputJsonValue,
        managerAssessment: next as unknown as Prisma.InputJsonValue,
        status: EmployeePerformanceReviewStatus.manager_review,
      },
      include: this.reviewInclude(),
    });

    return this.toReviewRecord(row as ReviewWithRelations, goals);
  }

  async submitManagerAssessment(
    reviewId: string,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId, user.tenantId);
    await this.assertCanEditManager(review, user);
    assertCycleInProgress(review.reviewCycle.status);

    if (review.status !== EmployeePerformanceReviewStatus.manager_review) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Submit manager assessment after saving the manager review form',
      });
    }

    const goals = await this.reviewGoals(review);
    const selfAssessment = this.currentSelf(review, goals);
    const managerAssessment = managerAssessmentView(
      selfAssessment,
      parseAssessmentPayload(review.managerAssessment),
    );
    this.assertComplete(managerAssessment, 'manager');

    const cycle = review.reviewCycle;
    const nextStatus = cycle.requiresWorkflowApproval
      ? EmployeePerformanceReviewStatus.pending_approval
      : EmployeePerformanceReviewStatus.approved;

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: {
        selfAssessment: selfAssessment as unknown as Prisma.InputJsonValue,
        managerAssessment: managerAssessment as unknown as Prisma.InputJsonValue,
        status: nextStatus,
        managerSubmittedAt: new Date(),
        approvedAt: cycle.requiresWorkflowApproval ? null : new Date(),
        returnReason: null,
        returnedAt: null,
      },
      include: this.reviewInclude(),
    });

    if (cycle.requiresWorkflowApproval) {
      await this.reviewWorkflow.startForReview({
        companyId: review.companyId,
        tenantId: review.tenantId,
        reviewId,
        requesterEmployeeId: review.employeeId,
        requesterUserId: user.id,
      });
    }

    await this.auditService.log({
      tenantId: review.tenantId,
      userId: user.id,
      action: 'update',
      module: 'performance',
      recordId: reviewId,
      newValue: { managerSubmitted: true, workflow: cycle.requiresWorkflowApproval },
    });

    if (!cycle.requiresWorkflowApproval) {
      await this.finalizeReview(reviewId, user);
      return this.toReviewRecord(await this.getReviewOrThrow(reviewId, user.tenantId));
    }

    return this.toReviewRecord(row as ReviewWithRelations);
  }

  async approveReviewWorkflow(
    reviewId: string,
    dto: WorkflowReviewActionDto,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId, user.tenantId);
    this.assertNotOwnSignOff(review, user);
    await this.dataScope.assertEmployeeInScope(user, review.employeeId, { includeSelf: false });
    if (review.status !== EmployeePerformanceReviewStatus.pending_approval) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Review is not pending workflow approval',
      });
    }

    const result = await this.reviewWorkflow.approve({
      reviewId,
      user,
      comment: dto.comment,
      audit: {
        tenantId: review.tenantId,
        module: 'performance',
        recordId: reviewId,
      },
      companyId: review.companyId,
      tenantId: review.tenantId,
      requesterEmployeeId: review.employeeId,
      requesterUserId: user.id,
    });

    let status: EmployeePerformanceReviewStatus =
      EmployeePerformanceReviewStatus.pending_approval;
    if (result.fullyApproved) {
      status = EmployeePerformanceReviewStatus.approved;
    }

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: {
        status,
        approvedAt: result.fullyApproved ? new Date() : null,
      },
      include: this.reviewInclude(),
    });

    if (result.fullyApproved) {
      await this.finalizeReview(reviewId, user);
      return this.toReviewRecord(await this.getReviewOrThrow(reviewId, user.tenantId));
    }

    return this.toReviewRecord(row as ReviewWithRelations);
  }

  async rejectReviewWorkflow(
    reviewId: string,
    dto: WorkflowReviewActionDto,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId, user.tenantId);
    this.assertNotOwnSignOff(review, user);
    await this.dataScope.assertEmployeeInScope(user, review.employeeId, { includeSelf: false });
    if (review.status !== EmployeePerformanceReviewStatus.pending_approval) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Review is not pending workflow approval',
      });
    }

    await this.reviewWorkflow.reject({
      reviewId,
      user,
      comment: dto.comment,
      audit: {
        tenantId: review.tenantId,
        module: 'performance',
        recordId: reviewId,
      },
      companyId: review.companyId,
      tenantId: review.tenantId,
      requesterEmployeeId: review.employeeId,
      requesterUserId: user.id,
    });

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: {
        status: EmployeePerformanceReviewStatus.returned,
        returnedAt: new Date(),
        returnReason: dto.comment?.trim() || 'Returned for revision',
      },
      include: this.reviewInclude(),
    });

    return this.toReviewRecord(row as ReviewWithRelations);
  }

  /** Calibrates the overall rating, or clears the calibration (null) to use the calculated rating. */
  async saveReviewOutcome(
    reviewId: string,
    dto: SaveReviewOutcomeDto,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId, user.tenantId);
    this.assertNotOwnSignOff(review, user);
    await this.permissions.assertPermission(user, 'performance', 'approve');
    await this.dataScope.assertEmployeeInScope(user, review.employeeId, { includeSelf: false });
    assertCanCalibrate({
      reviewStatus: review.status,
      cycleStatus: review.reviewCycle.status,
      promotionStatus: review.promotionRecommendationStatus,
    });

    const approved = review.status === EmployeePerformanceReviewStatus.approved;
    const calculated = approved
      ? computeOverallRating({
          managerAssessment: parseAssessmentPayload(review.managerAssessment),
          feedback360Summary: normalize360Summary(review.performance360Summary),
        }).overallRating
      : null;
    const next = dto.overallRating != null ? roundRating(dto.overallRating) : calculated;
    const before = review.overallRating?.toNumber() ?? null;

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: {
        overallRating: next != null ? toDecimal(next) : null,
        overallRatingLabel: next != null ? ratingLabelForScore(next) : null,
      },
      include: this.reviewInclude(),
    });

    if (approved && next != null && review.performanceLifecycleEventId) {
      await this.performanceLifecycle.syncReviewOutcomeRating(
        review.performanceLifecycleEventId,
        next,
        dto.overallRating != null,
      );
    }

    await this.auditService.log({
      tenantId: review.tenantId,
      userId: user.id,
      action: 'update',
      module: 'performance',
      recordId: reviewId,
      oldValue: { overallRating: before },
      newValue: {
        overallRating: next,
        calibrated: dto.overallRating != null,
        calibrationReason: dto.reason?.trim() || undefined,
      },
    });

    return this.toReviewRecord(row as ReviewWithRelations);
  }

  async savePromotionRecommendation(
    reviewId: string,
    dto: SavePromotionRecommendationDto,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId, user.tenantId);
    await this.assertCanEditManager(review, user);
    assertRecommendationEditable({
      reviewStatus: review.status,
      cycleStatus: review.reviewCycle.status,
      promotionStatus: review.promotionRecommendationStatus,
    });

    let data: Prisma.EmployeePerformanceReviewUpdateInput;
    if (dto.promotionRecommended) {
      const designationId = dto.recommendedDesignationId ?? review.recommendedDesignationId;
      if (!designationId) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Choose the designation you are recommending',
        });
      }
      if (designationId === review.employee.designationId) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `${personName(review.employee)} already holds this designation`,
        });
      }
      const designation = await this.prisma.unscoped.designation.findFirst({
        where: { id: designationId, companyId: review.companyId },
        select: { id: true },
      });
      if (!designation) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'The designation does not belong to this company',
        });
      }
      data = {
        promotionRecommended: true,
        recommendedDesignation: { connect: { id: designationId } },
        promotionRecommendationNote:
          dto.promotionRecommendationNote === undefined
            ? review.promotionRecommendationNote
            : dto.promotionRecommendationNote?.trim() || null,
        promotionRecommendationStatus: 'draft',
      };
    } else {
      data = {
        promotionRecommended: false,
        recommendedDesignation: { disconnect: true },
        promotionRecommendationNote: null,
        promotionRecommendationStatus: 'none',
      };
    }

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data,
      include: this.reviewInclude(),
    });
    await this.auditPromotion(review, user, dto.promotionRecommended ? 'draft' : 'none', {
      recommendedDesignation: row.recommendedDesignation?.name ?? null,
    });
    return this.toReviewRecord(row as ReviewWithRelations);
  }

  async submitPromotionRecommendation(
    reviewId: string,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId, user.tenantId);
    await this.assertCanEditManager(review, user);
    assertRecommendationEditable({
      reviewStatus: review.status,
      cycleStatus: review.reviewCycle.status,
      promotionStatus: review.promotionRecommendationStatus,
    });
    assertRecommendationSubmittable({
      promotionStatus: review.promotionRecommendationStatus,
      promotionRecommended: review.promotionRecommended,
      recommendedDesignationId: review.recommendedDesignationId,
      note: review.promotionRecommendationNote,
    });

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: { promotionRecommendationStatus: 'submitted' },
      include: this.reviewInclude(),
    });
    await this.auditPromotion(review, user, 'submitted');
    return this.toReviewRecord(row as ReviewWithRelations);
  }

  async approvePromotionRecommendation(
    reviewId: string,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId, user.tenantId);
    this.assertNotOwnSignOff(review, user);
    await this.assertPromotionAuthority(user, review, 'approve');
    assertRecommendationAwaitingDecision(review.promotionRecommendationStatus);

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: { promotionRecommendationStatus: 'approved' },
      include: this.reviewInclude(),
    });
    await this.auditPromotion(review, user, 'approved');
    return this.toReviewRecord(row as ReviewWithRelations);
  }

  async rejectPromotionRecommendation(
    reviewId: string,
    dto: WorkflowReviewActionDto,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId, user.tenantId);
    this.assertNotOwnSignOff(review, user);
    await this.assertPromotionAuthority(user, review, 'approve');
    assertRecommendationAwaitingDecision(review.promotionRecommendationStatus);
    const reason = dto.comment?.trim();
    if (!reason) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Give a reason so the manager knows what to change',
      });
    }

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: {
        promotionRecommendationStatus: 'rejected',
        promotionRecommendationNote: noteWithRejection(
          review.promotionRecommendationNote,
          reason,
          formatDateOnly(new Date()),
        ),
      },
      include: this.reviewInclude(),
    });
    await this.auditPromotion(review, user, 'rejected', { reason });
    return this.toReviewRecord(row as ReviewWithRelations);
  }

  /** Records the approved recommendation as a promotion lifecycle event on the employee. */
  async executePromotionFromReview(
    reviewId: string,
    dto: ExecutePromotionFromReviewDto,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId, user.tenantId);
    this.assertNotOwnSignOff(review, user);
    await this.assertPromotionAuthority(user, review, 'edit');
    assertPromotionConvertible({
      reviewStatus: review.status,
      promotionStatus: review.promotionRecommendationStatus,
    });

    const eventId = await this.performanceLifecycle.convertPromotionRecommendation(review, user, dto);
    await this.auditPromotion(review, user, 'executed', { lifecycleEventId: eventId });
    return this.toReviewRecord(await this.getReviewOrThrow(reviewId, user.tenantId));
  }

  async listPerformanceHistory(
    companyId: string,
    employeeId: string,
    user: AuthenticatedUser,
  ): Promise<
    Array<{
      reviewCycleName: string;
      overallRating: number | null;
      overallRatingLabel: string | null;
      approvedAt: string | null;
    }>
  > {
    await this.companyScope.assertCompanyInTenant(companyId);
    await this.dataScope.assertEmployeeInScope(user, employeeId);
    const rows = await this.prisma.unscoped.employeePerformanceReview.findMany({
      where: {
        companyId,
        employeeId,
        status: EmployeePerformanceReviewStatus.approved,
      },
      include: { reviewCycle: { select: { name: true, periodEnd: true } } },
      orderBy: [{ reviewCycle: { periodEnd: 'asc' } }],
    });

    return rows.map((row) => ({
      reviewCycleName: row.reviewCycle.name,
      overallRating: row.overallRating?.toNumber() ?? null,
      overallRatingLabel: row.overallRating ? ratingLabelForScore(row.overallRating.toNumber()) : null,
      approvedAt: row.approvedAt?.toISOString() ?? null,
    }));
  }

  private async finalizeReview(reviewId: string, user: AuthenticatedUser): Promise<void> {
    const summary = await this.feedback360.computeAndPersistSummary(reviewId);
    const review = await this.getReviewOrThrow(reviewId, user.tenantId);
    const managerAssessment = parseAssessmentPayload(review.managerAssessment);
    const existingOverride = review.overallRating?.toNumber() ?? null;
    const { overallRating, overallRatingLabel } = computeOverallRating({
      managerAssessment,
      feedback360Summary: summary,
      overrideRating: existingOverride,
    });

    const updated = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: {
        overallRating: toDecimal(overallRating),
        overallRatingLabel,
        performance360Summary: summary as unknown as Prisma.InputJsonValue,
        approvedAt: review.approvedAt ?? new Date(),
      },
      include: this.reviewInclude(),
    });

    await this.performanceLifecycle.recordPerformanceReviewOutcome(
      updated as ReviewWithRelations,
      user,
    );
  }

  private reviewInclude() {
    return {
      employee: {
        select: {
          firstName: true,
          lastName: true,
          employeeNumber: true,
          hireDate: true,
          designationId: true,
          designation: { select: { name: true } },
        },
      },
      manager: { select: { firstName: true, lastName: true } },
      reviewCycle: {
        select: { name: true, requiresWorkflowApproval: true, status: true, reviewDueDate: true },
      },
      recommendedDesignation: { select: { name: true } },
    } satisfies Prisma.EmployeePerformanceReviewInclude;
  }

  private async getReviewOrThrow(
    reviewId: string,
    tenantId: string | null,
  ): Promise<ReviewWithRelations> {
    const row = tenantId
      ? await this.prisma.unscoped.employeePerformanceReview.findFirst({
          where: { id: reviewId, tenantId },
          include: this.reviewInclude(),
        })
      : null;
    if (!row) {
      throw new NotFoundException('Performance review not found');
    }
    return row as ReviewWithRelations;
  }

  private async assertCycleInCompany(
    cycleId: string,
    companyId: string,
  ): Promise<PerformanceReviewCycle> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const cycle = await this.prisma.unscoped.performanceReviewCycle.findFirst({
      where: { id: cycleId, companyId },
    });
    if (!cycle) {
      throw new NotFoundException('Review cycle not found');
    }
    return cycle;
  }

  /** KPI items follow the live goals until the manager submits, while the cycle is in progress. */
  private kpiItemsLive(row: ReviewWithRelations): boolean {
    return (
      row.managerSubmittedAt == null &&
      row.reviewCycle.status === 'active' &&
      row.status !== EmployeePerformanceReviewStatus.cancelled
    );
  }

  private async goalsByEmployee(
    reviewCycleId: string,
    employeeIds: string[],
  ): Promise<Map<string, ReviewKpiGoal[]>> {
    return this.loadGoals({ reviewCycleId, employeeId: { in: employeeIds } }, employeeIds.length);
  }

  private async goalsForReviews(
    rows: ReviewWithRelations[],
  ): Promise<Map<string, ReviewKpiGoal[]>> {
    return this.loadGoals(
      {
        reviewCycleId: { in: [...new Set(rows.map((row) => row.reviewCycleId))] },
        employeeId: { in: [...new Set(rows.map((row) => row.employeeId))] },
      },
      rows.length,
    );
  }

  private async loadGoals(
    where: Prisma.EmployeeKpiAssignmentWhereInput,
    count: number,
  ): Promise<Map<string, ReviewKpiGoal[]>> {
    const grouped = new Map<string, ReviewKpiGoal[]>();
    if (count === 0) return grouped;
    const goals = await this.prisma.unscoped.employeeKpiAssignment.findMany({
      where: { ...where, status: { in: RATED_KPI_STATUSES } },
      select: REVIEW_GOAL_SELECT,
      orderBy: [{ measurementPeriodStart: 'asc' }, { title: 'asc' }],
    });
    for (const goal of goals) {
      const key = goalKey(goal.reviewCycleId, goal.employeeId);
      grouped.set(key, [...(grouped.get(key) ?? []), goal]);
    }
    return grouped;
  }

  /** The review's current goals, or undefined once its KPI items are frozen. */
  private async reviewGoals(row: ReviewWithRelations): Promise<ReviewKpiGoal[] | undefined> {
    if (!this.kpiItemsLive(row)) return undefined;
    const goals = await this.goalsByEmployee(row.reviewCycleId, [row.employeeId]);
    return goals.get(goalKey(row.reviewCycleId, row.employeeId)) ?? [];
  }

  private currentSelf(
    row: ReviewWithRelations,
    goals: ReviewKpiGoal[] | undefined,
  ): PerformanceAssessmentPayload {
    const self = parseAssessmentPayload(row.selfAssessment);
    return goals ? { ...self, kpiAssessments: syncKpiItems(self.kpiAssessments, goals) } : self;
  }

  private assertSelfEditable(review: ReviewWithRelations): void {
    assertCycleInProgress(review.reviewCycle.status);
    if (!SELF_EDITABLE_STATUSES.includes(review.status)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: review.selfSubmittedAt
          ? 'The self-assessment has already been submitted'
          : 'Self assessment cannot be edited in the current review status',
      });
    }
  }

  private assertComplete(
    payload: PerformanceAssessmentPayload,
    side: PerformanceAssessmentSide,
  ): void {
    const { missing } = assessmentCompletion(payload, side);
    if (missing.length > 0) {
      throw new BadRequestException({
        code: 'INCOMPLETE_ASSESSMENT',
        message: `Rate every competency and KPI goal before submitting. Still unrated: ${nameList(missing)}`,
      });
    }
  }

  /** Promotions change the employee record, so they need employee permissions on top of performance:approve. */
  private async assertPromotionAuthority(
    user: AuthenticatedUser,
    review: ReviewWithRelations,
    employeeAction: 'approve' | 'edit',
  ): Promise<void> {
    await this.permissions.assertPermission(user, 'employee', employeeAction);
    await this.dataScope.assertEmployeeInScope(user, review.employeeId, { includeSelf: false });
  }

  private async hasHrOverride(user: AuthenticatedUser): Promise<boolean> {
    return (
      this.permissions.hasPermission(user, 'performance', 'edit') &&
      (await this.dataScope.isOrgWide(user))
    );
  }

  private async assertCanEditSelf(
    review: ReviewWithRelations,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.employeeId === review.employeeId) return;
    if (await this.hasHrOverride(user)) return;
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Only the review subject can edit self assessment',
    });
  }

  private async auditPromotion(
    review: ReviewWithRelations,
    user: AuthenticatedUser,
    status: PromotionRecommendationStatus,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await this.auditService.log({
      tenantId: review.tenantId,
      userId: user.id,
      action: 'update',
      module: 'performance',
      recordId: review.id,
      oldValue: { promotionRecommendationStatus: review.promotionRecommendationStatus },
      newValue: { promotionRecommendationStatus: status, ...extra },
    });
  }

  private assertNotOwnSignOff(review: ReviewWithRelations, user: AuthenticatedUser): void {
    if (user.employeeId && user.employeeId === review.employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You cannot sign off on your own review',
      });
    }
  }

  private async assertCanEditManager(
    review: ReviewWithRelations,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.employeeId && user.employeeId === review.employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You cannot complete the manager assessment of your own review',
      });
    }
    if (user.employeeId && user.employeeId === review.managerEmployeeId) {
      await this.dataScope.assertEmployeeInScope(user, review.employeeId, { includeSelf: false });
      return;
    }
    if (await this.hasHrOverride(user)) return;
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Only the assigned manager or HR can edit manager assessment',
    });
  }

  private async toReviewRecord(
    row: ReviewWithRelations,
    goals?: ReviewKpiGoal[],
    feedbackCounts?: { invited: number; submitted: number },
  ): Promise<EmployeePerformanceReviewRecord> {
    const workflow = await this.reviewWorkflow.findForReview(row.id);
    const counts =
      feedbackCounts ??
      (await this.feedback360.countsForReviews([row.id])).get(row.id) ?? { invited: 0, submitted: 0 };
    const overallRating = row.overallRating?.toNumber() ?? null;
    const live = this.kpiItemsLive(row);
    const selfAssessment = this.currentSelf(
      row,
      live ? (goals ?? (await this.reviewGoals(row))) : undefined,
    );
    return {
      id: row.id,
      companyId: row.companyId,
      reviewCycleId: row.reviewCycleId,
      reviewCycleName: row.reviewCycle.name,
      reviewCycleStatus: row.reviewCycle.status,
      reviewDueDate: formatDateOnly(row.reviewCycle.reviewDueDate),
      employeeId: row.employeeId,
      employeeName: personName(row.employee),
      employeeNumber: row.employee.employeeNumber,
      employeeDesignationId: row.employee.designationId ?? null,
      employeeDesignationName: row.employee.designation?.name ?? null,
      managerEmployeeId: row.managerEmployeeId,
      managerName: row.manager ? personName(row.manager) : null,
      status: row.status,
      feedback360InvitedCount: counts.invited,
      feedback360SubmittedCount: counts.submitted,
      kpiItemsLive: live,
      selfAssessment,
      managerAssessment: managerAssessmentView(
        selfAssessment,
        parseAssessmentPayload(row.managerAssessment),
      ),
      selfSubmittedAt: row.selfSubmittedAt?.toISOString() ?? null,
      managerSubmittedAt: row.managerSubmittedAt?.toISOString() ?? null,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      returnedAt: row.returnedAt?.toISOString() ?? null,
      returnReason: row.returnReason,
      overallRating,
      overallRatingLabel: overallRating != null ? ratingLabelForScore(overallRating) : null,
      performance360Summary: normalize360Summary(row.performance360Summary),
      promotionRecommended: row.promotionRecommended,
      recommendedDesignationId: row.recommendedDesignationId,
      recommendedDesignationName: row.recommendedDesignation?.name ?? null,
      promotionRecommendationNote: row.promotionRecommendationNote,
      promotionRecommendationStatus: row.promotionRecommendationStatus,
      performanceLifecycleEventId: row.performanceLifecycleEventId,
      promotionLifecycleEventId: row.promotionLifecycleEventId,
      workflowInstanceId: workflow?.id ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
