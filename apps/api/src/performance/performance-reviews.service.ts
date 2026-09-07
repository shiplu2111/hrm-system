import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeKpiAssignmentStatus,
  EmployeePerformanceReviewStatus,
  PerformanceReviewCycleStatus,
  Prisma,
  type EmployeePerformanceReview,
  type PerformanceReviewCycle,
} from '@prisma/client';
import type {
  EmployeePerformanceReviewRecord,
  PerformanceAssessmentPayload,
  Performance360Summary,
  PerformanceReviewParticipantRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  ExecutePromotionFromReviewDto,
  ListEmployeePerformanceReviewsQueryDto,
  SaveManagerAssessmentDto,
  SaveReviewOutcomeDto,
  SaveSelfAssessmentDto,
  SetReviewCycleParticipantsDto,
  WorkflowReviewActionDto,
} from './dto/performance.dto';
import {
  buildKpiAssessmentItems,
  emptyAssessmentPayload,
  mergeManagerAssessment,
  mergeSelfAssessment,
  parseAssessmentPayload,
} from './performance-assessment.utils';
import { Performance360Service } from './performance-360.service';
import { PerformanceLifecycleService } from './performance-lifecycle.service';
import { PerformanceReviewWorkflowService } from './performance-review-workflow.service';
import { computeOverallRating } from './performance-rating.utils';
import { formatDateOnly, toDecimal } from './performance.utils';

type ReviewWithRelations = EmployeePerformanceReview & {
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string;
    hireDate?: Date;
    designationId?: string | null;
  };
  manager: { firstName: string; lastName: string } | null;
  reviewCycle: { name: string; requiresWorkflowApproval: boolean };
  recommendedDesignation?: { name: string } | null;
};

type ParticipantWithRelations = {
  id: string;
  reviewCycleId: string;
  employeeId: string;
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string;
    department: { name: string } | null;
    manager: { firstName: string; lastName: string } | null;
  };
  reviewCycle: {
    reviews: Array<{ id: string; status: EmployeePerformanceReviewStatus }>;
  };
};

