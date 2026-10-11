import { BadRequestException } from '@nestjs/common';
import type { PerformanceReviewCycleStatus } from '@hrm/shared-types';

const STATUS_NAMES: Record<PerformanceReviewCycleStatus, string> = {
  draft: 'draft',
  active: 'in-progress',
  closed: 'completed',
  archived: 'archived',
};

/** Draft → active only happens through launch, which creates the review forms. */
const NEXT_CYCLE_STATUSES: Record<PerformanceReviewCycleStatus, PerformanceReviewCycleStatus[]> = {
  draft: ['archived'],
  active: ['closed'],
  closed: ['active', 'archived'],
  archived: [],
};

/** Fixed once the cycle launches: reviews and KPI windows were built from them. */
export const CYCLE_LAUNCH_FIELDS = [
  'periodStart',
  'periodEnd',
  'measurementPeriod',
  'requiresWorkflowApproval',
] as const;

export type CycleLaunchField = (typeof CYCLE_LAUNCH_FIELDS)[number];

const LAUNCH_FIELD_LABELS: Record<CycleLaunchField, string> = {
  periodStart: 'period',
  periodEnd: 'period',
  measurementPeriod: 'measurement period',
  requiresWorkflowApproval: 'approval setting',
};

export function assertCycleStatusTransition(
  from: PerformanceReviewCycleStatus,
  to: PerformanceReviewCycleStatus,
): void {
  if (from === to) return;
  if (from === 'draft' && to === 'active') {
    throw new BadRequestException({
      code: 'INVALID_STATUS_TRANSITION',
      message: 'Launch the cycle to start it; launching creates the review forms',
    });
  }
  if (!NEXT_CYCLE_STATUSES[from].includes(to)) {
    const hint = from === 'active' && to === 'archived' ? '; close it first' : '';
    const article = /^[aeiou]/.test(STATUS_NAMES[from]) ? 'An' : 'A';
    throw new BadRequestException({
      code: 'INVALID_STATUS_TRANSITION',
      message: `${article} ${STATUS_NAMES[from]} review cycle can't become ${STATUS_NAMES[to]}${hint}`,
    });
  }
}

/**
 * `changedFields` excludes `status`. Archived cycles are read-only; completed cycles only
 * change status (reopen or archive); launched cycles keep their period and approval setting.
 */
export function assertCycleEditable(
  cycle: { status: PerformanceReviewCycleStatus; launchedAt: Date | null },
  changedFields: string[],
): void {
  if (cycle.status === 'archived') {
    throw new BadRequestException({
      code: 'CYCLE_LOCKED',
      message: 'Archived review cycles are read-only',
    });
  }
  if (changedFields.length === 0) return;
  if (cycle.status === 'closed') {
    throw new BadRequestException({
      code: 'CYCLE_LOCKED',
      message: 'This review cycle is completed; reopen it to make changes',
    });
  }
  if (cycle.launchedAt) {
    const locked = CYCLE_LAUNCH_FIELDS.filter((field) => changedFields.includes(field));
    if (locked.length > 0) {
      const labels = [...new Set(locked.map((field) => LAUNCH_FIELD_LABELS[field]))];
      throw new BadRequestException({
        code: 'CYCLE_LAUNCHED',
        message: `The cycle has launched, so its ${labels.join(' and ')} can no longer change`,
      });
    }
  }
}

export function assertReviewDueDate(periodStart: string, reviewDueDate: string): void {
  if (reviewDueDate < periodStart) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'The review due date cannot be before the cycle starts',
    });
  }
}

/** Participants can change until the cycle is completed, including after launch. */
export function assertCycleOpenForParticipants(status: PerformanceReviewCycleStatus): void {
  if (status === 'closed' || status === 'archived') {
    throw new BadRequestException({
      code: 'CYCLE_LOCKED',
      message: `Participants of ${status === 'archived' ? 'an' : 'a'} ${STATUS_NAMES[status]} review cycle can't change`,
    });
  }
}

export function assertCycleLaunchable(status: PerformanceReviewCycleStatus): void {
  if (status === 'closed') {
    throw new BadRequestException({
      code: 'CYCLE_LOCKED',
      message: 'This review cycle is completed; reopen it before creating more reviews',
    });
  }
  if (status === 'archived') {
    throw new BadRequestException({
      code: 'CYCLE_LOCKED',
      message: 'Archived review cycles cannot be launched',
    });
  }
}

/** Self and manager assessments can only change while their cycle is in progress. */
export function assertCycleInProgress(status: PerformanceReviewCycleStatus): void {
  if (status !== 'active') {
    throw new BadRequestException({
      code: 'CYCLE_LOCKED',
      message: `The review cycle is ${STATUS_NAMES[status]}, so its assessments can't change`,
    });
  }
}
