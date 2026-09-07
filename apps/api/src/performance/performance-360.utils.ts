import type {
  Performance360CompetencyAverage,
  Performance360FeedbackRecord,
  Performance360Relationship,
  Performance360Summary,
} from '@hrm/shared-types';
import { DEFAULT_PERFORMANCE_COMPETENCIES } from './performance-assessment.utils';
import { averageRatings } from './performance-rating.utils';

const RELATIONSHIP_LABELS: Record<Performance360Relationship, string> = {
  peer: 'Peers',
  direct_report: 'Direct reports',
  cross_functional: 'Cross-functional',
};

export function parseCompetencyRatings(value: unknown): Array<{ key: string; rating: number }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as { key?: unknown; rating?: unknown };
      if (typeof record.key !== 'string' || typeof record.rating !== 'number') return null;
      return { key: record.key, rating: record.rating };
    })
    .filter((item): item is { key: string; rating: number } => item != null);
}

export function buildDefault360Ratings(): Array<{ key: string; rating: number }> {
  return DEFAULT_PERFORMANCE_COMPETENCIES.map((item) => ({
    key: item.key,
    rating: 0,
  }));
}

export function compute360Summary(
  feedbackRows: Array<
    Pick<
      Performance360FeedbackRecord,
      'relationship' | 'status' | 'competencyRatings' | 'comment'
    >
  >,
): Performance360Summary {
  const submitted = feedbackRows.filter((row) => row.status === 'submitted');
  const competencyMap = new Map<string, number[]>();
  const byRelationship: Performance360Summary['byRelationship'] = {
    peer: { responseCount: 0, averageRating: null, comments: [] },
    direct_report: { responseCount: 0, averageRating: null, comments: [] },
    cross_functional: { responseCount: 0, averageRating: null, comments: [] },
  };

  for (const row of submitted) {
    const ratings = parseCompetencyRatings(row.competencyRatings);
    const rowAvg = averageRatings(ratings.map((item) => item.rating));
    const bucket = byRelationship[row.relationship];
    bucket.responseCount += 1;
    if (row.comment?.trim()) {
      bucket.comments.push(row.comment.trim());
    }
    for (const rating of ratings) {
      const list = competencyMap.get(rating.key) ?? [];
      list.push(rating.rating);
      competencyMap.set(rating.key, list);
    }
    if (rowAvg != null) {
      bucket.averageRating =
        bucket.averageRating == null
          ? rowAvg
          : (bucket.averageRating * (bucket.responseCount - 1) + rowAvg) / bucket.responseCount;
    }
  }

  const competencyAverages: Performance360CompetencyAverage[] =
    DEFAULT_PERFORMANCE_COMPETENCIES.map((item) => ({
      key: item.key,
      label: item.label,
      averageRating: averageRatings(competencyMap.get(item.key) ?? []),
    }));

  const allSubmittedAverages = submitted
    .map((row) => averageRatings(parseCompetencyRatings(row.competencyRatings).map((r) => r.rating)))
    .filter((value): value is number => value != null);

  return {
    responseCount: submitted.length,
    invitedCount: feedbackRows.length,
    averageRating: averageRatings(allSubmittedAverages),
    competencyAverages,
    byRelationship,
    relationshipLabels: RELATIONSHIP_LABELS,
  };
}
