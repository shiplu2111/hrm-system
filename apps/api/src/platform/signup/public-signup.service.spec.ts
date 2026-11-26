jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_HOUR: '0 * * * *' },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { PendingSignupStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { FieldEncryptionService } from '../../crypto/field-encryption.service';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../settings/mail.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { TenantLifecycleQueueService } from '../tenants/tenant-lifecycle-queue.service';
import { PublicCaptchaService } from './public-captcha.service';
import { PublicSignupService } from './public-signup.service';

describe('PublicSignupService & PublicCaptchaService', () => {
  let service: PublicSignupService;
  let captchaService: PublicCaptchaService;
  let mockPrisma: any;
  let mockQueue: any;
  let mockAudit: any;
  let mockMail: any;

  const solveChallenge = (): string => {
    const ch = captchaService.issueChallenge();
    const match = ch.prompt.match(/(\d+)\s*\+\s*(\d+)/);
    const ans = Number(match![1]) + Number(match![2]);
    return `${ch.challengeId}:${ans}`;
  };

  beforeEach(async () => {
    mockPrisma = {
      unscoped: {
        tenant: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        user: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        country: {
          findMany: jest.fn().mockResolvedValue([
            { isoCode: 'AU', name: 'Australia' },
            { isoCode: 'BD', name: 'Bangladesh' },
          ]),
        },
        platformSetting: {
          findMany: jest.fn().mockResolvedValue([]),
          findUnique: jest.fn().mockResolvedValue(null),
        },
        pendingSignup: {
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation(async ({ data }: any) => ({
            id: 'pending-1',
            ...data,
          })),
          update: jest.fn().mockImplementation(async ({ where, data }: any) => ({
            id: where.id,
            ...data,
          })),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        platformIncident: {
          create: jest.fn().mockResolvedValue({ id: 'inc-signup-1' }),
        },
      },
    };

    mockQueue = {
      enqueueProvisioning: jest.fn().mockResolvedValue({
        tenantId: 'tenant-new-1',
        name: 'Acme AU',
        subdomain: 'acme-au',
        status: 'Trial',
        companyId: 'company-1',
        ownerUserId: 'user-1',
        ownerEmail: 'alex@acme-au.com',
        invitationSent: true,
        message: 'Provisioned',
      }),
    };

    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mockMail = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicSignupService,
        PublicCaptchaService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TenantLifecycleQueueService, useValue: mockQueue },
        { provide: PlatformAuditService, useValue: mockAudit },
        { provide: MailService, useValue: mockMail },
        { provide: FieldEncryptionService, useValue: { decrypt: (v: string) => v } },
      ],
    }).compile();

    service = module.get(PublicSignupService);
    captchaService = module.get(PublicCaptchaService);
  });

  it('rejects invalid CAPTCHA and blocks replaying a solved challenge', async () => {
    await expect(captchaService.verifyToken('bad-token')).rejects.toThrow();

    const token = solveChallenge();
    await expect(captchaService.verifyToken(token)).resolves.toBeUndefined();
    await expect(captchaService.verifyToken(token)).rejects.toThrow(/already been used/i);
  });

  it('rejects reserved subdomains and disposable emails', async () => {
    const reserved = await service.checkSubdomainAvailability('platform');
    expect(reserved.available).toBe(false);
    expect(reserved.reason).toBe('reserved');

    await expect(
      service.submitSignup({
        companyName: 'Test Co',
        country: 'AU',
        workEmail: 'spammer@mailinator.com',
        ownerName: 'Spam User',
        password: 'Password123',
        desiredSubdomain: 'valid-co',
        acceptedTerms: true,
        termsVersion: '2026-11',
        captchaToken: solveChallenge(),
      }),
    ).rejects.toThrow(/Disposable email addresses/i);
  });

  it('creates pending signup with hashed password & hashed token, strips UTM without consent, and returns identical response for duplicates & registered users', async () => {
    const payload = {
      companyName: 'Acme AU Pty Ltd',
      country: 'AU',
      workEmail: 'alex@acme-au.com',
      ownerName: 'Alex Morgan',
      authMethod: 'password' as const,
      password: 'Password123!',
      desiredSubdomain: 'acme-au',
      acceptedTerms: true,
      termsVersion: '2026-11',
      captchaToken: solveChallenge(),
      marketingConsent: false,
      utmSource: 'google',
      utmCampaign: 'payroll-search',
      referrer: 'https://google.com',
    };

    const res1 = await service.submitSignup(payload, '127.0.0.1', 'jest');
    expect(res1.status).toBe('verification_sent');
    expect(res1.expiresInHours).toBe(24);
    expect(mockQueue.enqueueProvisioning).not.toHaveBeenCalled();

    const createdData = mockPrisma.unscoped.pendingSignup.create.mock.calls[0][0].data;
    expect(createdData.passwordHash).toBeTruthy();
    expect(createdData.passwordHash).not.toContain('Password123');
    expect(createdData.verificationTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createdData.termsVersion).toBe('2026-11');
    // Without marketingConsent=true, UTM & referrer are omitted
    expect(createdData.utmSource).toBeNull();
    expect(createdData.referrer).toBeNull();

    // Repeat signup with already-registered email returns byte-for-byte identical response
    mockPrisma.unscoped.user.findFirst.mockResolvedValue({
      id: 'existing-user',
      tenantId: 'tenant-existing',
    });
    mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
      name: 'Acme Existing',
      subdomain: 'acme-existing',
      deletedAt: null,
    });

    const res2 = await service.submitSignup(
      { ...payload, captchaToken: solveChallenge() },
      '127.0.0.1',
      'jest',
    );
    expect(res2).toEqual(res1);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'public_signup.duplicate_email_suppressed' }),
    );
  });

  it('enforces per-email rate limit after 3 attempts', async () => {
    const basePayload = {
      companyName: 'Rate Limit Co',
      country: 'AU',
      workEmail: 'burst@company-real.com',
      ownerName: 'Rate Tester',
      password: 'Password123!',
      desiredSubdomain: 'rate-co',
      acceptedTerms: true,
      termsVersion: '2026-11',
    };

    for (let i = 0; i < 3; i += 1) {
      await service.submitSignup({ ...basePayload, captchaToken: solveChallenge() });
    }

    await expect(
      service.submitSignup({ ...basePayload, captchaToken: solveChallenge() }),
    ).rejects.toThrow(/Too many signup attempts/i);
  });

  it('verifies token, reads trialDays from platform settings, calls provisioning, and returns tenant loginUrl', async () => {
    const rawToken = 'raw-secret-verification-token-123';
    const digest = createHash('sha256').update(rawToken).digest('hex');

    mockPrisma.unscoped.platformSetting.findMany.mockResolvedValue([
      { key: 'trial', value: { trialDays: 21 } },
    ]);

    mockPrisma.unscoped.pendingSignup.findUnique.mockResolvedValue({
      id: 'pending-verify-1',
      companyName: 'Melbourne Health',
      countryCode: 'AU',
      workEmail: 'founder@melbournehealth.com.au',
      ownerFirstName: 'Sam',
      ownerLastName: 'Lee',
      authMethod: 'password',
      passwordHash: '$2a$10$hashedpw',
      desiredSubdomain: 'melbourne-health',
      termsVersion: '2026-11',
      termsAcceptedAt: new Date('2026-11-25T00:00:00Z'),
      marketingConsent: true,
      utmSource: 'linkedin',
      utmMedium: 'cpc',
      utmCampaign: 'au-launch',
      referrer: 'https://linkedin.com',
      verificationTokenHash: digest,
      status: PendingSignupStatus.pending,
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const result = await service.verifyAndProvision(rawToken, '127.0.0.1', 'jest');

    expect(mockQueue.enqueueProvisioning).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Melbourne Health',
        subdomain: 'melbourne-health',
        planId: 'trial',
        trialDays: 21,
        countryCode: 'AU',
        ownerEmail: 'founder@melbournehealth.com.au',
        ownerPasswordHash: '$2a$10$hashedpw',
        mustChangePassword: false,
      }),
    );

    expect(result.status).toBe('provisioned');
    expect(result.tenantId).toBe('tenant-new-1');
    expect(result.loginUrl).toContain('/login?tenant=');
    expect(result.trialDays).toBe(21);

    // Clears password hash after provisioning
    expect(mockPrisma.unscoped.pendingSignup.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PendingSignupStatus.provisioned,
          passwordHash: null,
        }),
      }),
    );
  });

  it('preserves pending signup, sets failed status, logs audit, and raises a platform staff incident when provisioning fails', async () => {
    const rawToken = 'failing-provision-token-123';
    const digest = createHash('sha256').update(rawToken).digest('hex');

    mockPrisma.unscoped.pendingSignup.findUnique.mockResolvedValue({
      id: 'pending-fail-1',
      companyName: 'Failover Co',
      countryCode: 'AU',
      workEmail: 'owner@failover.com',
      ownerFirstName: 'Alex',
      ownerLastName: 'Morgan',
      authMethod: 'password',
      passwordHash: '$2a$10$preservedhash',
      desiredSubdomain: 'failover-co',
      termsVersion: '2026-11',
      termsAcceptedAt: new Date('2026-11-25T00:00:00Z'),
      marketingConsent: false,
      verificationTokenHash: digest,
      status: PendingSignupStatus.pending,
      expiresAt: new Date(Date.now() + 3600_000),
    });

    mockQueue.enqueueProvisioning.mockRejectedValueOnce(new Error('Simulated DB deadlock'));

    await expect(service.verifyAndProvision(rawToken, '127.0.0.1', 'jest')).rejects.toThrow(
      /platform team has been alerted/i,
    );

    expect(mockPrisma.unscoped.pendingSignup.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PendingSignupStatus.failed,
          failureReason: 'Simulated DB deadlock',
        }),
      }),
    );

    expect(mockPrisma.unscoped.platformIncident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subsystem: 'signup',
          severity: 'major',
          status: 'investigating',
        }),
      }),
    );

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_signup.provisioning_failed',
        recordId: 'pending-fail-1',
      }),
    );
  });

  it('rejects expired verification tokens and cleans up expired unverified signups', async () => {
    const rawToken = 'expired-token-123';
    const digest = createHash('sha256').update(rawToken).digest('hex');

    mockPrisma.unscoped.pendingSignup.findUnique.mockResolvedValue({
      id: 'pending-expired-1',
      status: PendingSignupStatus.pending,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(service.verifyAndProvision(rawToken)).rejects.toThrow(/expired after 24 hours/i);

    mockPrisma.unscoped.pendingSignup.deleteMany.mockResolvedValue({ count: 4 });
    const cleaned = await service.cleanupExpiredSignups();
    expect(cleaned.cleanedCount).toBe(4);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'public_signup.expired_cleaned' }),
    );
  });

  it('stores UTM attribution when cookie banner attributionConsent=true even if marketingConsent=false', async () => {
    await service.submitSignup(
      {
        companyName: 'Attribution Corp',
        country: 'AU',
        workEmail: 'growth@attribution-corp.com',
        ownerName: 'Growth Ops',
        authMethod: 'password',
        password: 'Password123!',
        desiredSubdomain: 'attribution-corp',
        acceptedTerms: true,
        termsVersion: '2026-11',
        captchaToken: solveChallenge(),
        marketingConsent: false,
        attributionConsent: true,
        utmSource: 'plausible-campaign',
        utmMedium: 'cpc',
        utmCampaign: 'launch-q4',
        referrer: 'https://partner.example',
      },
      '127.0.0.1',
      'jest',
    );

    const createdData = mockPrisma.unscoped.pendingSignup.create.mock.calls[0][0].data;
    expect(createdData.marketingConsent).toBe(false);
    expect(createdData.utmSource).toBe('plausible-campaign');
    expect(createdData.utmMedium).toBe('cpc');
    expect(createdData.utmCampaign).toBe('launch-q4');
    expect(createdData.referrer).toBe('https://partner.example');
  });
});
