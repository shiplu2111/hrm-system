import { Test, TestingModule } from '@nestjs/testing';
import { LeadStatus } from '@prisma/client';
import { FieldEncryptionService } from '../../crypto/field-encryption.service';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../settings/mail.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PublicCaptchaService } from '../signup/public-captcha.service';
import { PublicLeadsService } from './public-leads.service';

describe('PublicLeadsService', () => {
  let service: PublicLeadsService;
  let captchaService: PublicCaptchaService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockMail: any;

  const solveCaptcha = (): string => {
    const ch = captchaService.issueChallenge();
    const match = ch.prompt.match(/(\d+)\s*\+\s*(\d+)/);
    return `${ch.challengeId}:${Number(match![1]) + Number(match![2])}`;
  };

  beforeEach(async () => {
    mockPrisma = {
      unscoped: {
        lead: {
          create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'lead-1', ...data })),
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        demoRequest: {
          create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'demo-1', ...data })),
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        contactMessage: {
          create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'contact-1', ...data })),
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        platformSetting: {
          findUnique: jest.fn().mockResolvedValue({
            value: {
              host: '127.0.0.1',
              port: 1025,
              secure: false,
              username: 'mailer',
              passwordEnc: 'secret',
              fromAddress: 'no-reply@cmsn-hr.example',
              fromName: 'CMSN-HR',
            },
          }),
          findMany: jest.fn().mockResolvedValue([
            {
              key: 'sales_inbox',
              value: { address: 'configured-sales@cmsn-hr.example' },
            },
          ]),
        },
        $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
      },
    };

    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mockMail = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicLeadsService,
        PublicCaptchaService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlatformAuditService, useValue: mockAudit },
        { provide: MailService, useValue: mockMail },
        { provide: FieldEncryptionService, useValue: { decrypt: (v: string) => v } },
      ],
    }).compile();

    service = module.get(PublicLeadsService);
    captchaService = module.get(PublicCaptchaService);
  });

  it('silently discards submissions where a bot fills the honeypot without writing DB or sending emails', async () => {
    const res = await service.submitDemoRequest({
      name: 'Bot Spammer',
      workEmail: 'bot@spam.invalid',
      company: 'Spam Corp',
      privacyConsent: true,
      website: 'https://buy-now.spam',
      captchaToken: 'not-even-valid',
    });

    expect(res.accepted).toBe(true);
    expect(mockPrisma.unscoped.demoRequest.create).not.toHaveBeenCalled();
    expect(mockPrisma.unscoped.lead.create).not.toHaveBeenCalled();
    expect(mockMail.sendMail).not.toHaveBeenCalled();
  });

  it('requires privacy consent and valid CAPTCHA', async () => {
    await expect(
      service.submitDemoRequest({
        name: 'Alex',
        workEmail: 'alex@company.com',
        company: 'Acme Co',
        privacyConsent: false,
        captchaToken: solveCaptcha(),
      }),
    ).rejects.toThrow(/Consent is required/i);

    await expect(
      service.submitDemoRequest({
        name: 'Alex',
        workEmail: 'alex@company.com',
        company: 'Acme Co',
        privacyConsent: true,
        captchaToken: 'invalid-token',
      }),
    ).rejects.toThrow();
  });

  it('creates one demo_request record, honours marketingConsent on UTM fields, and sends confirmation + configurable sales inbox emails', async () => {
    const res = await service.submitDemoRequest({
      name: 'Jordan Taylor',
      workEmail: 'jordan@acme.com',
      company: 'Acme Logistics',
      country: 'AU',
      employeeCountBand: '51-250',
      message: 'Need AU payroll walkthrough',
      sourcePage: '/pricing',
      utmSource: 'linkedin',
      utmCampaign: 'demo-q4',
      referrer: 'https://linkedin.com',
      privacyConsent: true,
      marketingConsent: false,
      captchaToken: solveCaptcha(),
    });

    expect(res.accepted).toBe(true);
    expect(mockPrisma.unscoped.demoRequest.create).toHaveBeenCalledTimes(1);
    const saved = mockPrisma.unscoped.demoRequest.create.mock.calls[0][0].data;
    expect(saved.status).toBe(LeadStatus.new);
    expect(saved.privacyConsent).toBe(true);
    // Marketing attribution omitted when marketingConsent=false
    expect(saved.utmSource).toBeNull();
    expect(saved.referrer).toBeNull();

    // Sends both visitor confirmation email and configured sales inbox notification
    expect(mockMail.sendMail).toHaveBeenCalledTimes(2);
    expect(mockMail.sendMail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ to: 'jordan@acme.com' }),
    );
    expect(mockMail.sendMail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ to: 'configured-sales@cmsn-hr.example' }),
    );
  });

  it('stores UTM fields when marketingConsent=true and enforces per-email rate limit after 5 attempts', async () => {
    for (let i = 0; i < 5; i += 1) {
      await service.submitContactMessage({
        name: 'Sam',
        workEmail: 'sam@company.com',
        topic: 'sales',
        message: 'Question about payroll',
        privacyConsent: true,
        marketingConsent: true,
        utmSource: 'google',
        captchaToken: solveCaptcha(),
      });
    }

    expect(mockPrisma.unscoped.contactMessage.create.mock.calls[0][0].data.utmSource).toBe('google');

    await expect(
      service.submitContactMessage({
        name: 'Sam',
        workEmail: 'sam@company.com',
        topic: 'sales',
        message: 'Burst #6',
        privacyConsent: true,
        captchaToken: solveCaptcha(),
      }),
    ).rejects.toThrow(/Too many submissions/i);
  });

  it('deletes lead, demo, and contact records on erasure request and logs audit', async () => {
    const res = await service.eraseByEmail('erase@company.com', 'User requested GDPR deletion', 'staff-1');

    expect(res).toEqual({
      leadsDeleted: 1,
      demoRequestsDeleted: 1,
      contactMessagesDeleted: 1,
      totalDeleted: 3,
    });
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'public_lead.erased',
        userId: 'staff-1',
      }),
    );
  });
});
