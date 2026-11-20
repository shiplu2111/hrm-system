import type {
  NotificationEventSettingsView,
  SendSmtpTestEmailInput,
  SendSmtpTestEmailResult,
  SmtpSettingsView,
  UpdateNotificationEventSettingsInput,
  UpdateSmtpSettingsInput,
  SupportAccessRequestRecord,
  TenantSecuritySettings,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

function companySettingsPath(companyId: string, resource: string): string {
  return `/organization/companies/${companyId}/settings/${resource}`;
}

// ---------------------------------------------------------------------------
// Support Access Settings (SECURITY.md, AUDIT_LOG.md)
// ---------------------------------------------------------------------------

export interface TenantSupportAccessData {
  settings: TenantSecuritySettings;
  requests: SupportAccessRequestRecord[];
}

export function getTenantSupportAccessSettings(): Promise<TenantSupportAccessData> {
  return tenantApiRequest<TenantSupportAccessData>('/tenant/security/support-access');
}

export function updateSupportAccessPreauthorization(
  preauthorized: boolean,
): Promise<TenantSecuritySettings> {
  return tenantApiRequest<TenantSecuritySettings>('/tenant/security/support-access/preauthorize', {
    method: 'PUT',
    body: JSON.stringify({ preauthorized }),
  });
}

export function approveSupportAccessRequest(
  requestId: string,
  accessMode?: 'read_only' | 'read_write',
): Promise<SupportAccessRequestRecord> {
  return tenantApiRequest<SupportAccessRequestRecord>(
    `/tenant/security/support-access/requests/${requestId}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ accessMode }),
    },
  );
}

export function rejectSupportAccessRequest(
  requestId: string,
  reason?: string,
): Promise<SupportAccessRequestRecord> {
  return tenantApiRequest<SupportAccessRequestRecord>(
    `/tenant/security/support-access/requests/${requestId}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  );
}

export function revokeSupportAccessSession(
  requestId: string,
  reason: string,
): Promise<SupportAccessRequestRecord> {
  return tenantApiRequest<SupportAccessRequestRecord>(
    `/tenant/security/support-access/requests/${requestId}/revoke`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  );
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
