import type {
  NotificationEventType,
  NotificationRuleConfig,
  NotificationRulesMap,
} from '@hrm/shared-types';

export const NOTIFICATION_RULES_SETTING_PREFIX = 'company:';
export const NOTIFICATION_RULES_SETTING_SUFFIX = ':notification_rules';

export function notificationRulesKeyForCompany(companyId: string): string {
  return `${NOTIFICATION_RULES_SETTING_PREFIX}${companyId}${NOTIFICATION_RULES_SETTING_SUFFIX}`;
}

export const DEFAULT_NOTIFICATION_RULES: NotificationRulesMap = {
  'leave.approved': {
    enabled: true,
    channels: { inApp: true, email: true, push: true },
    recipients: ['subject_employee'],
  },
  'leave.rejected': {
    enabled: true,
    channels: { inApp: true, email: true, push: true },
    recipients: ['subject_employee'],
  },
  'payroll.finalized': {
    enabled: true,
    channels: { inApp: true, email: true, push: true },
    recipients: ['subject_employee'],
  },
  'attendance.late': {
    enabled: true,
    channels: { inApp: true, email: true, push: true },
    recipients: ['subject_employee', 'manager'],
  },
};

export interface NotificationTemplateSet {
  title: string;
  body: string;
  emailSubject: string;
}

export const DEFAULT_NOTIFICATION_TEMPLATES: Record<
  NotificationEventType,
  NotificationTemplateSet
> = {
  'leave.approved': {
    title: 'Leave approved',
    body: 'Your {leave_type} request for {start_date} to {end_date} has been approved.',
    emailSubject: 'Leave request approved — {leave_type}',
  },
  'leave.rejected': {
    title: 'Leave rejected',
    body: 'Your {leave_type} request for {start_date} to {end_date} has been rejected.',
    emailSubject: 'Leave request rejected — {leave_type}',
  },
  'payroll.finalized': {
    title: 'Payslip ready',
    body: 'Your payslip for {period_name} is ready. Net pay: {net_pay}.',
    emailSubject: 'Payslip available — {period_name}',
  },
  'attendance.late': {
    title: 'Late arrival recorded',
    body: '{employee_name} clocked in late on {work_date} at {clock_in_time}.',
    emailSubject: 'Late attendance — {work_date}',
  },
};

export const EMAIL_RETRY_DELAYS_MS = [0, 1_000, 3_000] as const;
export const EMAIL_MAX_ATTEMPTS = EMAIL_RETRY_DELAYS_MS.length;

export const PUSH_RETRY_DELAYS_MS = [0, 1_000, 3_000] as const;
export const PUSH_MAX_ATTEMPTS = PUSH_RETRY_DELAYS_MS.length;

export function mergeNotificationRules(
  overrides: Partial<NotificationRulesMap> | null | undefined,
): NotificationRulesMap {
  const merged = { ...DEFAULT_NOTIFICATION_RULES };
  if (!overrides) return merged;

  for (const eventType of Object.keys(DEFAULT_NOTIFICATION_RULES) as NotificationEventType[]) {
    const override = overrides[eventType];
    if (!override) continue;
    merged[eventType] = {
      ...merged[eventType],
      ...override,
      channels: {
        ...merged[eventType].channels,
        ...override.channels,
      },
      recipients: override.recipients ?? merged[eventType].recipients,
    };
  }

  return merged;
}

export function renderNotificationTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{([a-z0-9_]+)\}/gi, (match, key: string) => {
    return variables[key] ?? match;
  });
}

export function parseStoredNotificationRules(
  value: unknown,
): Partial<NotificationRulesMap> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Partial<NotificationRulesMap>;
}

export function isSupportedNotificationEvent(
  eventType: string,
): eventType is NotificationEventType {
  return eventType in DEFAULT_NOTIFICATION_RULES;
}

export function normalizeRuleConfig(
  rule: NotificationRuleConfig | undefined,
  fallback: NotificationRuleConfig,
): NotificationRuleConfig {
  if (!rule) return fallback;
  return {
    enabled: rule.enabled ?? fallback.enabled,
    channels: {
      inApp: rule.channels?.inApp ?? fallback.channels.inApp,
      email: rule.channels?.email ?? fallback.channels.email,
      push: rule.channels?.push ?? fallback.channels.push,
    },
    recipients: rule.recipients?.length ? rule.recipients : fallback.recipients,
  };
}
