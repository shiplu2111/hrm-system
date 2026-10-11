import { BadRequestException } from '@nestjs/common';
import {
  PERFORMANCE_360_MIN_RESPONSES,
  roundRating,
  type Performance360CompetencyRating,
  type Performance360FeedbackStatus,
  type Performance360Relationship,
  type Performance360Summary,
} from '@hrm/shared-types';
import { DEFAULT_PERFORMANCE_COMPETENCIES } from './performance-assessment.utils';
import { averageRatings } from './performance-rating.utils';

export const RELATIONSHIP_LABELS: Record<Performance360Relationship, string> = {
  peer: 'Peers',
  direct_report: 'Direct reports',
  cross_functional: 'Cross-functional',
};

export const MAX_360_REVIEWERS = 20;

const RELATIONSHIPS = Object.keys(RELATIONSHIP_LABELS) as Performance360Relationship[];

export interface Stored360Rating {
  key: string;
  rating: number | null;
}

function validRating(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
    ? value
    : null;
}

/** Stored ratings by competency key; anything outside 1–5 (older rows used 0) counts as unrated. */
export function parseCompetencyRatings(value: unknown): Stored360Rating[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as { key?: unknown; rating?: unknown };
      if (typeof record.key !== 'string') return null;
      return { key: record.key, rating: validRating(record.rating) };
    })
    .filter((item): item is Stored360Rating => item != null);
}

export function buildDefault360Ratings(): Stored360Rating[] {
  return DEFAULT_PERFORMANCE_COMPETENCIES.map((item) => ({ key: item.key, rating: null }));
}

export function competencyRatingsView(value: unknown): Performance360CompetencyRating[] {
  const byKey = new Map(parseCompetencyRatings(value).map((item) => [item.key, item.rating]));
  return DEFAULT_PERFORMANCE_COMPETENCIES.map((item) => ({
    key: item.key,
    label: item.label,
    rating: byKey.get(item.key) ?? null,
  }));
}

/** Applies rating changes by key over the full competency list. */
export function apply360Ratings(
  stored: unknown,
  input: Array<{ key: string; rating?: number | null }>,
): Stored360Rating[] {
  const known = new Set(DEFAULT_PERFORMANCE_COMPETENCIES.map((item) => item.key));
  const next = new Map(competencyRatingsView(stored).map((item) => [item.key, item.rating]));
  for (const item of input) {
    if (!known.has(item.key)) {
      throw new BadRequestException({
        code: 'UNKNOWN_ASSESSMENT_ITEM',
        message: `"${item.key}" is not a competency on this feedback form`,
      });
    }
    if (item.rating !== undefined) next.set(item.key, item.rating);
  }
  return DEFAULT_PERFORMANCE_COMPETENCIES.map((item) => ({
    key: item.key,
    rating: next.get(item.key) ?? null,
  }));
}

export function missing360Ratings(ratings: Stored360Rating[]): string[] {
  const byKey = new Map(ratings.map((item) => [item.key, item.rating]));
  return DEFAULT_PERFORMANCE_COMPETENCIES.filter((item) => byKey.get(item.key) == null).map(
    (item) => item.label,
  );
}

function rounded(value: number | null): number | null {
  return value == null ? null : roundRating(value);
}

/**
 * Aggregates submitted feedback. Nothing is shown until `minResponses` are in, and a
 * relationship group's average stays hidden below that count so no single answer is exposed.
 */
export function compute360Summary(
  rows: Array<{
    relationship: Performance360Relationship;
    status: Performance360FeedbackStatus;
    competencyRatings: unknown;
    comment: string | null;
  }>,
  minResponses = PERFORMANCE_360_MIN_RESPONSES,
): Performance360Summary {
  const submitted = rows.filter((row) => row.status === 'submitted');
  const visible = submitted.length >= minResponses;
  const competencyMap = new Map<string, number[]>();
  const groupAverages = new Map<Performance360Relationship, number[]>();
  const rowAverages: number[] = [];
  const comments: string[] = [];

  for (const row of submitted) {
    const ratings = parseCompetencyRatings(row.competencyRatings);
    for (const item of ratings) {
      if (item.rating == null) continue;
      competencyMap.set(item.key, [...(competencyMap.get(item.key) ?? []), item.rating]);
    }
    const average = averageRatings(ratings.map((item) => item.rating));
    if (average != null) {
      rowAverages.push(average);
      groupAverages.set(row.relationship, [...(groupAverages.get(row.relationship) ?? []), average]);
    }
    if (row.comment?.trim()) comments.push(row.comment.trim());
  }

  const byRelationship = Object.fromEntries(
    RELATIONSHIPS.map((relationship) => {
      const count = submitted.filter((row) => row.relationship === relationship).length;
      const hidden = count > 0 && count < minResponses;
      return [
        relationship,
        {
          responseCount: count,
          averageRating: visible && !hidden ? rounded(averageRatings(groupAverages.get(relationship) ?? [])) : null,
          hidden,
        },
      ];
    }),
  ) as Performance360Summary['byRelationship'];

  return {
    responseCount: submitted.length,
    invitedCount: rows.length,
    minResponses,
    visible,
    averageRating: visible ? rounded(averageRatings(rowAverages)) : null,
    competencyAverages: DEFAULT_PERFORMANCE_COMPETENCIES.map((item) => ({
      key: item.key,
      label: item.label,
      averageRating: visible ? rounded(averageRatings(competencyMap.get(item.key) ?? [])) : null,
    })),
    byRelationship,
    relationshipLabels: RELATIONSHIP_LABELS,
    comments: visible ? [...comments].sort((a, b) => a.localeCompare(b)) : [],
  };
}

type LegacySummary = {
  responseCount?: number;
  invitedCount?: number;
  averageRating?: number | null;
  competencyAverages?: Performance360Summary['competencyAverages'];
  byRelationship?: Record<string, { responseCount?: number; averageRating?: number | null; comments?: string[] }>;
};

/** Summaries stored before the anonymity rules get the same redaction when read back. */
export function normalize360Summary(value: unknown): Performance360Summary | null {
  if (!value || typeof value !== 'object') return null;
  if ('visible' in value) return value as Performance360Summary;
  const legacy = value as LegacySummary;
  const responseCount = legacy.responseCount ?? 0;
  const minResponses = PERFORMANCE_360_MIN_RESPONSES;
  const visible = responseCount >= minResponses;
  const groups = legacy.byRelationship ?? {};
  return {
    responseCount,
    invitedCount: legacy.invitedCount ?? responseCount,
    minResponses,
    visible,
    averageRating: visible ? rounded(legacy.averageRating ?? null) : null,
    competencyAverages: DEFAULT_PERFORMANCE_COMPETENCIES.map((item) => {
      const match = legacy.competencyAverages?.find((entry) => entry.key === item.key);
      return {
        key: item.key,
        label: item.label,
        averageRating: visible ? rounded(match?.averageRating ?? null) : null,
      };
    }),
    byRelationship: Object.fromEntries(
      RELATIONSHIPS.map((relationship) => {
        const group = groups[relationship];
        const count = group?.responseCount ?? 0;
        const hidden = count > 0 && count < minResponses;
        return [
          relationship,
          {
            responseCount: count,
            averageRating: visible && !hidden ? rounded(group?.averageRating ?? null) : null,
            hidden,
          },
        ];
      }),
    ) as Performance360Summary['byRelationship'],
    relationshipLabels: RELATIONSHIP_LABELS,
    comments: visible
      ? RELATIONSHIPS.flatMap((relationship) => groups[relationship]?.comments ?? []).sort((a, b) =>
          a.localeCompare(b),
        )
      : [],
  };
}
