import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  SupportAccessRequestRecord,
  TenantSecuritySettings,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { PlatformAuditService } from '../platform/audit/platform-audit.service';
import {
  ApproveSupportAccessRequestDto,
  RejectSupportAccessRequestDto,
  RevokeSupportAccessRequestDto,
} from './dto/tenant-security.dto';

@Injectable()
export class TenantSecurityService {
  private readonly logger = new Logger(TenantSecurityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  /**
   * Get tenant security settings & recent support access requests.
   */
  async getSecuritySettings(
    tenantId: string,
  ): Promise<{
    settings: TenantSecuritySettings;
    requests: SupportAccessRequestRecord[];
  }> {
    const settingRow = await this.prisma.unscoped.tenantSetting.findUnique({
      where: {
        tenantId_category_key: {
          tenantId,
          category: 'security',
          key: 'support_access',
        },
      },
    });

    const preauthorized =
      settingRow?.value &&
      typeof settingRow.value === 'object' &&
      (settingRow.value as { preauthorized?: boolean }).preauthorized === true;

    // Auto-expire overdue requests
    await this.prisma.unscoped.supportAccessRequest.updateMany({
      where: {
        tenantId,
        status: 'approved',
        revokedAt: null,
        expiresAt: { lt: new Date() },
      },
      data: { status: 'expired' },
    });

    const requests = await this.prisma.unscoped.supportAccessRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      settings: {
        preauthorizedSupportAccess: Boolean(preauthorized),
        updatedAt: settingRow?.updatedAt?.toISOString(),
        updatedBy: settingRow?.updatedBy,
      },
      requests: requests.map((r) => this.toRecord(r)),
    };
  }

