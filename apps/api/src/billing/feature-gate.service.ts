import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { EmploymentStatus } from '@prisma/client';
import type {
  EnterpriseFeature,
  PlanDefinition,
  PlanFeatureKey,
  PlanLimitKey,
  PlanUsageMetric,
  SubscriptionPlanTier,
  TenantSubscriptionStatus,
  TenantSubscriptionView,
} from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import {
  DEFAULT_PLAN,
  nextPlanId,
  normalizePlanId,
  PLAN_API_CALL_LIMITS,
  PLAN_CATALOG,
  PLAN_COMPANY_LIMITS,
  PLAN_EMPLOYEE_LIMITS,
  PLAN_FEATURES,
  PLAN_LIMIT_APPROACHING_RATIO,
  PLAN_ORDER,
  PLAN_STORAGE_LIMITS,
  planDefinition,
  tenantHasFeature,
  usageLevel,
} from './plan-features.constants';

export interface EffectiveFeatureInfo {
  featureKey: string;
  enabled: boolean;
  source: 'tenant_override' | 'setting_override' | 'plan_default';
  planCode: string;
}

export interface EffectiveLimitInfo {
  limitKey: string;
  limit: number | null;
  used: number;
  level: string;
  source: 'tenant_override' | 'plan_default';
  planCode: string;
}

export interface EffectivePlanDetails {
  planId: SubscriptionPlanTier;
  planName: string;
  status: TenantSubscriptionStatus;
  features: EffectiveFeatureInfo[];
  limits: EffectiveLimitInfo[];
}

const isUuid = (val?: string | null): val is string =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

@Injectable()
export class FeatureGateService {
  private readonly logger = new Logger(FeatureGateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates if a tenant has a specific feature enabled.
   * Resolution chain (Stage G):
   * 1. TenantFeatureOverride (explicit per-tenant grant/block)
   * 2. TenantSetting (category: 'feature_flag')
   * 3. PlanFeature (plan defaults loaded from database `plans` + `plan_features`)
   * 4. Static fallback (PLAN_FEATURES in constants)
   */
  async hasFeature(tenantId: string, featureKey: string): Promise<boolean> {
    if (!tenantId) return false;

    // 1. Check explicit TenantFeatureOverride
    try {
      const override = await (this.prisma.unscoped as any).tenantFeatureOverride?.findUnique({
        where: { tenantId_featureKey: { tenantId, featureKey } },
      });
      if (override) {
        return override.enabled;
      }
    } catch (err) {
      this.logger.debug(`Could not query tenantFeatureOverride: ${err}`);
    }

    // 2. Check TenantSetting with category 'feature_flag'
    try {
      const setting = await (this.prisma.unscoped as any).tenantSetting?.findUnique({
        where: {
          tenantId_category_key: {
            tenantId,
            category: 'feature_flag',
            key: featureKey,
          },
        },
      });
      if (setting && setting.value !== undefined && setting.value !== null) {
        const val = setting.value;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'object' && val !== null && 'enabled' in val) {
          return Boolean((val as any).enabled);
        }
        if (typeof val === 'string') return val === 'true';
      }
    } catch {
      // continue to plan resolution
    }

    // 3. Resolve Tenant's Plan
    const tenant = await (this.prisma.unscoped as any).tenant?.findUnique({
      where: { id: tenantId },
      select: { planId: true, status: true, isSandbox: true },
    });
    if (!tenant) return false;

    // Inactive/Suspended full-block check
    if (tenant.status === 'deleted' || tenant.status === 'pending_deletion') {
      return false;
    }

    const planCode = normalizePlanId(tenant.planId);

    // Query database Plan + PlanFeature
    try {
      const planWhere = isUuid(tenant.planId)
        ? { OR: [{ id: tenant.planId }, { code: planCode }], isActive: true }
        : { code: planCode, isActive: true };
      const plan = await (this.prisma.unscoped as any).plan?.findFirst({
        where: planWhere,
        include: { features: true },
      });

      if (plan && plan.features && plan.features.length > 0) {
        const feat = plan.features.find((f: any) => f.featureKey === featureKey);
        if (feat) {
          return feat.enabled;
        }
      }
    } catch (err) {
      this.logger.debug(`Database plan lookup fallback: ${err}`);
    }

    // 4. Static fallback for unit test mocks / bootstrap
    return tenantHasFeature(planCode, featureKey as EnterpriseFeature);
  }

