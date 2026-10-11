import { BadRequestException } from '@nestjs/common';
import type {
  EmployeeKpiAssignmentStatus,
  KpiDirection,
  KpiUnit,
  PerformanceAssessmentPayload,
  PerformanceAssessmentSide,
  PerformanceCompetencyAssessment,
  PerformanceKpiAssessmentItem,
} from '@hrm/shared-types';
import { Decimal } from '@prisma/client/runtime/library';
import { computeKpiProgressPercent, decimalToNumber, formatDateOnly } from './performance.utils';

export const DEFAULT_PERFORMANCE_COMPETENCIES: PerformanceCompetencyAssessment[] = [
  {
    key: 'impact',
    label: 'Business impact',
  },
  {
    key: 'ownership',
    label: 'Ownership',
  },
  {
    key: 'collaboration',
    label: 'Collaboration',
  },
  {
    key: 'craft',
    label: 'Functional excellence',
  },
];

/** KPI goal statuses a review rates; draft goals aren't agreed yet and cancelled ones no longer count. */
export const RATED_KPI_STATUSES: EmployeeKpiAssignmentStatus[] = ['active', 'completed'];

export interface ReviewKpiGoal {
  id: string;
  title: string;
  unit: KpiUnit;
  direction: KpiDirection;
  targetValue: Decimal;
  currentValue: Decimal | null;
  weightPercent: Decimal | null;
  measurementPeriodStart: Date;
  measurementPeriodEnd: Date;
  status: EmployeeKpiAssignmentStatus;
}

interface RatingInput {
  rating?: number | null;
  comment?: string | null;
}

export interface AssessmentPatch {
  competencies?: Array<RatingInput & { key: string }>;
  kpiAssessments?: Array<RatingInput & { kpiAssignmentId: string }>;
  overallComment?: string | null;
}

export function emptyAssessmentPayload(): PerformanceAssessmentPayload {
  return {
    competencies: DEFAULT_PERFORMANCE_COMPETENCIES.map((item) => ({ ...item })),
    kpiAssessments: [],
    overallSelfComment: null,
    overallManagerComment: null,
  };
}

export function buildKpiAssessmentItems(goals: ReviewKpiGoal[]): PerformanceKpiAssessmentItem[] {
  return goals.map((goal) => {
    const targetValue = decimalToNumber(goal.targetValue) ?? 0;
    const currentValue = decimalToNumber(goal.currentValue);
    return {
      kpiAssignmentId: goal.id,
      title: goal.title,
      unit: goal.unit,
      targetValue,
      currentValue,
      progressPercent: computeKpiProgressPercent(targetValue, currentValue, goal.direction),
      direction: goal.direction,
      weightPercent: decimalToNumber(goal.weightPercent),
      measurementPeriodStart: formatDateOnly(goal.measurementPeriodStart),
      measurementPeriodEnd: formatDateOnly(goal.measurementPeriodEnd),
      goalStatus: goal.status,
    };
  });
}

/**
 * Rebuilds KPI items from the employee's current rated goals, keeping existing ratings and
 * comments by goal id. Goals cancelled since launch drop out; goals activated since launch join.
 */
export function syncKpiItems(
  items: PerformanceKpiAssessmentItem[],
  goals: ReviewKpiGoal[],
): PerformanceKpiAssessmentItem[] {
  const previous = new Map(items.map((item) => [item.kpiAssignmentId, item]));
  return buildKpiAssessmentItems(
    goals.filter((goal) => RATED_KPI_STATUSES.includes(goal.status)),
  ).map((item) => {
    const prior = previous.get(item.kpiAssignmentId);
    return prior
      ? {
          ...item,
          selfRating: prior.selfRating ?? null,
          selfComment: prior.selfComment ?? null,
          managerRating: prior.managerRating ?? null,
          managerComment: prior.managerComment ?? null,
        }
      : item;
  });
}

