import { BadRequestException } from '@nestjs/common';
import type {
  EmployeePerformanceReviewStatus,
  PerformanceReviewCycleStatus,
  PromotionRecommendationStatus,
} from '@hrm/shared-types';

function reject(code: string, message: string): never {
  throw new BadRequestException({ code, message });
}

const RECOMMENDABLE_REVIEW_STATUSES: EmployeePerformanceReviewStatus[] = [
  'manager_review',
  'returned',
  'pending_approval',
  'approved',
];

const EDITABLE_RECOMMENDATION_STATUSES: PromotionRecommendationStatus[] = ['none', 'draft', 'rejected'];

/** The calibrated rating can change after the manager submits and before the cycle closes or a promotion is made. */
export function assertCanCalibrate(input: {
  reviewStatus: EmployeePerformanceReviewStatus;
  cycleStatus: PerformanceReviewCycleStatus;
  promotionStatus: PromotionRecommendationStatus;
}): void {
  if (input.reviewStatus !== 'pending_approval' && input.reviewStatus !== 'approved') {
    reject('VALIDATION_ERROR', 'The rating can be calibrated once the manager has submitted their assessment');
  }
  if (input.cycleStatus !== 'active') {
    reject('CYCLE_LOCKED', 'Ratings are final once the review cycle is closed');
  }
  if (input.promotionStatus === 'executed') {
    reject('VALIDATION_ERROR', 'The rating is final because a promotion has been recorded from this review');
  }
}

export function assertRecommendationEditable(input: {
  reviewStatus: EmployeePerformanceReviewStatus;
  cycleStatus: PerformanceReviewCycleStatus;
  promotionStatus: PromotionRecommendationStatus;
}): void {
  if (input.cycleStatus === 'archived') {
    reject('CYCLE_LOCKED', 'This review cycle is archived');
  }
  if (!RECOMMENDABLE_REVIEW_STATUSES.includes(input.reviewStatus)) {
    reject(
      'VALIDATION_ERROR',
      'A promotion can be recommended once the employee has submitted their self-assessment',
    );
  }
  if (!EDITABLE_RECOMMENDATION_STATUSES.includes(input.promotionStatus)) {
    reject(
      'INVALID_STATUS_TRANSITION',
      input.promotionStatus === 'executed'
        ? 'The promotion has already been recorded'
        : input.promotionStatus === 'approved'
          ? 'The promotion recommendation has been approved and can no longer change'
          : 'The promotion recommendation is with HR; it can change again if it is rejected',
    );
  }
}

export function assertRecommendationSubmittable(input: {
  promotionStatus: PromotionRecommendationStatus;
  promotionRecommended: boolean;
  recommendedDesignationId: string | null;
  note: string | null;
}): void {
  if (!input.promotionRecommended || !input.recommendedDesignationId) {
    reject('VALIDATION_ERROR', 'Save a promotion recommendation with a designation before submitting');
  }
  if (input.promotionStatus !== 'draft') {
    reject(
      'INVALID_STATUS_TRANSITION',
      input.promotionStatus === 'rejected'
        ? 'Revise the rejected recommendation before submitting it again'
        : 'The promotion recommendation has already been submitted',
    );
  }
  if (!input.note?.trim()) {
    reject('VALIDATION_ERROR', 'Add a justification before submitting the recommendation');
  }
}

export function assertRecommendationAwaitingDecision(status: PromotionRecommendationStatus): void {
  if (status !== 'submitted') {
    reject('INVALID_STATUS_TRANSITION', 'The promotion recommendation is not awaiting a decision');
  }
}

export function assertPromotionConvertible(input: {
  reviewStatus: EmployeePerformanceReviewStatus;
  promotionStatus: PromotionRecommendationStatus;
}): void {
  if (input.promotionStatus === 'executed') {
    reject('INVALID_STATUS_TRANSITION', 'The promotion has already been recorded');
  }
  if (input.reviewStatus !== 'approved') {
    reject('VALIDATION_ERROR', 'The performance review must be approved before converting to a promotion');
  }
  if (input.promotionStatus !== 'approved') {
    reject('VALIDATION_ERROR', 'The promotion recommendation must be approved before converting it');
  }
}

/** Appends a dated rejection reason so the manager sees why when revising. */
export function noteWithRejection(note: string | null, reason: string, date: string): string {
  return `${note?.trim() ?? ''}\n\nRejected ${date}: ${reason.trim()}`.trim();
}
