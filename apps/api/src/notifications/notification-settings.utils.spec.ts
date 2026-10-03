import { DEFAULT_REALTIME_BROADCAST } from '../realtime/realtime.constants';
import { DEFAULT_NOTIFICATION_RULES, mergeNotificationRules } from './notification.constants';
import {
  NOTIFICATION_EVENT_TYPES,
  applyEventUpdates,
  diffEventSettings,
  toEventSettings,
  type EventSettingsState,
} from './notification-settings.utils';

const defaults = (): EventSettingsState => ({
  rules: mergeNotificationRules(null),
  realtimeEnabled: true,
  liveBroadcast: { ...DEFAULT_REALTIME_BROADCAST },
});

describe('notification-settings.utils', () => {
  it('lists every event with its defaults and flags approver-routed events', () => {
    const events = toEventSettings(defaults());
    expect(events.map((e) => e.eventType)).toEqual(NOTIFICATION_EVENT_TYPES);
    expect(events).toHaveLength(Object.keys(DEFAULT_REALTIME_BROADCAST).length);

    const pending = events.find((e) => e.eventType === 'approval.pending')!;
    expect(pending.directRecipients).toBe(true);
    const rejected = events.find((e) => e.eventType === 'leave.rejected')!;
    expect(rejected.live).toBe(false);
    expect(rejected.defaults).toEqual({
      enabled: true,
      channels: { inApp: true, email: true, push: true },
      live: false,
    });
  });

  it('applies updates without touching unlisted events or recipients', () => {
    const current = defaults();
    const next = applyEventUpdates(current, {
      realtimeEnabled: false,
      events: [
        {
          eventType: 'kudos.received',
          enabled: true,
          channels: { inApp: true, email: false, push: false },
          live: false,
        },
      ],
    });

    expect(next.realtimeEnabled).toBe(false);
    expect(next.rules['kudos.received'].channels).toEqual({ inApp: true, email: false, push: false });
    expect(next.rules['kudos.received'].recipients).toEqual(
      DEFAULT_NOTIFICATION_RULES['kudos.received'].recipients,
    );
    expect(next.liveBroadcast['kudos.received']).toBe(false);
    expect(next.rules['leave.approved']).toEqual(current.rules['leave.approved']);
    expect(current.rules['kudos.received'].channels.email).toBe(true);
  });

  it('audits only the events that changed, separately for rules and live delivery', () => {
    const current = defaults();
    const next = applyEventUpdates(current, {
      realtimeEnabled: true,
      events: [
        {
          eventType: 'payroll.finalized',
          enabled: true,
          channels: { inApp: true, email: true, push: false },
          live: true,
        },
      ],
    });
    const diff = diffEventSettings(current, next);

    expect(diff.realtime).toBeNull();
    expect(Object.keys(diff.rules!.after.events as object)).toEqual(['payroll.finalized']);
    expect(diff.rules!.before.events).toEqual({
      'payroll.finalized': { enabled: true, channels: { inApp: true, email: true, push: true } },
    });
  });

  it('reports no changes when the update matches the current state', () => {
    const current = defaults();
    const same = applyEventUpdates(current, {
      realtimeEnabled: true,
      events: toEventSettings(current).map(({ eventType, enabled, channels, live }) => ({
        eventType,
        enabled,
        channels,
        live,
      })),
    });
    expect(diffEventSettings(current, same)).toEqual({ rules: null, realtime: null });
  });
});
