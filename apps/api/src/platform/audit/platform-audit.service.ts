import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface CreatePlatformAuditLogInput {
  userId?: string | null;
  action: string;
  module: string;
  recordId?: string | null;
  reason?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface PlatformAuditLogFilters {
  module?: string;
  userId?: string;
  action?: string;
  recordId?: string;
  from?: string | Date;
  to?: string | Date;
  page?: number;
  pageSize?: number;
}

const REDACT_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'secret',
  'totpsecret',
  'totp_secret',
  'totpsecretencrypted',
  'totp_secret_encrypted',
  'token',
  'refreshtoken',
  'refresh_token',
  'refreshtokenhash',
  'refresh_token_hash',
  'mfatoken',
]);

function sanitizeValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const lowerKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (REDACT_KEYS.has(lowerKey)) {
      result[k] = '[redacted]';
    } else if (typeof v === 'object' && v !== null) {
      result[k] = sanitizeValue(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

@Injectable()
export class PlatformAuditService {
  private readonly logger = new Logger(PlatformAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append-only platform audit logging (AUDIT_LOG.md).
   * No update or delete operations exist.
   */
  async log(input: CreatePlatformAuditLogInput): Promise<void> {
    try {
      const sanitizedOld = input.oldValue !== undefined ? sanitizeValue(input.oldValue) : undefined;
      const sanitizedNew = input.newValue !== undefined ? sanitizeValue(input.newValue) : undefined;

      await this.prisma.unscoped.platformAuditLog.create({
        data: {
          userId: input.userId ?? null,
          action: input.action,
          module: input.module,
          recordId: input.recordId ? String(input.recordId) : null,
          reason: input.reason ?? null,
          oldValue: sanitizedOld as Prisma.InputJsonValue | undefined,
          newValue: sanitizedNew as Prisma.InputJsonValue | undefined,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
    } catch (error) {
      // Platform audit failures must not crash the primary operational request,
      // but should be logged immediately.
      this.logger.error(
        `Failed to record platform audit log: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async list(filters: PlatformAuditLogFilters = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
    const skip = (page - 1) * pageSize;

    const where: Prisma.PlatformAuditLogWhereInput = {};

    if (filters.module) {
      where.module = filters.module;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.action) {
      where.action = filters.action;
    }
    if (filters.recordId) {
      where.recordId = filters.recordId;
    }
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) {
        where.createdAt.gte = new Date(filters.from);
      }
      if (filters.to) {
        where.createdAt.lte = new Date(filters.to);
      }
    }

    const [rows, total] = await Promise.all([
      this.prisma.unscoped.platformAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.unscoped.platformAuditLog.count({ where }),
    ]);

    const logs = rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      userEmail: r.user?.email ?? null,
      userName: r.user ? `${r.user.firstName} ${r.user.lastName}` : null,
      action: r.action,
      module: r.module,
      recordId: r.recordId,
      oldValue: r.oldValue as Record<string, unknown> | null,
      newValue: r.newValue as Record<string, unknown> | null,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      createdAt: r.createdAt.toISOString(),
    }));

    return { logs, total, page, pageSize };
  }
}
