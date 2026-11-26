import { Injectable } from '@nestjs/common';
import type {
  PublicDpaMetadataResponse,
  PublicSubprocessorCategory,
  PublicSubprocessorCategoryNote,
  PublicSubprocessorItem,
  PublicSubprocessorsResponse,
} from '@hrm/shared-types';
import { StorageService } from '../../storage/storage.service';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { renderDpaPdf } from './dpa-pdf.generator';

const DPA_VERSION = '2026-11';
const DPA_EFFECTIVE_DATE = '2026-11-25';
const DPA_STORAGE_KEY = `platform/legal/cmsn-hr-dpa-${DPA_VERSION}.pdf`;
const DPA_FILENAME = `CMSN-HR-DPA-${DPA_VERSION}.pdf`;
const SUBPROCESSORS_BASELINE_DATE = '2026-11-25';

const CATEGORIES_ORDER: PublicSubprocessorCategory[] = [
  'hosting',
  'email',
  'sms',
  'push',
  'payment',
  'error_tracking',
];

const CATEGORY_LABELS: Record<PublicSubprocessorCategory, string> = {
  hosting: 'Hosting & Object Storage',
  email: 'Email Delivery',
  sms: 'SMS Messaging',
  push: 'Mobile Push Notifications',
  payment: 'Payment Processing',
  error_tracking: 'Error Tracking',
};

function resolveEmailProviderName(provider: string, host?: string): string {
  const p = provider.toLowerCase();
  if (p === 'sendgrid') return 'SendGrid (Twilio)';
  if (p === 'postmark') return 'Postmark (ActiveCampaign)';
  if (p === 'ses') return 'Amazon SES';

  const h = (host || '').toLowerCase();
  if (h.includes('sendgrid')) return 'SendGrid (Twilio)';
  if (h.includes('amazonaws.com') || h.includes('ses')) return 'Amazon SES';
  if (h.includes('postmark')) return 'Postmark (ActiveCampaign)';
  if (h.includes('mailgun')) return 'Mailgun';
  if (h.includes('resend')) return 'Resend';
  return 'Configured SMTP Relay';
}

function resolveSmsProviderName(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'twilio':
      return 'Twilio SMS';
    case 'messagebird':
      return 'MessageBird (Bird)';
    case 'sns':
      return 'Amazon SNS';
    default:
      return 'Configured SMS Gateway';
  }
}

@Injectable()
export class PublicComplianceService {
  private lastGeneratedAt = new Date().toISOString();

  constructor(
    private readonly platformSettings: PlatformSettingsService,
    private readonly storageService: StorageService,
  ) {}

  async ensureDpaPdfStored(): Promise<{ buffer: Buffer; key: string }> {
    const exists = await this.storageService.exists(DPA_STORAGE_KEY);
    if (exists) {
      const read = await this.storageService.read(DPA_STORAGE_KEY);
      return { buffer: read.buffer, key: DPA_STORAGE_KEY };
    }

    const buffer = await renderDpaPdf({
      version: DPA_VERSION,
      effectiveDate: DPA_EFFECTIVE_DATE,
      draftNotice: 'DRAFT, pending legal review',
    });

    await this.storageService.uploadPlatformAsset(DPA_STORAGE_KEY, buffer, {
      contentType: 'application/pdf',
      originalName: DPA_FILENAME,
      size: buffer.byteLength,
    });
    this.lastGeneratedAt = new Date().toISOString();

    return { buffer, key: DPA_STORAGE_KEY };
  }

  async getDpaMetadata(): Promise<PublicDpaMetadataResponse> {
    const { buffer } = await this.ensureDpaPdfStored();
    return {
      title: 'Data Processing Agreement (DPA)',
      version: DPA_VERSION,
      effectiveDate: DPA_EFFECTIVE_DATE,
      storageKey: DPA_STORAGE_KEY,
      filename: DPA_FILENAME,
      downloadUrl: '/api/v1/public/legal/dpa/pdf',
      byteSize: buffer.byteLength,
      lastGeneratedAt: this.lastGeneratedAt,
    };
  }

