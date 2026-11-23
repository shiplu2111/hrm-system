import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PlatformAnnouncementAudienceType,
  PlatformAnnouncementSeverity,
  PlatformAnnouncementStatus,
  RoleDataScope,
} from '@prisma/client';
import { PlatformAnnouncementsService } from './platform-announcements.service';

describe('PlatformAnnouncementsService', () => {
  let service: PlatformAnnouncementsService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockDelivery: any;

  beforeEach(() => {
    mockPrisma = {
      unscoped: {
        platformAnnouncement: {
          findMany: jest.fn(),
          count: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        platformAnnouncementDismissal: {
          upsert: jest.fn(),
        },
        tenant: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
        },
        user: {
          findMany: jest.fn(),
          count: jest.fn(),
        },
      },
    };

    mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mockDelivery = {
      deliverInApp: jest.fn().mockResolvedValue(undefined),
      deliverEmailWithRetry: jest.fn().mockResolvedValue(undefined),
    };

    service = new PlatformAnnouncementsService(
      mockPrisma,
      mockAudit,
      mockDelivery,
    );
  });

  describe('CRUD & Lifecycle', () => {
    it('creates announcement with valid dates and draft status', async () => {
      const input = {
        title: 'Platform Maintenance Notice',
        body: 'Scheduled DB index migration',
        severity: PlatformAnnouncementSeverity.info,
        audienceType: PlatformAnnouncementAudienceType.all,
        startTime: new Date(Date.now() + 10000).toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        dismissible: true,
        sendEmail: false,
      };

      const created = {
        id: 'ann-1',
        ...input,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        status: PlatformAnnouncementStatus.draft,
        targetPlans: [],
        targetCountries: [],
        targetTenantIds: [],
        rolesOnly: false,
        createdBy: 'user-1',
        createdByName: 'Admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.unscoped.platformAnnouncement.create.mockResolvedValue(created);

      const result = await service.createAnnouncement(input, 'user-1', 'Admin');
      expect(result.id).toBe('ann-1');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'platform_announcement.created',
          recordId: 'ann-1',
        }),
      );
    });

    it('rejects creation when end time is before or equal to start time', async () => {
      const input = {
        title: 'Invalid Notice',
        body: 'Body text',
        severity: PlatformAnnouncementSeverity.warning,
        audienceType: PlatformAnnouncementAudienceType.all,
        startTime: '2026-11-24T12:00:00Z',
        endTime: '2026-11-24T11:00:00Z',
      };

      await expect(service.createAnnouncement(input)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('publishes announcement and dispatches Notification Engine in-app and email', async () => {
      const existing = {
        id: 'ann-2',
        title: 'Statutory Payroll Update',
        body: 'Please review updated tax tables',
        severity: PlatformAnnouncementSeverity.critical,
        audienceType: PlatformAnnouncementAudienceType.all,
        targetPlans: [],
        targetCountries: [],
        targetTenantIds: [],
        rolesOnly: true,
        startTime: new Date(),
        endTime: null,
        dismissible: false,
        sendEmail: true,
        status: PlatformAnnouncementStatus.draft,
        createdBy: 'user-1',
      };

      const updated = {
        ...existing,
        status: PlatformAnnouncementStatus.published,
      };

      mockPrisma.unscoped.platformAnnouncement.findUnique.mockResolvedValue(existing);
      mockPrisma.unscoped.platformAnnouncement.update.mockResolvedValue(updated);
      mockPrisma.unscoped.tenant.findMany.mockResolvedValue([
        { id: 't-1', name: 'Acme', subdomain: 'acme', planId: 'pro', companies: [{ id: 'c-1' }] },
      ]);
      mockPrisma.unscoped.user.findMany.mockResolvedValue([
        { id: 'u-1', email: 'owner@acme.com', firstName: 'Alice', lastName: 'Admin', tenantId: 't-1' },
      ]);

      const res = await service.publishAnnouncement('ann-2', 'user-1', 'Owner');
      expect(res.status).toBe(PlatformAnnouncementStatus.published);

      expect(mockDelivery.deliverInApp).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't-1',
          userId: 'u-1',
          eventType: 'platform.announcement',
        }),
      );

      expect(mockDelivery.deliverEmailWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't-1',
          toEmail: 'owner@acme.com',
          eventType: 'platform.announcement.email',
        }),
      );
    });

    it('deletes announcement and writes audit log', async () => {
      mockPrisma.unscoped.platformAnnouncement.findUnique.mockResolvedValue({
        id: 'ann-3',
        title: 'Deprecated Notice',
      });
      mockPrisma.unscoped.platformAnnouncement.delete.mockResolvedValue({});

      const res = await service.deleteAnnouncement('ann-3', 'user-1');
      expect(res.success).toBe(true);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'platform_announcement.deleted',
          recordId: 'ann-3',
        }),
      );
    });
  });

  describe('Audience Targeting & Preview', () => {
    it('previews audience for all tenants', async () => {
      mockPrisma.unscoped.tenant.findMany.mockResolvedValue([
        { id: 't-1', name: 'Acme', subdomain: 'acme', planId: 'enterprise', companies: [{ countryId: 'US' }] },
        { id: 't-2', name: 'Beta', subdomain: 'beta', planId: 'pro', companies: [{ countryId: 'BD' }] },
      ]);
      mockPrisma.unscoped.user.count.mockResolvedValue(42);

      const preview = await service.previewAudience({
        audienceType: PlatformAnnouncementAudienceType.all,
      });

      expect(preview.tenantCount).toBe(2);
      expect(preview.userCount).toBe(42);
      expect(preview.sampleTenants.length).toBe(2);
    });

    it('previews audience filtered by plan', async () => {
      mockPrisma.unscoped.tenant.findMany.mockResolvedValue([
        { id: 't-1', name: 'Acme', subdomain: 'acme', planId: 'enterprise', companies: [] },
      ]);
      mockPrisma.unscoped.user.count.mockResolvedValue(10);

      const preview = await service.previewAudience({
        audienceType: PlatformAnnouncementAudienceType.by_plan,
        targetPlans: ['enterprise'],
      });

      expect(preview.tenantCount).toBe(1);
      expect(mockPrisma.unscoped.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            planId: { in: ['enterprise'] },
          }),
        }),
      );
    });

    it('previews audience filtered by country', async () => {
      mockPrisma.unscoped.tenant.findMany.mockResolvedValue([
        { id: 't-1', name: 'Acme US', subdomain: 'acme-us', planId: 'pro', companies: [{ countryId: 'US' }] },
        { id: 't-2', name: 'Acme BD', subdomain: 'acme-bd', planId: 'pro', companies: [{ countryId: 'BD' }] },
      ]);
      mockPrisma.unscoped.user.count.mockResolvedValue(5);

      const preview = await service.previewAudience({
        audienceType: PlatformAnnouncementAudienceType.by_country,
        targetCountries: ['US'],
      });

      expect(preview.tenantCount).toBe(1);
      expect(preview.sampleTenants[0].subdomain).toBe('acme-us');
    });
  });

  describe('Tenant Portal Active Announcements & Dismissal', () => {
    it('returns active announcement matching tenant plan and country', async () => {
      const activeAnn = {
        id: 'ann-10',
        title: 'Pro Tier Feature Update',
        body: 'New analytics dashboard now live',
        severity: PlatformAnnouncementSeverity.info,
        audienceType: PlatformAnnouncementAudienceType.by_plan,
        targetPlans: ['pro'],
        targetCountries: [],
        targetTenantIds: [],
        rolesOnly: false,
        startTime: new Date(Date.now() - 10000),
        endTime: new Date(Date.now() + 1000000),
        dismissible: true,
        dismissals: [],
      };

      mockPrisma.unscoped.platformAnnouncement.findMany.mockResolvedValue([activeAnn]);
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 't-1',
        planId: 'pro',
        companies: [{ countryId: 'US' }],
      });

      const list = await service.getActiveAnnouncementsForTenant('t-1', 'u-1', 'Employee');
      expect(list.length).toBe(1);
      expect(list[0].id).toBe('ann-10');
      expect(list[0].title).toBe('Pro Tier Feature Update');
    });

    it('filters out announcement if rolesOnly is true and user is regular employee', async () => {
      const adminOnlyAnn = {
        id: 'ann-11',
        title: 'Billing Invoice Ready',
        body: 'Monthly invoice generated',
        severity: PlatformAnnouncementSeverity.info,
        audienceType: PlatformAnnouncementAudienceType.all,
        targetPlans: [],
        targetCountries: [],
        targetTenantIds: [],
        rolesOnly: true,
        startTime: new Date(Date.now() - 10000),
        endTime: null,
        dismissible: true,
        dismissals: [],
      };

      mockPrisma.unscoped.platformAnnouncement.findMany.mockResolvedValue([adminOnlyAnn]);
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 't-1',
        planId: 'pro',
        companies: [],
      });

      // Regular employee should NOT receive it
      const employeeList = await service.getActiveAnnouncementsForTenant('t-1', 'u-1', 'Software Engineer');
      expect(employeeList.length).toBe(0);

      // Company Owner should receive it
      const ownerList = await service.getActiveAnnouncementsForTenant('t-1', 'u-2', 'Company Owner');
      expect(ownerList.length).toBe(1);
    });

    it('filters out announcement already dismissed by user', async () => {
      const dismissedAnn = {
        id: 'ann-12',
        title: 'Survey',
        body: 'Take survey',
        severity: PlatformAnnouncementSeverity.info,
        audienceType: PlatformAnnouncementAudienceType.all,
        targetPlans: [],
        targetCountries: [],
        targetTenantIds: [],
        rolesOnly: false,
        startTime: new Date(Date.now() - 10000),
        endTime: null,
        dismissible: true,
        dismissals: [{ id: 'd-1', userId: 'u-1' }],
      };

      mockPrisma.unscoped.platformAnnouncement.findMany.mockResolvedValue([dismissedAnn]);
      mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
        id: 't-1',
        planId: 'pro',
        companies: [],
      });

      const list = await service.getActiveAnnouncementsForTenant('t-1', 'u-1', 'Company Owner');
      expect(list.length).toBe(0);
    });

    it('allows dismissal of dismissible announcement', async () => {
      mockPrisma.unscoped.platformAnnouncement.findUnique.mockResolvedValue({
        id: 'ann-13',
        dismissible: true,
      });
      mockPrisma.unscoped.platformAnnouncementDismissal.upsert.mockResolvedValue({});

      const res = await service.dismissAnnouncement('ann-13', 't-1', 'u-1');
      expect(res.success).toBe(true);
      expect(
        mockPrisma.unscoped.platformAnnouncementDismissal.upsert,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { announcementId_userId: { announcementId: 'ann-13', userId: 'u-1' } },
        }),
      );
    });

    it('rejects dismissal of mandatory non-dismissible announcement', async () => {
      mockPrisma.unscoped.platformAnnouncement.findUnique.mockResolvedValue({
        id: 'ann-14',
        dismissible: false,
      });

      await expect(
        service.dismissAnnouncement('ann-14', 't-1', 'u-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
