import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  findKpiMeasurementWindow,
  KPI_WEIGHT_LIMIT_PERCENT,
  kpiMeasurementWindows,
  type EmployeeKpiAssignmentStatus,
  type KpiAssignmentLockState,
  type KpiDirection,
  type KpiMeasurementPeriod,
  type PerformanceReviewCycleStatus,
} from '@hrm/shared-types';

const LOCKED_CYCLE_STATUSES: PerformanceReviewCycleStatus[] = ['closed', 'archived'];

/** Fields fixed once the employee's review has launched (the review snapshots them). */
export const KPI_TARGET_FIELDS = [
  'title',
  'targetValue',
  'measurementPeriod',
  'measurementPeriodStart',
  'measurementPeriodEnd',
  'weightPercent',
] as const;

export interface CycleWindowSource {
  periodStart: string;
  periodEnd: string;
  measurementPeriod: KpiMeasurementPeriod;
}

export interface ResolvedMeasurementPeriod {
  measurementPeriod: KpiMeasurementPeriod;
  start: string;
  end: string;
}

export function kpiAssignmentLockState(
  cycleStatus: PerformanceReviewCycleStatus,
  reviewLaunched: boolean,
): KpiAssignmentLockState {
  if (LOCKED_CYCLE_STATUSES.includes(cycleStatus)) return 'cycle_locked';
  return reviewLaunched ? 'targets_locked' : 'open';
}

export function assertCycleOpenForGoals(cycleStatus: PerformanceReviewCycleStatus): void {
  if (LOCKED_CYCLE_STATUSES.includes(cycleStatus)) {
    throw new BadRequestException({
      code: 'CYCLE_LOCKED',
      message: 'KPI goals in a closed or archived review cycle are read-only',
    });
  }
}

export function assertReviewNotLaunched(reviewLaunched: boolean, employeeName: string): void {
  if (reviewLaunched) {
    throw new BadRequestException({
      code: 'REVIEW_LAUNCHED',
      message: `${employeeName}'s review for this cycle has already launched, so new KPI goals would not be part of it`,
    });
  }
}

/**
 * Dates default to the whole cycle. A fixed period type (monthly, quarterly, …) must use one of
 * the cycle's windows of that type; without an explicit type the cycle's own type is used when the
 * dates fit one of its windows, otherwise the goal is `custom`.
 */
export function resolveMeasurementPeriod(
  cycle: CycleWindowSource,
  input: { measurementPeriod?: KpiMeasurementPeriod; start?: string; end?: string },
): ResolvedMeasurementPeriod {
  const start = input.start ?? cycle.periodStart;
  const end = input.end ?? cycle.periodEnd;

  if (start > end) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Measurement period start must be on or before end',
    });
  }
  if (start < cycle.periodStart || end > cycle.periodEnd) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Measurement period must fall within the review cycle period',
    });
  }

  if (!input.measurementPeriod) {
    const fits = findKpiMeasurementWindow(
      cycle.periodStart,
      cycle.periodEnd,
      cycle.measurementPeriod,
      start,
      end,
    );
    return { measurementPeriod: fits ? cycle.measurementPeriod : 'custom', start, end };
  }

  if (input.measurementPeriod === 'custom') {
    return { measurementPeriod: 'custom', start, end };
  }

  const window = findKpiMeasurementWindow(
    cycle.periodStart,
    cycle.periodEnd,
    input.measurementPeriod,
    start,
    end,
  );
  if (!window) {
    const example = kpiMeasurementWindows(
      cycle.periodStart,
      cycle.periodEnd,
      input.measurementPeriod,
    )[0];
    throw new BadRequestException({
      code: 'INVALID_MEASUREMENT_PERIOD',
      message: example
        ? `Dates must match a ${input.measurementPeriod.replace('_', '-')} window of the review cycle (e.g. ${example.label}), or use a custom period`
        : 'The review cycle has no windows of that period type; use a custom period',
    });
  }
  return { measurementPeriod: input.measurementPeriod, start, end };
}

export function assertTargetValue(targetValue: number, direction: KpiDirection): void {
  if (!Number.isFinite(targetValue) || targetValue < 0) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Target value must be zero or more',
    });
  }
  if (direction === 'higher_is_better' && targetValue === 0) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Target value must be greater than zero when higher is better',
    });
  }
}

export function assertWeightWithinLimit(
  existingTotal: number,
  addedWeight: number,
  employeeName: string,
): void {
  const total = Math.round((existingTotal + addedWeight) * 100) / 100;
  if (total > KPI_WEIGHT_LIMIT_PERCENT) {
    throw new ConflictException({
      code: 'WEIGHT_LIMIT_EXCEEDED',
      message: `${employeeName}'s KPI weights in this cycle would total ${total}% (limit ${KPI_WEIGHT_LIMIT_PERCENT}%; ${Math.max(0, Math.round((KPI_WEIGHT_LIMIT_PERCENT - existingTotal) * 100) / 100)}% available)`,
    });
  }
}

export function assertStatusTransition(
  from: EmployeeKpiAssignmentStatus,
  to: EmployeeKpiAssignmentStatus,
): void {
  if (from === to) return;
  if (from === 'cancelled') {
    throw new BadRequestException({
      code: 'INVALID_STATUS_TRANSITION',
      message: 'A cancelled KPI goal cannot be reopened; assign it again instead',
    });
  }
  if (to === 'draft' && from !== 'draft') {
    throw new BadRequestException({
      code: 'INVALID_STATUS_TRANSITION',
      message: 'An active or completed KPI goal cannot move back to draft',
    });
  }
}

const TARGET_FIELD_LABELS: Record<(typeof KPI_TARGET_FIELDS)[number], string> = {
  title: 'title',
  targetValue: 'target',
  measurementPeriod: 'measurement period',
  measurementPeriodStart: 'measurement period',
  measurementPeriodEnd: 'measurement period',
  weightPercent: 'weight',
};

/** Throws when a targets-locked goal is asked to change any target field. */
export function assertTargetFieldsUnchanged(
  changed: ReadonlyArray<(typeof KPI_TARGET_FIELDS)[number]>,
): void {
  if (changed.length > 0) {
    const labels = [...new Set(changed.map((field) => TARGET_FIELD_LABELS[field]))];
    throw new BadRequestException({
      code: 'TARGETS_LOCKED',
      message: `The employee's review has launched, so the goal's ${labels.join(', ')} can no longer change; only progress, notes and status can be updated`,
    });
  }
}