  /**
   * Evaluates if a tenant is within its allocated limit for a limitKey.
   * Resolution chain:
   * 1. TenantLimitOverride (explicit per-tenant custom quota)
   * 2. PlanLimit (plan defaults loaded from database `plans` + `plan_limits`)
   * 3. Static fallback (PLAN_EMPLOYEE_LIMITS, etc.)
   */
  async withinLimit(
    tenantId: string,
    limitKey: string,
    currentUsage?: number,
  ): Promise<boolean> {
    if (!tenantId) return false;

    const limit = await this.getLimit(tenantId, limitKey);
    if (limit === null) {
      return true; // null means unlimited
    }

    const usage =
      currentUsage !== undefined
        ? currentUsage
        : await this.getCurrentUsage(tenantId, limitKey);

    return usage <= limit;
  }

  /**
   * Asserts feature access. Throws ForbiddenException if disabled.
   * Returns error code FEATURE_NOT_IN_PLAN with an upgrade hint per ERROR_HANDLING.md.
   */
  async assertFeature(tenantId: string, featureKey: string): Promise<void> {
    const enabled = await this.hasFeature(tenantId, featureKey);
    if (!enabled) {
      const planCode = await this.getTenantPlanCode(tenantId);
      const planName = planCode.charAt(0).toUpperCase() + planCode.slice(1);

      let upgradeHint = 'Upgrade your subscription plan to access this feature.';
      if (['attendance', 'leave', 'basic_payroll'].includes(featureKey)) {
        upgradeHint = 'Upgrade your plan to Starter or above to access this feature.';
      } else if (['roster', 'timesheets', 'advanced_reports'].includes(featureKey)) {
        upgradeHint = 'Upgrade your plan to Business or Enterprise to access this feature.';
      } else if (
        ['api_access', 'sso', 'custom_payroll_rules', 'advanced_workflow'].includes(featureKey)
      ) {
        upgradeHint = 'Upgrade your plan to Enterprise to access this feature.';
      }

      throw new ForbiddenException({
        code: 'FEATURE_NOT_IN_PLAN',
        message: `Feature '${featureKey}' is not included in your ${planName} plan. ${upgradeHint}`,
        upgradeHint,
        details: [{ field: 'feature', message: upgradeHint }],
      });
    }
  }

