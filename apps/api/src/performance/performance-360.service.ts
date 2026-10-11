import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeePerformanceReviewStatus,
  EmploymentStatus,
  Performance360FeedbackStatus,
  Prisma,
  type Performance360Relationship,
} from '@prisma/client';
import type {
  Performance360FeedbackRecord,
  Performance360RequestRecord,
  Performance360Summary,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { DataScopeService } from '../rbac/data-scope.service';
import { PermissionsService } from '../rbac/permissions.service';
import {
  apply360Ratings,
  buildDefault360Ratings,
  competencyRatingsView,
  compute360Summary,
  MAX_360_REVIEWERS,
  missing360Ratings,
  parseCompetencyRatings,
} from './performance-360.utils';
import { formatDateOnly } from './performance.utils';
import type { Invite360ReviewersDto, Save360FeedbackDto } from './dto/performance.dto';

/** Feedback is collected until the manager submits their assessment. */
const FEEDBACK_OPEN_STATUSES: EmployeePerformanceReviewStatus[] = [
  EmployeePerformanceReviewStatus.not_started,
  EmployeePerformanceReviewStatus.self_assessment_draft,
  EmployeePerformanceReviewStatus.self_submitted,
  EmployeePerformanceReviewStatus.manager_review,
  EmployeePerformanceReviewStatus.returned,
];

const PERSON = { firstName: true, lastName: true, employeeNumber: true } as const;

const REQUEST_INCLUDE = {
  reviewer: { select: { ...PERSON, department: { select: { name: true } } } },
} satisfies Prisma.Performance360FeedbackInclude;

const FEEDBACK_INCLUDE = {
  reviewer: { select: PERSON },
  review: {
    select: {
      id: true,
      tenantId: true,
      employeeId: true,
      managerEmployeeId: true,
      status: true,
      employee: { select: { ...PERSON, designation: { select: { name: true } } } },
      reviewCycle: { select: { name: true, status: true, reviewDueDate: true } },
    },
  },
} satisfies Prisma.Performance360FeedbackInclude;

type RequestRow = Prisma.Performance360FeedbackGetPayload<{ include: typeof REQUEST_INCLUDE }>;
type FeedbackRow = Prisma.Performance360FeedbackGetPayload<{ include: typeof FEEDBACK_INCLUDE }>;

type ReviewContext = {
  id: string;
  tenantId: string;
  companyId: string;
  employeeId: string;
  managerEmployeeId: string | null;
  status: EmployeePerformanceReviewStatus;
  reviewCycle: { status: string };
};

function personName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

@Injectable()
export class Performance360Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly permissions: PermissionsService,
    private readonly dataScope: DataScopeService,
  ) {}

  /** Who was asked and whether they answered; individual answers are never returned here. */
  async listRequests(reviewId: string, user: AuthenticatedUser): Promise<Performance360RequestRecord[]> {
    const review = await this.getReviewContext(reviewId, user);
    if (user.employeeId && user.employeeId === review.employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '360° reviewers are not shown to the person being reviewed',
      });
    }
    await this.dataScope.assertEmployeeInScope(user, review.employeeId, { includeSelf: false });
    return this.findRequests(reviewId);
  }

  async getSummary(reviewId: string, user: AuthenticatedUser): Promise<Performance360Summary> {
    const review = await this.getReviewContext(reviewId, user);
    await this.dataScope.assertEmployeeInScope(user, review.employeeId);
    return compute360Summary(await this.findSummaryRows(reviewId));
  }

  async inviteReviewers(
    reviewId: string,
    dto: Invite360ReviewersDto,
    user: AuthenticatedUser,
  ): Promise<Performance360RequestRecord[]> {
    const review = await this.getReviewContext(reviewId, user);
    await this.assertCanManage360(review, user);
    this.assertCollectionOpen(review);

    const invites = new Map<string, Performance360Relationship>();
    for (const item of dto.reviewers) {
      invites.set(item.employeeId, item.relationship as Performance360Relationship);
    }
    const reviewerIds = [...invites.keys()];

    if (invites.has(review.employeeId)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'The person being reviewed cannot give 360° feedback on their own review',
      });
    }

    const employees = await this.prisma.unscoped.employee.findMany({
      where: {
        id: { in: reviewerIds },
        tenantId: review.tenantId,
        companyId: review.companyId,
        deletedAt: null,
      },
      select: { id: true, firstName: true, lastName: true, employmentStatus: true },
    });
    if (employees.length !== reviewerIds.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Every reviewer must be an employee of the same company as the review',
      });
    }
    const manager = employees.find((employee) => employee.id === review.managerEmployeeId);
    if (manager) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${personName(manager)} is the reviewing manager and rates this review in the manager assessment`,
      });
    }
    const unavailable = employees.filter(
      (employee) =>
        employee.employmentStatus === EmploymentStatus.terminated ||
        employee.employmentStatus === EmploymentStatus.inactive,
    );
    if (unavailable.length > 0) {
      throw new BadRequestException({
        code: 'EMPLOYEE_NOT_ACTIVE',
        message: `${unavailable.map(personName).join(', ')} ${unavailable.length === 1 ? 'is' : 'are'} not active and cannot be invited`,
      });
    }

    const existing = await this.prisma.unscoped.performance360Feedback.findMany({
      where: { reviewId, tenantId: review.tenantId },
      select: { id: true, reviewerEmployeeId: true, relationship: true, status: true },
    });
    const existingByReviewer = new Map(existing.map((row) => [row.reviewerEmployeeId, row]));
    const answered = employees.filter((employee) => {
      const row = existingByReviewer.get(employee.id);
      return row?.status === Performance360FeedbackStatus.submitted && row.relationship !== invites.get(employee.id);
    });
    if (answered.length > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${answered.map(personName).join(', ')} already responded, so their relationship cannot change`,
      });
    }

    const toCreate = reviewerIds.filter((id) => !existingByReviewer.has(id));
    const toUpdate = reviewerIds.filter((id) => {
      const row = existingByReviewer.get(id);
      return row && row.status === Performance360FeedbackStatus.pending && row.relationship !== invites.get(id);
    });
    if (existing.length + toCreate.length > MAX_360_REVIEWERS) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `A review can have at most ${MAX_360_REVIEWERS} 360° reviewers`,
      });
    }

    await this.prisma.unscoped.$transaction([
      this.prisma.unscoped.performance360Feedback.createMany({
        data: toCreate.map((employeeId) => ({
          tenantId: review.tenantId,
          companyId: review.companyId,
          reviewId,
          reviewerEmployeeId: employeeId,
          relationship: invites.get(employeeId)!,
          competencyRatings: buildDefault360Ratings() as unknown as Prisma.InputJsonValue,
        })),
        skipDuplicates: true,
      }),
      ...toUpdate.map((employeeId) =>
        this.prisma.unscoped.performance360Feedback.update({
          where: { id: existingByReviewer.get(employeeId)!.id },
          data: { relationship: invites.get(employeeId)! },
        }),
      ),
    ]);

    if (toCreate.length > 0 || toUpdate.length > 0) {
      await this.auditService.log({
        tenantId: review.tenantId,
        userId: user.id,
        action: 'update',
        module: 'performance',
        recordId: reviewId,
        newValue: { invited360Reviewers: toCreate.length, changed360Relationships: toUpdate.length },
      });
    }

    return this.findRequests(reviewId);
  }

  async removeRequest(feedbackId: string, user: AuthenticatedUser): Promise<void> {
    const row = await this.prisma.unscoped.performance360Feedback.findFirst({
      where: { id: feedbackId, tenantId: user.tenantId ?? undefined },
      include: REQUEST_INCLUDE,
    });
    if (!row || !user.tenantId) {
      throw new NotFoundException('360° feedback request not found');
    }
    const review = await this.getReviewContext(row.reviewId, user);
    await this.assertCanManage360(review, user);
    this.assertCollectionOpen(review);
    if (row.status === Performance360FeedbackStatus.submitted) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${personName(row.reviewer)} has already responded; submitted feedback stays part of the results`,
      });
    }
    await this.prisma.unscoped.performance360Feedback.delete({ where: { id: feedbackId } });
    await this.auditService.log({
      tenantId: review.tenantId,
      userId: user.id,
      action: 'update',
      module: 'performance',
      recordId: review.id,
      newValue: { removed360Reviewer: personName(row.reviewer) },
    });
  }

  /** Feedback requests addressed to the signed-in employee. */
  async listMine(user: AuthenticatedUser): Promise<Performance360FeedbackRecord[]> {
    if (!user.employeeId || !user.tenantId) return [];
    const rows = await this.prisma.unscoped.performance360Feedback.findMany({
      where: {
        tenantId: user.tenantId,
        reviewerEmployeeId: user.employeeId,
        review: { status: { not: EmployeePerformanceReviewStatus.cancelled } },
      },
      include: FEEDBACK_INCLUDE,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.toFeedback(row));
  }

  async getFeedback(feedbackId: string, user: AuthenticatedUser): Promise<Performance360FeedbackRecord> {
    const row = await this.getFeedbackRow(feedbackId, user);
    await this.assertCanRespond(row, user, 'view');
    return this.toFeedback(row);
  }

  async saveFeedback(
    feedbackId: string,
    dto: Save360FeedbackDto,
    user: AuthenticatedUser,
  ): Promise<Performance360FeedbackRecord> {
    const row = await this.getFeedbackRow(feedbackId, user);
    const onBehalf = await this.assertCanRespond(row, user, 'edit');
    this.assertFeedbackEditable(row);
    const updated = await this.prisma.unscoped.performance360Feedback.update({
      where: { id: feedbackId },
      data: this.feedbackChanges(row, dto),
      include: FEEDBACK_INCLUDE,
    });
    if (onBehalf) await this.auditFeedback(updated, user, 'saved');
    return this.toFeedback(updated);
  }

  async submitFeedback(
    feedbackId: string,
    dto: Save360FeedbackDto,
    user: AuthenticatedUser,
  ): Promise<Performance360FeedbackRecord> {
    const row = await this.getFeedbackRow(feedbackId, user);
    const onBehalf = await this.assertCanRespond(row, user, 'edit');
    this.assertFeedbackEditable(row);
    const changes = this.feedbackChanges(row, dto);
    const missing = missing360Ratings(parseCompetencyRatings(changes.competencyRatings));
    if (missing.length > 0) {
      throw new BadRequestException({
        code: 'INCOMPLETE_ASSESSMENT',
        message: `Rate every competency before submitting. Still unrated: ${missing.join(', ')}`,
      });
    }
    const updated = await this.prisma.unscoped.performance360Feedback.update({
      where: { id: feedbackId },
      data: { ...changes, status: Performance360FeedbackStatus.submitted, submittedAt: new Date() },
      include: FEEDBACK_INCLUDE,
    });
    await this.auditFeedback(updated, user, 'submitted', onBehalf);
    return this.toFeedback(updated);
  }

  async computeAndPersistSummary(reviewId: string): Promise<Performance360Summary> {
    const summary = compute360Summary(await this.findSummaryRows(reviewId));
    await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: { performance360Summary: summary as unknown as Prisma.InputJsonValue },
    });
    return summary;
  }

  /** Counts per review for list screens. */
  async countsForReviews(reviewIds: string[]): Promise<Map<string, { invited: number; submitted: number }>> {
    const counts = new Map<string, { invited: number; submitted: number }>();
    if (reviewIds.length === 0) return counts;
    const groups = await this.prisma.unscoped.performance360Feedback.groupBy({
      by: ['reviewId', 'status'],
      where: { reviewId: { in: reviewIds } },
      _count: { _all: true },
    });
    for (const group of groups) {
      const entry = counts.get(group.reviewId) ?? { invited: 0, submitted: 0 };
      entry.invited += group._count._all;
      if (group.status === Performance360FeedbackStatus.submitted) entry.submitted += group._count._all;
      counts.set(group.reviewId, entry);
    }
    return counts;
  }

  private feedbackChanges(row: FeedbackRow, dto: Save360FeedbackDto) {
    const ratings = dto.competencyRatings
      ? apply360Ratings(row.competencyRatings, dto.competencyRatings)
      : apply360Ratings(row.competencyRatings, []);
    const comment = dto.comment === undefined ? row.comment : dto.comment?.trim() || null;
    return {
      competencyRatings: ratings as unknown as Prisma.InputJsonValue,
      comment,
    };
  }

  private async auditFeedback(
    row: FeedbackRow,
    user: AuthenticatedUser,
    action: 'saved' | 'submitted',
    onBehalf = true,
  ): Promise<void> {
    await this.auditService.log({
      tenantId: row.tenantId,
      userId: user.id,
      action: 'update',
      module: 'performance',
      recordId: row.reviewId,
      newValue: {
        [action === 'submitted' ? 'submitted360Feedback' : 'saved360Feedback']: row.id,
        onBehalfOfReviewer: onBehalf ? personName(row.reviewer) : undefined,
      },
    });
  }

  private assertCollectionOpen(review: ReviewContext): void {
    if (review.reviewCycle.status !== 'active') {
      throw new BadRequestException({
        code: 'CYCLE_LOCKED',
        message: '360° feedback can only be collected while the review cycle is in progress',
      });
    }
    if (!FEEDBACK_OPEN_STATUSES.includes(review.status)) {
      throw new BadRequestException({
        code: 'FEEDBACK_CLOSED',
        message: '360° feedback closed when the manager submitted their assessment',
      });
    }
  }

  private feedbackEditable(row: FeedbackRow): boolean {
    return (
      row.status === Performance360FeedbackStatus.pending &&
      row.review.reviewCycle.status === 'active' &&
      FEEDBACK_OPEN_STATUSES.includes(row.review.status)
    );
  }

  private assertFeedbackEditable(row: FeedbackRow): void {
    if (row.status === Performance360FeedbackStatus.submitted) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This feedback has already been submitted',
      });
    }
    if (!this.feedbackEditable(row)) {
      throw new BadRequestException({
        code: 'FEEDBACK_CLOSED',
        message: 'Feedback for this review has closed',
      });
    }
  }

  /**
   * The reviewer answers their own request. HR can open and fill in a request that is still
   * pending (for example from a paper form), but never read someone's submitted answers.
   * Returns true when HR is acting on the reviewer's behalf.
   */
  private async assertCanRespond(
    row: FeedbackRow,
    user: AuthenticatedUser,
    mode: 'view' | 'edit',
  ): Promise<boolean> {
    if (user.employeeId && user.employeeId === row.reviewerEmployeeId) return false;
    if (user.employeeId && user.employeeId === row.review.employeeId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only the invited reviewer can open this feedback' });
    }
    if (await this.hasHrOverride(user)) {
      if (row.status === Performance360FeedbackStatus.submitted) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message:
            mode === 'view'
              ? 'Submitted 360° feedback is anonymous; only the totals are shown on the review'
              : 'This feedback has already been submitted',
        });
      }
      await this.dataScope.assertEmployeeInScope(user, row.review.employeeId, { includeSelf: false });
      return true;
    }
    throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only the invited reviewer can open this feedback' });
  }

  private async getFeedbackRow(feedbackId: string, user: AuthenticatedUser): Promise<FeedbackRow> {
    const row = user.tenantId
      ? await this.prisma.unscoped.performance360Feedback.findFirst({
          where: { id: feedbackId, tenantId: user.tenantId },
          include: FEEDBACK_INCLUDE,
        })
      : null;
    if (!row) throw new NotFoundException('360° feedback request not found');
    return row;
  }

  private async findRequests(reviewId: string): Promise<Performance360RequestRecord[]> {
    const rows = await this.prisma.unscoped.performance360Feedback.findMany({
      where: { reviewId },
      include: REQUEST_INCLUDE,
      orderBy: [{ relationship: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.toRequest(row));
  }

  private findSummaryRows(reviewId: string) {
    return this.prisma.unscoped.performance360Feedback.findMany({
      where: { reviewId },
      select: { relationship: true, status: true, competencyRatings: true, comment: true },
    });
  }

  private async getReviewContext(reviewId: string, user: AuthenticatedUser): Promise<ReviewContext> {
    const review = user.tenantId
      ? await this.prisma.unscoped.employeePerformanceReview.findFirst({
          where: { id: reviewId, tenantId: user.tenantId },
          select: {
            id: true,
            tenantId: true,
            companyId: true,
            employeeId: true,
            managerEmployeeId: true,
            status: true,
            reviewCycle: { select: { status: true } },
          },
        })
      : null;
    if (!review) throw new NotFoundException('Performance review not found');
    return review;
  }

  private async hasHrOverride(user: AuthenticatedUser): Promise<boolean> {
    return (
      this.permissions.hasPermission(user, 'performance', 'edit') &&
      (await this.dataScope.isOrgWide(user))
    );
  }

  private async assertCanManage360(review: ReviewContext, user: AuthenticatedUser): Promise<void> {
    if (user.employeeId && user.employeeId === review.employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'The person being reviewed cannot choose their own 360° reviewers',
      });
    }
    if (user.employeeId && user.employeeId === review.managerEmployeeId) {
      await this.dataScope.assertEmployeeInScope(user, review.employeeId, { includeSelf: false });
      return;
    }
    if (await this.hasHrOverride(user)) return;
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Only the manager or HR can manage 360° feedback invitations',
    });
  }

  private toRequest(row: RequestRow): Performance360RequestRecord {
    return {
      id: row.id,
      reviewId: row.reviewId,
      reviewerEmployeeId: row.reviewerEmployeeId,
      reviewerName: personName(row.reviewer),
      reviewerNumber: row.reviewer.employeeNumber,
      reviewerDepartmentName: row.reviewer.department?.name ?? null,
      relationship: row.relationship,
      status: row.status,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toFeedback(row: FeedbackRow): Performance360FeedbackRecord {
    return {
      id: row.id,
      reviewId: row.reviewId,
      reviewCycleName: row.review.reviewCycle.name,
      reviewDueDate: formatDateOnly(row.review.reviewCycle.reviewDueDate),
      subjectEmployeeId: row.review.employeeId,
      subjectName: personName(row.review.employee),
      subjectNumber: row.review.employee.employeeNumber,
      subjectDesignationName: row.review.employee.designation?.name ?? null,
      reviewerEmployeeId: row.reviewerEmployeeId,
      reviewerName: personName(row.reviewer),
      relationship: row.relationship,
      status: row.status,
      competencyRatings: competencyRatingsView(row.competencyRatings),
      comment: row.comment,
      isAnonymous: row.isAnonymous,
      editable: this.feedbackEditable(row),
      submittedAt: row.submittedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
