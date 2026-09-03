import type {
  NotificationEventType,
  RealtimeNotificationSettingsView,
  UpdateRealtimeNotificationSettingsInput,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

function companySettingsPath(companyId: string, resource: string): string {
  return `/organization/companies/${companyId}/settings/${resource}`;
}

export function getRealtimeNotificationSettings(
  companyId: string,
): Promise<RealtimeNotificationSettingsView> {
  return tenantApiRequest<RealtimeNotificationSettingsView>(
    companySettingsPath(companyId, 'notifications/realtime'),
  );
}

export function updateRealtimeNotificationSettings(
  companyId: string,
  input: UpdateRealtimeNotificationSettingsInput,
): Promise<RealtimeNotificationSettingsView> {
  return tenantApiRequest<RealtimeNotificationSettingsView>(
    companySettingsPath(companyId, 'notifications/realtime'),
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export const REALTIME_EVENT_OPTIONS: Array<{
  key: NotificationEventType;
  label: string;
  description: string;
}> = [
  {
    key: 'leave.approved',
    label: 'Leave approved',
    description: 'Notify the employee immediately when leave is fully approved.',
  },
  {
    key: 'leave.rejected',
    label: 'Leave rejected',
    description: 'Live toast when a leave request is rejected.',
  },
  {
    key: 'payroll.finalized',
    label: 'Payroll finalized',
    description: 'Alert employees when their payslip is ready.',
  },
  {
    key: 'attendance.late',
    label: 'Late clock-in',
    description: 'Alert the employee and their manager on late arrival.',
  },
];
