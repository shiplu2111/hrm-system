/** Standard notification event types (NOTIFICATION_LOGIC.md §3). */
export type NotificationEventType =
  | 'leave.approved'
  | 'leave.rejected'
  | 'payroll.finalized'
  | 'attendance.late'
  | 'contract.expiring'
  | 'approval.pending'
  | 'contract.renewal.approved'
  | 'contract.renewal.rejected'
  | 'expense.approved'
  | 'expense.rejected'
  | 'onboarding.welcome'
  | 'certification.expiring'
  | 'kudos.received'
  | 'safety.incident.reported'
  | 'interview.scheduled';

export type NotificationRecipientRole =
  | 'subject_employee'
  | 'manager'
  | 'hr_admin';

export type PushPlatform = 'ios' | 'android';

export interface NotificationRuleConfig {
  enabled: boolean;
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  recipients: NotificationRecipientRole[];
}

export interface RegisterPushTokenInput {
  token: string;
  deviceId: string;
  platform: PushPlatform;
}

export type NotificationRulesMap = Record<
  NotificationEventType,
  NotificationRuleConfig
>;

export interface InAppNotificationRecord {
  id: string;
  eventType: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationEmitInput {
  tenantId: string;
  companyId: string;
  eventType: NotificationEventType;
  /** Primary employee the event is about (leave requester, late employee, etc.). */
  subjectEmployeeId: string;
  variables: Record<string, string>;
  payload?: Record<string, unknown>;
  /** When set, delivers only to these users (e.g. workflow approvers). */
  directUserIds?: string[];
}

/** Per-event live WebSocket broadcast toggles (NOTIFICATION_LOGIC.md §10). */
export type RealtimeBroadcastMap = Record<NotificationEventType, boolean>;

export interface RealtimeNotificationSettingsView {
  enabled: boolean;
  liveBroadcast: RealtimeBroadcastMap;
  updatedAt: string | null;
}

export interface UpdateRealtimeNotificationSettingsInput {
  enabled: boolean;
  liveBroadcast: Partial<RealtimeBroadcastMap>;
}

export type NotificationChannelKey = keyof NotificationRuleConfig['channels'];

/** Editable delivery state of one event: rule on/off, channels, and live WebSocket toast. */
export interface NotificationEventChannelState {
  enabled: boolean;
  channels: NotificationRuleConfig['channels'];
  /** Live toast over WebSocket; only applies when the in-app channel is on. */
  live: boolean;
}

export interface NotificationEventSetting extends NotificationEventChannelState {
  eventType: NotificationEventType;
  recipients: NotificationRecipientRole[];
  /** Recipients come from the event itself (e.g. the current approver), not the rule. */
  directRecipients: boolean;
  defaults: NotificationEventChannelState;
}

export interface NotificationChannelStatus {
  /** Company SMTP saved with a password — email can't be delivered otherwise. */
  email: { configured: boolean };
  /** Platform push provider (Firebase) configured. */
  push: { configured: boolean };
}

/** Per-company notification events & channels (NOTIFICATION_LOGIC.md §4, §10; SYSTEM_SETTINGS.md §2a). */
export interface NotificationEventSettingsView {
  realtimeEnabled: boolean;
  events: NotificationEventSetting[];
  channelStatus: NotificationChannelStatus;
  updatedAt: string | null;
}

export interface UpdateNotificationEventSettingsInput {
  realtimeEnabled: boolean;
  events: Array<NotificationEventChannelState & { eventType: NotificationEventType }>;
}
