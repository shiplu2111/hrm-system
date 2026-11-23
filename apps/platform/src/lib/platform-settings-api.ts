import { apiRequest } from './api-client';
import type {
  PlatformAllSettingsView,
  PlatformBillingSettings,
  PlatformEmailSettings,
  PlatformPushSettings,
  PlatformSmsSettings,
  PlatformStorageSettings,
  SendTestEmailInput,
  SendTestSmsInput,
  TestBillingResult,
  TestEmailResult,
  TestPushResult,
  TestSmsResult,
  TestStorageResult,
  UpdatePlatformBillingSettingsInput,
  UpdatePlatformEmailSettingsInput,
  UpdatePlatformPushSettingsInput,
  UpdatePlatformSmsSettingsInput,
  UpdatePlatformStorageSettingsInput,
} from '@hrm/shared-types';

/**
 * Fetch all platform runtime settings (passwords/secrets masked)
 */
export function getPlatformAllSettings(): Promise<PlatformAllSettingsView> {
  return apiRequest<PlatformAllSettingsView>('/platform/settings');
}

/**
 * 1. Email (SMTP / Provider)
 */
export function getPlatformEmailSettings(): Promise<PlatformEmailSettings> {
  return apiRequest<PlatformEmailSettings>('/platform/settings/email');
}

export function updatePlatformEmailSettings(
  input: UpdatePlatformEmailSettingsInput,
): Promise<PlatformEmailSettings> {
  return apiRequest<PlatformEmailSettings>('/platform/settings/email', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function sendPlatformTestEmail(input: SendTestEmailInput): Promise<TestEmailResult> {
  return apiRequest<TestEmailResult>('/platform/settings/email/test', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * 2. SMS Provider
 */
export function getPlatformSmsSettings(): Promise<PlatformSmsSettings> {
  return apiRequest<PlatformSmsSettings>('/platform/settings/sms');
}

export function updatePlatformSmsSettings(
  input: UpdatePlatformSmsSettingsInput,
): Promise<PlatformSmsSettings> {
  return apiRequest<PlatformSmsSettings>('/platform/settings/sms', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function sendPlatformTestSms(input: SendTestSmsInput): Promise<TestSmsResult> {
  return apiRequest<TestSmsResult>('/platform/settings/sms/test', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * 3. Push Notifications (Firebase)
 */
export function getPlatformPushSettings(): Promise<PlatformPushSettings> {
  return apiRequest<PlatformPushSettings>('/platform/settings/push');
}

export function updatePlatformPushSettings(
  input: UpdatePlatformPushSettingsInput,
): Promise<PlatformPushSettings> {
  return apiRequest<PlatformPushSettings>('/platform/settings/push', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function testPlatformPushConnection(): Promise<TestPushResult> {
  return apiRequest<TestPushResult>('/platform/settings/push/test', {
    method: 'POST',
  });
}

/**
 * 4. File Storage (S3 / Local)
 */
export function getPlatformStorageSettings(): Promise<PlatformStorageSettings> {
  return apiRequest<PlatformStorageSettings>('/platform/settings/storage');
}

export function updatePlatformStorageSettings(
  input: UpdatePlatformStorageSettingsInput,
): Promise<PlatformStorageSettings> {
  return apiRequest<PlatformStorageSettings>('/platform/settings/storage', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function testPlatformStorageConnection(): Promise<TestStorageResult> {
  return apiRequest<TestStorageResult>('/platform/settings/storage/test', {
    method: 'POST',
  });
}

/**
 * 5. Billing Provider (Stripe)
 */
export function getPlatformBillingSettings(): Promise<PlatformBillingSettings> {
  return apiRequest<PlatformBillingSettings>('/platform/settings/billing');
}

export function updatePlatformBillingSettings(
  input: UpdatePlatformBillingSettingsInput,
): Promise<PlatformBillingSettings> {
  return apiRequest<PlatformBillingSettings>('/platform/settings/billing', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function testPlatformBillingConnection(): Promise<TestBillingResult> {
  return apiRequest<TestBillingResult>('/platform/settings/billing/test', {
    method: 'POST',
  });
}
