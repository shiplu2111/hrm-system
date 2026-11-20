import type { PageKey } from '@/context/NavContext';

export type NotificationTone = 'accent' | 'success' | 'warning' | 'error' | 'neutral';

export function notificationToneForEvent(eventType: string): NotificationTone {
  if (
    eventType.includes('approved') ||
    eventType.includes('finalized') ||
    eventType === 'onboarding.welcome'
  ) {
    return 'success';
  }
  if (eventType.includes('rejected') || eventType.includes('incident')) {
    return 'error';
  }
  if (
    eventType.includes('pending') ||
    eventType.includes('expiring') ||
    eventType.includes('late')
  ) {
    return 'warning';
  }
  return 'accent';
}

export const NOTIFICATION_TONE_DOT: Record<NotificationTone, string> = {
  accent: 'bg-accent-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
  neutral: 'bg-secondary-400',
};

/** Maps notification events to deep-linked destinations (NAVIGATION.md §5). */
export function resolveNotificationTargetPage(
  eventType: string,
  options?: { selfServiceOnly?: boolean },
): PageKey | null {
  const selfService = options?.selfServiceOnly ?? true;

  if (eventType.startsWith('leave.')) {
    return selfService ? 'my-leave' : 'leave-requests';
  }
  if (eventType.startsWith('payroll.')) {
    return selfService ? 'my-payslips' : 'payslips';
  }
  if (eventType.startsWith('attendance.')) {
    return selfService ? 'my-attendance' : 'attendance';
  }
  if (eventType.startsWith('timesheet.')) {
    return selfService ? 'my-timesheets' : 'timesheet';
  }
  if (
    eventType.startsWith('profile.') ||
    eventType.startsWith('contract.') ||
    eventType.startsWith('onboarding.') ||
    eventType.startsWith('certification.')
  ) {
    return selfService ? 'my-profile' : 'emp-directory';
  }
  if (eventType.startsWith('kudos.')) {
    return selfService ? 'my-dashboard' : 'engagement-kudos';
  }
  if (eventType.startsWith('safety.')) {
    return selfService ? 'my-notifications' : 'health-safety';
  }
  if (eventType.startsWith('support.')) {
    return selfService ? 'my-help' : 'support-tickets';
  }
  if (eventType.startsWith('expense.')) {
    return selfService ? 'my-expenses' : 'expenses';
  }
  if (eventType.startsWith('approval.')) {
    return selfService ? 'my-leave' : 'leave-requests';
  }
  return null;
}

export function formatLocalizedRelativeTime(
  iso: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return t('common.justNow');
  if (minutes < 60) return t('common.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('common.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('common.daysAgo', { count: days });
}


