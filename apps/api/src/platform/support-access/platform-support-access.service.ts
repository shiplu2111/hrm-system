import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import type {
  ImpersonationTokenResponse,
  PaginatedSupportSessions,
  SupportAccessRequestRecord,
  SupportSessionListItem,
  SupportSessionStats,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { NotificationDeliveryService } from '../../notifications/notification-delivery.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import {
  CreateSupportAccessRequestDto,
  RevokeSupportAccessSessionDto,
} from './dto/platform-support-access.dto';
import { QuerySupportSessionsDto } from './dto/platform-support-sessions.dto';

interface PlatformStaffIdentity {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleName: string;
}

@Injectable()
export class PlatformSupportAccessService {
  private readonly logger = new Logger(PlatformSupportAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly platformAudit: PlatformAuditService,
    private readonly notificationDelivery: NotificationDeliveryService,
  ) {}

  /**
   * Request support access for a tenant (SECURITY.md, AUDIT_LOG.md).
   * Duration max 4 hours (240 minutes). Reason mandatory (min 10 chars).
   * If tenant has pre-authorised support access in settings, auto-approve immediately;
   * otherwise creates pending request and triggers email + in-app notification to Company Owner.
   */
  async requestAccess(
    tenantId: string,
    dto: CreateSupportAccessRequestDto,
    staff: PlatformStaffIdentity,
  ): Promise<SupportAccessRequestRecord> {
    if (!dto.reason || dto.reason.trim().length < 10) {
      throw new BadRequestException({
        code: 'INVALID_REASON',
        message: 'A clear reason for support access is required (minimum 10 characters).',
      });
    }

    if (dto.durationMinutes < 15 || dto.durationMinutes > 240) {
      throw new BadRequestException({
        code: 'INVALID_DURATION',
        message: 'Support access duration must be between 15 and 240 minutes (maximum 4 hours).',
      });
    }

    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id: tenantId },
      include: {
        companies: {
          select: { id: true, name: true },
          take: 1,
        },
      },
    });

    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant workspace not found',
      });
    }

    const companyId = tenant.companies[0]?.id;

    // Check if tenant has pre-authorized support access in tenant settings
    const preauthSetting = await this.prisma.unscoped.tenantSetting.findUnique({
      where: {
        tenantId_category_key: {
          tenantId,
          category: 'security',
          key: 'support_access',
        },
      },
    });

    const isPreauthorized =
      preauthSetting?.value &&
      typeof preauthSetting.value === 'object' &&
      (preauthSetting.value as { preauthorized?: boolean }).preauthorized === true;

    const accessMode = dto.accessMode ?? 'read_only';
    const now = new Date();
    const expiresAt = isPreauthorized
      ? new Date(now.getTime() + dto.durationMinutes * 60 * 1000)
      : null;

    const request = await this.prisma.unscoped.supportAccessRequest.create({
      data: {
        tenantId,
        platformUserId: staff.id,
        staffName: `${staff.firstName} ${staff.lastName}`.trim(),
        staffEmail: staff.email,
        reason: dto.reason.trim(),
        durationMinutes: dto.durationMinutes,
        accessMode,
        status: isPreauthorized ? 'approved' : 'pending',
        autoApproved: Boolean(isPreauthorized),
        approvedAt: isPreauthorized ? now : null,
        expiresAt,
      },
    });

    // Find Company Owner users of this tenant for notifications
    const owners = await this.findTenantOwners(tenantId);

    if (isPreauthorized) {
      // Auto-approved! Dual audit log
      await this.platformAudit.log({
        userId: staff.id,
        action: 'support_access.auto_approved',
        module: 'support_access',
        recordId: tenantId,
        reason: `Auto-approved support session (${accessMode}, ${dto.durationMinutes}m) via tenant pre-authorisation setting. Reason: ${dto.reason}`,
        newValue: {
          requestId: request.id,
          accessMode,
          durationMinutes: dto.durationMinutes,
          expiresAt: expiresAt?.toISOString(),
        },
      });

      // Write to tenant audit_logs with staff name clearly visible
      await this.prisma.unscoped.auditLog.create({
        data: {
          tenantId,
          userId: owners[0]?.id ?? staff.id,
          action: 'create',
          module: 'support_access',
          recordId: request.id,
          device: `Platform Support: ${request.staffName} (${request.staffEmail})`,
          newValue: {
            event: 'support_access_auto_approved',
            staffName: request.staffName,
            staffEmail: request.staffEmail,
            durationMinutes: dto.durationMinutes,
            accessMode,
            reason: dto.reason,
            expiresAt: expiresAt?.toISOString(),
          },
        },
      });

      // Notify owners of auto-activation
      for (const owner of owners) {
        if (companyId) {
          await this.notificationDelivery.deliverInApp({
            tenantId,
            companyId,
            userId: owner.id,
            eventType: 'support.access_granted',
            title: 'Platform Support Session Activated (Pre-authorised)',
            body: `Platform engineer ${request.staffName} has activated a ${dto.durationMinutes}-minute ${accessMode} support session. Reason: "${dto.reason}". All actions are tracked in your Audit Log.`,
            payload: {
              requestId: request.id,
              tenantId,
              mode: accessMode,
              durationMinutes: dto.durationMinutes,
            },
          });

          await this.notificationDelivery.deliverEmailWithRetry({
            tenantId,
            companyId,
            eventType: 'support.access_granted',
            toEmail: owner.email,
            recipientUserId: owner.id,
            subject: `[HRM Security] Support Access Session Activated for ${tenant.name}`,
            text: `Platform engineer ${request.staffName} (${request.staffEmail}) has activated a ${dto.durationMinutes}-minute ${accessMode} session under your workspace pre-authorisation settings.\n\nReason: "${dto.reason}"\nExpires: ${expiresAt?.toISOString()}`,
            html: `<p>Platform engineer <strong>${request.staffName}</strong> (<em>${request.staffEmail}</em>) has activated a <strong>${dto.durationMinutes}-minute (${accessMode})</strong> support session under your workspace pre-authorisation policy.</p><p><strong>Reason:</strong> ${dto.reason}</p><p>All actions are strictly audited and logged directly in your tenant audit log. Payroll finalization, payments, and full banking credentials remain cryptographically blocked.</p>`,
            payload: { requestId: request.id },
          });
        }
      }
    } else {
      // Pending owner approval
      await this.platformAudit.log({
        userId: staff.id,
        action: 'support_access.requested',
        module: 'support_access',
        recordId: tenantId,
        reason: `Requested support access (${accessMode}, ${dto.durationMinutes}m) awaiting Company Owner approval. Reason: ${dto.reason}`,
        newValue: {
          requestId: request.id,
          accessMode,
          durationMinutes: dto.durationMinutes,
        },
      });

      // Notify owners of pending request
      for (const owner of owners) {
        if (companyId) {
          await this.notificationDelivery.deliverInApp({
            tenantId,
            companyId,
            userId: owner.id,
            eventType: 'support.access_requested',
            title: 'Platform Support Access Requested',
            body: `Platform engineer ${request.staffName} has requested ${accessMode} access for ${dto.durationMinutes} minutes. Reason: "${dto.reason}". Please review in Security Settings.`,
            payload: {
              requestId: request.id,
              tenantId,
              mode: accessMode,
              durationMinutes: dto.durationMinutes,
            },
          });

          await this.notificationDelivery.deliverEmailWithRetry({
            tenantId,
            companyId,
            eventType: 'support.access_requested',
            toEmail: owner.email,
            recipientUserId: owner.id,
            subject: `[HRM Security] Approval Required: Platform Support Access Request for ${tenant.name}`,
            text: `Platform engineer ${request.staffName} (${request.staffEmail}) has requested ${accessMode} support access to ${tenant.name} for ${dto.durationMinutes} minutes.\n\nReason: "${dto.reason}"\n\nPlease sign in to your HRM admin portal to approve or reject this request.`,
            html: `<p>Platform engineer <strong>${request.staffName}</strong> (${request.staffEmail}) has requested <strong>${accessMode} support access</strong> to your workspace for ${dto.durationMinutes} minutes.</p><p><strong>Reason:</strong> ${dto.reason}</p><p>Please review and approve or reject this request in your workspace <strong>Settings &rarr; Security</strong>.</p>`,
            payload: { requestId: request.id },
          });
        }
      }
    }

    return this.toRecord(request, tenant);
  }

  /**
   * List support access requests for a tenant, automatically auto-expiring overdue requests.
   */
  async listRequests(tenantId?: string): Promise<SupportAccessRequestRecord[]> {
    await this.expireOverdueRequests();

    const rows = await this.prisma.unscoped.supportAccessRequest.findMany({
      where: tenantId ? { tenantId } : {},
      include: {
        tenant: {
          select: { id: true, name: true, subdomain: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return rows.map((r) => this.toRecord(r, r.tenant));
  }

  /**
   * Get active approved session for tenant.
   */
  async getActiveSession(tenantId: string): Promise<SupportAccessRequestRecord | null> {
    await this.expireOverdueRequests();

    const row = await this.prisma.unscoped.supportAccessRequest.findFirst({
      where: {
        tenantId,
        status: 'approved',
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        tenant: {
          select: { id: true, name: true, subdomain: true },
        },
      },
      orderBy: { approvedAt: 'desc' },
    });

    return row ? this.toRecord(row, row.tenant) : null;
  }

  /**
   * Issue short-lived impersonation token for approved support access grant.
   * Scoped to named tenant. Read-only by default.
   */
  async issueImpersonationToken(
    requestId: string,
    staff: PlatformStaffIdentity,
  ): Promise<ImpersonationTokenResponse> {
    await this.expireOverdueRequests();

    const request = await this.prisma.unscoped.supportAccessRequest.findUnique({
      where: { id: requestId },
      include: {
        tenant: {
          select: { id: true, name: true, subdomain: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Support access request not found',
      });
    }

    if (request.status !== 'approved' || request.revokedAt !== null) {
      throw new BadRequestException({
        code: 'SUPPORT_GRANT_NOT_ACTIVE',
        message: `Support access grant is in status "${request.status}" and cannot be launched.`,
      });
    }

    if (!request.expiresAt || request.expiresAt < new Date()) {
      await this.prisma.unscoped.supportAccessRequest.update({
        where: { id: requestId },
        data: { status: 'expired' },
      });
      throw new BadRequestException({
        code: 'SUPPORT_GRANT_EXPIRED',
        message: 'Support access grant has expired.',
      });
    }

    // Find Company Owner user in tenant to impersonate
    const targetUser = await this.findImpersonationUser(request.tenantId);
    if (!targetUser) {
      throw new BadRequestException({
        code: 'NO_TENANT_USER',
        message: 'Tenant workspace has no eligible user accounts to impersonate.',
      });
    }

    const remainingMs = request.expiresAt.getTime() - Date.now();
    const remainingSeconds = Math.max(1, Math.floor(remainingMs / 1000));
    const tokenJti = randomUUID();

    const jwtSecret =
      process.env.JWT_ACCESS_SECRET ?? 'hrm_secret_jwt_access_super_secure_2026';

    const permissions = (targetUser.role?.permissions ?? []).map((p: any) => ({
      module: p.module,
      action: p.action,
    }));

    const accessToken = await this.jwtService.signAsync(
      {
        sub: targetUser.id,
        tenant_id: request.tenantId,
        tenant_name: request.tenant?.name ?? 'Workspace',
        role_id: targetUser.roleId,
        role_name: targetUser.role?.name ?? 'Company Owner',
        employee_id: targetUser.employeeId ?? null,
        permissions,
        data_scope: targetUser.role?.dataScope ?? 'all',
        must_change_password: false,
        // Support access specific claims
        support_access: true,
        support_request_id: request.id,
        platform_user_id: staff.id,
        staff_name: request.staffName,
        staff_email: request.staffEmail,
        access_mode: request.accessMode,
        jti: tokenJti,
      },
      {
        secret: jwtSecret,
        expiresIn: `${remainingSeconds}s`,
      },
    );

    // Save token JTI
    await this.prisma.unscoped.supportAccessRequest.update({
      where: { id: requestId },
      data: { tokenJti },
    });

    // Dual Audit Log: Issue impersonation token
    await this.platformAudit.log({
      userId: staff.id,
      action: 'support_access.token_issued',
      module: 'support_access',
      recordId: request.tenantId,
      reason: `Issued support impersonation token (${request.accessMode}, expires in ${Math.round(remainingSeconds / 60)}m) for ${request.staffName}`,
      newValue: {
        requestId: request.id,
        impersonatedUserId: targetUser.id,
        accessMode: request.accessMode,
        expiresAt: request.expiresAt.toISOString(),
      },
    });

    await this.prisma.unscoped.auditLog.create({
      data: {
        tenantId: request.tenantId,
        userId: targetUser.id,
        action: 'create',
        module: 'support_access',
        recordId: request.id,
        device: `Platform Support: ${request.staffName} (${request.staffEmail})`,
        newValue: {
          event: 'support_token_issued',
          staffName: request.staffName,
          staffEmail: request.staffEmail,
          accessMode: request.accessMode,
          expiresAt: request.expiresAt.toISOString(),
        },
      },
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresAt: request.expiresAt.toISOString(),
      accessMode: request.accessMode as any,
      tenantId: request.tenantId,
      tenantName: request.tenant.name,
      tenantSubdomain: request.tenant.subdomain,
      staffName: request.staffName,
      staffEmail: request.staffEmail,
      requestId: request.id,
    };
  }

  /**
   * Terminate active support access session early.
   */
  async revokeSession(
    requestId: string,
    dto: RevokeSupportAccessSessionDto,
    staff: PlatformStaffIdentity,
  ): Promise<SupportAccessRequestRecord> {
    const request = await this.prisma.unscoped.supportAccessRequest.findUnique({
      where: { id: requestId },
      include: {
        tenant: {
          select: { id: true, name: true, subdomain: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Support access request not found',
      });
    }

    const updated = await this.prisma.unscoped.supportAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
        revokedByUserId: staff.id,
        revokedReason: dto.reason.trim(),
      },
      include: {
        tenant: {
          select: { id: true, name: true, subdomain: true },
        },
      },
    });

    // Dual Audit Log: Revocation
    await this.platformAudit.log({
      userId: staff.id,
      action: 'support_access.revoked',
      module: 'support_access',
      recordId: request.tenantId,
      reason: `Support access session terminated by platform staff: ${dto.reason}`,
      newValue: {
        requestId: request.id,
        revokedReason: dto.reason,
      },
    });

    await this.prisma.unscoped.auditLog.create({
      data: {
        tenantId: request.tenantId,
        userId: staff.id,
        action: 'suspend',
        module: 'support_access',
        recordId: request.id,
        device: `Platform Support: ${request.staffName} (${request.staffEmail})`,
        newValue: {
          event: 'support_access_revoked',
          revokedBy: `${staff.firstName} ${staff.lastName}`,
          reason: dto.reason,
        },
      },
    });

    return this.toRecord(updated, updated.tenant);
  }

  private async expireOverdueRequests(): Promise<void> {
    try {
      await this.prisma.unscoped.supportAccessRequest.updateMany({
        where: {
          status: 'approved',
          revokedAt: null,
          expiresAt: { lt: new Date() },
        },
        data: {
          status: 'expired',
        },
      });
    } catch (err) {
      this.logger.warn(`Failed expiring overdue support requests: ${err}`);
    }
  }

  private async findTenantOwners(tenantId: string) {
    const owners = await this.prisma.unscoped.user.findMany({
      where: {
        tenantId,
        role: { name: 'Company Owner' },
      },
      select: { id: true, email: true },
    });

    if (owners.length > 0) return owners;

    // Fallback: any active user in tenant
    return this.prisma.unscoped.user.findMany({
      where: { tenantId },
      select: { id: true, email: true },
      take: 2,
    });
  }

  private async findImpersonationUser(tenantId: string) {
    return (
      (await this.prisma.unscoped.user.findFirst({
        where: {
          tenantId,
          role: { name: 'Company Owner' },
        },
        include: {
          role: {
            include: {
              permissions: true,
            },
          },
        },
      })) ??
      (await this.prisma.unscoped.user.findFirst({
        where: { tenantId },
        include: {
          role: {
            include: {
              permissions: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }))
    );
  }

  /**
   * List all support access sessions across tenants with pagination, filters, and actions count.
   */
  async listAllSessions(
    query: QuerySupportSessionsDto,
  ): Promise<PaginatedSupportSessions> {
    await this.expireOverdueRequests();

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    if (query.accessMode && query.accessMode !== 'all') {
      where.accessMode = query.accessMode;
    }

    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { staffName: { contains: term, mode: 'insensitive' } },
        { staffEmail: { contains: term, mode: 'insensitive' } },
        { reason: { contains: term, mode: 'insensitive' } },
        { tenant: { name: { contains: term, mode: 'insensitive' } } },
        { tenant: { subdomain: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const orderBy: any = {};
    const sortField = query.sortBy ?? 'createdAt';
    const sortDir = query.sortDir ?? 'desc';
    if (sortField !== 'actionsCount') {
      orderBy[sortField] = sortDir;
    } else {
      orderBy.createdAt = 'desc';
    }

    const [total, rows] = await Promise.all([
      this.prisma.unscoped.supportAccessRequest.count({ where }),
      this.prisma.unscoped.supportAccessRequest.findMany({
        where,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              subdomain: true,
            },
          },
          platformUser: {
            include: {
              role: { select: { id: true, name: true } },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const ids = rows.map((r) => r.id);
    const countsMap = new Map<string, number>();

    if (ids.length > 0) {
      const auditGroups = await this.prisma.unscoped.auditLog.groupBy({
        by: ['recordId'],
        where: {
          recordId: { in: ids },
          module: 'support_access',
        },
        _count: { _all: true },
      });
      for (const ag of auditGroups) {
        if (ag.recordId) {
          countsMap.set(ag.recordId, ag._count._all);
        }
      }
    }

    let items: SupportSessionListItem[] = rows.map((r) => {
      const rec = this.toRecord(r, r.tenant);
      return {
        ...rec,
        tenantName: r.tenant?.name ?? 'Unknown Workspace',
        tenantSubdomain: r.tenant?.subdomain ?? '',
        tenantCountryCode: (r.tenant as any)?.countryCode ?? undefined,
        platformUserRoleName: r.platformUser?.role?.name ?? 'Platform Staff',
        actionsCount: countsMap.get(r.id) ?? 0,
      };
    });

    if (sortField === 'actionsCount') {
      items.sort((a, b) =>
        sortDir === 'asc'
          ? a.actionsCount - b.actionsCount
          : b.actionsCount - a.actionsCount,
      );
    }

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Aggregate support access stats for summary cards.
   */
  async getSupportStats(): Promise<SupportSessionStats> {
    await this.expireOverdueRequests();

    const [
      totalSessions,
      activeSessions,
      totalActionsTaken,
      preauthorizedCount,
      readWriteCount,
      avgDuration,
    ] = await Promise.all([
      this.prisma.unscoped.supportAccessRequest.count(),
      this.prisma.unscoped.supportAccessRequest.count({
        where: {
          status: 'approved',
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
      this.prisma.unscoped.auditLog.count({
        where: {
          module: 'support_access',
        },
      }),
      this.prisma.unscoped.supportAccessRequest.count({
        where: { autoApproved: true },
      }),
      this.prisma.unscoped.supportAccessRequest.count({
        where: { accessMode: 'read_write' },
      }),
      this.prisma.unscoped.supportAccessRequest.aggregate({
        _avg: { durationMinutes: true },
      }),
    ]);

    return {
      totalSessions,
      activeSessions,
      totalActionsTaken,
      preauthorizedCount,
      readWriteCount,
      avgDurationMinutes: Math.round(avgDuration._avg.durationMinutes ?? 60),
    };
  }

  private toRecord(r: any, tenant?: { id: string; name: string; subdomain: string }): SupportAccessRequestRecord {
    return {
      id: r.id,
      tenantId: r.tenantId,
      tenantName: tenant?.name ?? '',
      tenantSubdomain: tenant?.subdomain ?? '',
      platformUserId: r.platformUserId,
      staffName: r.staffName,
      staffEmail: r.staffEmail,
      reason: r.reason,
      durationMinutes: r.durationMinutes,
      accessMode: r.accessMode,
      status: r.status,
      autoApproved: r.autoApproved,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      approvedByUserId: r.approvedByUserId ?? null,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      revokedAt: r.revokedAt?.toISOString() ?? null,
      revokedByUserId: r.revokedByUserId ?? null,
      revokedReason: r.revokedReason ?? null,
      tokenJti: r.tokenJti ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
