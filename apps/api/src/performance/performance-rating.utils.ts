import {
  assessmentScore,
  combineOverallRating,
  ratingLabelForScore,
  roundRating,
  type Performance360Summary,
  type PerformanceAssessmentPayload,
  type PerformanceOverallRatingLabel,
} from '@hrm/shared-types';

export { ratingLabelForScore };

export const OVERALL_RATING_LABELS: Record<PerformanceOverallRatingLabel, string> = {
  outstanding: 'Outstanding',
  exceeds_expectations: 'Exceeds expectations',
  meets_expectations: 'Meets expectations',
  needs_improvement: 'Needs improvement',
};

export function averageRatings(values: Array<number | null | undefined>): number | null {
  const numbers = values.filter((value): value is number => value != null && !Number.isNaN(value));
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

export function computeManagerScore(
  managerAssessment: PerformanceAssessmentPayload,
): number | null {
  return assessmentScore(managerAssessment, 'manager');
}

/** A calibrated rating wins; otherwise manager score × 60% + 360° average × 40%. */
export function computeOverallRating(input: {
  managerAssessment: PerformanceAssessmentPayload;
  feedback360Summary?: Performance360Summary | null;
  overrideRating?: number | null;
}): { overallRating: number; overallRatingLabel: PerformanceOverallRatingLabel } {
  const overallRating =
    input.overrideRating != null
      ? roundRating(input.overrideRating)
      : (combineOverallRating(
          computeManagerScore(input.managerAssessment),
          input.feedback360Summary?.averageRating ?? null,
        ) ?? 0);
  return { overallRating, overallRatingLabel: ratingLabelForScore(overallRating) };
}