export function parseAssessmentPayload(value: unknown): PerformanceAssessmentPayload {
  if (!value || typeof value !== 'object') {
    return emptyAssessmentPayload();
  }

  const record = value as Partial<PerformanceAssessmentPayload>;
  return {
    competencies:
      Array.isArray(record.competencies) && record.competencies.length > 0
        ? record.competencies
        : DEFAULT_PERFORMANCE_COMPETENCIES.map((item) => ({ ...item })),
    kpiAssessments: Array.isArray(record.kpiAssessments)
      ? record.kpiAssessments
      : [],
    overallSelfComment: record.overallSelfComment ?? null,
    overallManagerComment: record.overallManagerComment ?? null,
  };
}

/**
 * The manager form: items and self fields come from the self assessment, manager fields from
 * the stored manager assessment, so a manager save can never alter what the employee wrote.
 */
export function managerAssessmentView(
  self: PerformanceAssessmentPayload,
  manager: PerformanceAssessmentPayload,
): PerformanceAssessmentPayload {
  const competencyByKey = new Map(manager.competencies.map((item) => [item.key, item]));
  const kpiById = new Map(manager.kpiAssessments.map((item) => [item.kpiAssignmentId, item]));
  return {
    competencies: self.competencies.map((item) => ({
      ...item,
      managerRating: competencyByKey.get(item.key)?.managerRating ?? null,
      managerComment: competencyByKey.get(item.key)?.managerComment ?? null,
    })),
    kpiAssessments: self.kpiAssessments.map((item) => ({
      ...item,
      managerRating: kpiById.get(item.kpiAssignmentId)?.managerRating ?? null,
      managerComment: kpiById.get(item.kpiAssignmentId)?.managerComment ?? null,
    })),
    overallSelfComment: self.overallSelfComment ?? null,
    overallManagerComment: manager.overallManagerComment ?? null,
  };
}

function cleanComment(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function applyRating<T extends PerformanceCompetencyAssessment | PerformanceKpiAssessmentItem>(
  item: T,
  side: PerformanceAssessmentSide,
  input: RatingInput | undefined,
): T {
  if (!input) return item;
  if (side === 'self') {
    return {
      ...item,
      selfRating: input.rating !== undefined ? input.rating : (item.selfRating ?? null),
      selfComment: input.comment !== undefined ? cleanComment(input.comment) : (item.selfComment ?? null),
    };
  }
  return {
    ...item,
    managerRating: input.rating !== undefined ? input.rating : (item.managerRating ?? null),
    managerComment:
      input.comment !== undefined ? cleanComment(input.comment) : (item.managerComment ?? null),
  };
}

/** Applies one side's ratings and comments by item key; other fields are left untouched. */
export function applyAssessmentPatch(
  payload: PerformanceAssessmentPayload,
  side: PerformanceAssessmentSide,
  patch: AssessmentPatch,
): PerformanceAssessmentPayload {
  const competencyInputs = new Map((patch.competencies ?? []).map((item) => [item.key, item]));
  const kpiInputs = new Map((patch.kpiAssessments ?? []).map((item) => [item.kpiAssignmentId, item]));

  const knownCompetencies = new Set(payload.competencies.map((item) => item.key));
  const unknownCompetency = [...competencyInputs.keys()].find((key) => !knownCompetencies.has(key));
  if (unknownCompetency) {
    throw new BadRequestException({
      code: 'UNKNOWN_ASSESSMENT_ITEM',
      message: `"${unknownCompetency}" is not a competency on this review`,
    });
  }
  const knownKpis = new Set(payload.kpiAssessments.map((item) => item.kpiAssignmentId));
  if ([...kpiInputs.keys()].some((id) => !knownKpis.has(id))) {
    throw new BadRequestException({
      code: 'UNKNOWN_ASSESSMENT_ITEM',
      message: 'A KPI goal in this form is no longer part of the review; reload it and try again',
    });
  }

  const next: PerformanceAssessmentPayload = {
    ...payload,
    competencies: payload.competencies.map((item) =>
      applyRating(item, side, competencyInputs.get(item.key)),
    ),
    kpiAssessments: payload.kpiAssessments.map((item) =>
      applyRating(item, side, kpiInputs.get(item.kpiAssignmentId)),
    ),
  };
  if (patch.overallComment !== undefined) {
    if (side === 'self') next.overallSelfComment = cleanComment(patch.overallComment);
    else next.overallManagerComment = cleanComment(patch.overallComment);
  }
  return next;
}