@Injectable()
export class PerformanceReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly reviewWorkflow: PerformanceReviewWorkflowService,
    private readonly feedback360: Performance360Service,
    private readonly performanceLifecycle: PerformanceLifecycleService,
  ) {}

  async listParticipants(
    companyId: string,
    cycleId: string,
  ): Promise<PerformanceReviewParticipantRecord[]> {
    await this.assertCycleInCompany(cycleId, companyId);

    const rows = await this.prisma.unscoped.performanceReviewParticipant.findMany({
      where: { companyId, reviewCycleId: cycleId },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            department: { select: { name: true } },
            manager: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ employee: { lastName: 'asc' } }, { employee: { firstName: 'asc' } }],
    });

    const reviews = await this.prisma.unscoped.employeePerformanceReview.findMany({
      where: { reviewCycleId: cycleId },
      select: { id: true, employeeId: true, status: true },
    });
    const reviewByEmployee = new Map(
      reviews.map((row) => [row.employeeId, row]),
    );

    return rows.map((row) => {
      const review = reviewByEmployee.get(row.employeeId);
      return {
        id: row.id,
        reviewCycleId: row.reviewCycleId,
        employeeId: row.employeeId,
        employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
        employeeNumber: row.employee.employeeNumber,
        departmentName: row.employee.department?.name ?? null,
        managerName: row.employee.manager
          ? `${row.employee.manager.firstName} ${row.employee.manager.lastName}`.trim()
          : null,
        reviewId: review?.id ?? null,
        reviewStatus: review?.status ?? null,
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
    if (cycle.launchedAt) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Cannot change participants after the review cycle has launched',
      });
    }

    const uniqueEmployeeIds = [...new Set(dto.employeeIds)];
    for (const employeeId of uniqueEmployeeIds) {
      const employee = await this.prisma.unscoped.employee.findFirst({
        where: { id: employeeId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!employee) {
        throw new NotFoundException(`Employee ${employeeId} not found in company`);
      }
    }

    await this.prisma.unscoped.$transaction(async (tx) => {
      await tx.performanceReviewParticipant.deleteMany({
        where: {
          reviewCycleId: cycleId,
          employeeId: { notIn: uniqueEmployeeIds },
        },
      });

      for (const employeeId of uniqueEmployeeIds) {
        await tx.performanceReviewParticipant.upsert({
          where: {
            reviewCycleId_employeeId: { reviewCycleId: cycleId, employeeId },
          },
          create: {
            tenantId: cycle.tenantId,
            companyId,
            reviewCycleId: cycleId,
            employeeId,
          },
          update: {},
        });
      }
    });

    await this.auditService.log({
      tenantId: cycle.tenantId,
      userId: user.id,
      action: 'update',
      module: 'performance',
      recordId: cycleId,
      newValue: { participantCount: uniqueEmployeeIds.length },
    });

    return this.listParticipants(companyId, cycleId);
  }

  async launchReviewCycle(
    companyId: string,
    cycleId: string,
    user: AuthenticatedUser,
  ): Promise<{ participantCount: number; reviewCount: number }> {
    const cycle = await this.assertCycleInCompany(cycleId, companyId);
    if (cycle.status === PerformanceReviewCycleStatus.archived) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Archived review cycles cannot be launched',
      });
    }

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

    let createdCount = 0;
    for (const participant of participants) {
      const existing = await this.prisma.unscoped.employeePerformanceReview.findUnique({
        where: {
          reviewCycleId_employeeId: {
            reviewCycleId: cycleId,
            employeeId: participant.employeeId,
          },
        },
      });
      if (existing) continue;

      const kpiAssignments = await this.prisma.unscoped.employeeKpiAssignment.findMany({
        where: {
          reviewCycleId: cycleId,
          employeeId: participant.employeeId,
          status: EmployeeKpiAssignmentStatus.active,
        },
      });

      const selfAssessment = emptyAssessmentPayload();
      selfAssessment.kpiAssessments = buildKpiAssessmentItems(kpiAssignments);

      await this.prisma.unscoped.employeePerformanceReview.create({
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
      createdCount += 1;
    }

    await this.prisma.unscoped.performanceReviewCycle.update({
      where: { id: cycleId },
      data: {
        status: PerformanceReviewCycleStatus.active,
        launchedAt: cycle.launchedAt ?? new Date(),
      },
    });

    await this.auditService.log({
      tenantId: cycle.tenantId,
      userId: user.id,
      action: 'create',
      module: 'performance',
      recordId: cycleId,
      newValue: { launched: true, reviewsCreated: createdCount },
    });

    const reviewCount = await this.prisma.unscoped.employeePerformanceReview.count({
      where: { reviewCycleId: cycleId },
    });

    return { participantCount: participants.length, reviewCount };
  }

  async listReviews(
    companyId: string,
    query: ListEmployeePerformanceReviewsQueryDto,
  ): Promise<EmployeePerformanceReviewRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.employeePerformanceReview.findMany({
      where: {
        companyId,
        reviewCycleId: query.reviewCycleId,
        employeeId: query.employeeId,
        status: query.status as EmployeePerformanceReviewStatus | undefined,
        managerEmployeeId: query.managerEmployeeId,
      },
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeNumber: true },
        },
        manager: { select: { firstName: true, lastName: true } },
        reviewCycle: { select: { name: true, requiresWorkflowApproval: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return Promise.all(rows.map((row) => this.toReviewRecord(row as ReviewWithRelations)));
  }

  async getReview(reviewId: string): Promise<EmployeePerformanceReviewRecord> {
    const row = await this.getReviewOrThrow(reviewId);
    return this.toReviewRecord(row);
  }

  async saveSelfAssessment(
    reviewId: string,
    dto: SaveSelfAssessmentDto,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId);
    this.assertCanEditSelf(review, user);

    if (
      review.status !== EmployeePerformanceReviewStatus.not_started &&
      review.status !== EmployeePerformanceReviewStatus.self_assessment_draft &&
      review.status !== EmployeePerformanceReviewStatus.returned
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Self assessment cannot be edited in the current review status',
      });
    }

    const current = parseAssessmentPayload(review.selfAssessment);
    const next = mergeSelfAssessment(
      current,
      dto as Partial<PerformanceAssessmentPayload>,
    );

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: {
        selfAssessment: next as unknown as Prisma.InputJsonValue,
        status: EmployeePerformanceReviewStatus.self_assessment_draft,
      },
      include: this.reviewInclude(),
    });

    return this.toReviewRecord(row as ReviewWithRelations);
  }

  async submitSelfAssessment(
    reviewId: string,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId);
    this.assertCanEditSelf(review, user);

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: {
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
      newValue: { selfSubmitted: true },
    });

    return this.toReviewRecord(row as ReviewWithRelations);
  }

  async saveManagerAssessment(
    reviewId: string,
    dto: SaveManagerAssessmentDto,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId);
    await this.assertCanEditManager(review, user);

    if (
      review.status !== EmployeePerformanceReviewStatus.self_submitted &&
      review.status !== EmployeePerformanceReviewStatus.manager_review &&
      review.status !== EmployeePerformanceReviewStatus.returned
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Manager assessment cannot be edited in the current review status',
      });
    }

    const selfAssessment = parseAssessmentPayload(review.selfAssessment);
    const currentManager = parseAssessmentPayload(review.managerAssessment);
    const next = mergeManagerAssessment(
      currentManager,
      selfAssessment,
      dto as Partial<PerformanceAssessmentPayload>,
    );

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: {
        managerAssessment: next as unknown as Prisma.InputJsonValue,
        status: EmployeePerformanceReviewStatus.manager_review,
      },
      include: this.reviewInclude(),
    });

    return this.toReviewRecord(row as ReviewWithRelations);
  }

  async submitManagerAssessment(
    reviewId: string,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId);
    await this.assertCanEditManager(review, user);

    if (review.status !== EmployeePerformanceReviewStatus.manager_review) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Submit manager assessment after saving the manager review form',
      });
    }

    const cycle = review.reviewCycle;
    const nextStatus = cycle.requiresWorkflowApproval
      ? EmployeePerformanceReviewStatus.pending_approval
      : EmployeePerformanceReviewStatus.approved;

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: {
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
      return this.getReview(reviewId);
    }

    return this.toReviewRecord(row as ReviewWithRelations);
  }

  async approveReviewWorkflow(
    reviewId: string,
    dto: WorkflowReviewActionDto,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId);
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
      return this.getReview(reviewId);
    }

    return this.toReviewRecord(row as ReviewWithRelations);
  }

  async rejectReviewWorkflow(
    reviewId: string,
    dto: WorkflowReviewActionDto,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId);
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
        returnReason: dto.comment?.trim() ?? 'Returned for revision',
      },
      include: this.reviewInclude(),
    });

    return this.toReviewRecord(row as ReviewWithRelations);
  }

  async saveReviewOutcome(
    reviewId: string,
    dto: SaveReviewOutcomeDto,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId);
    await this.assertCanEditManager(review, user);

    if (
      review.status !== EmployeePerformanceReviewStatus.manager_review &&
      review.status !== EmployeePerformanceReviewStatus.pending_approval &&
      review.status !== EmployeePerformanceReviewStatus.approved
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Review outcome can only be set during manager review or after approval',
      });
    }

    if (dto.promotionRecommended && !dto.recommendedDesignationId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'recommendedDesignationId is required when promotion is recommended',
      });
    }

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: {
        overallRating:
          dto.overallRating != null ? toDecimal(dto.overallRating) : undefined,
        overallRatingLabel: dto.overallRatingLabel,
        promotionRecommended: dto.promotionRecommended,
        recommendedDesignationId: dto.recommendedDesignationId ?? undefined,
        promotionRecommendationNote: dto.promotionRecommendationNote,
        promotionRecommendationStatus:
          dto.promotionRecommended === true ? 'draft' : dto.promotionRecommended === false ? 'none' : undefined,
      },
      include: this.reviewInclude(),
    });

    return this.toReviewRecord(row as ReviewWithRelations);
  }

  async submitPromotionRecommendation(
    reviewId: string,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    const review = await this.getReviewOrThrow(reviewId);
    await this.assertCanEditManager(review, user);

    if (!review.promotionRecommended || !review.recommendedDesignationId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Save a promotion recommendation before submitting',
      });
    }

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: { promotionRecommendationStatus: 'submitted' },
      include: this.reviewInclude(),
    });

    return this.toReviewRecord(row as ReviewWithRelations);
  }

  async approvePromotionRecommendation(
    reviewId: string,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    if (user.roleName !== 'HR Admin' && user.roleName !== 'Company Owner') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only HR can approve promotion recommendations',
      });
    }

    const review = await this.getReviewOrThrow(reviewId);
    if (review.promotionRecommendationStatus !== 'submitted') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Promotion recommendation is not awaiting approval',
      });
    }

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: { promotionRecommendationStatus: 'approved' },
      include: this.reviewInclude(),
    });

    return this.toReviewRecord(row as ReviewWithRelations);
  }

  async rejectPromotionRecommendation(
    reviewId: string,
    dto: WorkflowReviewActionDto,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    if (user.roleName !== 'HR Admin' && user.roleName !== 'Company Owner') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only HR can reject promotion recommendations',
      });
    }

    const review = await this.getReviewOrThrow(reviewId);
    if (review.promotionRecommendationStatus !== 'submitted') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Promotion recommendation is not awaiting approval',
      });
    }

    const row = await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: {
        promotionRecommendationStatus: 'rejected',
        promotionRecommendationNote: dto.comment?.trim()
          ? `${review.promotionRecommendationNote ?? ''}\nRejected: ${dto.comment.trim()}`.trim()
          : review.promotionRecommendationNote,
      },
      include: this.reviewInclude(),
    });

    return this.toReviewRecord(row as ReviewWithRelations);
  }

  async executePromotionFromReview(
    reviewId: string,
    dto: ExecutePromotionFromReviewDto,
    user: AuthenticatedUser,
  ): Promise<EmployeePerformanceReviewRecord> {
    if (user.roleName !== 'HR Admin' && user.roleName !== 'Company Owner') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only HR can execute promotion recommendations',
      });
    }

    const review = await this.getReviewOrThrow(reviewId);
    if (review.status !== EmployeePerformanceReviewStatus.approved) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Performance review must be approved before executing promotion',
      });
    }

    await this.performanceLifecycle.executePromotionRecommendation(review, user, dto);
    return this.getReview(reviewId);
  }

  async listPerformanceHistory(
    companyId: string,
    employeeId: string,
  ): Promise<
    Array<{
      reviewCycleName: string;
      overallRating: number | null;
      overallRatingLabel: string | null;
      approvedAt: string | null;
    }>
  > {
    await this.companyScope.assertCompanyInTenant(companyId);
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
      overallRatingLabel: row.overallRatingLabel,
      approvedAt: row.approvedAt?.toISOString() ?? null,
    }));
  }

  private async finalizeReview(reviewId: string, user: AuthenticatedUser): Promise<void> {
    const summary = await this.feedback360.computeAndPersistSummary(reviewId);
    const review = await this.getReviewOrThrow(reviewId);
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
        },
      },
      manager: { select: { firstName: true, lastName: true } },
      reviewCycle: { select: { name: true, requiresWorkflowApproval: true } },
      recommendedDesignation: { select: { name: true } },
    };
  }

  private async getReviewOrThrow(reviewId: string): Promise<ReviewWithRelations> {
    const row = await this.prisma.unscoped.employeePerformanceReview.findUnique({
      where: { id: reviewId },
      include: this.reviewInclude(),
    });
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

  private assertCanEditSelf(
    review: ReviewWithRelations,
    user: AuthenticatedUser,
  ): void {
    if (user.employeeId === review.employeeId) return;
    if (user.roleName === 'HR Admin' || user.roleName === 'Company Owner') return;
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Only the review subject can edit self assessment',
    });
  }

  private async assertCanEditManager(
    review: ReviewWithRelations,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.employeeId && user.employeeId === review.managerEmployeeId) return;
    if (user.roleName === 'HR Admin' || user.roleName === 'Company Owner') return;
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Only the assigned manager or HR can edit manager assessment',
    });
  }

  private async toReviewRecord(
    row: ReviewWithRelations,
  ): Promise<EmployeePerformanceReviewRecord> {
    const workflow = await this.reviewWorkflow.findForReview(row.id);
    return {
      id: row.id,
      companyId: row.companyId,
      reviewCycleId: row.reviewCycleId,
      reviewCycleName: row.reviewCycle.name,
      employeeId: row.employeeId,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      employeeNumber: row.employee.employeeNumber,
      managerEmployeeId: row.managerEmployeeId,
      managerName: row.manager
        ? `${row.manager.firstName} ${row.manager.lastName}`.trim()
        : null,
      status: row.status,
      selfAssessment: parseAssessmentPayload(row.selfAssessment),
      managerAssessment: parseAssessmentPayload(row.managerAssessment),
      selfSubmittedAt: row.selfSubmittedAt?.toISOString() ?? null,
      managerSubmittedAt: row.managerSubmittedAt?.toISOString() ?? null,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      returnedAt: row.returnedAt?.toISOString() ?? null,
      returnReason: row.returnReason,
      overallRating: row.overallRating?.toNumber() ?? null,
      overallRatingLabel: row.overallRatingLabel as EmployeePerformanceReviewRecord['overallRatingLabel'],
      performance360Summary: (row.performance360Summary as Performance360Summary | null) ?? null,
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
