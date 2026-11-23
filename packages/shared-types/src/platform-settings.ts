/**
 * Platform Settings & Operational Secrets Management
 * SYSTEM_SETTINGS.md §2, §2a, ENV_SETUP.md §0, SECURITY.md §1, §11, DATABASE_SCHEMA.md §11
 */

// ============================================================================
// 1. Email (SMTP / Provider)
// ============================================================================

export type PlatformEmailProviderKind = 'smtp' | 'sendgrid' | 'postmark' | 'ses';

export interface PlatformEmailSettings {
  configured: boolean;
  provider: PlatformEmailProviderKind;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  passwordMasked: string | null;
  passwordConfigured: boolean;
  fromAddress: string;
  fromName: string;
  updatedAt: string | null;
}

export interface UpdatePlatformEmailSettingsInput {
  provider: PlatformEmailProviderKind;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string; // Optional: provide only to replace stored secret
  fromAddress: string;
  fromName: string;
}

export interface SendTestEmailInput {
  to: string;
  subject?: string;
  testBody?: string;
}

export interface TestEmailResult {
  success: boolean;
  message: string;
  messageId: string;
  recipient: string;
  timestamp: string;
}

// ============================================================================
// 2. SMS Provider
// ============================================================================

export type PlatformSmsProviderKind = 'twilio' | 'messagebird' | 'sns' | 'custom';

export interface PlatformSmsSettings {
  configured: boolean;
  provider: PlatformSmsProviderKind;
  accountSid: string;
  authTokenMasked: string | null;
  authTokenConfigured: boolean;
  fromNumber: string;
  updatedAt: string | null;
}

export interface UpdatePlatformSmsSettingsInput {
  provider: PlatformSmsProviderKind;
  accountSid: string;
  authToken?: string; // Optional: provide only to replace stored secret
  fromNumber: string;
}

export interface SendTestSmsInput {
  to: string;
  message?: string;
}

export interface TestSmsResult {
  success: boolean;
  message: string;
  sid: string;
  recipient: string;
  timestamp: string;
}

// ============================================================================
// 3. Push Notifications (Firebase)
// ============================================================================

export interface PlatformPushSettings {
  configured: boolean;
  provider: 'firebase';
  projectId: string;
  clientEmail: string;
  privateKeyMasked: string | null;
  privateKeyConfigured: boolean;
  appId?: string | null;
  updatedAt: string | null;
}

export interface UpdatePlatformPushSettingsInput {
  provider?: 'firebase';
  projectId: string;
  clientEmail: string;
  privateKey?: string; // Optional: provide only to replace stored secret
  appId?: string;
}

export interface TestPushResult {
  success: boolean;
  message: string;
  projectId: string;
  timestamp: string;
}

// ============================================================================
// 4. File Storage (S3 / Local)
// ============================================================================

export type PlatformStorageDriverKind = 'local' | 's3';

export interface PlatformStorageSettings {
  configured: boolean;
  storageDriver: PlatformStorageDriverKind;
  localPath: string;
  s3Bucket: string | null;
  s3Region: string | null;
  s3Endpoint: string | null;
  s3ForcePathStyle: boolean;
  s3AccessKeyId: string | null;
  s3SecretKeyMasked: string | null;
  s3SecretKeyConfigured: boolean;
  updatedAt: string | null;
}

export interface UpdatePlatformStorageSettingsInput {
  storageDriver: PlatformStorageDriverKind;
  localPath?: string;
  s3Bucket?: string;
  s3Region?: string;
  s3Endpoint?: string;
  s3ForcePathStyle?: boolean;
  s3AccessKeyId?: string;
  s3SecretKey?: string; // Optional: provide only to replace stored secret
}

export interface TestStorageResult {
  success: boolean;
  driver: PlatformStorageDriverKind;
  latencyMs: number;
  message: string;
  timestamp: string;
}

// ============================================================================
// 5. Billing Provider (Stripe)
// ============================================================================

export interface PlatformBillingSettings {
  configured: boolean;
  provider: 'stripe';
  publishableKey: string;
  secretKeyMasked: string | null;
  secretKeyConfigured: boolean;
  webhookSecretMasked: string | null;
  webhookSecretConfigured: boolean;
  currency: string;
  updatedAt: string | null;
}

export interface UpdatePlatformBillingSettingsInput {
  provider?: 'stripe';
  publishableKey: string;
  secretKey?: string; // Optional: provide only to replace stored secret
  webhookSecret?: string; // Optional: provide only to replace stored secret
  currency: string;
}

export interface TestBillingResult {
  success: boolean;
  provider: 'stripe';
  mode: 'test' | 'live';
  currency: string;
  message: string;
  timestamp: string;
}

// ============================================================================
// Aggregate Settings View
// ============================================================================

export interface PlatformAllSettingsView {
  email: PlatformEmailSettings;
  sms: PlatformSmsSettings;
  push: PlatformPushSettings;
  storage: PlatformStorageSettings;
  billing: PlatformBillingSettings;
}
