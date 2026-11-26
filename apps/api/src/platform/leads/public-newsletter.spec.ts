import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PublicNewsletterService } from './public-newsletter';

describe('PublicNewsletterService', () => {
  let service: PublicNewsletterService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(async () => {
    mockPrisma = {
      unscoped: {
        emailSubscription: {
          upsert: jest.fn().mockImplementation(async ({ create }: any) => ({
            id: 'sub-1',
            ...create,
          })),
        },
      },
    };
    mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicNewsletterService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlatformAuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get(PublicNewsletterService);
  });

  it('requires explicit consent before saving subscription', async () => {
    await expect(
      service.subscribe({
        email: 'reader@acme.com',
        consentGranted: false,
        consentText: 'Subscribe to blog',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockPrisma.unscoped.emailSubscription.upsert).not.toHaveBeenCalled();
  });

  it('stores email, channel, consent text, timestamp, and sourcePage cleanly', async () => {
    const res = await service.subscribe(
      {
        email: 'Reader@Acme.com ',
        channel: 'blog',
        consentGranted: true,
        consentText: 'I agree to receive CMSN-HR blog updates.',
        consentVersion: '2026-11',
        sourcePage: '/blog',
      },
      '203.0.113.10',
    );

    expect(res.accepted).toBe(true);
    expect(mockPrisma.unscoped.emailSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email_channel: { email: 'reader@acme.com', channel: 'blog' } },
        create: expect.objectContaining({
          email: 'reader@acme.com',
          consentGranted: true,
          consentVersion: '2026-11',
          sourcePage: '/blog',
        }),
      }),
    );
    expect(mockAudit.log).toHaveBeenCalled();
  });
});
