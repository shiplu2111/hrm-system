import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PlatformSettingCategory } from '@prisma/client';
import { PlatformSettingsService } from './platform-settings.service';
import { PrismaService } from '../../database/prisma.service';
import { FieldEncryptionService } from '../../crypto/field-encryption.service';
import { PlatformAuditService } from '../audit/platform-audit.service';

describe('PlatformSettingsService', () => {
  let service: PlatformSettingsService;
  let prisma: any;
  let fieldEncryption: FieldEncryptionService;
  let auditService: any;

  const mockDbStore: Record<string, any> = {};

  beforeEach(async () => {
    Object.keys(mockDbStore).forEach((key) => delete mockDbStore[key]);

    const platformSettingMock = {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const k = `${where.category_key.category}:${where.category_key.key}`;
        return Promise.resolve(mockDbStore[k] || null);
      }),
      upsert: jest.fn().mockImplementation(({ where, create, update }) => {
        const k = `${where.category_key.category}:${where.category_key.key}`;
        const existing = mockDbStore[k];
        const record = {
          id: existing?.id || 'uuid-' + Math.random().toString(36).slice(2),
          category: where.category_key.category,
          key: where.category_key.key,
          value: existing ? update.value : create.value,
          updatedBy: existing ? update.updatedBy : create.updatedBy,
          createdAt: existing?.createdAt || new Date(),
          updatedAt: new Date(),
        };
        mockDbStore[k] = record;
        return Promise.resolve(record);
      }),
    };

    prisma = {
      platformSetting: platformSettingMock,
      unscoped: {
        platformSetting: platformSettingMock,
      },
    };

    fieldEncryption = new FieldEncryptionService();

    auditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformSettingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: FieldEncryptionService, useValue: fieldEncryption },
        { provide: PlatformAuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<PlatformSettingsService>(PlatformSettingsService);
  });

  describe('Email Settings', () => {
    it('returns default placeholder when no email settings stored', async () => {
      const email = await service.getEmailSettings();
      expect(email.configured).toBe(false);
      expect(email.passwordMasked).toBeNull();
      expect(email.passwordConfigured).toBe(false);
    });

    it('encrypts secret password and returns masked password on update', async () => {
      const updated = await service.updateEmailSettings(
        {
          provider: 'smtp',
          host: 'smtp.mailgun.org',
          port: 587,
          secure: true,
          username: 'postmaster@mailgun.org',
          password: 'super-secret-smtp-password',
          fromAddress: 'notifications@hrm.io',
          fromName: 'HR Notifications',
        },
        'user-uuid-1',
      );

      expect(updated.configured).toBe(true);
      expect(updated.passwordMasked).toBe(FieldEncryptionService.MASKED_VALUE);
      expect(updated.passwordConfigured).toBe(true);

      // Verify encrypted at rest in database
      const row = mockDbStore[`${PlatformSettingCategory.email}:default`];
      expect(row).toBeDefined();
      expect(row.value.passwordEnc).not.toBe('super-secret-smtp-password');
      expect(fieldEncryption.decrypt(row.value.passwordEnc)).toBe('super-secret-smtp-password');

      // Verify audit log
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'platform_setting.update',
          recordId: 'email',
          newValue: expect.objectContaining({
            password: '[encrypted_secret]',
          }),
        }),
      );
    });

    it('preserves existing password when password is not replaced', async () => {
      // 1. Initial save with secret
      await service.updateEmailSettings(
        {
          provider: 'smtp',
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          username: 'apikey',
          password: 'initial-secret-key-1234',
          fromAddress: 'alerts@hrm.io',
          fromName: 'Platform Alerts',
        },
        'user-uuid-1',
      );

      const rowBefore = mockDbStore[`${PlatformSettingCategory.email}:default`];
      const initialEncrypted = rowBefore.value.passwordEnc;

      // 2. Second save changing only fromName, omitting password
      const secondUpdate = await service.updateEmailSettings(
        {
          provider: 'smtp',
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          username: 'apikey',
          password: undefined,
          fromAddress: 'alerts@hrm.io',
          fromName: 'New Platform Alerts Name',
        },
        'user-uuid-1',
      );

      const rowAfter = mockDbStore[`${PlatformSettingCategory.email}:default`];
      expect(rowAfter.value.passwordEnc).toBe(initialEncrypted);
      expect(fieldEncryption.decrypt(rowAfter.value.passwordEnc)).toBe('initial-secret-key-1234');
      expect(secondUpdate.fromName).toBe('New Platform Alerts Name');
      expect(secondUpdate.passwordMasked).toBe(FieldEncryptionService.MASKED_VALUE);
    });

    it('sends test email and returns valid test result envelope', async () => {
      const res = await service.sendTestEmail({
        to: 'staff@client.com',
        subject: 'Verification email',
      });

      expect(res.success).toBe(true);
      expect(res.recipient).toBe('staff@client.com');
      expect(res.messageId).toContain('@');
    });
  });

  describe('SMS Settings', () => {
    it('encrypts authToken and supports Replace semantics', async () => {
      await service.updateSmsSettings(
        {
          provider: 'twilio',
          accountSid: 'AC1234567890abcdef',
          authToken: 'twilio-auth-token-999',
          fromNumber: '+18005550199',
        },
        'user-uuid-1',
      );

      const row = mockDbStore[`${PlatformSettingCategory.sms}:default`];
      expect(fieldEncryption.decrypt(row.value.authTokenEnc)).toBe('twilio-auth-token-999');

      const smsView = await service.getSmsSettings();
      expect(smsView.authTokenMasked).toBe(FieldEncryptionService.MASKED_VALUE);
      expect(smsView.authTokenConfigured).toBe(true);

      const testRes = await service.sendTestSms({ to: '+15551234567' });
      expect(testRes.success).toBe(true);
      expect(testRes.sid).toMatch(/^SM/);
    });
  });

  describe('Push Settings', () => {
    it('encrypts Firebase private key and verifies connection', async () => {
      await service.updatePushSettings(
        {
          projectId: 'hrm-push-test',
          clientEmail: 'fcm@hrm-push-test.iam.gserviceaccount.com',
          privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgk...\n-----END PRIVATE KEY-----',
          appId: '1:999:web:abc',
        },
        'user-uuid-1',
      );

      const row = mockDbStore[`${PlatformSettingCategory.push}:default`];
      expect(fieldEncryption.decrypt(row.value.privateKeyEnc)).toContain('BEGIN PRIVATE KEY');

      const pushView = await service.getPushSettings();
      expect(pushView.privateKeyMasked).toBe(FieldEncryptionService.MASKED_VALUE);
      expect(pushView.privateKeyConfigured).toBe(true);

      const testRes = await service.testPushConnection();
      expect(testRes.success).toBe(true);
      expect(testRes.projectId).toBe('hrm-push-test');
    });
  });

  describe('Storage Settings', () => {
    it('executes storage probe test on local filesystem', async () => {
      await service.updateStorageSettings(
        {
          storageDriver: 'local',
          localPath: './storage-test-tmp',
        },
        'user-uuid-1',
      );

      const testRes = await service.testStorageConnection();
      expect(testRes.success).toBe(true);
      expect(testRes.driver).toBe('local');
      expect(testRes.latencyMs).toBeGreaterThanOrEqual(1);

      // Clean up tmp dir if created
      const tmpDir = './storage-test-tmp';
      if (require('fs').existsSync(tmpDir)) {
        require('fs').rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('encrypts S3 secret key when S3 storage configured', async () => {
      await service.updateStorageSettings(
        {
          storageDriver: 's3',
          s3Bucket: 'hrm-prod-vault',
          s3Region: 'eu-west-1',
          s3AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          s3SecretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        },
        'user-uuid-1',
      );

      const row = mockDbStore[`${PlatformSettingCategory.storage}:default`];
      expect(fieldEncryption.decrypt(row.value.s3SecretKeyEnc)).toBe(
        'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      );

      const view = await service.getStorageSettings();
      expect(view.storageDriver).toBe('s3');
      expect(view.s3SecretKeyMasked).toBe(FieldEncryptionService.MASKED_VALUE);

      const testRes = await service.testStorageConnection();
      expect(testRes.success).toBe(true);
      expect(testRes.driver).toBe('s3');
    });
  });

  describe('Billing Settings', () => {
    it('encrypts Stripe secretKey and webhookSecret with mode detection', async () => {
      await service.updateBillingSettings(
        {
          provider: 'stripe',
          publishableKey: 'pk_test_51Mz000000000000000000000',
          secretKey: 'sk_test_51Mz000000000000000000000',
          webhookSecret: 'whsec_999999999999999999999999',
          currency: 'USD',
        },
        'user-uuid-1',
      );

      const row = mockDbStore[`${PlatformSettingCategory.billing}:default`];
      expect(fieldEncryption.decrypt(row.value.secretKeyEnc)).toBe('sk_test_51Mz000000000000000000000');
      expect(fieldEncryption.decrypt(row.value.webhookSecretEnc)).toBe('whsec_999999999999999999999999');

      const billingView = await service.getBillingSettings();
      expect(billingView.secretKeyMasked).toBe(FieldEncryptionService.MASKED_VALUE);
      expect(billingView.webhookSecretMasked).toBe(FieldEncryptionService.MASKED_VALUE);

      const testRes = await service.testBillingConnection();
      expect(testRes.success).toBe(true);
      expect(testRes.mode).toBe('test');
      expect(testRes.currency).toBe('USD');
    });
  });

  describe('Aggregate Settings', () => {
    it('returns all 5 categories masked in single aggregate payload', async () => {
      const all = await service.getAllSettings();
      expect(all.email).toBeDefined();
      expect(all.sms).toBeDefined();
      expect(all.push).toBeDefined();
      expect(all.storage).toBeDefined();
      expect(all.billing).toBeDefined();
    });
  });
});
