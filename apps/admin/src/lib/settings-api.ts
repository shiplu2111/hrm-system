import type {
  NotificationEventSettingsView,
  SendSmtpTestEmailInput,
  SendSmtpTestEmailResult,
  SmtpSettingsView,
  UpdateNotificationEventSettingsInput,
  UpdateSmtpSettingsInput,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

function companySettingsPath(companyId: string, resource: string): string {
  return `/organization/companies/${companyId}/settings/${resource}`;
}

export function getNotificationEventSettings(companyId: string): Promise<NotificationEventSettingsView> {
  return tenantApiRequest<NotificationEventSettingsView>(companySettingsPath(companyId, 'notifications/events'));
}

export function updateNotificationEventSettings(
  companyId: string,
  input: UpdateNotificationEventSettingsInput,
): Promise<NotificationEventSettingsView> {
  return tenantApiRequest<NotificationEventSettingsView>(companySettingsPath(companyId, 'notifications/events'), {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function getSmtpSettings(companyId: string): Promise<SmtpSettingsView> {
  return tenantApiRequest<SmtpSettingsView>(
    companySettingsPath(companyId, 'smtp'),
  );
}

export function updateSmtpSettings(
  companyId: string,
  input: UpdateSmtpSettingsInput,
): Promise<SmtpSettingsView> {
  return tenantApiRequest<SmtpSettingsView>(
    companySettingsPath(companyId, 'smtp'),
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export function sendSmtpTestEmail(
  companyId: string,
  input: SendSmtpTestEmailInput,
): Promise<SendSmtpTestEmailResult> {
  return tenantApiRequest<SendSmtpTestEmailResult>(
    companySettingsPath(companyId, 'smtp/test'),
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}
