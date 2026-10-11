import { BadRequestException, Injectable } from '@nestjs/common';
import { LifecycleEventType, Prisma } from '@prisma/client';
import { ratingLabelForScore } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { PrismaService } from '../database/prisma.service';
import { formatDateOnly } from './performance.utils';
import { normalize360Summary } from './performance-360.utils';

type ReviewForLifecycle = {
  id: string;
  employeeId: string;
  reviewCycleId: string;
  tenantId: string;
  companyId: string;
  overallRating: Prisma.Decimal | null;
  overallRatingLabel: string | null;
  promotionRecommended: boolean;
  recommendedDesignationId: string | null;
  promotionRecommendationNote: string | null;
  performance360Summary: unknown;
  performanceLifecycleEventId: string | null;
  promotionLifecycleEventId: string | null;
  promotionRecommendationStatus: string;
  approvedAt: Date | null;
  reviewCycle: { name: string };
  employee: { designationId?: string | null };
  recommendedDesignation?: { name: string } | null;
};

export interface ConvertPromotionInput {
  effectiveDate: string;
  newDesignationId?: string;
  newDepartmentId?: string;
  newManagerId?: string;
  notes?: string;
}

@Injectable()
export class PerformanceLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycleService: LifecycleService,
  ) {}

  async recordPerformanceReviewOutcome(
    review: ReviewForLifecycle,
    user: AuthenticatedUser,
  ): Promise<string | null> {
    if (review.performanceLifecycleEventId) {
      return review.performanceLifecycleEventId;
    }

    if (review.overallRating == null) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Overall rating must be set before recording lifecycle outcome',
      });
    }

    const effectiveDate = review.approvedAt ?? new Date();
    const summary = normalize360Summary(review.performance360Summary);

    const event = await this.lifecycleService.createEvent(
      review.employeeId,
      {
        eventType: LifecycleEventType.performance_review,
        effectiveDate: formatDateOnly(effectiveDate),
        details: {
          reviewId: review.id,
          reviewCycleId: review.reviewCycleId,
          reviewCycleName: review.reviewCycle.name,
          overallRating: review.overallRating.toNumber(),
          overallRatingLabel: ratingLabelForScore(review.overallRating.toNumber()),
          promotionRecommended: review.promotionRecommended,
          recommendedDesignationId: review.recommendedDesignationId,
          recommendedDesignationName: review.recommendedDesignation?.name ?? null,
          promotionRecommendationNote: review.promotionRecommendationNote,
          feedback360ResponseCount: summary?.responseCount ?? 0,
          feedback360AverageRating: summary?.averageRating ?? null,
        },
      },
      user,
    );

    await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: review.id },
      data: { performanceLifecycleEventId: event.id },
    });

    return event.id;
  }

  /** Keeps the employee's performance-review history entry in step with a calibrated rating. */
  async syncReviewOutcomeRating(eventId: string, overallRating: number, calibrated: boolean): Promise<void> {
    const event = await this.prisma.unscoped.employeeLifecycleEvent.findUnique({
      where: { id: eventId },
      select: { details: true },
    });
    if (!event) return;
    const details = (event.details && typeof event.details === 'object' ? event.details : {}) as Record<
      string,
      unknown
    >;
    await this.prisma.unscoped.employeeLifecycleEvent.update({
      where: { id: eventId },
      data: {
        details: {
          ...details,
          overallRating,
          overallRatingLabel: ratingLabelForScore(overallRating),
          calibrated,
        } as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Records the promotion through the same lifecycle rules as the employee profile. The review
   * is claimed first so a double submit cannot record two promotions.
   */
  async convertPromotionRecommendation(
    review: ReviewForLifecycle,
    user: AuthenticatedUser,
    input: ConvertPromotionInput,
  ): Promise<string> {
    const designationId = input.newDesignationId ?? review.recommendedDesignationId;
    if (!designationId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Choose the designation for the promotion',
      });
    }
    if (designationId === review.employee.designationId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'The employee already holds this designation',
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

    await this.lifecycleService.assertCanRecordEvent(review.employeeId, LifecycleEventType.promotion, user);

    const claimed = await this.prisma.unscoped.employeePerformanceReview.updateMany({
      where: {
        id: review.id,
        promotionRecommendationStatus: 'approved',
        promotionLifecycleEventId: null,
      },
      data: { promotionRecommendationStatus: 'executed' },
    });
    if (claimed.count === 0) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'The promotion has already been recorded',
      });
    }

    try {
      const event = await this.lifecycleService.createEvent(
        review.employeeId,
        {
          eventType: LifecycleEventType.promotion,
          effectiveDate: input.effectiveDate,
          details: {
            newDesignationId: designationId,
            ...(input.newDepartmentId ? { newDepartmentId: input.newDepartmentId } : {}),
            ...(input.newManagerId ? { newManagerId: input.newManagerId } : {}),
            ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
            source: 'performance_review',
            reviewId: review.id,
            reviewCycleId: review.reviewCycleId,
            reviewCycleName: review.reviewCycle.name,
            recommendedDesignationId: review.recommendedDesignationId,
            recommendationNote: review.promotionRecommendationNote,
            overallRating: review.overallRating?.toNumber() ?? null,
            overallRatingLabel:
              review.overallRating != null ? ratingLabelForScore(review.overallRating.toNumber()) : null,
          },
        },
        user,
      );
      await this.prisma.unscoped.employeePerformanceReview.update({
        where: { id: review.id },
        data: { promotionLifecycleEventId: event.id },
      });
      return event.id;
    } catch (error) {
      await this.prisma.unscoped.employeePerformanceReview.update({
        where: { id: review.id },
        data: { promotionRecommendationStatus: 'approved' },
      });
      throw error;
    }
  }
}
