import {
  assertCycleEditable,
  assertCycleInProgress,
  assertCycleLaunchable,
  assertCycleOpenForParticipants,
  assertCycleStatusTransition,
  assertReviewDueDate,
} from './review-cycle.rules';

const launched = new Date('2026-07-05');

describe('assertCycleStatusTransition', () => {
  it('only starts a draft cycle through launch', () => {
    expect(() => assertCycleStatusTransition('draft', 'active')).toThrow(/Launch the cycle/);
    expect(() => assertCycleStatusTransition('draft', 'archived')).not.toThrow();
  });

  it('closes, reopens and archives in order', () => {
    expect(() => assertCycleStatusTransition('active', 'closed')).not.toThrow();
    expect(() => assertCycleStatusTransition('closed', 'active')).not.toThrow();
    expect(() => assertCycleStatusTransition('closed', 'archived')).not.toThrow();
    expect(() => assertCycleStatusTransition('active', 'archived')).toThrow(/close it first/);
    expect(() => assertCycleStatusTransition('active', 'draft')).toThrow();
    expect(() => assertCycleStatusTransition('archived', 'closed')).toThrow();
  });
});

describe('assertCycleEditable', () => {
  it('lets a draft cycle change anything', () => {
    expect(() =>
      assertCycleEditable({ status: 'draft', launchedAt: null }, ['periodStart', 'requiresWorkflowApproval']),
    ).not.toThrow();
  });

  it('keeps the period and approval setting once launched', () => {
    const cycle = { status: 'active' as const, launchedAt: launched };
    expect(() => assertCycleEditable(cycle, ['name', 'reviewDueDate'])).not.toThrow();
    expect(() => assertCycleEditable(cycle, ['periodStart', 'periodEnd'])).toThrow(
      'The cycle has launched, so its period can no longer change',
    );
    expect(() => assertCycleEditable(cycle, ['requiresWorkflowApproval'])).toThrow(/approval setting/);
  });

  it('allows only status changes on completed cycles and nothing on archived ones', () => {
    expect(() => assertCycleEditable({ status: 'closed', launchedAt: launched }, [])).not.toThrow();
    expect(() => assertCycleEditable({ status: 'closed', launchedAt: launched }, ['name'])).toThrow(/reopen/);
    expect(() => assertCycleEditable({ status: 'archived', launchedAt: launched }, [])).toThrow(/read-only/);
  });
});

describe('cycle guards', () => {
  it('rejects a due date before the cycle starts', () => {
    expect(() => assertReviewDueDate('2026-07-01', '2026-06-30')).toThrow();
    expect(() => assertReviewDueDate('2026-07-01', '2026-07-01')).not.toThrow();
  });

  it('keeps participants open until the cycle completes', () => {
    expect(() => assertCycleOpenForParticipants('draft')).not.toThrow();
    expect(() => assertCycleOpenForParticipants('active')).not.toThrow();
    expect(() => assertCycleOpenForParticipants('closed')).toThrow();
  });

  it('launches draft and in-progress cycles only', () => {
    expect(() => assertCycleLaunchable('draft')).not.toThrow();
    expect(() => assertCycleLaunchable('active')).not.toThrow();
    expect(() => assertCycleLaunchable('closed')).toThrow(/reopen/);
    expect(() => assertCycleLaunchable('archived')).toThrow();
  });

  it('allows assessment changes only while in progress', () => {
    expect(() => assertCycleInProgress('active')).not.toThrow();
    expect(() => assertCycleInProgress('closed')).toThrow(/completed/);
  });
});
