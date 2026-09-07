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
  'contract.expiring': {
    enabled: true,
    channels: { inApp: true, email: true, push: true },
    recipients: ['subject_employee', 'manager', 'hr_admin'],
  },
  'approval.pending': {
    enabled: true,
    channels: { inApp: true, email: true, push: true },
    recipients: ['subject_employee'],
  },
  'contract.renewal.approved': {
    enabled: true,
    channels: { inApp: true, email: true, push: true },
    recipients: ['subject_employee', 'manager'],
  },
  'contract.renewal.rejected': {
    enabled: true,
    channels: { inApp: true, email: true, push: true },
    recipients: ['subject_employee', 'manager'],
  },
  'expense.approved': {
    enabled: true,
    channels: { inApp: true, email: true, push: true },
    recipients: ['subject_employee'],
  },
  'expense.rejected': {
    enabled: true,
    channels: { inApp: true, email: true, push: true },
    recipients: ['subject_employee'],
  },
  'onboarding.welcome': {
    enabled: true,
    channels: { inApp: true, email: true, push: false },
    recipients: ['subject_employee'],
  },
  'certification.expiring': {
    enabled: true,
    channels: { inApp: true, email: true, push: true },
    recipients: ['subject_employee', 'manager', 'hr_admin'],
  },
  'kudos.received': {
    enabled: true,
    channels: { inApp: true, email: true, push: true },
    recipients: ['subject_employee'],
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
  'contract.expiring': {
    title: 'Contract expiring soon',
    body: 'The employment contract for {employee_name} expires on {expiry_date} ({days_until} days remaining).',
    emailSubject: 'Contract expiring — {employee_name}',
  },
  'approval.pending': {
    title: 'Approval required',
    body: 'A {entity_label} for {employee_name} is awaiting your approval ({step_name}).',
    emailSubject: 'Approval pending — {entity_label}',
  },
  'contract.renewal.approved': {
    title: 'Contract renewal approved',
    body: 'The contract renewal for {employee_name} ({start_date} to {end_date}) has been approved.',
    emailSubject: 'Contract renewal approved — {employee_name}',
  },
  'contract.renewal.rejected': {
    title: 'Contract renewal rejected',
    body: 'The contract renewal for {employee_name} was rejected.',
    emailSubject: 'Contract renewal rejected — {employee_name}',
  },
  'expense.approved': {
    title: 'Expense claim approved',
    body: 'Your expense claim {claim_id} for {amount} ({category_name}) has been approved and queued for reimbursement.',
    emailSubject: 'Expense claim approved — {claim_id}',
  },
  'expense.rejected': {
    title: 'Expense claim rejected',
    body: 'Your expense claim {claim_id} for {amount} ({category_name}) has been rejected.',
    emailSubject: 'Expense claim rejected — {claim_id}',
  },
  'onboarding.welcome': {
    title: 'Welcome to {company_name}',
    body: 'Hi {employee_name}, welcome aboard! Your onboarding checklist is ready — {pending_task_count} tasks to complete before {start_date}.',
    emailSubject: 'Welcome to {company_name}',
  },
  'certification.expiring': {
    title: 'Certification expiring soon',
    body: 'The certification "{certification_name}" for {employee_name} expires on {expiry_date} ({days_until} days remaining).',
    emailSubject: 'Certification expiring — {certification_name}',
  },
  'kudos.received': {
    title: 'You received kudos!',
    body: '{from_employee_name} recognized you: "{kudos_message}"',
    emailSubject: 'Kudos from {from_employee_name}',
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
