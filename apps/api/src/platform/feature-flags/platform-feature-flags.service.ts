import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  FeatureEvaluationResult,
  FlagTenantOverrideDetailView,
  PlatformFeatureFlagDetailView,
  PlatformFeatureFlagView,
  TenantFeatureOverrideView,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { FeatureGateService } from '../../billing/feature-gate.service';
import { tenantHasFeature } from '../../billing/plan-features.constants';
import {
  CreatePlatformFeatureFlagDto,
  SetTenantFeatureOverrideDto,
  UpdatePlatformFeatureFlagDto,
} from './dto/platform-feature-flags.dto';

@Injectable()
export class PlatformFeatureFlagsService {
  private readonly logger = new Logger(PlatformFeatureFlagsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: PlatformAuditService,
    private readonly featureGateService: FeatureGateService,
  ) {}

  /**
   * Seed default catalog flags if none exist in the database.
   */
  private async ensureDefaultFlags(): Promise<void> {
    try {
      const count = await (this.prisma.unscoped as any).platformFeatureFlag.count();
      if (count > 0) return;

      const defaults = [
        { key: 'api_access', description: 'Public REST API & Webhook Dispatch Access', defaultState: false, rolloutPercentage: 100 },
        { key: 'sso', description: 'SAML 2.0 / OIDC Single Sign-On Authentication', defaultState: false, rolloutPercentage: 100 },
        { key: 'custom_payroll_rules', description: 'Custom Statutory & Country Rule Engine', defaultState: false, rolloutPercentage: 100 },
        { key: 'advanced_workflow', description: 'Multi-tier Approval Routing & Conditional Steps', defaultState: false, rolloutPercentage: 100 },
        { key: 'ai_insights', description: 'AI Workforce Insights & Anomaly Detection', defaultState: false, rolloutPercentage: 35 },
        { key: 'payroll_v2', description: 'Deterministic Payroll Engine v2 Calculation Pipeline', defaultState: true, rolloutPercentage: 100 },
        { key: 'mobile_clock', description: 'Offline-First Mobile Attendance & Geo-Fencing', defaultState: true, rolloutPercentage: 70 },
        { key: 'custom_reports', description: 'Custom Visual Drag-and-Drop Report Builder', defaultState: false, rolloutPercentage: 50 },
        { key: 'multi_currency', description: 'Multi-Currency Payroll & International Direct Deposit', defaultState: false, rolloutPercentage: 20 },
      ];

      for (const d of defaults) {
        await (this.prisma.unscoped as any).platformFeatureFlag.create({
          data: d,
        });
      }
      this.logger.log(`Initialized ${defaults.length} default platform feature flags.`);
    } catch (err) {
      this.logger.warn(`Could not seed default feature flags: ${err}`);
    }
  }

  /**
   * List all platform feature flags with rollout percentages and override counts.
   */
  async listFlags(): Promise<PlatformFeatureFlagView[]> {
    await this.ensureDefaultFlags();

    const flags = await (this.prisma.unscoped as any).platformFeatureFlag.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Query override counts
    let countMap = new Map<string, number>();
    try {
      const counts = await (this.prisma.unscoped as any).tenantFeatureOverride.groupBy({
        by: ['featureKey'],
        _count: { id: true },
      });
      for (const c of counts) {
        countMap.set(c.featureKey, c._count.id);
      }
    } catch {
      // ignore
    }

    return flags.map((f: any) => ({
      ...this.mapFlagView(f),
      overrideCount: countMap.get(f.key) || 0,
    }));
  }

  /**
   * Get a single platform feature flag by key or ID with override count.
   */
  async getFlag(keyOrId: string): Promise<PlatformFeatureFlagView> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(keyOrId);
    const flag = await (this.prisma.unscoped as any).platformFeatureFlag.findFirst({
      where: isUuid
        ? { OR: [{ key: keyOrId }, { id: keyOrId }] }
        : { key: keyOrId },
    });

    if (!flag) {
      throw new NotFoundException(`Feature flag '${keyOrId}' not found.`);
    }

    const overrideCount = await (this.prisma.unscoped as any).tenantFeatureOverride.count({
      where: { featureKey: flag.key },
    }).catch(() => 0);

