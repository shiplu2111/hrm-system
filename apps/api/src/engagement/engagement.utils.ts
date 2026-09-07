import { createHash } from 'node:crypto';
import type { EmployeeKudosType, EnpsSummary } from '@hrm/shared-types';

/** Classify recognition as manager when the sender is the recipient's direct manager. */
export function resolveKudosType(
  fromEmployeeId: string,
  toEmployeeManagerId: string | null,
): EmployeeKudosType {
  return toEmployeeManagerId === fromEmployeeId ? 'manager' : 'peer';
}

/** eNPS: % promoters (9–10) minus % detractors (0–6) on a 0–10 scale. */
export function computeEnps(scores: number[]): EnpsSummary {
  const distribution = Array.from({ length: 11 }, (_, score) => ({
    score,
    count: 0,
  }));

  for (const score of scores) {
    if (score >= 0 && score <= 10) {
      distribution[score].count += 1;
    }
  }

  const total = scores.length;
  if (total === 0) {
    return {
      score: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      total: 0,
      distribution,
    };
  }

  const promoters = scores.filter((s) => s >= 9).length;
  const passives = scores.filter((s) => s >= 7 && s <= 8).length;
  const detractors = scores.filter((s) => s <= 6).length;
  const score = Math.round(((promoters - detractors) / total) * 100);

  return {
    score,
    promoters,
    passives,
    detractors,
    total,
    distribution,
  };
}

export function responseFingerprint(employeeId: string, surveyId: string): string {
  return createHash('sha256').update(`${employeeId}:${surveyId}`).digest('hex');
}
