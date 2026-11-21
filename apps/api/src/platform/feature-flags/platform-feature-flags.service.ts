import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  FeatureEvaluationResult,
  PlatformFeatureFlagView,
  TenantFeatureOverrideView,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { FeatureGateService } from '../../billing/feature-gate.service';
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
   * List all platform feature flags.
   */
  async listFlags(): Promise<PlatformFeatureFlagView[]> {
    const flags = await (this.prisma.unscoped as any).platformFeatureFlag.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return flags.map(this.mapFlagView);
  }

  /**
   * Get a single platform feature flag by key or ID.
   */
  async getFlag(keyOrId: string): Promise<PlatformFeatureFlagView> {
    const flag = await (this.prisma.unscoped as any).platformFeatureFlag.findFirst({
      where: {
        OR: [{ key: keyOrId }, { id: keyOrId }],
      },
    });

    if (!flag) {
      throw new NotFoundException(`Feature flag '${keyOrId}' not found.`);
    }

    return this.mapFlagView(flag);
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
