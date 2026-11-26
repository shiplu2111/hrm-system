import { Test, TestingModule } from '@nestjs/testing';
import { TenantStatus } from '@prisma/client';
import { FieldEncryptionService } from '../../crypto/field-encryption.service';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../settings/mail.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PublicLoginService } from './public-login.service';

describe('PublicLoginService', () => {
  let service: PublicLoginService;
  let mockPrisma: any;
  let mockMail: any;
  let mockAudit: any;

  beforeEach(async () => {
    mockPrisma = {
      unscoped: {
        tenant: {
          findFirst: jest.fn(),
        },
        tenantCustomDomain: {
          findFirst: jest.fn(),
        },
        user: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        platformSetting: {
          findUnique: jest.fn().mockResolvedValue({
            value: {
              host: '127.0.0.1',
              port: 1025,
              secure: false,
              username: 'mailer',
              passwordEnc: 'enc-secret',
              fromAddress: 'no-reply@cmsn-hr.example',
              fromName: 'CMSN-HR',
            },
          }),
        },
      },
    };

    mockMail = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };

    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicLoginService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMail },
        { provide: FieldEncryptionService, useValue: { decrypt: (v: string) => v } },
        { provide: PlatformAuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get(PublicLoginService);
  });

  it('redirects known tenant subdomain without leaking extra tenant metadata', async () => {
    mockPrisma.unscoped.tenant.findFirst.mockResolvedValue({
      subdomain: 'acme-payroll',
      customDomains: [],
    });

    const res = await service.discoverLoginTarget('acme-payroll.cmsn-hr.com', 'portal');

    expect(res.action).toBe('redirect');
    expect(res.redirectUrl).toContain('/login?tenant=acme-payroll');
    expect(res).not.toHaveProperty('tenantName');
    expect(res).not.toHaveProperty('tenantId');
  });

  it('returns identical neutral check_address message for unknown or deleted companies', async () => {
    mockPrisma.unscoped.tenant.findFirst.mockResolvedValue(null);
    mockPrisma.unscoped.tenantCustomDomain.findFirst.mockResolvedValue(null);

    const res1 = await service.discoverLoginTarget('nonexistent-co', 'portal');
    const res2 = await service.discoverLoginTarget('another-missing.cmsn-hr.com', 'portal');

    expect(res1).toEqual(res2);
    expect(res1.action).toBe('check_address');
    expect(res1.message).toMatch(/check the address or contact your administrator/i);
  });

  it('emails login links ONLY to the address owner and never reveals existence for email lookup', async () => {
    mockPrisma.unscoped.user.findMany.mockResolvedValue([
      {
        tenant: {
          id: 't-1',
          name: 'Acme Retail',
          subdomain: 'acme-retail',
          status: TenantStatus.active,
          customDomains: [],
        },
      },
      {
        tenant: {
          id: 't-2',
          name: 'Acme Logistics',
          subdomain: 'acme-logistics',
          status: TenantStatus.trial,
          customDomains: [],
        },
      },
    ]);

    const foundRes = await service.forgotCompanyAddress('owner@acme.example');

    expect(mockMail.sendMail).toHaveBeenCalledTimes(1);
    expect(mockMail.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@acme.example',
        text: expect.stringContaining('acme-retail'),
      }),
    );
    expect(mockMail.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('acme-logistics'),
      }),
    );

    mockMail.sendMail.mockClear();
    mockPrisma.unscoped.user.findMany.mockResolvedValue([]);

    const missingRes = await service.forgotCompanyAddress('nobody@unknown.example');

    expect(mockMail.sendMail).not.toHaveBeenCalled();
    expect(foundRes).toEqual(missingRes);
    expect(foundRes.accepted).toBe(true);
  });

  it('treats work email input on discover endpoint identically without returning tenant URLs in HTTP body', async () => {
    mockPrisma.unscoped.user.findMany.mockResolvedValue([
      {
        tenant: {
          id: 't-1',
          name: 'Acme Retail',
          subdomain: 'acme-retail',
          customDomains: [],
        },
      },
    ]);

    const emailDiscoverRes = await service.discoverLoginTarget('alex@acme.example', 'portal');

    expect(emailDiscoverRes.action).toBe('email_sent');
    expect(emailDiscoverRes.redirectUrl).toBeUndefined();
    expect(mockMail.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'alex@acme.example' }),
    );
  });
});
