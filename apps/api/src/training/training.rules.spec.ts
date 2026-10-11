import {
  assertCanEnrol,
  assertCanMark,
  assertCanWithdraw,
  assertCourseSchedulable,
  assertCourseTransition,
  assertSessionDetailsEditable,
  assertSessionTransition,
  assertSessionWindow,
  attendanceCounts,
  attendanceFields,
  summarizeSessionCosts,
} from './training.rules';

function code(fn: () => void): string | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    return (error as { response?: { code?: string } }).response?.code;
  }
}

const start = new Date('2026-10-10T09:00:00Z');
const before = new Date('2026-10-10T08:00:00Z');
const after = new Date('2026-10-10T10:00:00Z');

describe('course rules', () => {
  it('blocks archiving with open sessions and going back to draft once used', () => {
    expect(code(() => assertCourseTransition('active', 'archived', { sessionCount: 2, openSessionCount: 1 }))).toBe(
      'COURSE_HAS_OPEN_SESSIONS',
    );
    expect(code(() => assertCourseTransition('active', 'archived', { sessionCount: 2, openSessionCount: 0 }))).toBeUndefined();
    expect(code(() => assertCourseTransition('active', 'draft', { sessionCount: 1, openSessionCount: 0 }))).toBe(
      'INVALID_STATUS_TRANSITION',
    );
    expect(code(() => assertCourseTransition('archived', 'active', { sessionCount: 1, openSessionCount: 0 }))).toBeUndefined();
  });

  it('only schedules active courses', () => {
    expect(code(() => assertCourseSchedulable('draft'))).toBe('COURSE_NOT_ACTIVE');
    expect(code(() => assertCourseSchedulable('archived'))).toBe('COURSE_NOT_ACTIVE');
    expect(code(() => assertCourseSchedulable('active'))).toBeUndefined();
  });
});

describe('session rules', () => {
  it('requires the end after the start', () => {
    expect(code(() => assertSessionWindow(start, before))).toBe('VALIDATION_ERROR');
    expect(code(() => assertSessionWindow(start, start))).toBe('VALIDATION_ERROR');
    expect(code(() => assertSessionWindow(start, after))).toBeUndefined();
    expect(code(() => assertSessionWindow(start, null))).toBeUndefined();
  });

  it('follows the status flow', () => {
    const ctx = { now: after, scheduledStart: start, unmarkedCount: 0, attendedCount: 0 };
    expect(code(() => assertSessionTransition('scheduled', 'in_progress', ctx))).toBeUndefined();
    expect(code(() => assertSessionTransition('scheduled', 'in_progress', { ...ctx, now: before }))).toBe(
      'SESSION_NOT_STARTED',
    );
    expect(code(() => assertSessionTransition('in_progress', 'completed', { ...ctx, unmarkedCount: 2 }))).toBe(
      'ATTENDANCE_NOT_MARKED',
    );
    expect(code(() => assertSessionTransition('in_progress', 'cancelled', { ...ctx, attendedCount: 1 }))).toBe(
      'SESSION_HAS_ATTENDANCE',
    );
    expect(code(() => assertSessionTransition('completed', 'in_progress', ctx))).toBe('INVALID_STATUS_TRANSITION');
    expect(code(() => assertSessionTransition('cancelled', 'scheduled', ctx))).toBe('INVALID_STATUS_TRANSITION');
  });

  it('locks the schedule once started and everything once cancelled', () => {
    expect(code(() => assertSessionDetailsEditable('in_progress', true))).toBe('SESSION_CLOSED');
    expect(code(() => assertSessionDetailsEditable('in_progress', false))).toBeUndefined();
    expect(code(() => assertSessionDetailsEditable('cancelled', false))).toBe('SESSION_CLOSED');
  });
});

describe('attendance rules', () => {
  it('enrols only into open sessions of active courses', () => {
    expect(code(() => assertCanEnrol('completed', 'active'))).toBe('SESSION_CLOSED');
    expect(code(() => assertCanEnrol('scheduled', 'archived'))).toBe('COURSE_NOT_ACTIVE');
    expect(code(() => assertCanEnrol('in_progress', 'active'))).toBeUndefined();
  });

  it('withdraws only unmarked enrolments', () => {
    expect(code(() => assertCanWithdraw('scheduled', 'attended'))).toBe('INVALID_STATUS_TRANSITION');
    expect(code(() => assertCanWithdraw('completed', 'registered'))).toBe('SESSION_CLOSED');
    expect(code(() => assertCanWithdraw('scheduled', 'registered'))).toBeUndefined();
  });

  it('marks attendance only after the start', () => {
    const base = { sessionStatus: 'scheduled' as const, scheduledStart: start, now: after, from: 'registered' as const };
    expect(code(() => assertCanMark({ ...base, to: 'attended' }))).toBeUndefined();
    expect(code(() => assertCanMark({ ...base, now: before, to: 'attended' }))).toBe('SESSION_NOT_STARTED');
    expect(code(() => assertCanMark({ ...base, sessionStatus: 'cancelled', to: 'attended' }))).toBe('SESSION_CLOSED');
    expect(code(() => assertCanMark({ ...base, from: 'cancelled', to: 'attended' }))).toBe('INVALID_STATUS_TRANSITION');
    expect(code(() => assertCanMark({ ...base, sessionStatus: 'completed', from: 'attended', to: 'registered' }))).toBe(
      'SESSION_CLOSED',
    );
  });

  it('keeps timestamps and score in line with the status', () => {
    const existing = { attendedAt: start, completedAt: null, score: 80 };
    expect(attendanceFields('completed', existing, after, undefined)).toEqual({
      attendedAt: start,
      completedAt: after,
      score: 80,
    });
    expect(attendanceFields('no_show', existing, after, undefined)).toEqual({
      attendedAt: null,
      completedAt: null,
      score: null,
    });
    expect(code(() => attendanceFields('registered', existing, after, 50))).toBe('VALIDATION_ERROR');
  });
});

describe('cost per session', () => {
  it('divides company-currency costs by attendees and lists other currencies separately', () => {
    const summary = summarizeSessionCosts(
      [
        { amount: 300, currency: 'AUD' },
        { amount: 150.5, currency: 'aud' },
        { amount: 40, currency: 'USD' },
      ],
      'AUD',
      { attendedCount: 3, enrolledCount: 4 },
    );
    expect(summary).toEqual({
      totalCost: 450.5,
      costPerAttendee: 150.17,
      costPerEnrolled: 112.63,
      otherCurrencyCosts: [{ currency: 'USD', amount: 40 }],
    });
    expect(summarizeSessionCosts([], 'AUD', { attendedCount: 0, enrolledCount: 0 }).costPerAttendee).toBeNull();
    const foreignOnly = summarizeSessionCosts([{ amount: 450, currency: 'AUD' }], 'BDT', {
      attendedCount: 2,
      enrolledCount: 2,
    });
    expect(foreignOnly.costPerAttendee).toBeNull();
    expect(foreignOnly.otherCurrencyCosts).toEqual([{ currency: 'AUD', amount: 450 }]);
  });

  it('counts withdrawn enrolments out', () => {
    expect(attendanceCounts(['registered', 'attended', 'completed', 'no_show', 'cancelled'])).toEqual({
      enrolledCount: 4,
      attendedCount: 2,
      completedCount: 1,
      noShowCount: 1,
      unmarkedCount: 1,
    });
  });
});
