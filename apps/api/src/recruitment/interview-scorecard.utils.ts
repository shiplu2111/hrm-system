import { BadRequestException } from '@nestjs/common';
import {
  INTERVIEW_RATING_MAX,
  INTERVIEW_RATING_MIN,
  INTERVIEW_SCORECARD_CRITERIA,
  interviewScorecardAverage,
  type InterviewRoundType,
  type InterviewScorecard,
  type InterviewScorecardRating,
} from '@hrm/shared-types';

/** Assumed length of an interview booked without an end time. */
export const DEFAULT_INTERVIEW_DURATION_MS = 60 * 60 * 1000;

export function buildInterviewScorecard(
  roundType: InterviewRoundType,
  input: {
    ratings?: InterviewScorecardRating[];
    strengths?: string;
    concerns?: string;
  },
): { scorecard: InterviewScorecard; score: number } {
  const criteria = INTERVIEW_SCORECARD_CRITERIA[roundType];
  const allowed = new Set(criteria.map((c) => c.key));
  const byKey = new Map<string, InterviewScorecardRating>();

  for (const entry of input.ratings ?? []) {
    if (!allowed.has(entry.key)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `"${entry.key}" is not a criterion on the ${roundType} scorecard`,
      });
    }
    if (byKey.has(entry.key)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Criterion "${entry.key}" was rated more than once`,
      });
    }
    if (
      !Number.isInteger(entry.rating) ||
      entry.rating < INTERVIEW_RATING_MIN ||
      entry.rating > INTERVIEW_RATING_MAX
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Ratings must be whole numbers from ${INTERVIEW_RATING_MIN} to ${INTERVIEW_RATING_MAX}`,
      });
    }
    byKey.set(entry.key, entry);
  }

  const missing = criteria.filter((c) => !byKey.has(c.key));
  if (missing.length > 0) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `Rate every criterion before submitting: ${missing
        .map((c) => c.label)
        .join(', ')}`,
    });
  }

  const ratings = criteria.map((c) => {
    const entry = byKey.get(c.key)!;
    return {
      key: c.key,
      rating: entry.rating,
      comment: entry.comment?.trim() || null,
    };
  });

  return {
    scorecard: {
      ratings,
      strengths: input.strengths?.trim() || null,
      concerns: input.concerns?.trim() || null,
    },
    score: interviewScorecardAverage(ratings) ?? 0,
  };
}

export function parseInterviewScorecard(value: unknown): InterviewScorecard | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.ratings)) return null;

  const ratings = raw.ratings
    .filter(
      (r): r is { key: string; rating: number; comment?: unknown } =>
        !!r &&
        typeof r === 'object' &&
        typeof (r as { key?: unknown }).key === 'string' &&
        typeof (r as { rating?: unknown }).rating === 'number',
    )
    .map((r) => ({
      key: r.key,
      rating: r.rating,
      comment: typeof r.comment === 'string' ? r.comment : null,
    }));

  return {
    ratings,
    strengths: typeof raw.strengths === 'string' ? raw.strengths : null,
    concerns: typeof raw.concerns === 'string' ? raw.concerns : null,
  };
}

interface Slot {
  start: Date;
  end: Date | null;
}

function slotEnd(slot: Slot): number {
  return (slot.end ?? new Date(slot.start.getTime() + DEFAULT_INTERVIEW_DURATION_MS)).getTime();
}

export function slotsOverlap(a: Slot, b: Slot): boolean {
  return a.start.getTime() < slotEnd(b) && b.start.getTime() < slotEnd(a);
}

export function findInterviewerConflict<
  T extends { scheduledStartAt: Date | null; scheduledEndAt: Date | null },
>(slot: Slot, existing: T[]): T | null {
  return (
    existing.find(
      (row) =>
        row.scheduledStartAt != null &&
        slotsOverlap(slot, { start: row.scheduledStartAt, end: row.scheduledEndAt }),
    ) ?? null
  );
}

/** True when every earlier round on the application is completed or skipped. */
export function isRoundNextInLine(
  round: { roundOrder: number },
  siblings: ReadonlyArray<{ roundOrder: number; status: string }>,
): boolean {
  return siblings
    .filter((s) => s.roundOrder < round.roundOrder)
    .every((s) => s.status === 'completed' || s.status === 'skipped');
}