  /**
   * Update pre-authorization for platform support access.
   * Gated to Company Owner / Admin.
   */
  async updatePreauthorization(
    tenantId: string,
    preauthorized: boolean,
    user: AuthenticatedUser,
  ): Promise<TenantSecuritySettings> {
    const row = await this.prisma.unscoped.tenantSetting.upsert({
      where: {
        tenantId_category_key: {
          tenantId,
          category: 'security',
          key: 'support_access',
        },
      },
      create: {
        tenantId,
        category: 'security',
        key: 'support_access',
        value: {
          preauthorized,
          updatedAt: new Date().toISOString(),
          updatedBy: user.id,
        },
        updatedBy: user.id,
      },
      update: {
        value: {
          preauthorized,
          updatedAt: new Date().toISOString(),
          updatedBy: user.id,
        },
        updatedBy: user.id,
      },
    });

    // Dual Audit Log
    await this.prisma.unscoped.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: 'update',
        module: 'settings',
        recordId: row.id,
        newValue: { preauthorizedSupportAccess: preauthorized },
        device: `Tenant Admin (${user.roleName})`,
      },
    });

    await this.platformAudit.log({
      userId: null,
      action: 'tenant.security_settings_updated',
      module: 'tenant_settings',
      recordId: tenantId,
      reason: `Tenant updated pre-authorised support access to ${preauthorized}`,
      newValue: { preauthorizedSupportAccess: preauthorized, updatedByUserId: user.id },
    });

    return {
      preauthorizedSupportAccess: preauthorized,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
    };
  }

  /**
   * Company Owner approves a pending support access request.
   */
  async approveRequest(
    tenantId: string,
    requestId: string,
    dto: ApproveSupportAccessRequestDto,
    user: AuthenticatedUser,
  ): Promise<SupportAccessRequestRecord> {
    const request = await this.prisma.unscoped.supportAccessRequest.findFirst({
      where: { id: requestId, tenantId },
    });

    if (!request) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Support access request not found',
      });
    }

    if (request.status !== 'pending') {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `Request is in status "${request.status}" and cannot be approved.`,
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + request.durationMinutes * 60 * 1000);
    const accessMode = dto.accessMode ?? request.accessMode;

    const updated = await this.prisma.unscoped.supportAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        accessMode,
        approvedAt: now,
        approvedByUserId: user.id,
        expiresAt,
      },
    });

    // Dual Audit Log
    await this.prisma.unscoped.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: 'approve',
        module: 'support_access',
        recordId: requestId,
        device: `Tenant Owner Approval (${user.roleName})`,
        newValue: {
          action: 'support_request_approved',
          staffName: request.staffName,
          staffEmail: request.staffEmail,
          accessMode,
          durationMinutes: request.durationMinutes,
          expiresAt: expiresAt.toISOString(),
        },
      },
    });

    await this.platformAudit.log({
      userId: request.platformUserId,
      action: 'support_access.approved_by_tenant',
      module: 'support_access',
      recordId: tenantId,
      reason: `Company Owner approved support access (${accessMode}, ${request.durationMinutes}m) for ${request.staffName}`,
      newValue: {
        requestId,
        approvedByUserId: user.id,
        accessMode,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return this.toRecord(updated);
  }

  /**
   * Company Owner rejects a pending support access request.
   */
  async rejectRequest(
    tenantId: string,
    requestId: string,
    dto: RejectSupportAccessRequestDto,
    user: AuthenticatedUser,
  ): Promise<SupportAccessRequestRecord> {
    const request = await this.prisma.unscoped.supportAccessRequest.findFirst({
      where: { id: requestId, tenantId },
    });

    if (!request) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Support access request not found',
      });
    }

    if (request.status !== 'pending') {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `Request is in status "${request.status}" and cannot be rejected.`,
      });
    }

    const updated = await this.prisma.unscoped.supportAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        revokedReason: dto.reason?.trim() ?? 'Rejected by Company Owner',
      },
    });

    // Dual Audit Log
    await this.prisma.unscoped.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: 'reject',
        module: 'support_access',
        recordId: requestId,
        device: `Tenant Owner Rejection (${user.roleName})`,
        newValue: {
          action: 'support_request_rejected',
          staffName: request.staffName,
          reason: dto.reason ?? null,
        },
      },
    });

    await this.platformAudit.log({
      userId: request.platformUserId,
      action: 'support_access.rejected_by_tenant',
      module: 'support_access',
      recordId: tenantId,
      reason: `Company Owner rejected support access request: ${dto.reason ?? 'No reason provided'}`,
      newValue: {
        requestId,
        rejectedByUserId: user.id,
        reason: dto.reason ?? null,
      },
    });

    return this.toRecord(updated);
  }

  /**
   * Company Owner revokes an active support access session immediately.
   */
  async revokeActiveSession(
    tenantId: string,
    requestId: string,
    dto: RevokeSupportAccessRequestDto,
    user: AuthenticatedUser,
  ): Promise<SupportAccessRequestRecord> {
    const request = await this.prisma.unscoped.supportAccessRequest.findFirst({
      where: { id: requestId, tenantId },
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
        revokedByUserId: user.id,
        revokedReason: dto.reason.trim(),
      },
    });

    // Dual Audit Log
    await this.prisma.unscoped.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: 'suspend',
        module: 'support_access',
        recordId: requestId,
        device: `Tenant Owner Revocation (${user.roleName})`,
        newValue: {
          action: 'support_access_revoked',
          staffName: request.staffName,
          reason: dto.reason,
        },
      },
    });

    await this.platformAudit.log({
      userId: request.platformUserId,
      action: 'support_access.revoked_by_tenant',
      module: 'support_access',
      recordId: tenantId,
      reason: `Company Owner revoked active support session: ${dto.reason}`,
      newValue: {
        requestId,
        revokedByUserId: user.id,
        reason: dto.reason,
      },
    });

    return this.toRecord(updated);
  }

  private toRecord(r: any): SupportAccessRequestRecord {
    return {
      id: r.id,
      tenantId: r.tenantId,
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
