/** Standard notification event types (NOTIFICATION_LOGIC.md §3). */
export type NotificationEventType =
  | 'leave.approved'
  | 'leave.rejected'
  | 'payroll.finalized'
  | 'attendance.late'
  | 'contract.expiring'
  | 'approval.pending'
  | 'contract.renewal.approved'
  | 'contract.renewal.rejected';

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
