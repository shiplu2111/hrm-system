import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Performance360FeedbackStatus,
  Prisma,
  type Performance360Relationship,
} from '@prisma/client';
import type {
  Performance360FeedbackRecord,
  Performance360Summary,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { DataScopeService } from '../rbac/data-scope.service';
import { PermissionsService } from '../rbac/permissions.service';
import {
  buildDefault360Ratings,
  compute360Summary,
  parseCompetencyRatings,
} from './performance-360.utils';
import type {
  Invite360ReviewersDto,
  Submit360FeedbackDto,
} from './dto/performance.dto';

type FeedbackRow = Prisma.Performance360FeedbackGetPayload<{
  include: { reviewer: { select: { firstName: true; lastName: true; employeeNumber: true } } };
}>;

@Injectable()
export class Performance360Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly permissions: PermissionsService,
    private readonly dataScope: DataScopeService,
  ) {}

  async listFeedback(
    reviewId: string,
    user: AuthenticatedUser,
  ): Promise<Performance360FeedbackRecord[]> {
    const review = await this.getReviewContext(reviewId);
    await this.dataScope.assertEmployeeInScope(user, review.employeeId);
    return this.findFeedback(reviewId);
  }

  async getSummary(reviewId: string, user: AuthenticatedUser): Promise<Performance360Summary> {
    return compute360Summary(await this.listFeedback(reviewId, user));
  }

  async inviteReviewers(
    reviewId: string,
    dto: Invite360ReviewersDto,
    user: AuthenticatedUser,
  ): Promise<Performance360FeedbackRecord[]> {
    const review = await this.getReviewContext(reviewId);
    await this.assertCanManage360(review, user);

    if (review.employeeId === user.employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Review subject cannot manage 360° feedback invitations',
      });
    }

    const reviewerIds = dto.reviewers.map((item) => item.employeeId);
    if (reviewerIds.includes(review.employeeId)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Review subject cannot be a 360° feedback reviewer',
      });
    }

    for (const invite of dto.reviewers) {
      await this.prisma.unscoped.performance360Feedback.upsert({
        where: {
          reviewId_reviewerEmployeeId: {
            reviewId,
            reviewerEmployeeId: invite.employeeId,
          },
        },
        create: {
          tenantId: review.tenantId,
          companyId: review.companyId,
          reviewId,
          reviewerEmployeeId: invite.employeeId,
          relationship: invite.relationship as Performance360Relationship,
          competencyRatings: buildDefault360Ratings() as unknown as Prisma.InputJsonValue,
        },
        update: {
          relationship: invite.relationship as Performance360Relationship,
        },
      });
    }

    await this.auditService.log({
      tenantId: review.tenantId,
      userId: user.id,
      action: 'update',
      module: 'performance',
      recordId: reviewId,
      newValue: { invited360Reviewers: dto.reviewers.length },
    });

    return this.findFeedback(reviewId);
  }

  async submitFeedback(
    feedbackId: string,
    dto: Submit360FeedbackDto,
    user: AuthenticatedUser,
  ): Promise<Performance360FeedbackRecord> {
    const row = await this.prisma.unscoped.performance360Feedback.findUnique({
      where: { id: feedbackId },
      include: {
        reviewer: { select: { firstName: true, lastName: true, employeeNumber: true } },
        review: { select: { employeeId: true, status: true } },
      },
    });

    if (!row) {
      throw new NotFoundException('360° feedback request not found');
    }

    if (user.employeeId !== row.reviewerEmployeeId && !(await this.hasHrOverride(user))) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only the invited reviewer can submit this feedback',
      });
    }

    const ratings = dto.competencyRatings ?? parseCompetencyRatings(row.competencyRatings);
    if (ratings.some((item) => item.rating < 1 || item.rating > 5)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Competency ratings must be between 1 and 5',
      });
    }

    const updated = await this.prisma.unscoped.performance360Feedback.update({
      where: { id: feedbackId },
      data: {
        competencyRatings: ratings as unknown as Prisma.InputJsonValue,
        comment: dto.comment?.trim() ?? null,
        status: Performance360FeedbackStatus.submitted,
        submittedAt: new Date(),
      },
      include: {
        reviewer: { select: { firstName: true, lastName: true, employeeNumber: true } },
      },
    });

    return this.toRecord(updated);
  }

  async computeAndPersistSummary(reviewId: string): Promise<Performance360Summary> {
    const summary = compute360Summary(await this.findFeedback(reviewId));
    await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: reviewId },
      data: {
        performance360Summary: summary as unknown as Prisma.InputJsonValue,
      },
    });
    return summary;
  }

  private async findFeedback(reviewId: string): Promise<Performance360FeedbackRecord[]> {
    const rows = await this.prisma.unscoped.performance360Feedback.findMany({
      where: { reviewId },
      include: {
        reviewer: { select: { firstName: true, lastName: true, employeeNumber: true } },
      },
      orderBy: [{ relationship: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.toRecord(row));
  }

  private async getReviewContext(reviewId: string) {
    const review = await this.prisma.unscoped.employeePerformanceReview.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        tenantId: true,
        companyId: true,
        employeeId: true,
        managerEmployeeId: true,
        status: true,
      },
    });
    if (!review) {
      throw new NotFoundException('Performance review not found');
    }
    return review;
  }

  private async hasHrOverride(user: AuthenticatedUser): Promise<boolean> {
    return (
      this.permissions.hasPermission(user, 'performance', 'edit') &&
      (await this.dataScope.isOrgWide(user))
    );
  }

  private async assertCanManage360(
    review: { managerEmployeeId: string | null; employeeId: string },
    user: AuthenticatedUser,
  ): Promise<void> {
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

  private toRecord(row: FeedbackRow): Performance360FeedbackRecord {
    return {
      id: row.id,
      reviewId: row.reviewId,
      reviewerEmployeeId: row.reviewerEmployeeId,
      reviewerName: row.isAnonymous
        ? null
        : `${row.reviewer.firstName} ${row.reviewer.lastName}`.trim(),
      relationship: row.relationship,
      status: row.status,
      competencyRatings: parseCompetencyRatings(row.competencyRatings),
      comment: row.comment,
      isAnonymous: row.isAnonymous,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
