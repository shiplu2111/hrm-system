import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EmployeeKudos, Prisma } from '@prisma/client';
import type {
  EmployeeKudosModerationRecord,
  EmployeeKudosModerationStatus,
  EmployeeKudosRecord,
  EmployeeKudosType,
  KudosModerationFeedResult,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { buildKudosReceivedVariables } from '../notifications/notification.helpers';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateKudosDto,
  ListKudosModerationQueryDto,
  ListKudosQueryDto,
  RemoveKudosDto,
} from './dto/engagement.dto';
import {
  formatModeratorName,
  normalizeRemovalReason,
  resolveKudosType,
} from './engagement.utils';

const KUDOS_EMPLOYEE_INCLUDE = {
  fromEmployee: { select: { firstName: true, lastName: true } },
  toEmployee: { select: { firstName: true, lastName: true, managerId: true } },
} satisfies Prisma.EmployeeKudosInclude;

const KUDOS_MODERATION_INCLUDE = {
  ...KUDOS_EMPLOYEE_INCLUDE,
  removedByUser: {
    select: {
      id: true,
      email: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.EmployeeKudosInclude;

type KudosWithEmployees = EmployeeKudos & {
  fromEmployee: { firstName: string; lastName: string };
  toEmployee: { firstName: string; lastName: string; managerId: string | null };
};

type KudosWithModeration = KudosWithEmployees & {
  removedByUser: {
    id: string;
    email: string;
    employee: { firstName: string; lastName: string } | null;
  } | null;
};

@Injectable()
export class KudosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly notificationEngine: NotificationEngineService,
  ) {}

  async listFeed(
    companyId: string,
    query: ListKudosQueryDto,
  ): Promise<EmployeeKudosRecord[]> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.employeeKudos.findMany({
      where: this.buildWhereClause(company.tenantId, companyId, {
        ...query,
        moderationStatus: 'active',
      }),
      include: KUDOS_EMPLOYEE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 20,
    });

    return rows.map((row) => this.toRecord(row));
  }

  async listForModeration(
    companyId: string,
    query: ListKudosModerationQueryDto,
  ): Promise<KudosModerationFeedResult> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const tenantId = company.tenantId;
    const moderationStatus =
      query.status && query.status !== 'all' ? query.status : undefined;

    const startOfMonth = this.startOfCurrentMonthUtc();

    const [rows, activeCount, removedCount, peerCount, managerCount, thisMonthCount] =
      await Promise.all([
        this.prisma.unscoped.employeeKudos.findMany({
          where: this.buildWhereClause(tenantId, companyId, {
            ...query,
            moderationStatus,
          }),
          include: KUDOS_MODERATION_INCLUDE,
          orderBy: { createdAt: 'desc' },
          take: query.limit ?? 100,
        }),
        this.prisma.unscoped.employeeKudos.count({
          where: { tenantId, companyId, moderationStatus: 'active' },
        }),
        this.prisma.unscoped.employeeKudos.count({
          where: { tenantId, companyId, moderationStatus: 'removed' },
        }),
        this.prisma.unscoped.employeeKudos.count({
          where: { tenantId, companyId, moderationStatus: 'active', kudosType: 'peer' },
        }),
        this.prisma.unscoped.employeeKudos.count({
          where: {
            tenantId,
            companyId,
            moderationStatus: 'active',
            kudosType: 'manager',
          },
        }),
        this.prisma.unscoped.employeeKudos.count({
          where: {
            tenantId,
            companyId,
            moderationStatus: 'active',
            createdAt: { gte: startOfMonth },
          },
        }),
      ]);

    return {
      items: rows.map((row) => this.toModerationRecord(row)),
      summary: {
        activeCount,
        removedCount,
        peerCount,
        managerCount,
        thisMonthCount,
      },
    };
  }

  async countThisMonth(companyId: string): Promise<number> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const startOfMonth = this.startOfCurrentMonthUtc();

    return this.prisma.unscoped.employeeKudos.count({
      where: {
        tenantId: company.tenantId,
        companyId,
        moderationStatus: 'active',
        createdAt: { gte: startOfMonth },
      },
    });
  }

  async createForEmployee(
    fromEmployeeId: string,
    dto: { toEmployeeId: string; message: string },
    user: AuthenticatedUser,
  ): Promise<EmployeeKudosRecord> {
    const tenantId = this.companyScope.requireTenantId();
    const employee = await this.prisma.unscoped.employee.findFirst({
      where: { id: fromEmployeeId, tenantId, deletedAt: null },
      select: { companyId: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return this.create(
      employee.companyId,
      {
        fromEmployeeId,
        toEmployeeId: dto.toEmployeeId,
        message: dto.message,
      },
      user,
    );
  }

  async create(
    companyId: string,
    dto: CreateKudosDto,
    user: AuthenticatedUser,
    options?: { allowDelegate?: boolean },
  ): Promise<EmployeeKudosRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    if (dto.fromEmployeeId === dto.toEmployeeId) {
      throw new BadRequestException('You cannot recognize yourself');
    }

    if (
      user.employeeId &&
      user.employeeId !== dto.fromEmployeeId &&
      !options?.allowDelegate
    ) {
      throw new ForbiddenException('Cannot send kudos on behalf of another employee');
    }

    const [, toEmployee] = await Promise.all([
      this.assertActiveEmployee(dto.fromEmployeeId, companyId, company.tenantId),
      this.assertActiveEmployee(dto.toEmployeeId, companyId, company.tenantId),
    ]);

    const kudosType = resolveKudosType(dto.fromEmployeeId, toEmployee.managerId);

    const row = await this.prisma.unscoped.employeeKudos.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        fromEmployeeId: dto.fromEmployeeId,
        toEmployeeId: dto.toEmployeeId,
        kudosType,
        message: dto.message.trim(),
        createdByUserId: user.id,
      },
      include: KUDOS_EMPLOYEE_INCLUDE,
    });

    const fromName = this.employeeName(row.fromEmployee);
    const toName = this.employeeName(row.toEmployee);

    await this.notificationEngine.emit({
      tenantId: company.tenantId,
      companyId,
      eventType: 'kudos.received',
      subjectEmployeeId: dto.toEmployeeId,
      variables: buildKudosReceivedVariables({
        fromEmployeeName: fromName,
        toEmployeeName: toName,
        kudosMessage: row.message,
        kudosType: row.kudosType,
      }),
      payload: {
        kudosId: row.id,
        fromEmployeeId: row.fromEmployeeId,
        kudosType: row.kudosType,
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'engagement',
      recordId: row.id,
      newValue: {
        fromEmployeeId: row.fromEmployeeId,
        toEmployeeId: row.toEmployeeId,
        kudosType: row.kudosType,
      },
    });

    return this.toRecord(row);
  }

  async removeKudos(
    kudosId: string,
    dto: RemoveKudosDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeKudosModerationRecord> {
    const existing = await this.findModerationRowOrThrow(kudosId);

    if (existing.moderationStatus === 'removed') {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Recognition post has already been removed',
      });
    }

    const reason = normalizeRemovalReason(dto?.reason);
    const removedAt = new Date();

    const updated = await this.prisma.unscoped.employeeKudos.update({
      where: { id: existing.id },
      data: {
        moderationStatus: 'removed',
        removedAt,
        removedByUserId: user.id,
        removalReason: reason,
      },
      include: KUDOS_MODERATION_INCLUDE,
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'delete',
      module: 'engagement',
      recordId: kudosId,
      oldValue: {
        moderationStatus: existing.moderationStatus,
        fromEmployeeId: existing.fromEmployeeId,
        toEmployeeId: existing.toEmployeeId,
        kudosType: existing.kudosType,
        message: existing.message,
      },
      newValue: {
        moderationStatus: 'removed',
        removedAt: removedAt.toISOString(),
        removedByUserId: user.id,
        removalReason: reason,
      },
    });

    return this.toModerationRecord(updated);
  }

  async restoreKudos(
    kudosId: string,
    user: AuthenticatedUser,
  ): Promise<EmployeeKudosModerationRecord> {
    const existing = await this.findModerationRowOrThrow(kudosId);

    if (existing.moderationStatus === 'active') {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Recognition post is already active',
      });
    }

    const updated = await this.prisma.unscoped.employeeKudos.update({
      where: { id: existing.id },
      data: {
        moderationStatus: 'active',
        removedAt: null,
        removedByUserId: null,
        removalReason: null,
      },
      include: KUDOS_MODERATION_INCLUDE,
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'restore',
      module: 'engagement',
      recordId: kudosId,
      oldValue: {
        moderationStatus: existing.moderationStatus,
        removedAt: existing.removedAt?.toISOString() ?? null,
        removedByUserId: existing.removedByUserId,
        removalReason: existing.removalReason,
      },
      newValue: {
        moderationStatus: 'active',
      },
    });

    return this.toModerationRecord(updated);
  }

  private async findModerationRowOrThrow(kudosId: string): Promise<KudosWithModeration> {
    const tenantId = this.companyScope.requireTenantId();
    const row = await this.prisma.unscoped.employeeKudos.findFirst({
      where: { id: kudosId, tenantId },
      include: KUDOS_MODERATION_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Recognition post not found',
      });
    }
    return row;
  }

  private buildWhereClause(
    tenantId: string,
    companyId: string,
    filters: {
      moderationStatus?: EmployeeKudosModerationStatus;
      toEmployeeId?: string;
      fromEmployeeId?: string;
      kudosType?: 'peer' | 'manager';
      q?: string;
    },
  ): Prisma.EmployeeKudosWhereInput {
    const search = filters.q?.trim();
    return {
      tenantId,
      companyId,
      ...(filters.moderationStatus ? { moderationStatus: filters.moderationStatus } : {}),
      ...(filters.toEmployeeId ? { toEmployeeId: filters.toEmployeeId } : {}),
      ...(filters.fromEmployeeId ? { fromEmployeeId: filters.fromEmployeeId } : {}),
      ...(filters.kudosType ? { kudosType: filters.kudosType } : {}),
      ...(search
        ? {
            OR: [
              { message: { contains: search, mode: 'insensitive' } },
              { fromEmployee: { firstName: { contains: search, mode: 'insensitive' } } },
              { fromEmployee: { lastName: { contains: search, mode: 'insensitive' } } },
              { toEmployee: { firstName: { contains: search, mode: 'insensitive' } } },
              { toEmployee: { lastName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  private startOfCurrentMonthUtc(): Date {
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    return startOfMonth;
  }

  private async assertActiveEmployee(
    employeeId: string,
    companyId: string,
    tenantId: string,
  ) {
    const employee = await this.prisma.unscoped.employee.findFirst({
      where: {
        id: employeeId,
        tenantId,
        companyId,
        deletedAt: null,
        employmentStatus: 'active',
      },
      select: { id: true, managerId: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found or not active');
    }
    return employee;
  }

  private employeeName(employee: { firstName: string; lastName: string }): string {
    return `${employee.firstName} ${employee.lastName}`.trim();
  }

  private toRecord(row: KudosWithEmployees): EmployeeKudosRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      fromEmployeeId: row.fromEmployeeId,
      fromEmployeeName: this.employeeName(row.fromEmployee),
      toEmployeeId: row.toEmployeeId,
      toEmployeeName: this.employeeName(row.toEmployee),
      kudosType: row.kudosType as EmployeeKudosType,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toModerationRecord(row: KudosWithModeration): EmployeeKudosModerationRecord {
    return {
      ...this.toRecord(row),
      moderationStatus: row.moderationStatus as EmployeeKudosModerationStatus,
      removedAt: row.removedAt ? row.removedAt.toISOString() : null,
      removedByUserId: row.removedByUserId,
      removedByName: formatModeratorName(row.removedByUser),
      removalReason: row.removalReason,
    };
  }
}