  /**
   * Asserts capacity under limit. Throws ForbiddenException if cap exceeded.
   * Returns error code PLAN_LIMIT_REACHED with an upgrade hint per ERROR_HANDLING.md.
   */
  async assertWithinLimit(
    tenantId: string,
    limitKey: string,
    additional = 1,
  ): Promise<void> {
    if (additional <= 0) return;

    const limit = await this.getLimit(tenantId, limitKey);
    if (limit === null) return; // Unlimited

    const used = await this.getCurrentUsage(tenantId, limitKey);
    if (used + additional <= limit) return;

    const planCode = await this.getTenantPlanCode(tenantId);
    const planName = planCode.charAt(0).toUpperCase() + planCode.slice(1);

    let upgradeHint: string;
    let message: string;

    if (limitKey === 'employees') {
      const nextTier =
        planCode === 'free'
          ? 'Starter (up to 50 employees) or Business'
          : planCode === 'starter'
            ? 'Business (up to 250 employees) or Enterprise'
            : 'Enterprise (unlimited employees)';
      upgradeHint = `Upgrade your plan to ${nextTier} to add more employees.`;
      message = `Your ${planName} plan employee limit of ${limit} has been reached (${used} in use). ${upgradeHint}`;
    } else if (limitKey === 'storage_gb') {
      const nextTier =
        planCode === 'free'
          ? 'Starter (up to 10 GB) or Business'
          : planCode === 'starter'
            ? 'Business (up to 50 GB) or Enterprise'
            : 'Enterprise (unlimited storage)';
      const formattedUsed = typeof used === 'number' ? used.toFixed(2) : used;
      upgradeHint = `Upgrade your plan to ${nextTier} to upload more files.`;
      message = `Your ${planName} plan storage limit of ${limit} GB has been reached (${formattedUsed} GB in use). ${upgradeHint}`;
    } else if (limitKey === 'companies') {
      const nextTier =
        planCode === 'free' || planCode === 'starter'
          ? 'Business (up to 3 companies) or Enterprise'
          : 'Enterprise (unlimited companies)';
      upgradeHint = `Upgrade your plan to ${nextTier} to add more companies.`;
      message = `Your ${planName} plan limit of ${limit} companies has been reached (${used} in use). ${upgradeHint}`;
    } else {
      upgradeHint = `Upgrade your plan to increase your ${limitKey} limit.`;
      message = `Your ${planName} plan limit of ${limit} ${limitKey} has been reached (${used} in use). ${upgradeHint}`;
    }

    throw new ForbiddenException({
      code: 'PLAN_LIMIT_REACHED',
      message,
      upgradeHint,
      details: [{ field: limitKey, message: upgradeHint }],
    });
  }

  /**
   * Resolves the effective limit for a tenant and limitKey.
   * Returns `null` if unlimited.
   */
  async getLimit(tenantId: string, limitKey: string): Promise<number | null> {
    // 1. Check TenantLimitOverride
    try {
      const override = await (this.prisma.unscoped as any).tenantLimitOverride?.findUnique({
        where: { tenantId_limitKey: { tenantId, limitKey } },
      });
      if (override) {
        return override.value;
      }
    } catch {
      // fallback
    }

    // 2. Database Plan lookup
    let planCode: SubscriptionPlanTier = 'starter';
    try {
      const tenant = await (this.prisma.unscoped as any).tenant?.findUnique({
        where: { id: tenantId },
        select: { planId: true },
      });
      planCode = normalizePlanId(tenant?.planId);

      const planWhere = isUuid(tenant?.planId)
        ? { OR: [{ id: tenant.planId }, { code: planCode }], isActive: true }
        : { code: planCode, isActive: true };
      const plan = await (this.prisma.unscoped as any).plan?.findFirst({
        where: planWhere,
        include: { limits: true },
      });

      if (plan && plan.limits && plan.limits.length > 0) {
        const lim = plan.limits.find((l: any) => l.limitKey === limitKey);
        if (lim) {
          return lim.value;
        }
      }
    } catch {
      // fallback
    }

    // 3. Static fallback
    if (limitKey === 'employees') return PLAN_EMPLOYEE_LIMITS[planCode] ?? null;
    if (limitKey === 'storage_gb') return PLAN_STORAGE_LIMITS[planCode] ?? null;
    if (limitKey === 'api_calls') return PLAN_API_CALL_LIMITS[planCode] ?? null;
    if (limitKey === 'companies') return PLAN_COMPANY_LIMITS[planCode] ?? null;

    return null;
  }

