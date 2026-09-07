import { BadRequestException, Injectable } from '@nestjs/common';
import { LifecycleEventType, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { PrismaService } from '../database/prisma.service';
import type { Performance360Summary } from '@hrm/shared-types';
import { formatDateOnly } from './performance.utils';

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
  recommendedDesignation?: { name: string } | null;
};

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
    const summary = review.performance360Summary as Performance360Summary | null;

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
          overallRatingLabel: review.overallRatingLabel,
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

  async executePromotionRecommendation(
    review: ReviewForLifecycle,
    user: AuthenticatedUser,
    input: { effectiveDate: string; newDepartmentId?: string },
  ): Promise<string> {
    if (!review.promotionRecommended || !review.recommendedDesignationId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Review does not include an approved promotion recommendation',
      });
    }

    if (
      review.promotionRecommendationStatus !== 'approved' &&
      review.promotionRecommendationStatus !== 'submitted'
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Promotion recommendation must be submitted or approved before execution',
      });
    }

    if (review.promotionLifecycleEventId) {
      return review.promotionLifecycleEventId;
    }

    const event = await this.lifecycleService.createEvent(
      review.employeeId,
      {
        eventType: LifecycleEventType.promotion,
        effectiveDate: input.effectiveDate,
        details: {
          newDesignationId: review.recommendedDesignationId,
          ...(input.newDepartmentId ? { newDepartmentId: input.newDepartmentId } : {}),
          source: 'performance_review',
          reviewId: review.id,
          reviewCycleId: review.reviewCycleId,
          reviewCycleName: review.reviewCycle.name,
          recommendationNote: review.promotionRecommendationNote,
          overallRating: review.overallRating?.toNumber() ?? null,
          overallRatingLabel: review.overallRatingLabel,
        },
      },
      user,
    );

    await this.prisma.unscoped.employeePerformanceReview.update({
      where: { id: review.id },
      data: {
        promotionLifecycleEventId: event.id,
        promotionRecommendationStatus: 'executed',
      },
    });

    return event.id;
  }
}
