import {
  mergeRealtimeSettings,
  shouldLiveBroadcast,
  DEFAULT_REALTIME_BROADCAST,
} from './realtime.constants';

describe('realtime.constants', () => {
  it('merges stored overrides with defaults', () => {
    const view = mergeRealtimeSettings(
      { enabled: true, liveBroadcast: { 'leave.rejected': true } },
      '2026-09-03T00:00:00.000Z',
    );

    expect(view.liveBroadcast['leave.rejected']).toBe(true);
    expect(view.liveBroadcast['leave.approved']).toBe(
      DEFAULT_REALTIME_BROADCAST['leave.approved'],
    );
  });

  it('respects master toggle for live broadcast', () => {
    const disabled = mergeRealtimeSettings(
      { enabled: false, liveBroadcast: { 'leave.approved': true } },
      null,
    );
    expect(shouldLiveBroadcast(disabled, 'leave.approved')).toBe(false);

    const enabled = mergeRealtimeSettings(
      { enabled: true, liveBroadcast: { 'leave.rejected': false } },
      null,
    );
    expect(shouldLiveBroadcast(enabled, 'leave.approved')).toBe(true);
    expect(shouldLiveBroadcast(enabled, 'leave.rejected')).toBe(false);
  });
});