  async getDpaPdfFile(): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const { buffer } = await this.ensureDpaPdfStored();
    return {
      buffer,
      filename: DPA_FILENAME,
      contentType: 'application/pdf',
    };
  }

  /**
   * Lists only third-party subprocessors actually configured/active in PlatformSettings
   * or runtime environment across hosting/storage, email, SMS, push, payment, and error tracking.
   */
  async getSubprocessorsOverview(): Promise<PublicSubprocessorsResponse> {
    const settings = await this.platformSettings.getAllSettings();
    const subprocessors: PublicSubprocessorItem[] = [];
    const unconfiguredCategories: PublicSubprocessorCategoryNote[] = [];

    // 1. Hosting / Cloud Object Storage
    const hostingVendorEnv = process.env.HOSTING_PROVIDER_NAME?.trim();
    const hostingRegionEnv = process.env.HOSTING_REGION?.trim() || 'Primary deployment region';
    let hasHostingVendor = false;

    if (hostingVendorEnv) {
      hasHostingVendor = true;
      subprocessors.push({
        id: 'hosting-cloud',
        name: hostingVendorEnv,
        category: 'hosting',
        categoryLabel: CATEGORY_LABELS.hosting,
        purpose: 'Primary application compute, database, and caching infrastructure.',
        dataProcessed: 'Encrypted workspace databases, application traffic, and session metadata.',
        region: hostingRegionEnv,
        configuredSource: 'environment',
        updatedAt: null,
      });
    }

    if (settings.storage.storageDriver === 's3' && (settings.storage.configured || process.env.S3_BUCKET)) {
      hasHostingVendor = true;
      subprocessors.push({
        id: 'hosting-s3',
        name: 'Amazon Web Services (S3 Object Storage)',
        category: 'hosting',
        categoryLabel: CATEGORY_LABELS.hosting,
        purpose: 'Encrypted document, payslip, attachment, and DPA artifact storage.',
        dataProcessed: 'Uploaded employee documents, payslip PDFs, and legal compliance artifacts.',
        region: settings.storage.s3Region || 'Configured AWS region',
        configuredSource: settings.storage.configured ? 'platform_settings' : 'environment',
        updatedAt: settings.storage.updatedAt,
      });
    }

    if (!hasHostingVendor) {
      unconfiguredCategories.push({
        category: 'hosting',
        categoryLabel: CATEGORY_LABELS.hosting,
        note: 'Files are stored on the platform’s local FileStorage driver with no external third-party cloud object storage configured.',
      });
    }

    // 2. Email Delivery
    if (settings.email.configured || process.env.SMTP_HOST?.trim()) {
      const providerName = settings.email.configured
        ? resolveEmailProviderName(settings.email.provider, settings.email.host)
        : resolveEmailProviderName('smtp', process.env.SMTP_HOST);

      subprocessors.push({
        id: `email-${settings.email.provider || 'smtp'}`,
        name: providerName,
        category: 'email',
        categoryLabel: CATEGORY_LABELS.email,
        purpose: 'Transactional emails including verification links, payslips, and lead confirmations.',
        dataProcessed: 'Recipient email address, name, and notification email content.',
        region: 'Global delivery',
        configuredSource: settings.email.configured ? 'platform_settings' : 'environment',
        updatedAt: settings.email.updatedAt,
      });
    } else {
      unconfiguredCategories.push({
        category: 'email',
        categoryLabel: CATEGORY_LABELS.email,
        note: 'No external platform email subprocessor is configured yet.',
      });
    }

    // 3. SMS Messaging
    if (settings.sms.configured) {
      subprocessors.push({
        id: `sms-${settings.sms.provider || 'gateway'}`,
        name: resolveSmsProviderName(settings.sms.provider),
        category: 'sms',
        categoryLabel: CATEGORY_LABELS.sms,
        purpose: 'Optional SMS shift notifications and verification messaging when enabled.',
        dataProcessed: 'Recipient phone number and outbound SMS message body.',
        region: 'Global carrier routing',
        configuredSource: 'platform_settings',
        updatedAt: settings.sms.updatedAt,
      });
    } else {
      unconfiguredCategories.push({
        category: 'sms',
        categoryLabel: CATEGORY_LABELS.sms,
        note: 'No third-party SMS gateway is configured.',
      });
    }

    // 4. Push Notifications
    const envPushConfigured = Boolean(
      process.env.FIREBASE_PROJECT_ID?.trim() &&
        process.env.FIREBASE_CLIENT_EMAIL?.trim() &&
        process.env.FIREBASE_PRIVATE_KEY?.trim(),
    );

    if (settings.push.configured || envPushConfigured) {
      subprocessors.push({
        id: 'push-firebase-fcm',
        name: 'Google Firebase Cloud Messaging (FCM)',
        category: 'push',
        categoryLabel: CATEGORY_LABELS.push,
        purpose: 'Mobile push notifications for attendance reminders, approvals, and payslip alerts.',
        dataProcessed: 'Device push registration tokens and notification titles/bodies.',
        region: 'Global push delivery',
        configuredSource: settings.push.configured ? 'platform_settings' : 'environment',
        updatedAt: settings.push.updatedAt,
      });
    } else {
      unconfiguredCategories.push({
        category: 'push',
        categoryLabel: CATEGORY_LABELS.push,
        note: 'No external push notification provider is configured.',
      });
    }

    // 5. Payment Processing
    if (settings.billing.configured || Boolean(process.env.STRIPE_SECRET_KEY?.trim())) {
      subprocessors.push({
        id: 'payment-stripe',
        name: 'Stripe, Inc.',
        category: 'payment',
        categoryLabel: CATEGORY_LABELS.payment,
        purpose: 'SaaS subscription billing, invoicing, and payment webhook reconciliation.',
        dataProcessed: 'Organization billing contact details, invoice metadata, and tokenized card state.',
        region: 'US / Global',
        configuredSource: settings.billing.configured ? 'platform_settings' : 'environment',
        updatedAt: settings.billing.updatedAt,
      });
    } else {
      unconfiguredCategories.push({
        category: 'payment',
        categoryLabel: CATEGORY_LABELS.payment,
        note: 'No external payment processor is configured.',
      });
    }

    // 6. Error Tracking
    if (process.env.SENTRY_DSN?.trim()) {
      subprocessors.push({
        id: 'error-tracking-sentry',
        name: process.env.ERROR_TRACKING_PROVIDER?.trim() || 'Sentry (Functional Software, Inc.)',
        category: 'error_tracking',
        categoryLabel: CATEGORY_LABELS.error_tracking,
        purpose: 'Runtime exception capture and reliability diagnostics (scrubbed of secrets/PII).',
        dataProcessed: 'Sanitized error stack traces, release tags, and request identifiers.',
        region: process.env.SENTRY_REGION?.trim() || 'Configured ingestion region',
        configuredSource: 'environment',
        updatedAt: null,
      });
    } else {
      unconfiguredCategories.push({
        category: 'error_tracking',
        categoryLabel: CATEGORY_LABELS.error_tracking,
        note: 'No external third-party error-tracking SaaS is configured.',
      });
    }

    const updatedDates = subprocessors
      .map((s) => s.updatedAt)
      .filter((d): d is string => Boolean(d))
      .sort();
    const latestSettingUpdate =
      updatedDates.length > 0 ? updatedDates[updatedDates.length - 1].slice(0, 10) : null;
    const lastUpdated =
      latestSettingUpdate && latestSettingUpdate > SUBPROCESSORS_BASELINE_DATE
        ? latestSettingUpdate
        : SUBPROCESSORS_BASELINE_DATE;

    return {
      lastUpdated,
      totalActive: subprocessors.length,
      categoriesChecked: CATEGORIES_ORDER,
      subprocessors,
      unconfiguredCategories,
    };
  }
}
