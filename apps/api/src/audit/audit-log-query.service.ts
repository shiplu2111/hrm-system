import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuditLogActor, AuditLogEntry, AuditLogFilterOptions } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { redactAuditValue } from './audit-redaction.utils';
import type { AuditLogQueryDto } from './dto/audit-log-query.dto';

const DEFAULT_PAGE_SIZE = 25;
const MAX_FILTER_ACTORS = 500;

/** Read side of the append-only audit trail — AUDIT_LOG.md §5. */
@Injectable()
export class AuditLogQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    query: AuditLogQueryDto,
  ): Promise<{ data: AuditLogEntry[]; total: number; page: number; pageSize: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = this.buildWhere(tenantId, query);

    const [rows, total] = await Promise.all([
      this.prisma.unscoped.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.unscoped.auditLog.count({ where }),
    ]);

    const actors = await this.resolveActors(rows.map((r) => r.userId));
    const data = rows.map((row) => ({
      id: row.id,
      action: row.action,
      module: row.module,
      recordId: row.recordId,
      actor: actors.get(row.userId) ?? { id: row.userId, name: null, email: null },
      oldValue: redactAuditValue(row.oldValue),
      newValue: redactAuditValue(row.newValue),
      ipAddress: row.ipAddress,
      device: row.device,
      createdAt: row.createdAt.toISOString(),
    }));

    return { data, total, page, pageSize };
  }

  async filterOptions(tenantId: string): Promise<AuditLogFilterOptions> {
    const [modules, users] = await Promise.all([
      this.prisma.unscoped.auditLog.findMany({
        where: { tenantId },
        distinct: ['module'],
        select: { module: true },
        orderBy: { module: 'asc' },
      }),
      this.prisma.unscoped.auditLog.findMany({
        where: { tenantId },
        distinct: ['userId'],
        select: { userId: true },
        take: MAX_FILTER_ACTORS,
      }),
    ]);

    const actors = [...(await this.resolveActors(users.map((u) => u.userId))).values()];
    actors.sort((a, b) => (a.name ?? a.email ?? '').localeCompare(b.name ?? b.email ?? ''));
    return { modules: modules.map((m) => m.module), actors };
  }

  private buildWhere(tenantId: string, query: AuditLogQueryDto): Prisma.AuditLogWhereInput {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from >= to) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'The start of the date range must be before the end',
        details: [{ field: 'from', message: 'Must be before "to"' }],
      });
    }

    return {
      tenantId,
      ...(query.module ? { module: query.module } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.recordId ? { recordId: query.recordId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } }
        : {}),
    };
  }

  /** Actors may include platform staff acting on the tenant, so lookup is not tenant-restricted. */
  private async resolveActors(userIds: string[]): Promise<Map<string, AuditLogActor>> {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return new Map();

    const users = await this.prisma.unscoped.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        email: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    });

    return new Map(
      users.map((u) => {
        const name = u.employee ? `${u.employee.firstName} ${u.employee.lastName}`.trim() : '';
        return [u.id, { id: u.id, name: name || null, email: u.email }];
      }),
    );
  }
}
