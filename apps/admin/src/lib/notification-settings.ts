import type {
  NotificationEventChannelState,
  NotificationEventSetting,
  NotificationEventSettingsView,
  NotificationEventType,
  UpdateNotificationEventSettingsInput,
} from '@hrm/shared-types';
import { notificationSettingsCopy as copy, type NotificationEventGroup } from './notification-settings-copy';

export type EventChannel = 'inApp' | 'live' | 'push' | 'email';

export interface EventsDraft {
  realtimeEnabled: boolean;
  events: Record<string, NotificationEventChannelState>;
}

const cloneState = (state: NotificationEventChannelState): NotificationEventChannelState => ({
  enabled: state.enabled,
  channels: { ...state.channels },
  live: state.live,
});

export function toEventsDraft(view: NotificationEventSettingsView): EventsDraft {
  return {
    realtimeEnabled: view.realtimeEnabled,
    events: Object.fromEntries(view.events.map((event) => [event.eventType, cloneState(event)])),
  };
}

export function defaultsDraft(view: NotificationEventSettingsView): EventsDraft {
  return {
    realtimeEnabled: true,
    events: Object.fromEntries(view.events.map((event) => [event.eventType, cloneState(event.defaults)])),
  };
}

export const channelOn = (state: NotificationEventChannelState, channel: EventChannel) =>
  channel === 'live' ? state.live : state.channels[channel];

/** Live toasts ride on the in-app record, so turning In-app off also turns Live off. */
export function setEventChannel(
  state: NotificationEventChannelState,
  channel: EventChannel,
  on: boolean,
): NotificationEventChannelState {
  if (channel === 'live') return { ...state, live: on && state.channels.inApp };
  const channels = { ...state.channels, [channel]: on };
  return { ...state, channels, live: channel === 'inApp' && !on ? false : state.live };
}

export const sameState = (a: NotificationEventChannelState, b: NotificationEventChannelState) =>
  a.enabled === b.enabled &&
  a.live === b.live &&
  a.channels.inApp === b.channels.inApp &&
  a.channels.email === b.channels.email &&
  a.channels.push === b.channels.push;

export function countChanges(draft: EventsDraft, view: NotificationEventSettingsView): number {
  const changedEvents = view.events.filter((event) => !sameState(draft.events[event.eventType], event)).length;
  return changedEvents + (draft.realtimeEnabled !== view.realtimeEnabled ? 1 : 0);
}

export function toUpdateInput(draft: EventsDraft, view: NotificationEventSettingsView): UpdateNotificationEventSettingsInput {
  return {
    realtimeEnabled: draft.realtimeEnabled,
    events: view.events
      .filter((event) => !sameState(draft.events[event.eventType], event))
      .map((event) => ({ eventType: event.eventType, ...cloneState(draft.events[event.eventType]) })),
  };
}

export const hasAnyChannel = (state: NotificationEventChannelState) =>
  state.channels.inApp || state.channels.email || state.channels.push;

export interface EventGroup {
  key: NotificationEventGroup;
  label: string;
  events: NotificationEventSetting[];
}

const GROUP_ORDER = Object.keys(copy.groups) as NotificationEventGroup[];

export function groupEvents(events: NotificationEventSetting[]): EventGroup[] {
  return GROUP_ORDER.map((key) => ({
    key,
    label: copy.groups[key],
    events: events.filter((event) => eventMeta(event.eventType).group === key),
  })).filter((group) => group.events.length > 0);
}

export function eventMeta(eventType: NotificationEventType) {
  return copy.eventMeta[eventType] ?? { group: 'people' as const, label: eventType, description: '' };
}

export function recipientsLabel(event: NotificationEventSetting): string {
  if (event.directRecipients) return copy.directRecipients;
  return event.recipients.map((role) => copy.recipients[role] ?? role).join(', ');
}
