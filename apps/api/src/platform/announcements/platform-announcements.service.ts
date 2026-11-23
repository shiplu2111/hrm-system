import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  PlatformAnnouncement,
  PlatformAnnouncementAudienceType,
  PlatformAnnouncementSeverity,
  PlatformAnnouncementStatus,
  RoleDataScope,
  TenantStatus,
} from '@prisma/client';
import type {
  AudiencePreviewQuery,
  AudiencePreviewResult,
  AudiencePreviewSampleTenant,
  CreatePlatformAnnouncementInput,
  PlatformAnnouncementStats,
  TenantActiveAnnouncement,
  TenantPreviewQuery,
  TenantPreviewResult,
  UpdatePlatformAnnouncementInput,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { NotificationDeliveryService } from '../../notifications/notification-delivery.service';
import { escapeHtml } from '../../settings/mail.service';

export interface ListAnnouncementsQuery {
  status?: PlatformAnnouncementStatus;
  severity?: PlatformAnnouncementSeverity;
  audienceType?: PlatformAnnouncementAudienceType;
  search?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class PlatformAnnouncementsService {
  private readonly logger = new Logger(PlatformAnnouncementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: PlatformAuditService,
    @Optional()
    private readonly notificationDeliveryService?: NotificationDeliveryService,
  ) {}

  // ==========================================================================
  // Platform Super Admin CRUD
  // ==========================================================================

  async listAnnouncements(query?: ListAnnouncementsQuery): Promise<{
    items: Array<PlatformAnnouncement & { active: boolean; stats: PlatformAnnouncementStats }>;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.severity) {
      where.severity = query.severity;
    }

    if (query?.audienceType) {
      where.audienceType = query.audienceType;
    }

    if (query?.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { body: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.unscoped.platformAnnouncement.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: {
          _count: {
            select: { dismissals: true, reads: true },
          },
        },
      }),
      this.prisma.unscoped.platformAnnouncement.count({ where }),
    ]);

    const now = Date.now();
    const enriched = await Promise.all(
      rows.map(async (row) => {
        const startMs = new Date(row.startTime).getTime();
        const endMs = row.endTime ? new Date(row.endTime).getTime() : null;
        const active =
          row.status === PlatformAnnouncementStatus.published &&
          startMs <= now &&
          (!endMs || endMs >= now);

        const audience = await this.previewAudience({
          audienceType: row.audienceType,
          targetPlans: row.targetPlans,
          targetCountries: row.targetCountries,
          targetTenantIds: row.targetTenantIds,
          rolesOnly: row.rolesOnly,
        });

        const stats: PlatformAnnouncementStats = {
          targetTenantCount: audience.tenantCount,
          targetUserCount: audience.userCount,
          readCount: row._count.reads,
          dismissalCount: row._count.dismissals,
        };

        return {
          ...row,
          active,
          stats,
        };
      }),
    );

    return {
      items: enriched,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async getAnnouncementById(
    id: string,
  ): Promise<PlatformAnnouncement & { active: boolean; stats: PlatformAnnouncementStats }> {
    const row = await this.prisma.unscoped.platformAnnouncement.findUnique({
      where: { id },
      include: {
        _count: {
          select: { dismissals: true, reads: true },
        },
      },
    });

    if (!row) {
      throw new NotFoundException(`Platform announcement with ID "${id}" not found`);
    }

    const now = Date.now();
    const startMs = new Date(row.startTime).getTime();
    const endMs = row.endTime ? new Date(row.endTime).getTime() : null;
    const active =
      row.status === PlatformAnnouncementStatus.published &&
      startMs <= now &&
      (!endMs || endMs >= now);

    const audience = await this.previewAudience({
      audienceType: row.audienceType,
      targetPlans: row.targetPlans,
      targetCountries: row.targetCountries,
      targetTenantIds: row.targetTenantIds,
      rolesOnly: row.rolesOnly,
    });

    return {
      ...row,
      active,
      stats: {
        targetTenantCount: audience.tenantCount,
        targetUserCount: audience.userCount,
        readCount: row._count.reads,
        dismissalCount: row._count.dismissals,
      },
    };
  }

  async createAnnouncement(
    input: CreatePlatformAnnouncementInput,
    actorUserId?: string,
    actorName?: string,
  ): Promise<PlatformAnnouncement> {
    this.validateDates(input.startTime, input.endTime);

    const announcement = await this.prisma.unscoped.platformAnnouncement.create({
      data: {
        title: input.title.trim(),
        body: input.body.trim(),
        severity: input.severity,
        audienceType: input.audienceType,
        targetPlans: input.targetPlans ?? [],
        targetCountries: input.targetCountries ?? [],
        targetTenantIds: input.targetTenantIds ?? [],
        rolesOnly: input.rolesOnly ?? false,
        startTime: new Date(input.startTime),
        endTime: input.endTime ? new Date(input.endTime) : null,
        dismissible: input.dismissible ?? true,
        sendEmail: input.sendEmail ?? false,
        status: input.status ?? PlatformAnnouncementStatus.draft,
        createdBy: actorUserId,
        createdByName: actorName || 'Platform Operator',
      },
    });

    await this.auditService.log({
      userId: actorUserId,
      action: 'platform_announcement.created',
      module: 'platform',
      recordId: announcement.id,
      reason: `Created announcement "${announcement.title}" (${announcement.severity}, ${announcement.audienceType})`,
      newValue: {
        title: announcement.title,
        severity: announcement.severity,
        audienceType: announcement.audienceType,
        rolesOnly: announcement.rolesOnly,
        status: announcement.status,
      },
    });

    if (announcement.status === PlatformAnnouncementStatus.published) {
      await this.dispatchAnnouncement(announcement);
    }

    return announcement;
  }

  async updateAnnouncement(
    id: string,
    input: UpdatePlatformAnnouncementInput,
    actorUserId?: string,
    actorName?: string,
  ): Promise<PlatformAnnouncement> {
    const existing = await this.prisma.unscoped.platformAnnouncement.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Platform announcement with ID "${id}" not found`);
    }

    const startTime = input.startTime ?? existing.startTime.toISOString();
    const endTime = input.endTime !== undefined ? input.endTime : (existing.endTime ? existing.endTime.toISOString() : null);
    this.validateDates(startTime, endTime);

    const updated = await this.prisma.unscoped.platformAnnouncement.update({
      where: { id },
      data: {
        title: input.title !== undefined ? input.title.trim() : undefined,
        body: input.body !== undefined ? input.body.trim() : undefined,
        severity: input.severity ?? undefined,
        audienceType: input.audienceType ?? undefined,
        targetPlans: input.targetPlans ?? undefined,
        targetCountries: input.targetCountries ?? undefined,
        targetTenantIds: input.targetTenantIds ?? undefined,
        rolesOnly: input.rolesOnly !== undefined ? input.rolesOnly : undefined,
        startTime: input.startTime ? new Date(input.startTime) : undefined,
        endTime: input.endTime !== undefined ? (input.endTime ? new Date(input.endTime) : null) : undefined,
        dismissible: input.dismissible !== undefined ? input.dismissible : undefined,
        sendEmail: input.sendEmail !== undefined ? input.sendEmail : undefined,
        status: input.status ?? undefined,
      },
    });

    await this.auditService.log({
      userId: actorUserId,
      action: 'platform_announcement.updated',
      module: 'platform',
      recordId: updated.id,
      reason: `Updated announcement "${updated.title}"`,
      oldValue: {
        title: existing.title,
        status: existing.status,
        severity: existing.severity,
      },
      newValue: {
        title: updated.title,
        status: updated.status,
        severity: updated.severity,
      },
    });

    // If transitioned to published from draft/archived, dispatch it!
    if (
      existing.status !== PlatformAnnouncementStatus.published &&
      updated.status === PlatformAnnouncementStatus.published
    ) {
      await this.dispatchAnnouncement(updated);
    }

    return updated;
  }

  async publishAnnouncement(
    id: string,
    actorUserId?: string,
    actorName?: string,
  ): Promise<PlatformAnnouncement> {
    return this.updateAnnouncement(
      id,
      { status: PlatformAnnouncementStatus.published },
      actorUserId,
      actorName,
    );
  }

  async archiveAnnouncement(
    id: string,
    actorUserId?: string,
    actorName?: string,
  ): Promise<PlatformAnnouncement> {
    return this.updateAnnouncement(
      id,
      { status: PlatformAnnouncementStatus.archived },
      actorUserId,
      actorName,
    );
  }

  async expireAnnouncement(
    id: string,
    actorUserId?: string,
    actorName?: string,
  ): Promise<PlatformAnnouncement> {
    const existing = await this.prisma.unscoped.platformAnnouncement.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Platform announcement with ID "${id}" not found`);
    }

    const updated = await this.prisma.unscoped.platformAnnouncement.update({
      where: { id },
      data: {
        endTime: new Date(),
      },
    });

    await this.auditService.log({
      userId: actorUserId,
      action: 'platform_announcement.expired',
      module: 'platform',
      recordId: id,
      reason: `Manually expired platform announcement "${existing.title}"`,
      oldValue: { endTime: existing.endTime },
      newValue: { endTime: updated.endTime },
    });

    return updated;
  }

  async deleteAnnouncement(
    id: string,
    actorUserId?: string,
  ): Promise<{ success: boolean }> {
    const existing = await this.prisma.unscoped.platformAnnouncement.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Platform announcement with ID "${id}" not found`);
    }

    await this.prisma.unscoped.platformAnnouncement.delete({
      where: { id },
    });

    await this.auditService.log({
      userId: actorUserId,
      action: 'platform_announcement.deleted',
      module: 'platform',
      recordId: id,
      reason: `Deleted platform announcement "${existing.title}"`,
      oldValue: { title: existing.title },
    });

    return { success: true };
  }

  // ==========================================================================
  // Audience Targeting & Recipient Preview
  // ==========================================================================

  async previewAudience(query: AudiencePreviewQuery): Promise<AudiencePreviewResult> {
    const tenants = await this.resolveTargetTenants(query);
    const tenantIds = tenants.map((t) => t.id);

    if (tenantIds.length === 0) {
      return { tenantCount: 0, userCount: 0, sampleTenants: [] };
    }

    // Resolve matching users across these tenants
    const userCount = await this.countTargetUsers(tenantIds, query.rolesOnly ?? false);

    const sampleTenants: AudiencePreviewSampleTenant[] = tenants.slice(0, 5).map((t) => ({
      id: t.id,
      name: t.name,
      subdomain: t.subdomain,
      planId: t.planId || 'trial',
      country: t.companies?.[0]?.countryId || null,
    }));

    return {
      tenantCount: tenants.length,
      userCount,
      sampleTenants,
    };
  }

  private async resolveTargetTenants(query: AudiencePreviewQuery) {
    const where: any = {
      status: { notIn: [TenantStatus.deleted, TenantStatus.pending_deletion] },
    };

    if (query.audienceType === 'by_plan' && query.targetPlans?.length) {
      where.planId = { in: query.targetPlans.map((p) => p.toLowerCase()) };
    } else if (
      query.audienceType === 'specific_tenants' &&
      query.targetTenantIds?.length
    ) {
      where.id = { in: query.targetTenantIds };
    }

    const allTenants = await this.prisma.unscoped.tenant.findMany({
      where,
      include: {
        companies: {
          select: { id: true, countryId: true },
        },
      },
    });

    if (query.audienceType === 'by_country' && query.targetCountries?.length) {
      const countrySet = new Set(
        query.targetCountries.map((c) => c.toUpperCase()),
      );
      return allTenants.filter((tenant) =>
        tenant.companies.some(
          (c) => c.countryId && countrySet.has(c.countryId.toUpperCase()),
        ),
      );
    }

    return allTenants;
  }

  private async countTargetUsers(tenantIds: string[], rolesOnly: boolean): Promise<number> {
    const where: any = {
      tenantId: { in: tenantIds },
      isActive: true,
    };

    if (rolesOnly) {
      // Find role IDs matching Company Owner or Admin roles
      where.role = {
        OR: [
          { dataScope: RoleDataScope.all },
          { name: { in: ['Company Owner', 'HR Admin', 'Payroll Admin', 'Admin'] } },
        ],
      };
    }

    return this.prisma.unscoped.user.count({ where });
  }

  // ==========================================================================
  // Tenant Portal Active Announcements & Dismissal
  // ==========================================================================

  async getActiveAnnouncementsForTenant(
    tenantId: string,
    userId: string,
    userRoleName?: string,
  ): Promise<TenantActiveAnnouncement[]> {
    const now = new Date();

    // 1. Fetch published announcements whose time window covers now
    const published = await this.prisma.unscoped.platformAnnouncement.findMany({
      where: {
        status: PlatformAnnouncementStatus.published,
        startTime: { lte: now },
        OR: [{ endTime: null }, { endTime: { gte: now } }],
      },
      include: {
        dismissals: {
          where: { userId },
        },
      },
      orderBy: [{ severity: 'desc' }, { startTime: 'desc' }],
    });

    if (published.length === 0) {
      return [];
    }

    // 2. Fetch current tenant metadata to evaluate audience match
    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id: tenantId },
      include: {
        companies: {
          select: { countryId: true },
        },
      },
    });

    if (!tenant) return [];

    const tenantCountries = new Set(
      tenant.companies
        .map((c) => c.countryId?.toUpperCase())
        .filter(Boolean) as string[],
    );

    const isCompanyAdmin =
      !userRoleName ||
      userRoleName.includes('Owner') ||
      userRoleName.includes('Admin');

    const results: TenantActiveAnnouncement[] = [];

    for (const item of published) {
      // Check if user already dismissed it
      if (item.dismissible && item.dismissals.length > 0) {
        continue;
      }

      // Check role restriction
      if (item.rolesOnly && !isCompanyAdmin) {
        continue;
      }

      // Check audience criteria
      let matches = false;
      switch (item.audienceType) {
        case 'all':
          matches = true;
          break;
        case 'by_plan':
          matches = item.targetPlans.some(
            (p) => p.toLowerCase() === (tenant.planId || '').toLowerCase(),
          );
          break;
        case 'by_country':
          matches = item.targetCountries.some((c) =>
            tenantCountries.has(c.toUpperCase()),
          );
          break;
        case 'specific_tenants':
          matches = item.targetTenantIds.includes(tenantId);
          break;
      }

      if (matches) {
        results.push({
          id: item.id,
          title: item.title,
          body: item.body,
          severity: item.severity,
          startTime: item.startTime.toISOString(),
          endTime: item.endTime ? item.endTime.toISOString() : null,
          dismissible: item.dismissible,
          rolesOnly: item.rolesOnly,
        });
      }
    }

    if (results.length > 0) {
      await Promise.allSettled(
        results.map((res) =>
          this.prisma.unscoped.platformAnnouncementRead.upsert({
            where: {
              announcementId_userId: {
                announcementId: res.id,
                userId,
              },
            },
            create: {
              announcementId: res.id,
              tenantId,
              userId,
            },
            update: {},
          }),
        ),
      );
    }

    return results;
  }

  async dismissAnnouncement(
    announcementId: string,
    tenantId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const announcement =
      await this.prisma.unscoped.platformAnnouncement.findUnique({
        where: { id: announcementId },
      });

    if (!announcement) {
      throw new NotFoundException('Platform announcement not found');
    }

    if (!announcement.dismissible) {
      throw new BadRequestException(
        'This critical platform notice is mandatory and cannot be dismissed.',
      );
    }

    await this.prisma.unscoped.platformAnnouncementDismissal.upsert({
      where: {
        announcementId_userId: {
          announcementId,
          userId,
        },
      },
      create: {
        announcementId,
        tenantId,
        userId,
      },
      update: {
        dismissedAt: new Date(),
      },
    });

    return { success: true };
  }

  async recordAnnouncementRead(
    announcementId: string,
    tenantId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.prisma.unscoped.platformAnnouncementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId,
          userId,
        },
      },
      create: {
        announcementId,
        tenantId,
        userId,
      },
      update: {},
    });

    return { success: true };
  }

  async previewAsTenantAdmin(
    query: TenantPreviewQuery,
  ): Promise<TenantPreviewResult> {
    // 1. Locate tenant
    let tenant = null;
    if (query.tenantId) {
      tenant = await this.prisma.unscoped.tenant.findUnique({
        where: { id: query.tenantId },
        include: { companies: { select: { id: true, countryId: true } } },
      });
    }

    if (!tenant && query.planId) {
      tenant = await this.prisma.unscoped.tenant.findFirst({
        where: {
          planId: query.planId.toLowerCase(),
          status: { notIn: [TenantStatus.deleted, TenantStatus.pending_deletion] },
        },
        include: { companies: { select: { id: true, countryId: true } } },
      });
    }

    if (!tenant) {
      tenant = await this.prisma.unscoped.tenant.findFirst({
        where: { status: { notIn: [TenantStatus.deleted, TenantStatus.pending_deletion] } },
        include: { companies: { select: { id: true, countryId: true } } },
      });
    }

    const tenantInfo = {
      id: tenant?.id || 'sample-tenant-uuid',
      name: tenant?.name || 'Acme Technologies Inc.',
      subdomain: tenant?.subdomain || 'acme',
      planId: (query.planId || tenant?.planId || 'enterprise').toLowerCase(),
      country: (query.country || tenant?.companies?.[0]?.countryId || 'BD').toUpperCase(),
      roleName: query.roleName || 'Company Owner',
    };

    // 2. Fetch or mock announcement
    let announcement: any = null;
    if (query.announcementId) {
      announcement = await this.prisma.unscoped.platformAnnouncement.findUnique({
        where: { id: query.announcementId },
      });
    }

    if (!announcement && query.announcementData) {
      announcement = {
        id: 'simulated-preview-announcement',
        title: query.announcementData.title || 'Platform Announcement Notice',
        body: query.announcementData.body || 'Simulated announcement preview.',
        severity: query.announcementData.severity || 'info',
        audienceType: query.announcementData.audienceType || 'all',
        targetPlans: query.announcementData.targetPlans || [],
        targetCountries: query.announcementData.targetCountries || [],
        targetTenantIds: query.announcementData.targetTenantIds || [],
        rolesOnly: query.announcementData.rolesOnly ?? false,
        startTime: new Date(),
        endTime: null,
        dismissible: query.announcementData.dismissible ?? true,
      };
    }

    if (!announcement) {
      return {
        matches: false,
        matchReasons: ['No announcement found to preview.'],
        banner: null,
        tenantInfo,
      };
    }

    // 3. Evaluate criteria
    const matchReasons: string[] = [];
    let matches = true;

    // Check Role restriction
    const isCompanyAdmin =
      tenantInfo.roleName.includes('Owner') || tenantInfo.roleName.includes('Admin');

    if (announcement.rolesOnly) {
      if (isCompanyAdmin) {
        matchReasons.push(`Role "${tenantInfo.roleName}" qualifies under Company Owner & Administrator restriction.`);
      } else {
        matches = false;
        matchReasons.push(`Role "${tenantInfo.roleName}" does NOT qualify (limited to Company Owners and Admins).`);
      }
    } else {
      matchReasons.push('Available to all tenant user roles.');
    }

    // Check audience type
    switch (announcement.audienceType) {
      case 'all':
        matchReasons.push('Broadcast reaches all tenants network-wide.');
        break;
      case 'by_plan':
        if (announcement.targetPlans.some((p: string) => p.toLowerCase() === tenantInfo.planId)) {
          matchReasons.push(`Tenant plan "${tenantInfo.planId}" matches targeted plans [${announcement.targetPlans.join(', ')}].`);
        } else {
          matches = false;
          matchReasons.push(`Tenant plan "${tenantInfo.planId}" does not match targeted plans [${announcement.targetPlans.join(', ')}].`);
        }
        break;
      case 'by_country':
        if (announcement.targetCountries.some((c: string) => c.toUpperCase() === tenantInfo.country)) {
          matchReasons.push(`Tenant country "${tenantInfo.country}" matches targeted countries [${announcement.targetCountries.join(', ')}].`);
        } else {
          matches = false;
          matchReasons.push(`Tenant country "${tenantInfo.country}" does not match targeted countries [${announcement.targetCountries.join(', ')}].`);
        }
        break;
      case 'specific_tenants':
        if (announcement.targetTenantIds.includes(tenantInfo.id)) {
          matchReasons.push(`Tenant ID "${tenantInfo.id}" is explicitly included in target tenant list.`);
        } else {
          matches = false;
          matchReasons.push(`Tenant ID "${tenantInfo.id}" is NOT included in target tenant list.`);
        }
        break;
    }

    const banner: TenantActiveAnnouncement = {
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      severity: announcement.severity,
      startTime: new Date(announcement.startTime).toISOString(),
      endTime: announcement.endTime ? new Date(announcement.endTime).toISOString() : null,
      dismissible: announcement.dismissible,
      rolesOnly: announcement.rolesOnly,
    };

    return {
      matches,
      matchReasons,
      banner: matches ? banner : null,
      tenantInfo,
    };
  }

  // ==========================================================================
  // Notification Engine Delivery (In-App Banner + Optional Email)
  // ==========================================================================

  private async dispatchAnnouncement(announcement: PlatformAnnouncement): Promise<void> {
    this.logger.log(
      `Dispatching announcement "${announcement.title}" (${announcement.severity}, audience: ${announcement.audienceType}) via Notification Engine`,
    );

    const tenants = await this.resolveTargetTenants({
      audienceType: announcement.audienceType,
      targetPlans: announcement.targetPlans,
      targetCountries: announcement.targetCountries,
      targetTenantIds: announcement.targetTenantIds,
      rolesOnly: announcement.rolesOnly,
    });

    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length === 0) return;

    // Resolve users to deliver in-app notifications
    const usersWhere: any = {
      tenantId: { in: tenantIds },
      isActive: true,
    };

    if (announcement.rolesOnly) {
      usersWhere.role = {
        OR: [
          { dataScope: RoleDataScope.all },
          { name: { in: ['Company Owner', 'HR Admin', 'Payroll Admin', 'Admin'] } },
        ],
      };
    }

    const targetUsers = await this.prisma.unscoped.user.findMany({
      where: usersWhere,
      select: {
        id: true,
        email: true,
        tenantId: true,
      },
    });

    this.logger.log(
      `Delivering platform announcement to ${targetUsers.length} users across ${tenants.length} tenants`,
    );

    // 1. Create InAppNotification records if delivery service is available
    if (this.notificationDeliveryService) {
      for (const u of targetUsers) {
        if (!u.tenantId) continue;
        const tenant = tenants.find((t) => t.id === u.tenantId);
        const companyId = tenant?.companies?.[0]?.id || u.tenantId;

        void this.notificationDeliveryService.deliverInApp({
          tenantId: u.tenantId,
          companyId,
          userId: u.id,
          eventType: 'platform.announcement',
          title: `[Notice] ${announcement.title}`,
          body: announcement.body,
          payload: {
            announcementId: announcement.id,
            severity: announcement.severity,
            dismissible: announcement.dismissible,
          },
        });
      }
    }

    // 2. Deliver Optional Email Broadcast
    if (announcement.sendEmail && this.notificationDeliveryService) {
      for (const u of targetUsers) {
        if (!u.email || !u.tenantId) continue;
        const tenant = tenants.find((t) => t.id === u.tenantId);
        const companyId = tenant?.companies?.[0]?.id || u.tenantId;

        const subject = `[CMSN-HR Platform ${announcement.severity.toUpperCase()}] ${announcement.title}`;
        const escapedTitle = escapeHtml(announcement.title);
        const escapedBody = escapeHtml(announcement.body).replace(/\n/g, '<br/>');

        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <div style="border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px;">
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: ${
                announcement.severity === 'critical' ? '#e11d48' : announcement.severity === 'warning' ? '#d97706' : '#2563eb'
              };">${announcement.severity.toUpperCase()} NOTICE</span>
              <h2 style="margin: 6px 0 0 0; color: #0f172a; font-size: 20px;">${escapedTitle}</h2>
            </div>
            <div style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
              ${escapedBody}
            </div>
            <div style="padding-top: 16px; border-top: 1px solid #f1f5f9; color: #94a3b8; font-size: 11px;">
              This is a platform-wide operational announcement from CMSN-HR Platform Administration.
            </div>
          </div>
        `;

        void this.notificationDeliveryService.deliverEmailWithRetry({
          tenantId: u.tenantId,
          companyId,
          eventType: 'platform.announcement.email',
          toEmail: u.email,
          recipientUserId: u.id,
          subject,
          text: `${announcement.title}\n\n${announcement.body}`,
          html,
          payload: {
            announcementId: announcement.id,
            severity: announcement.severity,
          },
        });
      }

      await this.prisma.unscoped.platformAnnouncement.update({
        where: { id: announcement.id },
        data: { emailSentAt: new Date() },
      });

      await this.auditService.log({
        userId: announcement.createdBy || undefined,
        action: 'platform_announcement.email_broadcast',
        module: 'platform',
        recordId: announcement.id,
        reason: `Dispatched announcement email broadcast to ${targetUsers.length} recipients`,
      });
    }
  }

  private validateDates(startIso: string, endIso?: string | null) {
    const startMs = new Date(startIso).getTime();
    if (isNaN(startMs)) {
      throw new BadRequestException('Invalid start time format');
    }

    if (endIso) {
      const endMs = new Date(endIso).getTime();
      if (isNaN(endMs)) {
        throw new BadRequestException('Invalid end time format');
      }
      if (endMs <= startMs) {
        throw new BadRequestException('End time must be strictly after start time');
      }
    }
  }
}
