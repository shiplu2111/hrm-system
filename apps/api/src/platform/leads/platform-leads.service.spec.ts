import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LeadStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PlatformLeadsService } from './platform-leads.service';

describe('PlatformLeadsService', () => {
  let service: PlatformLeadsService;
  let mockPrisma: any;
  let mockAudit: any;

  const sampleDemoRow = {
    id: 'demo-uuid-1',
    name: 'Morgan Lee',
    workEmail: 'morgan@acme.example',
    company: 'Acme Retail',
    country: 'AU',
    employeeCountBand: '51-250',
    message: 'Payroll & offline mobile attendance walkthrough',
    sourcePage: '/demo',
    utmSource: 'linkedin',
    utmMedium: 'paid',
    utmCampaign: 'au-q4',
    utmTerm: null,
    utmContent: null,
    referrer: null,
    privacyConsent: true,
    marketingConsent: true,
    consentAt: new Date('2026-11-25T08:00:00.000Z'),
    status: LeadStatus.new,
    assigneeUserId: null,
    assigneeName: null,
    notes: null,
    createdAt: new Date('2026-11-25T08:00:00.000Z'),
    updatedAt: new Date('2026-11-25T08:00:00.000Z'),
  };

  beforeEach(async () => {
    mockPrisma = {
      unscoped: {
        lead: {
          findMany: jest.fn().mockResolvedValue([]),
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
        demoRequest: {
          findMany: jest.fn().mockResolvedValue([sampleDemoRow]),
          findUnique: jest.fn().mockResolvedValue(sampleDemoRow),
          update: jest.fn().mockResolvedValue({ ...sampleDemoRow, status: LeadStatus.qualified }),
        },
        contactMessage: {
          findMany: jest.fn().mockResolvedValue([]),
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
        platformUser: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'sales-user-1',
              email: 'sales.rep@cmsnbd.com',
              firstName: 'Sales',
              lastName: 'Rep',
              role: { name: 'Sales' },
            },
          ]),
          findUnique: jest.fn().mockResolvedValue({
            id: 'sales-user-1',
            firstName: 'Sales',
            lastName: 'Rep',
            isActive: true,
            role: { name: 'Sales' },
          }),
        },
        platformAuditLog: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    };

    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformLeadsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlatformAuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get(PlatformLeadsService);
  });

  it('allows Platform Owner, Platform Admin, and Sales roles and blocks Support Agent', async () => {
    await expect(
      service.list({ kind: 'demo' }, { id: 'u1', email: 'sales@cmsnbd.com', roleName: 'Sales' }),
    ).resolves.toMatchObject({ total: 1 });

    await expect(
      service.list(
        { kind: 'demo' },
        { id: 'u2', email: 'admin@cmsnbd.com', roleName: 'Platform Admin' },
      ),
    ).resolves.toMatchObject({ total: 1 });

    await expect(
      service.list(
        { kind: 'demo' },
        { id: 'u3', email: 'owner@cmsnbd.com', roleName: 'Platform Owner' },
      ),
    ).resolves.toMatchObject({ total: 1 });

    await expect(
      service.list(
        { kind: 'demo' },
        { id: 'u4', email: 'support@cmsnbd.com', roleName: 'Support Agent' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.list(
        { kind: 'demo' },
        { id: 'u5', email: 'billing@cmsnbd.com', roleName: 'Billing Admin' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updates demo status, assigns Sales staff, appends notes, and audit-logs status transition', async () => {
    await service.update(
      'demo',
      'demo-uuid-1',
      {
        status: LeadStatus.qualified,
        assigneeUserId: 'sales-user-1',
        noteAppend: 'Scheduled discovery call',
        reason: 'Confirmed multi-entity AU payroll budget',
      },
      { id: 'sales-user-1', email: 'sales.rep@cmsnbd.com', roleName: 'Sales' },
    );

    expect(mockPrisma.unscoped.demoRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'demo-uuid-1' },
        data: expect.objectContaining({
          status: LeadStatus.qualified,
          assigneeUserId: 'sales-user-1',
          assigneeName: 'Sales Rep',
        }),
      }),
    );

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'lead.status_changed',
        module: 'leads',
        recordId: 'demo-uuid-1',
        userId: 'sales-user-1',
        oldValue: expect.objectContaining({ status: 'new' }),
        newValue: expect.objectContaining({ status: 'qualified', assigneeUserId: 'sales-user-1' }),
      }),
    );
  });

  it('exports formula-safe CSV matching filters', async () => {
    const csv = await service.exportCsv(
      { kind: 'demo' },
      { id: 'u1', email: 'sales.rep@cmsnbd.com', roleName: 'Sales' },
    );

    expect(csv.filename).toMatch(/^cmsn-demo-requests-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv.content).toContain('"Morgan Lee"');
    expect(csv.content).toContain('"Acme Retail"');
    expect(csv.content).toContain('"linkedin"');
  });
});
