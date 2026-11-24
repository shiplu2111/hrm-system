// apps/api/src/platform/api-registry/platform-api-registry.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { TenantApiKeyStatus, TenantOAuthClientStatus } from '@prisma/client';
import type {
  ApiAccessScope,
  PlatformApiKeyItem,
  PlatformApiKeyQuery,
  PlatformApiRegistrySummary,
  PlatformOAuthClientItem,
  PlatformOAuthClientQuery,
  PlatformRateLimitQuery,
  RevokePlatformApiKeyInput,
  RevokePlatformOAuthClientInput,
  SetTenantRateLimitOverrideInput,
  TenantRateLimitItem,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { hashApiSecret } from '../../api-access/api-access.utils';

export interface PlatformActorContext {
  id?: string;
  email?: string;
  roleName?: string;
  permissions?: Array<{ module: string; action: string }>;
}

export const DEFAULT_PLAN_RATE_LIMITS: Record<
  string,
  { rateLimitPerMin: number; burstLimit: number }
> = {
  free: { rateLimitPerMin: 60, burstLimit: 100 },
  starter: { rateLimitPerMin: 120, burstLimit: 200 },
  business: { rateLimitPerMin: 300, burstLimit: 500 },
  enterprise: { rateLimitPerMin: 1000, burstLimit: 2000 },
  default: { rateLimitPerMin: 120, burstLimit: 200 },
};

export function resolveBaselinePlanLimits(planIdOrTier?: string | null): {
  planTier: string;
  rateLimitPerMin: number;
  burstLimit: number;
} {
  const norm = (planIdOrTier || '').toLowerCase();
  if (norm.includes('enterprise')) {
    return { planTier: 'Enterprise', ...DEFAULT_PLAN_RATE_LIMITS.enterprise };
  }
  if (norm.includes('business')) {
    return { planTier: 'Business', ...DEFAULT_PLAN_RATE_LIMITS.business };
  }
  if (norm.includes('starter')) {
    return { planTier: 'Starter', ...DEFAULT_PLAN_RATE_LIMITS.starter };
  }
  if (norm.includes('free')) {
    return { planTier: 'Free', ...DEFAULT_PLAN_RATE_LIMITS.free };
  }
  return { planTier: 'Standard', ...DEFAULT_PLAN_RATE_LIMITS.default };
}

@Injectable()
export class PlatformApiRegistryService implements OnModuleInit {
  private readonly logger = new Logger(PlatformApiRegistryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  private get db() {
    return (this.prisma as any).unscoped || this.prisma;
  }

  async onModuleInit() {
    await this.seedInitialApiKeysAndOverridesIfEmpty();
  }

  /**
   * Summary KPI metrics across all tenants.
   */
  async getSummary(): Promise<PlatformApiRegistrySummary> {
    const [totalActiveKeys, totalRevokedKeys, keyVolumes, activeOverrides, totalOAuthClients] =
      await Promise.all([
        this.db.tenantApiKey.count({
          where: { status: TenantApiKeyStatus.active },
        }),
        this.db.tenantApiKey.count({
          where: { status: TenantApiKeyStatus.revoked },
        }),
        this.db.tenantApiKey.aggregate({
          _sum: { callVolume: true },
        }),
        this.db.tenantRateLimitOverride.count({
          where: {
            isActive: true,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        }),
        this.db.tenantOAuthClient.count(),
      ]);

    return {
      totalActiveKeys,
      totalRevokedKeys,
      totalApiCalls30d: keyVolumes._sum.callVolume || 0,
      activeRateLimitOverrides: activeOverrides,
      totalOAuthClients,
    };
  }

  /**
   * List API keys across all tenants with search, status & scope filters, and pagination.
   */
  async listApiKeys(query: PlatformApiKeyQuery = {}): Promise<{
    data: PlatformApiKeyItem[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    if (query.scope) {
      where.scopes = { has: query.scope };
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { prefix: { contains: s, mode: 'insensitive' } },
        { tenant: { name: { contains: s, mode: 'insensitive' } } },
        { tenant: { subdomain: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.db.tenantApiKey.count({ where }),
      this.db.tenantApiKey.findMany({
        where,
        include: {
          tenant: {
            select: { id: true, name: true, subdomain: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const userIds = [
      ...new Set(
        rows.flatMap((r: any) => [r.createdByUserId, r.revokedByUserId]).filter(Boolean) as string[],
      ),
    ];
    const userNames = await this.resolveUserNames(userIds);

    const data: PlatformApiKeyItem[] = rows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenantId,
      tenantName: r.tenant?.name || 'Unknown Tenant',
      tenantSubdomain: r.tenant?.subdomain || '',
      name: r.name,
      prefix: r.prefix,
      keyMasked: `${r.prefix}_••••••••••••••••`,
      scopes: r.scopes as ApiAccessScope[],
      status: r.status as any,
      expiresAt: r.expiresAt?.toISOString() || null,
      lastUsedAt: r.lastUsedAt?.toISOString() || null,
      callVolume: r.callVolume || 0,
      createdAt: r.createdAt.toISOString(),
      createdByName: r.createdByUserId ? userNames.get(r.createdByUserId) || null : null,
      revokedAt: r.revokedAt?.toISOString() || null,
      revokedByName: r.revokedByUserId ? userNames.get(r.revokedByUserId) || null : null,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Immediately revoke an API key from the platform control plane.
   */
  async revokeApiKey(
    id: string,
    input: RevokePlatformApiKeyInput,
    actor: PlatformActorContext,
  ): Promise<PlatformApiKeyItem> {
    if (!input.reason?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A reason must be provided when revoking an API key',
      });
    }

    const existing = await this.db.tenantApiKey.findUnique({
      where: { id },
      include: {
        tenant: {
          select: { id: true, name: true, subdomain: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'API key not found',
      });
    }

    let updated = existing;
    if (existing.status !== TenantApiKeyStatus.revoked) {
      updated = await this.db.tenantApiKey.update({
        where: { id },
        data: {
          status: TenantApiKeyStatus.revoked,
          revokedAt: new Date(),
          revokedByUserId: actor.id || null,
        },
        include: {
          tenant: {
            select: { id: true, name: true, subdomain: true },
          },
        },
      });

      await this.platformAudit.log({
        userId: actor.id || null,
        tenantId: existing.tenantId,
        module: 'api_access',
        action: 'api_key:revoke',
        recordId: existing.id,
        reason: input.reason.trim(),
        oldValue: {
          status: 'active',
          name: existing.name,
          prefix: existing.prefix,
          scopes: existing.scopes,
        },
        newValue: {
          status: 'revoked',
          revokedAt: updated.revokedAt,
          revocationReason: input.reason.trim(),
        },
      });
    }

    const userNames = await this.resolveUserNames(
      [updated.createdByUserId, updated.revokedByUserId].filter(Boolean) as string[],
    );

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      tenantName: updated.tenant?.name || 'Unknown Tenant',
      tenantSubdomain: updated.tenant?.subdomain || '',
      name: updated.name,
      prefix: updated.prefix,
      keyMasked: `${updated.prefix}_••••••••••••••••`,
      scopes: updated.scopes as ApiAccessScope[],
      status: updated.status as any,
      expiresAt: updated.expiresAt?.toISOString() || null,
      lastUsedAt: updated.lastUsedAt?.toISOString() || null,
      callVolume: updated.callVolume || 0,
      createdAt: updated.createdAt.toISOString(),
      createdByName: updated.createdByUserId ? userNames.get(updated.createdByUserId) || null : null,
      revokedAt: updated.revokedAt?.toISOString() || null,
      revokedByName: updated.revokedByUserId ? userNames.get(updated.revokedByUserId) || null : null,
    };
  }

  /**
   * List OAuth Clients across all tenants.
   */
  async listOAuthClients(query: PlatformOAuthClientQuery = {}): Promise<{
    data: PlatformOAuthClientItem[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }
    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }
    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { clientId: { contains: s, mode: 'insensitive' } },
        { tenant: { name: { contains: s, mode: 'insensitive' } } },
        { tenant: { subdomain: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.db.tenantOAuthClient.count({ where }),
      this.db.tenantOAuthClient.findMany({
        where,
        include: {
          tenant: {
            select: { id: true, name: true, subdomain: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const data: PlatformOAuthClientItem[] = rows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenantId,
      tenantName: r.tenant?.name || 'Unknown Tenant',
      tenantSubdomain: r.tenant?.subdomain || '',
      name: r.name,
      description: r.description || null,
      clientId: r.clientId,
      redirectUris: r.redirectUris || [],
      scopes: (r.scopes || []) as ApiAccessScope[],
      status: r.status as any,
      createdAt: r.createdAt.toISOString(),
      revokedAt: r.revokedAt?.toISOString() || null,
      revokedByName: null,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Immediately revoke an OAuth client across all tenants and invalidate its tokens.
   */
  async revokeOAuthClient(
    id: string,
    input: RevokePlatformOAuthClientInput,
    actor: PlatformActorContext,
  ): Promise<PlatformOAuthClientItem> {
    if (!input.reason?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A reason must be provided when revoking an OAuth client',
      });
    }

    const existing = await this.db.tenantOAuthClient.findUnique({
      where: { id },
      include: {
        tenant: {
          select: { id: true, name: true, subdomain: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'OAuth client not found',
      });
    }

    let updated = existing;
    if (existing.status !== TenantOAuthClientStatus.revoked) {
      updated = await this.db.tenantOAuthClient.update({
        where: { id },
        data: {
          status: TenantOAuthClientStatus.revoked,
          revokedAt: new Date(),
        },
        include: {
          tenant: {
            select: { id: true, name: true, subdomain: true },
          },
        },
      });

      // Revoke all existing access tokens for this client immediately
      await this.db.tenantOAuthAccessToken.updateMany({
        where: { clientId: existing.clientId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.platformAudit.log({
        userId: actor.id || null,
        tenantId: existing.tenantId,
        module: 'api_access',
        action: 'oauth_client:revoke',
        recordId: existing.id,
        reason: input.reason.trim(),
        oldValue: {
          status: 'active',
          name: existing.name,
          clientId: existing.clientId,
        },
        newValue: {
          status: 'revoked',
          revokedAt: updated.revokedAt,
          revocationReason: input.reason.trim(),
        },
      });
    }

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      tenantName: updated.tenant?.name || 'Unknown Tenant',
      tenantSubdomain: updated.tenant?.subdomain || '',
      name: updated.name,
      description: updated.description || null,
      clientId: updated.clientId,
      redirectUris: updated.redirectUris || [],
      scopes: (updated.scopes || []) as ApiAccessScope[],
      status: updated.status as any,
      createdAt: updated.createdAt.toISOString(),
      revokedAt: updated.revokedAt?.toISOString() || null,
      revokedByName: null,
    };
  }

  /**
   * List tenant rate limits, active overrides, baseline plan limits, and 24h usage.
   */
  async listRateLimits(query: PlatformRateLimitQuery = {}): Promise<{
    data: TenantRateLimitItem[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.tenantId) {
      where.id = query.tenantId;
    }
    if (query.hasOverride) {
      where.rateLimitOverride = {
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      };
    }
    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { subdomain: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [total, tenants] = await Promise.all([
      this.db.tenant.count({ where }),
      this.db.tenant.findMany({
        where,
        select: {
          id: true,
          name: true,
          subdomain: true,
          planId: true,
          rateLimitOverride: true,
          usageDailyRecords: {
            orderBy: { date: 'desc' },
            take: 1,
            select: { apiCalls: true },
          },
          tenantApiKeys: {
            select: { callVolume: true },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const grantedByIds = tenants
      .map((t: any) => t.rateLimitOverride?.grantedByUserId)
      .filter(Boolean) as string[];
    const staffDetails = await this.resolveStaffDetails(grantedByIds);

    const data: TenantRateLimitItem[] = tenants.map((t: any) => {
      const baseline = resolveBaselinePlanLimits(t.planId);
      const overrideRow = t.rateLimitOverride;

      const isOverrideActive =
        overrideRow &&
        overrideRow.isActive &&
        (!overrideRow.expiresAt || new Date(overrideRow.expiresAt).getTime() > Date.now());

      const effectiveRateLimitPerMin = isOverrideActive
        ? overrideRow.rateLimitPerMin
        : baseline.rateLimitPerMin;
      const effectiveBurstLimit = isOverrideActive
        ? overrideRow.burstLimit ?? Math.round(overrideRow.rateLimitPerMin * 1.5)
        : baseline.burstLimit;

      const latestDaily = t.usageDailyRecords?.[0]?.apiCalls || 0;
      const keySum = (t.tenantApiKeys || []).reduce(
        (sum: number, k: any) => sum + (k.callVolume || 0),
        0,
      );
      const apiCalls24h = Math.max(latestDaily, keySum);

      const staff = overrideRow?.grantedByUserId
        ? staffDetails.get(overrideRow.grantedByUserId)
        : null;

      return {
        tenantId: t.id,
        tenantName: t.name,
        tenantSubdomain: t.subdomain || '',
        planTier: baseline.planTier,
        defaultRateLimitPerMin: baseline.rateLimitPerMin,
        defaultBurstLimit: baseline.burstLimit,
        override: overrideRow
          ? {
              id: overrideRow.id,
              rateLimitPerMin: overrideRow.rateLimitPerMin,
              burstLimit: overrideRow.burstLimit,
              reason: overrideRow.reason,
              grantedByUserId: overrideRow.grantedByUserId,
              grantedByEmail: staff?.email || null,
              grantedByName: staff?.name || null,
              expiresAt: overrideRow.expiresAt?.toISOString() || null,
              isActive: overrideRow.isActive,
              createdAt: overrideRow.createdAt.toISOString(),
              updatedAt: overrideRow.updatedAt.toISOString(),
            }
          : null,
        effectiveRateLimitPerMin,
        effectiveBurstLimit,
        apiCalls24h,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Set or update rate limit override for a tenant with mandatory reason.
   */
  async setRateLimitOverride(
    tenantId: string,
    input: SetTenantRateLimitOverrideInput,
    actor: PlatformActorContext,
  ): Promise<TenantRateLimitItem> {
    if (!input.reason?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A mandatory operational or business reason is required to set a rate-limit override',
      });
    }

    const rateLimit = Number(input.rateLimitPerMin);
    if (!Number.isInteger(rateLimit) || rateLimit < 10 || rateLimit > 50000) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Rate limit must be an integer between 10 and 50,000 requests per minute',
      });
    }

    const burstLimit = input.burstLimit !== undefined && input.burstLimit !== null
      ? Number(input.burstLimit)
      : Math.round(rateLimit * 1.5);

    if (burstLimit < rateLimit) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Burst limit cannot be lower than the per-minute rate limit',
      });
    }

    const tenant = await this.db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, subdomain: true, planId: true },
    });

    if (!tenant) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    const existingOverride = await this.db.tenantRateLimitOverride.findUnique({
      where: { tenantId },
    });

    const expiresAtDate = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAtDate && expiresAtDate.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Override expiry date must be in the future',
      });
    }

    const override = await this.db.tenantRateLimitOverride.upsert({
      where: { tenantId },
      create: {
        tenantId,
        rateLimitPerMin: rateLimit,
        burstLimit,
        reason: input.reason.trim(),
        grantedByUserId: actor.id || null,
        expiresAt: expiresAtDate,
        isActive: true,
      },
      update: {
        rateLimitPerMin: rateLimit,
        burstLimit,
        reason: input.reason.trim(),
        grantedByUserId: actor.id || null,
        expiresAt: expiresAtDate,
        isActive: true,
      },
    });

    await this.platformAudit.log({
      userId: actor.id || null,
      tenantId,
      module: 'api_access',
      action: existingOverride ? 'rate_limit:update_override' : 'rate_limit:set_override',
      recordId: override.id,
      reason: input.reason.trim(),
      oldValue: existingOverride
        ? {
            rateLimitPerMin: existingOverride.rateLimitPerMin,
            burstLimit: existingOverride.burstLimit,
            reason: existingOverride.reason,
            isActive: existingOverride.isActive,
          }
        : null,
      newValue: {
        rateLimitPerMin: override.rateLimitPerMin,
        burstLimit: override.burstLimit,
        reason: override.reason,
        expiresAt: override.expiresAt,
        isActive: override.isActive,
      },
    });

    const baseline = resolveBaselinePlanLimits(tenant.planId);
    const staffDetails = await this.resolveStaffDetails(
      actor.id ? [actor.id] : [],
    );
    const staff = actor.id ? staffDetails.get(actor.id) : null;

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSubdomain: tenant.subdomain || '',
      planTier: baseline.planTier,
      defaultRateLimitPerMin: baseline.rateLimitPerMin,
      defaultBurstLimit: baseline.burstLimit,
      override: {
        id: override.id,
        rateLimitPerMin: override.rateLimitPerMin,
        burstLimit: override.burstLimit,
        reason: override.reason,
        grantedByUserId: override.grantedByUserId,
        grantedByEmail: staff?.email || actor.email || null,
        grantedByName: staff?.name || actor.roleName || null,
        expiresAt: override.expiresAt?.toISOString() || null,
        isActive: override.isActive,
        createdAt: override.createdAt.toISOString(),
        updatedAt: override.updatedAt.toISOString(),
      },
      effectiveRateLimitPerMin: override.rateLimitPerMin,
      effectiveBurstLimit: override.burstLimit ?? Math.round(override.rateLimitPerMin * 1.5),
      apiCalls24h: 0,
    };
  }

  /**
   * Remove rate limit override for a tenant (reverts to baseline plan tier limits).
   */
  async removeRateLimitOverride(
    tenantId: string,
    actor: PlatformActorContext,
  ): Promise<TenantRateLimitItem> {
    const tenant = await this.db.tenant.findUnique({
      where: { id: tenantId },
      include: { rateLimitOverride: true },
    });

    if (!tenant) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    if (!tenant.rateLimitOverride) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'No active rate limit override found for this tenant',
      });
    }

    const existing = tenant.rateLimitOverride;

    await this.db.tenantRateLimitOverride.delete({
      where: { tenantId },
    });

    await this.platformAudit.log({
      userId: actor.id || null,
      tenantId,
      module: 'api_access',
      action: 'rate_limit:remove_override',
      recordId: existing.id,
      reason: 'Rate-limit override removed, tenant reverted to baseline plan tier limits',
      oldValue: {
        rateLimitPerMin: existing.rateLimitPerMin,
        burstLimit: existing.burstLimit,
        reason: existing.reason,
      },
      newValue: null,
    });

    const baseline = resolveBaselinePlanLimits(tenant.planId);

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSubdomain: tenant.subdomain || '',
      planTier: baseline.planTier,
      defaultRateLimitPerMin: baseline.rateLimitPerMin,
      defaultBurstLimit: baseline.burstLimit,
      override: null,
      effectiveRateLimitPerMin: baseline.rateLimitPerMin,
      effectiveBurstLimit: baseline.burstLimit,
      apiCalls24h: 0,
    };
  }

  /**
   * Resolve user or platform staff names for key items.
   */
  private async resolveUserNames(userIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!userIds.length) return map;

    const [users, platformUsers] = await Promise.all([
      this.db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, employee: { select: { firstName: true, lastName: true } } },
      }),
      this.db.platformUser.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, firstName: true, lastName: true },
      }),
    ]);

    for (const u of users) {
      const name = u.employee
        ? `${u.employee.firstName || ''} ${u.employee.lastName || ''}`.trim()
        : u.email;
      map.set(u.id, name || u.email);
    }

    for (const pu of platformUsers) {
      const name = `${pu.firstName || ''} ${pu.lastName || ''}`.trim() || pu.email;
      map.set(pu.id, name);
    }

    return map;
  }

  /**
   * Resolve platform staff details for override displays.
   */
  private async resolveStaffDetails(
    staffIds: string[],
  ): Promise<Map<string, { name: string; email: string }>> {
    const map = new Map<string, { name: string; email: string }>();
    if (!staffIds.length) return map;

    const platformUsers = await this.db.platformUser.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    for (const pu of platformUsers) {
      const name = `${pu.firstName || ''} ${pu.lastName || ''}`.trim() || pu.email;
      map.set(pu.id, { name, email: pu.email });
    }

    return map;
  }

  /**
   * Seed initial test API keys, OAuth clients, and rate limit overrides if empty.
   */
  async seedInitialApiKeysAndOverridesIfEmpty(): Promise<void> {
    try {
      const existingKeyCount = await this.db.tenantApiKey.count();
      if (existingKeyCount > 0) {
        return;
      }

      this.logger.log('Seeding initial cross-tenant API keys and rate-limit overrides...');

      const tenants = await this.db.tenant.findMany({
        take: 5,
        orderBy: { createdAt: 'asc' },
      });

      if (!tenants.length) return;

      const acme = tenants.find((t: any) => t.subdomain === 'acme') || tenants[0];
      const techflow =
        tenants.find((t: any) => t.subdomain === 'techflow') || tenants[1] || tenants[0];
      const globex =
        tenants.find((t: any) => t.subdomain === 'globex') || tenants[2] || tenants[0];

      // Find platform owner or admin user to attribute seed items
      const owner = await this.db.platformUser.findFirst({
        where: { email: 'platform.owner@cmsnbd.com' },
      });
      const staffUserId = owner?.id || null;

      // Seed API keys
      await this.db.tenantApiKey.createMany({
        data: [
          {
            tenantId: acme.id,
            name: 'Production HR Portal Sync',
            prefix: 'hrm_live_acme01',
            keyHash: hashApiSecret('hrm_live_acme01_seeded_secret_9941'),
            scopes: ['read:employees', 'read:attendance', 'write:attendance', 'read:leave'],
            status: TenantApiKeyStatus.active,
            createdByUserId: staffUserId,
            callVolume: 18450,
            lastUsedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 mins ago
            createdAt: new Date(Date.now() - 45 * 86400000),
          },
          {
            tenantId: acme.id,
            name: 'Legacy Payroll Exporter',
            prefix: 'hrm_live_acme02',
            keyHash: hashApiSecret('hrm_live_acme02_seeded_secret_8172'),
            scopes: ['read:payroll', 'read:employees'],
            status: TenantApiKeyStatus.active,
            createdByUserId: staffUserId,
            callVolume: 3200,
            lastUsedAt: new Date(Date.now() - 2 * 3600 * 1000),
            createdAt: new Date(Date.now() - 90 * 86400000),
          },
          {
            tenantId: techflow.id,
            name: 'Mobile Biometric Kiosks Backend',
            prefix: 'hrm_live_tech01',
            keyHash: hashApiSecret('hrm_live_tech01_seeded_secret_2019'),
            scopes: ['read:attendance', 'write:attendance'],
            status: TenantApiKeyStatus.active,
            createdByUserId: staffUserId,
            callVolume: 42100,
            lastUsedAt: new Date(Date.now() - 5 * 60 * 1000),
            createdAt: new Date(Date.now() - 30 * 86400000),
          },
          {
            tenantId: techflow.id,
            name: 'Staging Integration Worker (Deprecated)',
            prefix: 'hrm_live_tech02',
            keyHash: hashApiSecret('hrm_live_tech02_seeded_secret_0012'),
            scopes: ['read:employees'],
            status: TenantApiKeyStatus.revoked,
            revokedAt: new Date(Date.now() - 5 * 86400000),
            revokedByUserId: staffUserId,
            createdByUserId: staffUserId,
            callVolume: 240,
            lastUsedAt: new Date(Date.now() - 7 * 86400000),
            createdAt: new Date(Date.now() - 60 * 86400000),
          },
          {
            tenantId: globex.id,
            name: 'Enterprise SAP / ERP Connector',
            prefix: 'hrm_live_glob01',
            keyHash: hashApiSecret('hrm_live_glob01_seeded_secret_7721'),
            scopes: [
              'read:employees',
              'write:employees',
              'read:payroll',
              'write:payroll',
              'read:leave',
            ],
            status: TenantApiKeyStatus.active,
            createdByUserId: staffUserId,
            callVolume: 94800,
            lastUsedAt: new Date(Date.now() - 1 * 60 * 1000),
            createdAt: new Date(Date.now() - 120 * 86400000),
          },
        ],
      });

      // Seed OAuth clients
      await this.db.tenantOAuthClient.createMany({
        data: [
          {
            tenantId: acme.id,
            name: 'Acme Employee Self-Service Mobile',
            description: 'Native iOS & Android self-service mobile client',
            clientId: 'acme-mobile-app-client',
            clientSecretHash: hashApiSecret('ocs_acme_mobile_secret_1122'),
            redirectUris: ['https://acme.corp/auth/callback', 'acme-app://oauth/callback'],
            scopes: ['read:employees', 'read:leave', 'read:attendance'],
            status: TenantOAuthClientStatus.active,
            createdAt: new Date(Date.now() - 40 * 86400000),
          },
          {
            tenantId: techflow.id,
            name: 'TechFlow Slack Attendance Bot',
            description: 'Internal Slack app integration for clock-in and status check',
            clientId: 'techflow-slack-bot-client',
            clientSecretHash: hashApiSecret('ocs_techflow_slack_secret_3344'),
            redirectUris: ['https://slack.techflow.io/oauth/callback'],
            scopes: ['read:attendance', 'write:attendance'],
            status: TenantOAuthClientStatus.active,
            createdAt: new Date(Date.now() - 25 * 86400000),
          },
        ],
      });

      // Seed Rate Limit Override for Globex
      await this.db.tenantRateLimitOverride.upsert({
        where: { tenantId: globex.id },
        create: {
          tenantId: globex.id,
          rateLimitPerMin: 2500,
          burstLimit: 5000,
          reason: 'High-volume annual SAP ERP employee sync and payroll batch migration',
          grantedByUserId: staffUserId,
          expiresAt: new Date(Date.now() + 60 * 86400000), // in 60 days
          isActive: true,
        },
        update: {},
      });

      this.logger.log('Seeded initial API keys, OAuth clients, and rate-limit overrides successfully.');
    } catch (err: any) {
      this.logger.warn(`Failed to seed API keys: ${err?.message || err}`);
    }
  }
}
