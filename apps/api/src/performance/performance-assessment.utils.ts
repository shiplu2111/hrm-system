import type {
  KpiUnit,
  PerformanceAssessmentPayload,
  PerformanceCompetencyAssessment,
  PerformanceKpiAssessmentItem,
} from '@hrm/shared-types';
import { Decimal } from '@prisma/client/runtime/library';
import { computeKpiProgressPercent, decimalToNumber } from './performance.utils';
import type { KpiDirection } from '@hrm/shared-types';

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

export function emptyAssessmentPayload(): PerformanceAssessmentPayload {
  return {
    competencies: DEFAULT_PERFORMANCE_COMPETENCIES.map((item) => ({ ...item })),
    kpiAssessments: [],
    overallSelfComment: null,
    overallManagerComment: null,
  };
}

export function buildKpiAssessmentItems(
  assignments: Array<{
    id: string;
    title: string;
    unit: KpiUnit;
    targetValue: Decimal;
    currentValue: Decimal | null;
    direction: KpiDirection;
  }>,
): PerformanceKpiAssessmentItem[] {
  return assignments.map((assignment) => {
    const targetValue = decimalToNumber(assignment.targetValue) ?? 0;
    const currentValue = decimalToNumber(assignment.currentValue);
    return {
      kpiAssignmentId: assignment.id,
      title: assignment.title,
      unit: assignment.unit,
      targetValue,
      currentValue,
      progressPercent: computeKpiProgressPercent(
        targetValue,
        currentValue,
        assignment.direction,
      ),
    };
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

export function mergeSelfAssessment(
  existing: PerformanceAssessmentPayload,
  patch: Partial<PerformanceAssessmentPayload>,
): PerformanceAssessmentPayload {
  return {
    competencies: patch.competencies ?? existing.competencies,
    kpiAssessments: patch.kpiAssessments ?? existing.kpiAssessments,
    overallSelfComment:
      patch.overallSelfComment !== undefined
        ? patch.overallSelfComment
        : existing.overallSelfComment,
    overallManagerComment: existing.overallManagerComment,
  };
}

export function mergeManagerAssessment(
  existing: PerformanceAssessmentPayload,
  selfAssessment: PerformanceAssessmentPayload,
  patch: Partial<PerformanceAssessmentPayload>,
): PerformanceAssessmentPayload {
  const base = {
    competencies: selfAssessment.competencies.map((item) => ({
      ...item,
      managerRating:
        existing.competencies.find((row) => row.key === item.key)?.managerRating ??
        item.managerRating ??
        null,
      managerComment:
        existing.competencies.find((row) => row.key === item.key)?.managerComment ??
        item.managerComment ??
        null,
    })),
    kpiAssessments: selfAssessment.kpiAssessments.map((item) => ({
      ...item,
      managerRating:
        existing.kpiAssessments.find((row) => row.kpiAssignmentId === item.kpiAssignmentId)
          ?.managerRating ?? item.managerRating ?? null,
      managerComment:
        existing.kpiAssessments.find((row) => row.kpiAssignmentId === item.kpiAssignmentId)
          ?.managerComment ?? item.managerComment ?? null,
    })),
    overallSelfComment: selfAssessment.overallSelfComment ?? null,
    overallManagerComment:
      patch.overallManagerComment !== undefined
        ? patch.overallManagerComment
        : existing.overallManagerComment,
  };

  if (patch.competencies) {
    base.competencies = patch.competencies.map((item) => ({
      ...item,
      managerRating: item.managerRating ?? null,
      managerComment: item.managerComment ?? null,
    }));
  }
  if (patch.kpiAssessments) {
    base.kpiAssessments = patch.kpiAssessments.map((item) => ({
      ...item,
      managerRating: item.managerRating ?? null,
      managerComment: item.managerComment ?? null,
    }));
  }

  return base;
}
