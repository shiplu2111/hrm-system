import type {
  NotificationEventType,
  RealtimeBroadcastMap,
  RealtimeNotificationSettingsView,
} from '@hrm/shared-types';

/** Stored in tenant_settings (category=notification) for per-company live broadcast config. */
export interface StoredRealtimeNotificationSettings {
  enabled: boolean;
  liveBroadcast: Partial<RealtimeBroadcastMap>;
}

export const REALTIME_SETTINGS_KEY_SUFFIX = ':realtime_notifications';

export function realtimeSettingsKeyForCompany(companyId: string): string {
  return `company:${companyId}${REALTIME_SETTINGS_KEY_SUFFIX}`;
}

export const DEFAULT_REALTIME_BROADCAST: RealtimeBroadcastMap = {
  'leave.approved': true,
  'leave.rejected': false,
  'payroll.finalized': true,
  'attendance.late': true,
};

export const DEFAULT_REALTIME_NOTIFICATION_SETTINGS: StoredRealtimeNotificationSettings =
  {
    enabled: true,
    liveBroadcast: { ...DEFAULT_REALTIME_BROADCAST },
  };

export function mergeRealtimeSettings(
  stored: StoredRealtimeNotificationSettings | null,
  updatedAt: string | null,
): RealtimeNotificationSettingsView {
  const enabled = stored?.enabled ?? DEFAULT_REALTIME_NOTIFICATION_SETTINGS.enabled;
  const liveBroadcast = {
    ...DEFAULT_REALTIME_BROADCAST,
    ...(stored?.liveBroadcast ?? {}),
  };

  return {
    enabled,
    liveBroadcast,
    updatedAt,
  };
}

export function shouldLiveBroadcast(
  settings: RealtimeNotificationSettingsView,
  eventType: NotificationEventType,
): boolean {
  if (!settings.enabled) return false;
  return settings.liveBroadcast[eventType] ?? false;
}

export function parseStoredRealtimeSettings(
  value: unknown,
): StoredRealtimeNotificationSettings | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const liveBroadcast =
    raw.liveBroadcast && typeof raw.liveBroadcast === 'object'
      ? (raw.liveBroadcast as Partial<RealtimeBroadcastMap>)
      : {};
  return {
    enabled: Boolean(raw.enabled ?? true),
    liveBroadcast,
  };
}

export function sanitizeRealtimeSettingsForAudit(
  stored: StoredRealtimeNotificationSettings | null,
): Record<string, unknown> | null {
  if (!stored) return null;
  return {
    enabled: stored.enabled,
    liveBroadcast: stored.liveBroadcast,
  };
}

export const REALTIME_NOTIFICATION_EVENT_LABELS: Record<
  NotificationEventType,
  string
> = {
  'leave.approved': 'Leave approved',
  'leave.rejected': 'Leave rejected',
  'payroll.finalized': 'Payroll finalized / payslip ready',
  'attendance.late': 'Late clock-in',
};

export const REALTIME_USER_ROOM_PREFIX = 'user:';

export function userRoom(userId: string): string {
  return `${REALTIME_USER_ROOM_PREFIX}${userId}`;
}

export const REALTIME_SOCKET_EVENT = {
  notification: 'notification',
  connected: 'connected',
} as const;
