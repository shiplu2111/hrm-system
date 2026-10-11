import { BadRequestException } from '@nestjs/common';
import type {
  TrainingAttendanceMarkStatus,
  TrainingAttendanceStatus,
  TrainingCourseStatus,
  TrainingSessionStatus,
} from '@hrm/shared-types';

function reject(code: string, message: string): never {
  throw new BadRequestException({ code, message });
}

export const MAX_ENROLMENTS_PER_REQUEST = 200;
export const MAX_SESSION_HOURS = 24 * 14;

const OPEN_SESSION_STATUSES: TrainingSessionStatus[] = ['scheduled', 'in_progress'];

export function isSessionOpen(status: TrainingSessionStatus): boolean {
  return OPEN_SESSION_STATUSES.includes(status);
}

/** draft ⇄ active while unused; anything → archived (no open sessions); archived → active. */
export function assertCourseTransition(
  from: TrainingCourseStatus,
  to: TrainingCourseStatus,
  counts: { sessionCount: number; openSessionCount: number },
): void {
  if (from === to) return;
  if (to === 'draft' && counts.sessionCount > 0) {
    reject(
      'INVALID_STATUS_TRANSITION',
      'A course with sessions can’t go back to draft; archive it instead',
    );
  }
  if (to === 'archived' && counts.openSessionCount > 0) {
    reject(
      'COURSE_HAS_OPEN_SESSIONS',
      `Complete or cancel the course’s ${counts.openSessionCount} open ${
        counts.openSessionCount === 1 ? 'session' : 'sessions'
      } before archiving it`,
    );
  }
  if (from === 'archived' && to === 'draft') {
    reject('INVALID_STATUS_TRANSITION', 'Restore an archived course as active');
  }
}

export function assertCourseSchedulable(status: TrainingCourseStatus): void {
  if (status !== 'active') {
    reject(
      'COURSE_NOT_ACTIVE',
      status === 'draft'
        ? 'Activate the course before scheduling sessions'
        : 'Archived courses can’t be scheduled',
    );
  }
}

export function assertSessionWindow(start: Date, end: Date | null): void {
  if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime()))) {
    reject('VALIDATION_ERROR', 'Enter a valid start and end time');
  }
  if (end && end.getTime() <= start.getTime()) {
    reject('VALIDATION_ERROR', 'The session must end after it starts');
  }
  if (end && end.getTime() - start.getTime() > MAX_SESSION_HOURS * 3600 * 1000) {
    reject('VALIDATION_ERROR', `A session can last at most ${MAX_SESSION_HOURS / 24} days`);
  }
}

/**
 * scheduled → in_progress → completed; scheduled → completed; scheduled / in_progress → cancelled.
 * Completed and cancelled are final.
 */
export function assertSessionTransition(
  from: TrainingSessionStatus,
  to: TrainingSessionStatus,
  context: { now: Date; scheduledStart: Date; unmarkedCount: number; attendedCount: number },
): void {
  if (from === to) return;
  if (from === 'completed' || from === 'cancelled') {
    reject('INVALID_STATUS_TRANSITION', `This session is ${from} and can’t change status`);
  }
  if (to === 'scheduled') {
    reject('INVALID_STATUS_TRANSITION', 'A started session can’t go back to scheduled');
  }
  if ((to === 'in_progress' || to === 'completed') && context.now < context.scheduledStart) {
    reject('SESSION_NOT_STARTED', 'The session hasn’t started yet');
  }
  if (to === 'completed' && context.unmarkedCount > 0) {
    reject(
      'ATTENDANCE_NOT_MARKED',
      `Mark attendance for the ${context.unmarkedCount} remaining ${
        context.unmarkedCount === 1 ? 'person' : 'people'
      } before completing the session`,
    );
  }
  if (to === 'cancelled' && context.attendedCount > 0) {
    reject(
      'SESSION_HAS_ATTENDANCE',
      'People have already attended this session; complete it instead of cancelling',
    );
  }
}

export function assertSessionDetailsEditable(
  status: TrainingSessionStatus,
  changesSchedule: boolean,
): void {
  if (status === 'cancelled') {
    reject('SESSION_CLOSED', 'Cancelled sessions can’t be edited');
  }
  if (changesSchedule && status !== 'scheduled') {
    reject('SESSION_CLOSED', 'The date and time can only change before the session starts');
  }
}

