import type {
  Performance360Summary,
  PerformanceAssessmentPayload,
  PerformanceOverallRatingLabel,
} from '@hrm/shared-types';

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

export function ratingLabelForScore(score: number): PerformanceOverallRatingLabel {
  if (score >= 4.5) return 'outstanding';
  if (score >= 3.5) return 'exceeds_expectations';
  if (score >= 2.5) return 'meets_expectations';
  return 'needs_improvement';
}

export function computeManagerScore(
  managerAssessment: PerformanceAssessmentPayload,
): number | null {
  const competencyAvg = averageRatings(
    managerAssessment.competencies.map((item) => item.managerRating),
  );
  const kpiAvg = averageRatings(
    managerAssessment.kpiAssessments.map((item) => item.managerRating),
  );
  if (competencyAvg == null && kpiAvg == null) return null;
  if (competencyAvg == null) return kpiAvg;
  if (kpiAvg == null) return competencyAvg;
  return competencyAvg * 0.6 + kpiAvg * 0.4;
}

export function computeOverallRating(input: {
  managerAssessment: PerformanceAssessmentPayload;
  feedback360Summary?: Performance360Summary | null;
  overrideRating?: number | null;
}): { overallRating: number; overallRatingLabel: PerformanceOverallRatingLabel } {
  if (input.overrideRating != null) {
    const rounded = Math.round(input.overrideRating * 100) / 100;
    return {
      overallRating: rounded,
      overallRatingLabel: ratingLabelForScore(rounded),
    };
  }

  const managerScore = computeManagerScore(input.managerAssessment);
  const feedbackScore = input.feedback360Summary?.averageRating ?? null;

  let combined: number | null = null;
  if (managerScore != null && feedbackScore != null) {
    combined = managerScore * 0.6 + feedbackScore * 0.4;
  } else {
    combined = managerScore ?? feedbackScore;
  }

  const overallRating = Math.round((combined ?? 0) * 100) / 100;
  return {
    overallRating,
    overallRatingLabel: ratingLabelForScore(overallRating),
  };
}
