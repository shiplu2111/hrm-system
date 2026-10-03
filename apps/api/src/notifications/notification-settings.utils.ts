import type {
  NotificationEventChannelState,
  NotificationEventSetting,
  NotificationEventType,
  NotificationRulesMap,
  RealtimeBroadcastMap,
  UpdateNotificationEventSettingsInput,
} from '@hrm/shared-types';
import { DEFAULT_REALTIME_BROADCAST } from '../realtime/realtime.constants';
import { DEFAULT_NOTIFICATION_RULES } from './notification.constants';

export const NOTIFICATION_EVENT_TYPES = Object.keys(
  DEFAULT_NOTIFICATION_RULES,
) as NotificationEventType[];

/** Events whose recipients are passed in by the emitter (e.g. the current approver), not resolved from the rule. */
export const DIRECT_RECIPIENT_EVENTS: ReadonlySet<NotificationEventType> = new Set([
  'approval.pending',
]);

export interface EventSettingsState {
  rules: NotificationRulesMap;
  realtimeEnabled: boolean;
  liveBroadcast: RealtimeBroadcastMap;
}

function channelState(
  rules: NotificationRulesMap,
  live: RealtimeBroadcastMap,
  eventType: NotificationEventType,
): NotificationEventChannelState {
  const rule = rules[eventType];
  return {
    enabled: rule.enabled,
    channels: { ...rule.channels },
    live: live[eventType] ?? false,
  };
}

export function toEventSettings(state: EventSettingsState): NotificationEventSetting[] {
  return NOTIFICATION_EVENT_TYPES.map((eventType) => ({
    eventType,
    ...channelState(state.rules, state.liveBroadcast, eventType),
    recipients: [...state.rules[eventType].recipients],
    directRecipients: DIRECT_RECIPIENT_EVENTS.has(eventType),
    defaults: channelState(DEFAULT_NOTIFICATION_RULES, DEFAULT_REALTIME_BROADCAST, eventType),
  }));
}

/** Applies an update on top of the current state; events not listed keep their current settings. */
export function applyEventUpdates(
  current: EventSettingsState,
  input: UpdateNotificationEventSettingsInput,
): EventSettingsState {
  const rules = { ...current.rules };
  const liveBroadcast = { ...current.liveBroadcast };
  for (const update of input.events) {
    rules[update.eventType] = {
      ...current.rules[update.eventType],
      enabled: update.enabled,
      channels: {
        inApp: update.channels.inApp,
        email: update.channels.email,
        push: update.channels.push,
      },
    };
    liveBroadcast[update.eventType] = update.live;
  }
  return { rules, realtimeEnabled: input.realtimeEnabled, liveBroadcast };
}

const sameChannels = (a: NotificationEventChannelState, b: NotificationEventChannelState) =>
  a.enabled === b.enabled &&
  a.channels.inApp === b.channels.inApp &&
  a.channels.email === b.channels.email &&
  a.channels.push === b.channels.push;

export interface EventSettingsDiff {
  rules: { before: Record<string, unknown>; after: Record<string, unknown> } | null;
  realtime: { before: Record<string, unknown>; after: Record<string, unknown> } | null;
}

/** Audit payloads limited to what actually changed. */
export function diffEventSettings(
  before: EventSettingsState,
  after: EventSettingsState,
): EventSettingsDiff {
  const rulesBefore: Record<string, unknown> = {};
  const rulesAfter: Record<string, unknown> = {};
  const liveBefore: Record<string, boolean> = {};
  const liveAfter: Record<string, boolean> = {};

  for (const eventType of NOTIFICATION_EVENT_TYPES) {
    const prev = channelState(before.rules, before.liveBroadcast, eventType);
    const next = channelState(after.rules, after.liveBroadcast, eventType);
    if (!sameChannels(prev, next)) {
      rulesBefore[eventType] = { enabled: prev.enabled, channels: prev.channels };
      rulesAfter[eventType] = { enabled: next.enabled, channels: next.channels };
    }
    if (prev.live !== next.live) {
      liveBefore[eventType] = prev.live;
      liveAfter[eventType] = next.live;
    }
  }

  const rulesChanged = Object.keys(rulesAfter).length > 0;
  const realtimeChanged =
    before.realtimeEnabled !== after.realtimeEnabled || Object.keys(liveAfter).length > 0;

  return {
    rules: rulesChanged
      ? {
          before: { entity: 'notification_rules', events: rulesBefore },
          after: { entity: 'notification_rules', events: rulesAfter },
        }
      : null,
    realtime: realtimeChanged
      ? {
          before: {
            entity: 'realtime_notifications',
            enabled: before.realtimeEnabled,
            liveBroadcast: liveBefore,
          },
          after: {
            entity: 'realtime_notifications',
            enabled: after.realtimeEnabled,
            liveBroadcast: liveAfter,
          },
        }
      : null,
  };
}