    return {
      ...this.mapFlagView(flag),
      overrideCount,
    };
  }

  /**
   * List all tenant overrides for a specific flag with plan default comparisons.
   */
  async getFlagOverrides(key: string): Promise<FlagTenantOverrideDetailView[]> {
    const overrides = await (this.prisma.unscoped as any).tenantFeatureOverride.findMany({
      where: { featureKey: key },
      include: {
        tenant: {
          include: {
            subscriptions: {
              where: { status: { in: ['active', 'past_due', 'trialing'] } },
              include: { plan: true },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    return overrides.map((o: any) => {
      const tenant = o.tenant;
      const sub = tenant?.subscriptions?.[0];
      const planCode = sub?.plan?.code ?? tenant?.planId ?? 'starter';
      const planName = sub?.plan?.name ?? 'Standard Plan';

      const planDefault = tenantHasFeature(
        planCode as any,
        key as any,
      );
      const isExpired = Boolean(o.expiresAt && new Date(o.expiresAt) <= now);
      const effectiveEnabled = isExpired ? planDefault : Boolean(o.enabled);
      const effectiveSource = isExpired ? 'plan_default' : 'tenant_override';

      let explanation = '';
      if (isExpired) {
        explanation = `Override expired on ${new Date(o.expiresAt).toLocaleDateString()}. Reverted to plan default (${planDefault ? 'Enabled' : 'Disabled'} by ${planName}).`;
      } else if (o.enabled) {
        explanation = planDefault
          ? `Explicitly granted by override (Plan default is also Enabled by ${planName}).`
          : `Explicitly granted by override (Overrides plan default: Disabled by ${planName}).`;
      } else {
        explanation = planDefault
          ? `Explicitly restricted by override (Overrides plan default: Enabled by ${planName}).`
          : `Explicitly restricted by override (Plan default is also Disabled by ${planName}).`;
      }

      return {
        id: o.id,
        tenantId: o.tenantId,
        tenantName: tenant?.name ?? 'Unknown Tenant',
        tenantSubdomain: tenant?.subdomain ?? 'unknown',
        featureKey: o.featureKey,
        enabled: Boolean(o.enabled),
        reason: o.reason ?? null,
        expiresAt: o.expiresAt ? new Date(o.expiresAt).toISOString() : null,
        isExpired,
        createdAt: new Date(o.createdAt).toISOString(),
        createdBy: o.createdBy ?? null,
        planCode,
        planName,
        planDefault,
        effectiveEnabled,
        effectiveSource,
        explanation,
      };
    });
  }

  /**
   * Get feature flag details along with all active overrides and evaluation metadata.
   */
  async getFlagDetail(key: string): Promise<PlatformFeatureFlagDetailView> {
    const flag = await this.getFlag(key);
    const overrides = await this.getFlagOverrides(flag.key);
    return {
      ...flag,
      overrideCount: overrides.length,
      overrides,
    };
  }

  /**
   * Create a new platform feature flag.
   * Every change writes to platform_audit_logs.
   */
  async createFlag(
    dto: CreatePlatformFeatureFlagDto,
    actor?: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformFeatureFlagView> {
    const existing = await (this.prisma.unscoped as any).platformFeatureFlag.findUnique({
      where: { key: dto.key },
    });

    if (existing) {
      throw new ConflictException(`Feature flag with key '${dto.key}' already exists.`);
    }

    const flag = await (this.prisma.unscoped as any).platformFeatureFlag.create({
      data: {
        key: dto.key,
        description: dto.description ?? null,
        defaultState: dto.defaultState ?? false,
        rolloutPercentage: dto.rolloutPercentage ?? 0,
        metadata: dto.metadata ?? null,
        createdBy: actor?.id ?? actor?.sub ?? null,
      },
    });

    await this.auditService.log({
      userId: actor?.id ?? actor?.sub ?? null,
      action: 'platform_feature_flag.create',
      module: 'feature_flags',
      recordId: flag.key,
      reason: `Created feature flag ${flag.key} (default: ${flag.defaultState}, rollout: ${flag.rolloutPercentage}%)`,
      newValue: {
        key: flag.key,
        description: flag.description,
        defaultState: flag.defaultState,
        rolloutPercentage: flag.rolloutPercentage,
        metadata: flag.metadata,
      },
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });

    return this.mapFlagView(flag);
  }

  /**
   * Update an existing platform feature flag.
   * Every change writes to platform_audit_logs.
   */
  async updateFlag(
    key: string,
    dto: UpdatePlatformFeatureFlagDto,
    actor?: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformFeatureFlagView> {
    const existing = await (this.prisma.unscoped as any).platformFeatureFlag.findUnique({
      where: { key },
    });

    if (!existing) {
      throw new NotFoundException(`Feature flag '${key}' not found.`);
    }

    const updated = await (this.prisma.unscoped as any).platformFeatureFlag.update({
      where: { key },
      data: {
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.defaultState !== undefined ? { defaultState: dto.defaultState } : {}),
        ...(dto.rolloutPercentage !== undefined ? { rolloutPercentage: dto.rolloutPercentage } : {}),
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
      },
    });

    await this.auditService.log({
      userId: actor?.id ?? actor?.sub ?? null,
      action: 'platform_feature_flag.update',
      module: 'feature_flags',
      recordId: key,
      reason: `Updated feature flag ${key}`,
      oldValue: {
        description: existing.description,
        defaultState: existing.defaultState,
        rolloutPercentage: existing.rolloutPercentage,
        metadata: existing.metadata,
      },
      newValue: {
        description: updated.description,
        defaultState: updated.defaultState,
        rolloutPercentage: updated.rolloutPercentage,
        metadata: updated.metadata,
      },
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });

    return this.mapFlagView(updated);
  }

  /**
   * Delete a platform feature flag.
   * Every change writes to platform_audit_logs.
   */
  async deleteFlag(
    key: string,
    actor?: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const existing = await (this.prisma.unscoped as any).platformFeatureFlag.findUnique({
      where: { key },
    });

    if (!existing) {
      throw new NotFoundException(`Feature flag '${key}' not found.`);
    }

    await (this.prisma.unscoped as any).platformFeatureFlag.delete({
      where: { key },
    });

    await this.auditService.log({
      userId: actor?.id ?? actor?.sub ?? null,
      action: 'platform_feature_flag.delete',
      module: 'feature_flags',
      recordId: key,
      reason: `Deleted feature flag ${key}`,
      oldValue: {
        key: existing.key,
        description: existing.description,
        defaultState: existing.defaultState,
        rolloutPercentage: existing.rolloutPercentage,
      },
      newValue: null,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });
  }

  /**
   * List feature overrides for a specific tenant.
   */
  async listTenantOverrides(tenantId: string): Promise<TenantFeatureOverrideView[]> {
    const overrides = await (this.prisma.unscoped as any).tenantFeatureOverride.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    return overrides.map((o: any) => ({
      id: o.id,
      tenantId: o.tenantId,
      key: o.featureKey,
      value: Boolean(o.enabled),
      reason: o.reason ?? null,
      expiresAt: o.expiresAt ? new Date(o.expiresAt).toISOString() : null,
      createdBy: o.createdBy ?? null,
      createdAt: new Date(o.createdAt).toISOString(),
      updatedAt: new Date(o.updatedAt).toISOString(),
      isExpired: Boolean(o.expiresAt && new Date(o.expiresAt) <= now),
    }));
  }

  /**
   * Sets or updates a tenant feature override.
   * Every change writes to platform_audit_logs.
   */
  async setTenantOverride(
    tenantId: string,
    dto: SetTenantFeatureOverrideDto,
    actor?: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TenantFeatureOverrideView> {
    const userId = actor?.id ?? actor?.sub ?? null;
    const actorEmail = actor?.email ?? null;

    await this.featureGateService.setFeatureOverride(
      tenantId,
      dto.key,
      dto.value,
      dto.reason,
      userId,
      dto.expiresAt,
      actorEmail,
    );

    const override = await (this.prisma.unscoped as any).tenantFeatureOverride.findUnique({
      where: { tenantId_featureKey: { tenantId, featureKey: dto.key } },
    });

    const now = new Date();
    return {
      id: override.id,
      tenantId: override.tenantId,
      key: override.featureKey,
      value: Boolean(override.enabled),
      reason: override.reason ?? null,
      expiresAt: override.expiresAt ? new Date(override.expiresAt).toISOString() : null,
      createdBy: override.createdBy ?? null,
      createdAt: new Date(override.createdAt).toISOString(),
      updatedAt: new Date(override.updatedAt).toISOString(),
      isExpired: Boolean(override.expiresAt && new Date(override.expiresAt) <= now),
    };
  }

  /**
   * Removes a tenant feature override.
   * Every change writes to platform_audit_logs.
   */
  async removeTenantOverride(
    tenantId: string,
    key: string,
    actor?: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const userId = actor?.id ?? actor?.sub ?? null;
    await this.featureGateService.removeFeatureOverride(
      tenantId,
      key,
      userId,
      `Removed override for ${key} on tenant ${tenantId}`,
    );
  }

  /**
   * Evaluates a feature key for a given tenant using the strict 3-order chain.
   */
  async evaluateFeature(tenantId: string, key: string): Promise<FeatureEvaluationResult> {
    return this.featureGateService.evaluateFeature(tenantId, key);
  }

  private mapFlagView(flag: any): PlatformFeatureFlagView {
    return {
      id: flag.id,
      key: flag.key,
      description: flag.description ?? null,
      defaultState: Boolean(flag.defaultState),
      rolloutPercentage: Number(flag.rolloutPercentage ?? 0),
      metadata: flag.metadata ?? null,
      createdBy: flag.createdBy ?? null,
      createdAt: new Date(flag.createdAt).toISOString(),
      updatedAt: new Date(flag.updatedAt).toISOString(),
    };
  }
}
