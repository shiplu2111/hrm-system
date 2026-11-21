import { Injectable, Logger } from '@nestjs/common';
import IORedis from 'ioredis';
import type {
  PlatformDashboardView,
  PlatformNeedsAttentionItem,
  PlatformNewTenantsPerWeek,
  PlatformTenantApproachingLimit,
  PlatformTenantsByStatus,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { isRedisConfigured } from '../../queue/redis.connection';

/**
 * Standard tier employee caps for capacity planning and limits enforcement.
 */
const PLAN_EMPLOYEE_LIMITS: Record<string, number> = {
  free: 25,
  trial: 50,
  starter: 250,
  business: 1000,
  enterprise: 10000,
};

@Injectable()
export class PlatformDashboardService {
  private readonly logger = new Logger(PlatformDashboardService.name);
  private redisClient: IORedis | null = null;
  private memoryCache: { data: PlatformDashboardView; expiresAt: number } | null = null;
  private readonly CACHE_KEY = 'platform:dashboard:aggregate';
  private readonly CACHE_TTL_SECONDS = 60;

  constructor(private readonly prisma: PrismaService) {
    this.initRedis();
  }

  private initRedis(): void {
    if (!isRedisConfigured()) {
      this.logger.debug(
        'REDIS_URL not configured — using memory cache for platform dashboard',
      );
      return;
    }

    try {
      const url = process.env.REDIS_URL!.trim();
      this.redisClient = new IORedis(url, {
        lazyConnect: true,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });

      this.redisClient.on('error', (err) => {
        this.logger.warn(
          `Redis cache warning: ${err.message}. Using fallback cache.`,
        );
      });
    } catch (err: any) {
      this.logger.warn(`Could not initialize Redis client: ${err.message}`);
    }
  }

  /**
   * Retrieves platform aggregate dashboard metrics with 60-second Redis caching.
   */
  async getDashboardAggregates(
    forceRefresh = false,
  ): Promise<{ data: PlatformDashboardView; cached: boolean }> {
    if (!forceRefresh) {
      const cached = await this.readFromCache();
      if (cached) {
        return { data: { ...cached, cached: true }, cached: true };
      }
    }

    const calculated = await this.computeAggregates();
    await this.writeToCache(calculated);

    return { data: { ...calculated, cached: false }, cached: false };
  }

  /**
   * Compute tenant breakdown by status.
   */
  async getTenantsByStatus(): Promise<PlatformTenantsByStatus> {
    const { data } = await this.getDashboardAggregates();
    return data.tenantsByStatus;
  }

  /**
   * Compute 12-week tenant acquisition trend.
   */
  async getNewTenantsPerWeek(): Promise<PlatformNewTenantsPerWeek[]> {
    const { data } = await this.getDashboardAggregates();
    return data.newTenantsPerWeek;
  }

  /**
   * Compute tenants approaching plan capacity limits.
   */
  async getTenantsApproachingLimits(): Promise<PlatformTenantApproachingLimit[]> {
    const { data } = await this.getDashboardAggregates();
    return data.tenantsApproachingLimits;
  }

  // ---------------------------------------------------------------------------
  // Internal Computation
  // ---------------------------------------------------------------------------

  private async computeAggregates(): Promise<PlatformDashboardView> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Parallel fetch of all platform aggregate dimensions
    const [
      tenants,
      totalActiveEmployees,
      openSupportTicketsCount,
      loginHistoryStats,
    ] = await Promise.all([
      // 1. All tenants with plan, status, and active employee headcount
      this.prisma.unscoped.tenant.findMany({
        select: {
          id: true,
          name: true,
          subdomain: true,
          planId: true,
          status: true,
          isSandbox: true,
          createdAt: true,
          _count: {
            select: {
              employees: {
                where: {
                  employmentStatus: 'active',
                  deletedAt: null,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),

      // 2. Total active employees across all tenants
      this.prisma.unscoped.employee.count({
        where: {
          employmentStatus: 'active',
          deletedAt: null,
        },
      }),

      // 3. Open support tickets count
      this.getOpenSupportTicketsSafely(),

      // 4. Last-24h error rate from platform operations / login attempts
      this.getLast24hErrorRateSafely(twentyFourHoursAgo),
    ]);

    // Aggregate tenants by status (trial, active, suspended, cancelled)
    let trial = 0;
    let active = 0;
    let suspended = 0;
    let cancelled = 0;

    for (const t of tenants) {
      const planLower = (t.planId || '').toLowerCase();
      const statusLower = t.status.toLowerCase();

      if (statusLower === 'suspended') {
        suspended++;
      } else if (statusLower === 'cancelled') {
        cancelled++;
      } else if (planLower === 'trial' || statusLower === 'trial') {
        trial++;
      } else {
        active++;
      }
    }

    const tenantsByStatus: PlatformTenantsByStatus = {
      trial,
      active,
      suspended,
      cancelled,
      total: tenants.length,
    };

    // Calculate new tenants per week for 12 weeks
    const newTenantsPerWeek: PlatformNewTenantsPerWeek[] = [];
    for (let i = 11; i >= 0; i--) {
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

      const count = tenants.filter((t) => {
        const created = new Date(t.createdAt);
        return created >= weekStart && created < weekEnd;
      }).length;

      const weekLabel = i === 0 ? 'Current Week' : `W-${i}`;

      newTenantsPerWeek.push({
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        count,
        weekLabel,
      });
    }

    // Identify tenants approaching their plan limits (usage >= 80%)
    const tenantsApproachingLimits: PlatformTenantApproachingLimit[] = [];
    for (const t of tenants) {
      if (t.isSandbox) continue; // Sandbox tenants are sales demo workspaces (never billed, unlimited capacity)
      const planKey = (t.planId || 'starter').toLowerCase();
      const limit = PLAN_EMPLOYEE_LIMITS[planKey] ?? 250;
      const employeeCount = t._count.employees;
      const usagePercentage = Math.round((employeeCount / limit) * 100);

      if (usagePercentage >= 80) {
        tenantsApproachingLimits.push({
          tenantId: t.id,
          name: t.name,
          subdomain: t.subdomain,
          plan: t.planId
            ? t.planId.charAt(0).toUpperCase() + t.planId.slice(1).toLowerCase()
            : 'Starter',
          employeeCount,
          limit,
          usagePercentage,
        });
      }
    }

    // Sort by highest usage percentage descending
    tenantsApproachingLimits.sort(
      (a, b) => b.usagePercentage - a.usagePercentage,
    );

    // Identify needs-attention items across three categories:
    // 1. Failed payments (from billing invoices when available in Stage F)
    // 2. Tenants over or approaching limits (usage >= 80% or >= 100%)
    // 3. Expiring trials (<= 5 days remaining or expired)
    const needsAttention: PlatformNeedsAttentionItem[] = [];

    // Category 2: Tenants Over or Approaching Limit
    for (const item of tenantsApproachingLimits) {
      const isOver = item.usagePercentage >= 100;
      needsAttention.push({
        id: `attn-limit-${item.tenantId}`,
        type: 'over_limit',
        tenantId: item.tenantId,
        tenantName: item.name,
        subdomain: item.subdomain,
        severity: isOver ? 'critical' : 'warning',
        title: isOver
          ? `${item.name} exceeded plan limit (${item.usagePercentage}%)`
          : `${item.name} nearing limit (${item.usagePercentage}%)`,
        detail: `${item.employeeCount} active of ${item.limit} ${item.plan} seats used.`,
        metric: `${item.employeeCount} / ${item.limit}`,
        actionLabel: isOver ? 'Upgrade Plan' : 'Review Capacity',
      });
    }

    // Category 3: Expiring Trials (<= 5 days remaining or expired)
    for (const t of tenants) {
      const isTrial =
        (t.planId || '').toLowerCase() === 'trial' ||
        t.status.toLowerCase() === 'trial';
      if (isTrial) {
        const trialEnd = new Date(
          new Date(t.createdAt).getTime() + 14 * 24 * 60 * 60 * 1000,
        );
        const diffMs = trialEnd.getTime() - now.getTime();
        const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

        if (daysRemaining <= 5) {
          const expired = daysRemaining <= 0;
          needsAttention.push({
            id: `attn-trial-${t.id}`,
            type: 'expiring_trial',
            tenantId: t.id,
            tenantName: t.name,
            subdomain: t.subdomain,
            severity: expired ? 'critical' : 'warning',
            title: expired
              ? `${t.name} trial expired`
              : `${t.name} trial expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
            detail: expired
              ? `14-day trial expired on ${trialEnd.toISOString().slice(0, 10)}. Conversion required.`
              : `14-day trial ending on ${trialEnd.toISOString().slice(0, 10)}. Follow up for plan upgrade.`,
            metric: expired ? 'Expired' : `${daysRemaining}d left`,
            dueDate: trialEnd.toISOString(),
            actionLabel: 'Extend or Upgrade',
          });
        }
      }
    }

    // Sort needs attention: critical first, then warning
    needsAttention.sort((a, b) => {
      const severityRank: Record<string, number> = {
        critical: 1,
        warning: 2,
        info: 3,
      };
      return (
        (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3)
      );
    });

    // MRR and ARR calculated from active and past_due subscriptions
    const activeSubs = await this.prisma.unscoped.subscription.findMany({
      where: {
        status: { in: ['active', 'past_due'] },
      },
      include: {
        plan: {
          include: {
            prices: true,
          },
        },
      },
    });

    let computedMrr = 0;
    for (const sub of activeSubs) {
      if (sub.plan && sub.plan.prices && sub.plan.prices.length > 0) {
        const price =
          sub.plan.prices.find((p: any) => p.billingCycle === sub.billingCycle) ||
          sub.plan.prices[0];
        const base = Number(price.amount);
        const monthly = sub.billingCycle === 'annual' ? base / 12 : base;
        const discount = sub.discountPercent ? Number(sub.discountPercent) : 0;
        computedMrr += Math.max(0, monthly * (1 - discount / 100));
      }
    }
    const mrr = Number(computedMrr.toFixed(2));
    const arr = Number((mrr * 12).toFixed(2));

    // Failed payments count from live payments table
    const failedPaymentsCount = await this.prisma.unscoped.payment.count({
      where: { status: 'failed' },
    });

    return {
      asOf: now.toISOString(),
      tenantsByStatus,
      totalActiveEmployees,
      mrr,
      arr,
      newTenantsPerWeek,
      tenantsApproachingLimits,
      needsAttention,
      failedPaymentsCount,
      openSupportTicketsCount,
      last24hErrorRate: loginHistoryStats.errorRate,
      cached: false,
      cachedAt: now.toISOString(),
      cacheTtlSeconds: this.CACHE_TTL_SECONDS,
    };
  }

  private async getOpenSupportTicketsSafely(): Promise<number> {
    try {
      return await this.prisma.unscoped.supportTicket.count({
        where: {
          status: {
            in: ['open', 'in_progress', 'waiting'],
          },
        },
      });
    } catch {
      return 0;
    }
  }

  private async getLast24hErrorRateSafely(
    since: Date,
  ): Promise<{ errorRate: number; total: number; failed: number }> {
    try {
      const [total, failed] = await Promise.all([
        this.prisma.unscoped.platformLoginHistory.count({
          where: {
            createdAt: { gte: since },
          },
        }),
        this.prisma.unscoped.platformLoginHistory.count({
          where: {
            createdAt: { gte: since },
            status: { in: ['failed', 'locked', '2fa_failed'] },
          },
        }),
      ]);

      const errorRate =
        total > 0 ? Number(((failed / total) * 100).toFixed(2)) : 0;

      return { errorRate, total, failed };
    } catch {
      return { errorRate: 0, total: 0, failed: 0 };
    }
  }

  // ---------------------------------------------------------------------------
  // Cache Management (Redis + Memory Fallback)
  // ---------------------------------------------------------------------------

  private async readFromCache(): Promise<PlatformDashboardView | null> {
    // 1. Try Redis first if available
    if (this.redisClient) {
      try {
        const raw = await this.redisClient.get(this.CACHE_KEY);
        if (raw) {
          return JSON.parse(raw) as PlatformDashboardView;
        }
      } catch (err: any) {
        this.logger.debug(`Redis get failed: ${err.message}`);
      }
    }

    // 2. Memory cache fallback
    if (this.memoryCache && this.memoryCache.expiresAt > Date.now()) {
      return this.memoryCache.data;
    }

    return null;
  }

  private async writeToCache(view: PlatformDashboardView): Promise<void> {
    // 1. Write to memory cache
    this.memoryCache = {
      data: view,
      expiresAt: Date.now() + this.CACHE_TTL_SECONDS * 1000,
    };

    // 2. Write to Redis if client is connected
    if (this.redisClient) {
      try {
        await this.redisClient.setex(
          this.CACHE_KEY,
          this.CACHE_TTL_SECONDS,
          JSON.stringify(view),
        );
      } catch (err: any) {
        this.logger.debug(`Redis setex failed: ${err.message}`);
      }
    }
  }
}