  /**
   * Calculates current usage dynamically for a given limit key.
   */
  async getCurrentUsage(tenantId: string, limitKey: string): Promise<number> {
    try {
      if (limitKey === 'employees') {
        return await (this.prisma.unscoped as any).employee?.count({
          where: {
            tenantId,
            deletedAt: null,
            employmentStatus: { not: EmploymentStatus.terminated },
          },
        }) ?? 0;
      }

      if (limitKey === 'companies') {
        return await (this.prisma.unscoped as any).company?.count({
          where: {
            tenantId,
            deletedAt: null,
          },
        }) ?? 0;
      }

      if (limitKey === 'api_calls') {
        return 0;
      }

      if (limitKey === 'storage_gb') {
        const [contracts, resumes, receipts, certifications, candidateDocs] = await Promise.all([
          (this.prisma.unscoped as any).employmentContractDocument?.aggregate({
            where: { tenantId },
            _sum: { sizeBytes: true },
          }).catch(() => null),
          (this.prisma.unscoped as any).jobApplicationResume?.aggregate({
            where: { tenantId },
            _sum: { sizeBytes: true },
          }).catch(() => null),
          (this.prisma.unscoped as any).expenseClaimReceipt?.aggregate({
            where: { tenantId },
            _sum: { sizeBytes: true },
          }).catch(() => null),
          (this.prisma.unscoped as any).employeeCertification?.aggregate({
            where: { tenantId },
            _sum: { fileSizeBytes: true },
          }).catch(() => null),
          (this.prisma.unscoped as any).candidateDocument?.aggregate({
            where: { tenantId },
            _sum: { sizeBytes: true },
          }).catch(() => null),
        ]);

        const totalBytes =
          (contracts?._sum?.sizeBytes ?? 0) +
          (resumes?._sum?.sizeBytes ?? 0) +
          (receipts?._sum?.sizeBytes ?? 0) +
          (certifications?._sum?.fileSizeBytes ?? 0) +
          (candidateDocs?._sum?.sizeBytes ?? 0);

        return totalBytes / (1024 * 1024 * 1024);
      }
    } catch {
      return 0;
    }

    return 0;
  }

  /**
   * Returns normalized plan code for tenant.
   */
  async getTenantPlanCode(tenantId: string): Promise<SubscriptionPlanTier> {
    try {
      const tenant = await (this.prisma.unscoped as any).tenant?.findUnique({
        where: { id: tenantId },
        select: { planId: true },
      });
      return normalizePlanId(tenant?.planId);
    } catch {
      return DEFAULT_PLAN;
    }
  }