export function assertCanEnrol(status: TrainingSessionStatus, courseStatus: TrainingCourseStatus): void {
  if (!isSessionOpen(status)) {
    reject('SESSION_CLOSED', `Enrolment is closed because the session is ${status}`);
  }
  if (courseStatus !== 'active') {
    reject('COURSE_NOT_ACTIVE', 'Enrolment is closed because the course isn’t active');
  }
}

export function assertCanWithdraw(
  sessionStatus: TrainingSessionStatus,
  attendanceStatus: TrainingAttendanceStatus,
): void {
  if (!isSessionOpen(sessionStatus)) {
    reject('SESSION_CLOSED', `Enrolments can’t change because the session is ${sessionStatus}`);
  }
  if (attendanceStatus !== 'registered') {
    reject(
      'INVALID_STATUS_TRANSITION',
      attendanceStatus === 'cancelled'
        ? 'This enrolment has already been withdrawn'
        : 'Attendance has been marked; set it back to registered before withdrawing',
    );
  }
}

export function assertCanMark(input: {
  sessionStatus: TrainingSessionStatus;
  scheduledStart: Date;
  now: Date;
  from: TrainingAttendanceStatus;
  to: TrainingAttendanceMarkStatus;
}): void {
  if (input.sessionStatus === 'cancelled') {
    reject('SESSION_CLOSED', 'The session was cancelled');
  }
  if (input.now < input.scheduledStart) {
    reject('SESSION_NOT_STARTED', 'Attendance can be marked once the session has started');
  }
  if (input.from === 'cancelled') {
    reject('INVALID_STATUS_TRANSITION', 'Re-enrol the employee before marking attendance');
  }
  if (input.to === 'registered' && input.sessionStatus === 'completed') {
    reject('SESSION_CLOSED', 'Everyone must stay marked on a completed session');
  }
}

/** Timestamps follow the status: going back to registered or no-show clears them, and the score. */
export function attendanceFields(
  to: TrainingAttendanceMarkStatus,
  existing: { attendedAt: Date | null; completedAt: Date | null; score: number | null },
  now: Date,
  score: number | null | undefined,
): { attendedAt: Date | null; completedAt: Date | null; score: number | null } {
  const present = to === 'attended' || to === 'completed';
  if (!present && score != null) {
    reject('VALIDATION_ERROR', 'A score can only be recorded for people who attended');
  }
  return {
    attendedAt: present ? (existing.attendedAt ?? now) : null,
    completedAt: to === 'completed' ? (existing.completedAt ?? now) : null,
    score: present ? (score === undefined ? existing.score : score) : null,
  };
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface SessionCostSummary {
  totalCost: number;
  costPerAttendee: number | null;
  costPerEnrolled: number | null;
  otherCurrencyCosts: Array<{ currency: string; amount: number }>;
}

/** Totals cover cost lines in the company currency; other currencies are listed separately. */
export function summarizeSessionCosts(
  costs: Array<{ amount: number; currency: string }>,
  currency: string,
  counts: { attendedCount: number; enrolledCount: number },
): SessionCostSummary {
  const base = currency.toUpperCase();
  let total = 0;
  let baseLines = 0;
  const others = new Map<string, number>();
  for (const cost of costs) {
    const code = cost.currency.toUpperCase();
    if (code === base) {
      total += cost.amount;
      baseLines += 1;
    } else {
      others.set(code, (others.get(code) ?? 0) + cost.amount);
    }
  }
  const totalCost = roundMoney(total);
  const perHead = (count: number) => (baseLines > 0 && count > 0 ? roundMoney(totalCost / count) : null);
  return {
    totalCost,
    costPerAttendee: perHead(counts.attendedCount),
    costPerEnrolled: perHead(counts.enrolledCount),
    otherCurrencyCosts: [...others].map(([code, amount]) => ({ currency: code, amount: roundMoney(amount) })),
  };
}

export function attendanceCounts(statuses: TrainingAttendanceStatus[]) {
  const count = (...values: TrainingAttendanceStatus[]) =>
    statuses.filter((status) => values.includes(status)).length;
  return {
    enrolledCount: statuses.length - count('cancelled'),
    attendedCount: count('attended', 'completed'),
    completedCount: count('completed'),
    noShowCount: count('no_show'),
    unmarkedCount: count('registered'),
  };
}
