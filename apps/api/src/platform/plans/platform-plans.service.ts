import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  PlatformPlanDetailView,
  PlatformPlanFeatureView,
  PlatformPlanLimitView,
  PlatformPlanPriceView,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import type { PlatformUserView } from '@hrm/shared-types';
import {
  CreatePlanPriceDto,
  CreatePlatformPlanDto,
  TogglePlanFeatureDto,
  UpdatePlanFeaturesDto,
  UpdatePlanLimitsDto,
  UpdatePlatformPlanDto,
} from './dto/platform-plans.dto';

const STANDARD_FEATURES = [
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

const STANDARD_LIMITS = ['employees', 'storage_gb', 'api_calls', 'companies'];

@Injectable()
export class PlatformPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  /**
   * Returns all plans ordered by rank with full features, limits, and prices.
   */
  async listPlans(): Promise<PlatformPlanDetailView[]> {
    const plans = await this.prisma.unscoped.plan.findMany({
      orderBy: { rank: 'asc' },
      include: {
        features: {
          orderBy: { featureKey: 'asc' },
        },
        limits: {
          orderBy: { limitKey: 'asc' },
        },
        prices: {
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });

    return plans.map((plan) => this.mapPlanToDetailView(plan));
  }

  /**
   * Get single plan by ID.
   */
  async getPlan(id: string): Promise<PlatformPlanDetailView> {
    const plan = await this.prisma.unscoped.plan.findUnique({
      where: { id },
      include: {
        features: {
          orderBy: { featureKey: 'asc' },
        },
        limits: {
          orderBy: { limitKey: 'asc' },
        },
        prices: {
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Plan with ID '${id}' was not found`,
      });
    }

    return this.mapPlanToDetailView(plan);
  }

  /**
   * Create a new plan.
   */
  async createPlan(
    dto: CreatePlatformPlanDto,
    actor?: PlatformUserView | null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformPlanDetailView> {
    const code = dto.code.trim().toLowerCase();

    const existing = await this.prisma.unscoped.plan.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `A plan with code '${code}' already exists`,
      });
    }

    const created = await this.prisma.unscoped.plan.create({
      data: {
        code,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        rank: dto.rank ?? 0,
        isActive: dto.isActive ?? true,
        // Seed default features (all false except core_hr)
        features: {
          create: STANDARD_FEATURES.map((featureKey) => ({
            featureKey,
            enabled: featureKey === 'core_hr',
          })),
        },
        // Seed default limits
        limits: {
          create: STANDARD_LIMITS.map((limitKey) => ({
            limitKey,
            value: limitKey === 'employees' ? 10 : limitKey === 'storage_gb' ? 1 : null,
          })),
        },
      },
      include: {
        features: true,
        limits: true,
        prices: true,
      },
    });

    await this.platformAudit.log({
      userId: actor?.id,
      action: 'platform.plan_created',
      module: 'billing',
      recordId: created.id,
      newValue: {
        code: created.code,
        name: created.name,
        rank: created.rank,
        isActive: created.isActive,
      },
      reason: `Platform staff created new plan '${created.name}' (${created.code})`,
      ipAddress,
      userAgent,
    });

    return this.mapPlanToDetailView(created);
  }

  /**
   * Update plan general metadata (name, description, public/hidden isActive, rank).
   */
  async updatePlan(
    id: string,
    dto: UpdatePlatformPlanDto,
    actor?: PlatformUserView | null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformPlanDetailView> {
    const existing = await this.prisma.unscoped.plan.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Plan with ID '${id}' was not found`,
      });
    }

    if (dto.code && dto.code.trim().toLowerCase() !== existing.code) {
      const codeTaken = await this.prisma.unscoped.plan.findUnique({
        where: { code: dto.code.trim().toLowerCase() },
      });
      if (codeTaken) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: `A plan with code '${dto.code}' already exists`,
        });
      }
    }

    const updated = await this.prisma.unscoped.plan.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.code ? { code: dto.code.trim().toLowerCase() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() ?? null } : {}),
        ...(dto.rank !== undefined ? { rank: dto.rank } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        features: true,
        limits: true,
        prices: {
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });

    await this.platformAudit.log({
      userId: actor?.id,
      action: 'platform.plan_updated',
      module: 'billing',
      recordId: id,
      oldValue: {
        name: existing.name,
        code: existing.code,
        isActive: existing.isActive,
        rank: existing.rank,
      },
      newValue: {
        name: updated.name,
        code: updated.code,
        isActive: updated.isActive,
        rank: updated.rank,
      },
      reason: `Platform staff updated plan '${updated.name}' details`,
      ipAddress,
      userAgent,
    });

    return this.mapPlanToDetailView(updated);
  }

  /**
   * Bulk update limits for a plan.
   */
  async updateLimits(
    id: string,
    dto: UpdatePlanLimitsDto,
    actor?: PlatformUserView | null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformPlanDetailView> {
    const plan = await this.prisma.unscoped.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Plan with ID '${id}' was not found`,
      });
    }

    await this.prisma.unscoped.$transaction(
      dto.limits.map((item) =>
        this.prisma.unscoped.planLimit.upsert({
          where: {
            planId_limitKey: { planId: id, limitKey: item.limitKey },
          },
          create: {
            planId: id,
            limitKey: item.limitKey,
            value: item.value,
          },
          update: {
            value: item.value,
          },
        }),
      ),
    );

    await this.platformAudit.log({
      userId: actor?.id,
      action: 'platform.plan_limits_updated',
      module: 'billing',
      recordId: id,
      newValue: dto.limits,
      reason: `Platform staff updated limits for plan '${plan.name}'`,
      ipAddress,
      userAgent,
    });

    return this.getPlan(id);
  }

  /**
   * Bulk update features for a plan.
   */
  async updateFeatures(
    id: string,
    dto: UpdatePlanFeaturesDto,
    actor?: PlatformUserView | null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformPlanDetailView> {
    const plan = await this.prisma.unscoped.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Plan with ID '${id}' was not found`,
      });
    }

    await this.prisma.unscoped.$transaction(
      dto.features.map((item) =>
        this.prisma.unscoped.planFeature.upsert({
          where: {
            planId_featureKey: { planId: id, featureKey: item.featureKey },
          },
          create: {
            planId: id,
            featureKey: item.featureKey,
            enabled: item.enabled,
          },
          update: {
            enabled: item.enabled,
          },
        }),
      ),
    );

    await this.platformAudit.log({
      userId: actor?.id,
      action: 'platform.plan_features_updated',
      module: 'billing',
      recordId: id,
      newValue: dto.features,
      reason: `Platform staff updated feature flags for plan '${plan.name}'`,
      ipAddress,
      userAgent,
    });

    return this.getPlan(id);
  }

  /**
   * Single toggle for the Feature Matrix Grid.
   */
  async toggleFeature(
    dto: TogglePlanFeatureDto,
    actor?: PlatformUserView | null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformPlanFeatureView> {
    const plan = await this.prisma.unscoped.plan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Plan with ID '${dto.planId}' was not found`,
      });
    }

    const feature = await this.prisma.unscoped.planFeature.upsert({
      where: {
        planId_featureKey: { planId: dto.planId, featureKey: dto.featureKey },
      },
      create: {
        planId: dto.planId,
        featureKey: dto.featureKey,
        enabled: dto.enabled,
      },
      update: {
        enabled: dto.enabled,
      },
    });

    await this.platformAudit.log({
      userId: actor?.id,
      action: 'platform.plan_feature_toggled',
      module: 'billing',
      recordId: feature.id,
      newValue: {
        planId: dto.planId,
        featureKey: dto.featureKey,
        enabled: dto.enabled,
      },
      reason: `Platform staff toggled feature '${dto.featureKey}' to ${dto.enabled} on plan '${plan.name}'`,
      ipAddress,
      userAgent,
    });

    return {
      id: feature.id,
      planId: feature.planId,
      featureKey: feature.featureKey,
      enabled: feature.enabled,
    };
  }

  /**
   * Add a new effective-dated price point for a plan.
   *
   * BUSINESS RULE:
   * Changing a price applies to new subscriptions or renewals starting on/after
   * `effectiveFrom`. Existing subscribers are grandfathered and will never be
   * silently re-priced; earlier price records are preserved with an updated `effectiveTo`.
   */
  async createPrice(
    planId: string,
    dto: CreatePlanPriceDto,
    actor?: PlatformUserView | null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformPlanPriceView> {
    const plan = await this.prisma.unscoped.plan.findUnique({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Plan with ID '${planId}' was not found`,
      });
    }

    const currency = dto.currency.trim().toUpperCase();
    const effectiveFromDate = new Date(dto.effectiveFrom);
    if (isNaN(effectiveFromDate.getTime())) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid effectiveFrom date format',
      });
    }

    // Find any existing active price for this (plan, currency, cycle)
    const activePrice = await this.prisma.unscoped.planPrice.findFirst({
      where: {
        planId,
        currency,
        billingCycle: dto.billingCycle,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFromDate } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    // If an active price exists, set its effectiveTo to this new price's effectiveFrom date
    if (activePrice) {
      await this.prisma.unscoped.planPrice.update({
        where: { id: activePrice.id },
        data: { effectiveTo: effectiveFromDate },
      });
    }

    const createdPrice = await this.prisma.unscoped.planPrice.create({
      data: {
        planId,
        currency,
        billingCycle: dto.billingCycle,
        amount: dto.amount,
        perSeatAmount: dto.perSeatAmount ?? null,
        effectiveFrom: effectiveFromDate,
        effectiveTo: null,
      },
    });

    await this.platformAudit.log({
      userId: actor?.id,
      action: 'platform.plan_price_scheduled',
      module: 'billing',
      recordId: createdPrice.id,
      oldValue: activePrice
        ? {
            id: activePrice.id,
            amount: Number(activePrice.amount),
            perSeatAmount: activePrice.perSeatAmount ? Number(activePrice.perSeatAmount) : null,
            effectiveFrom: activePrice.effectiveFrom.toISOString(),
            effectiveTo: effectiveFromDate.toISOString(),
          }
        : null,
      newValue: {
        id: createdPrice.id,
        currency,
        billingCycle: dto.billingCycle,
        amount: dto.amount,
        perSeatAmount: dto.perSeatAmount ?? null,
        effectiveFrom: effectiveFromDate.toISOString(),
        effectiveTo: null,
      },
      reason: `Platform staff scheduled new ${currency} ${dto.billingCycle} price of ${dto.amount} for plan '${plan.name}' effective from ${effectiveFromDate.toISOString().slice(0, 10)}. Existing subscribers grandfathered.`,
      ipAddress,
      userAgent,
    });

    return {
      id: createdPrice.id,
      planId: createdPrice.planId,
      currency: createdPrice.currency,
      billingCycle: createdPrice.billingCycle as 'monthly' | 'annual',
      amount: Number(createdPrice.amount),
      perSeatAmount: createdPrice.perSeatAmount ? Number(createdPrice.perSeatAmount) : null,
      effectiveFrom: createdPrice.effectiveFrom.toISOString(),
      effectiveTo: createdPrice.effectiveTo ? createdPrice.effectiveTo.toISOString() : null,
    };
  }

  /**
   * Helper to format Prisma plan model to PlatformPlanDetailView DTO.
   */
  private mapPlanToDetailView(plan: any): PlatformPlanDetailView {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description ?? null,
      rank: plan.rank ?? 0,
      isActive: Boolean(plan.isActive),
      isCustom: Boolean(plan.isCustom),
      createdAt: plan.createdAt instanceof Date ? plan.createdAt.toISOString() : String(plan.createdAt),
      updatedAt: plan.updatedAt instanceof Date ? plan.updatedAt.toISOString() : String(plan.updatedAt),
      features: (plan.features ?? []).map((f: any) => ({
        id: f.id,
        planId: f.planId,
        featureKey: f.featureKey,
        enabled: Boolean(f.enabled),
      })),
      limits: (plan.limits ?? []).map((l: any) => ({
        id: l.id,
        planId: l.planId,
        limitKey: l.limitKey,
        value: l.value !== null && l.value !== undefined ? Number(l.value) : null,
      })),
      prices: (plan.prices ?? []).map((p: any) => ({
        id: p.id,
        planId: p.planId,
        currency: p.currency,
        billingCycle: p.billingCycle,
        amount: Number(p.amount),
        perSeatAmount: p.perSeatAmount !== null && p.perSeatAmount !== undefined ? Number(p.perSeatAmount) : null,
        effectiveFrom: p.effectiveFrom instanceof Date ? p.effectiveFrom.toISOString() : String(p.effectiveFrom),
        effectiveTo: p.effectiveTo instanceof Date ? p.effectiveTo.toISOString() : p.effectiveTo ?? null,
      })),
    };
  }
}