  /**
   * Returns full resolved plan details with active overrides.
   */
  async getEffectivePlanDetails(tenantId: string): Promise<EffectivePlanDetails> {
    const tenant = await (this.prisma.unscoped as any).tenant?.findUniqueOrThrow({
      where: { id: tenantId },
      select: { planId: true, status: true },
    });
    const planCode = normalizePlanId(tenant.planId);
    const planName = planCode.charAt(0).toUpperCase() + planCode.slice(1);

    const [dbPlan, featureOverrides, limitOverrides, usedEmployees, usedCompanies] =
      await Promise.all([
        (this.prisma.unscoped as any).plan?.findFirst({
          where: isUuid(tenant.planId)
            ? { OR: [{ id: tenant.planId }, { code: planCode }], isActive: true }
            : { code: planCode, isActive: true },
          include: { features: true, limits: true, prices: true },
        }),
        (this.prisma.unscoped as any).tenantFeatureOverride?.findMany({
          where: { tenantId },
        }) ?? [],
        (this.prisma.unscoped as any).tenantLimitOverride?.findMany({
          where: { tenantId },
        }) ?? [],
        this.getCurrentUsage(tenantId, 'employees'),
        this.getCurrentUsage(tenantId, 'companies'),
      ]);

    const overrideFeatureMap = new Map<string, boolean>(
      featureOverrides.map((o: any) => [o.featureKey, o.enabled]),
    );
    const overrideLimitMap = new Map<string, number | null>(
      limitOverrides.map((o: any) => [o.limitKey, o.value]),
    );

    // Compile features
    const allFeatureKeys: PlanFeatureKey[] = [
      'core_hr',
      'attendance',
      'leave',
      'basic_payroll',
      'roster',
      'timesheets',
      'advanced_reports',
      'api_access',
      'sso',
      'custom_payroll_rules',
      'advanced_workflow',
    ];

    const features: EffectiveFeatureInfo[] = allFeatureKeys.map((key) => {
      if (overrideFeatureMap.has(key)) {
        return {
          featureKey: key,
          enabled: overrideFeatureMap.get(key)!,
          source: 'tenant_override',
          planCode,
        };
      }
      const dbFeat = dbPlan?.features?.find((f: any) => f.featureKey === key);
      if (dbFeat) {
        return {
          featureKey: key,
          enabled: dbFeat.enabled,
          source: 'plan_default',
          planCode,
        };
      }
      return {
        featureKey: key,
        enabled: tenantHasFeature(planCode, key as EnterpriseFeature),
        source: 'plan_default',
        planCode,
      };
    });

    // Compile limits
    const limitKeys: PlanLimitKey[] = ['employees', 'companies', 'storage_gb', 'api_calls'];
    const limits: EffectiveLimitInfo[] = limitKeys.map((key) => {
      let limitVal: number | null = null;
      let source: 'tenant_override' | 'plan_default' = 'plan_default';

      if (overrideLimitMap.has(key)) {
        limitVal = overrideLimitMap.get(key)!;
        source = 'tenant_override';
      } else {
        const dbLim = dbPlan?.limits?.find((l: any) => l.limitKey === key);
        if (dbLim !== undefined) {
          limitVal = dbLim.value;
        } else if (key === 'employees') {
          limitVal = PLAN_EMPLOYEE_LIMITS[planCode] ?? null;
        } else if (key === 'companies') {
          limitVal = PLAN_COMPANY_LIMITS[planCode] ?? null;
        } else if (key === 'storage_gb') {
          limitVal = PLAN_STORAGE_LIMITS[planCode] ?? null;
        } else if (key === 'api_calls') {
          limitVal = PLAN_API_CALL_LIMITS[planCode] ?? null;
        }
      }

      const used = key === 'employees' ? usedEmployees : key === 'companies' ? usedCompanies : 0;
      const level = usageLevel(used, limitVal);

      return {
        limitKey: key,
        limit: limitVal,
        used,
        level,
        source,
        planCode,
      };
    });

    return {
      planId: planCode,
      planName,
      status: tenant.status,
      features,
      limits,
    };
  }

  /**
   * Sets or clears a tenant feature override (Stage G).
   */
  async setFeatureOverride(
    tenantId: string,
    featureKey: string,
    enabled: boolean,
    reason?: string,
    createdBy?: string,
  ): Promise<void> {
    await (this.prisma.unscoped as any).tenantFeatureOverride.upsert({
      where: { tenantId_featureKey: { tenantId, featureKey } },
      create: {
        tenantId,
        featureKey,
        enabled,
        reason,
        createdBy,
      },
      update: {
        enabled,
        reason,
        createdBy,
      },
    });
  }

  /**
   * Sets or clears a tenant limit override (Stage G).
   */
  async setLimitOverride(
    tenantId: string,
    limitKey: string,
    value: number | null,
    reason?: string,
    createdBy?: string,
  ): Promise<void> {
    await (this.prisma.unscoped as any).tenantLimitOverride.upsert({
      where: { tenantId_limitKey: { tenantId, limitKey } },
      create: {
        tenantId,
        limitKey,
        value,
        reason,
        createdBy,
      },
      update: {
        value,
        reason,
        createdBy,
      },
    });
  }

  /**
   * Removes a tenant feature override.
   */
  async removeFeatureOverride(tenantId: string, featureKey: string): Promise<void> {
    await (this.prisma.unscoped as any).tenantFeatureOverride.deleteMany({
      where: { tenantId, featureKey },
    });
  }

  /**
   * Removes a tenant limit override.
   */
  async removeLimitOverride(tenantId: string, limitKey: string): Promise<void> {
    await (this.prisma.unscoped as any).tenantLimitOverride.deleteMany({
      where: { tenantId, limitKey },
    });
  }
}
