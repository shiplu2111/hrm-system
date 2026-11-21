import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  PlatformSubscriptionDetailView,
  PlatformSubscriptionListItem,
  SubscriptionActionType,
  SubscriptionChangeRecord,
  SubscriptionState,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import type {
  PlatformApplyDiscountDto,
  PlatformCancelSubscriptionDto,
  PlatformChangePlanDto,
  PlatformExtendTrialDto,
  PlatformPauseSubscriptionDto,
  PlatformResumeSubscriptionDto,
  QueryPlatformSubscriptionsDto,
} from './dto/platform-subscriptions.dto';

@Injectable()
export class PlatformSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: PlatformAuditService,
  ) {}

  async listSubscriptions(
    query?: QueryPlatformSubscriptionsDto,
  ): Promise<PlatformSubscriptionListItem[]> {
    const where: Prisma.SubscriptionWhereInput = {};

    if (query?.status) {
      where.status = query.status as any;
    }

    if (query?.planId) {
      where.planId = query.planId;
    }

    const subscriptions = await this.prisma.unscoped.subscription.findMany({
      where,
      include: {
        tenant: true,
        plan: {
          include: {
            prices: {
              where: {
                effectiveFrom: { lte: new Date() },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
              },
            },
            limits: true,
          },
        },
        pendingPlan: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const tenantIds = subscriptions.map((s) => s.tenantId);
    const employeeCounts = await this.prisma.unscoped.employee.groupBy({
      by: ['tenantId'],
      _count: { id: true },
      where: { tenantId: { in: tenantIds } },
    });
    const employeeCountMap = new Map<string, number>(
      employeeCounts.map((ec) => [ec.tenantId, ec._count.id]),
    );

    let items: PlatformSubscriptionListItem[] = subscriptions.map((sub) => {
      const activePrice =
        sub.plan.prices.find(
          (p) =>
            p.currency === sub.currency &&
            p.billingCycle === sub.billingCycle,
        ) ?? sub.plan.prices[0];

      const maxEmpLimit = sub.plan.limits.find((l) => l.limitKey === 'employees');

      return {
        id: sub.id,
        tenantId: sub.tenantId,
        tenantName: sub.tenant.name,
        tenantSubdomain: sub.tenant.subdomain,
        planId: sub.planId,
        planCode: sub.plan.code,
        planName: sub.plan.name,
        status: sub.status as SubscriptionState,
        billingCycle: sub.billingCycle as 'monthly' | 'annual',
        currency: sub.currency,
        baseAmount: activePrice ? Number(activePrice.amount) : 0,
        perSeatAmount:
          activePrice && activePrice.perSeatAmount !== null
            ? Number(activePrice.perSeatAmount)
            : null,
        currentPeriodStart: sub.currentPeriodStart.toISOString(),
        currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
        nextBillingAt: sub.nextBillingAt.toISOString(),
        trialEndsAt: sub.trialEndsAt ? sub.trialEndsAt.toISOString() : null,
        discountPercent:
          sub.discountPercent !== null ? Number(sub.discountPercent) : null,
        creditBalance: Number(sub.creditBalance || 0),
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        canceledAt: sub.canceledAt ? sub.canceledAt.toISOString() : null,
        pausedAt: sub.pausedAt ? sub.pausedAt.toISOString() : null,
        pendingPlan: sub.pendingPlan
          ? {
              id: sub.pendingPlan.id,
              code: sub.pendingPlan.code,
              name: sub.pendingPlan.name,
            }
          : null,
        employeeCount: employeeCountMap.get(sub.tenantId) ?? 0,
        maxEmployees: maxEmpLimit ? maxEmpLimit.value : null,
        createdAt: sub.createdAt.toISOString(),
      };
    });

    if (query?.search) {
      const q = query.search.toLowerCase();
      items = items.filter(
        (i) =>
          i.tenantName.toLowerCase().includes(q) ||
          i.tenantSubdomain.toLowerCase().includes(q) ||
          i.planName.toLowerCase().includes(q) ||
          i.planCode.toLowerCase().includes(q),
      );
    }

    return items;
  }

  async getSubscriptionDetail(id: string): Promise<PlatformSubscriptionDetailView> {
    const sub = await this.prisma.unscoped.subscription.findUnique({
      where: { id },
      include: {
        tenant: true,
        plan: {
          include: {
            prices: {
              where: {
                effectiveFrom: { lte: new Date() },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
              },
            },
            limits: true,
            features: true,
          },
        },
        pendingPlan: true,
        changes: {
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!sub) {
      throw new NotFoundException(`Subscription ${id} not found.`);
    }

    const employeeCount = await this.prisma.unscoped.employee.count({
      where: { tenantId: sub.tenantId },
    });

    // Lookup plan names for change history
    const allPlanIds = new Set<string>();
    sub.changes.forEach((c) => {
      if (c.fromPlanId) allPlanIds.add(c.fromPlanId);
      if (c.toPlanId) allPlanIds.add(c.toPlanId);
    });

    const referencedPlans = await this.prisma.unscoped.plan.findMany({
      where: { id: { in: Array.from(allPlanIds) } },
      select: { id: true, name: true, code: true },
    });
    const planNameMap = new Map<string, string>(
      referencedPlans.map((p) => [p.id, p.name]),
    );

    const activePrice =
      sub.plan.prices.find(
        (p) =>
          p.currency === sub.currency &&
          p.billingCycle === sub.billingCycle,
      ) ?? sub.plan.prices[0];

    const maxEmpLimit = sub.plan.limits.find((l) => l.limitKey === 'employees');

    const changes: SubscriptionChangeRecord[] = sub.changes.map((c) => ({
      id: c.id,
      subscriptionId: c.subscriptionId,
      tenantId: c.tenantId,
      action: c.action as SubscriptionActionType,
      fromPlanId: c.fromPlanId,
      fromPlanName: c.fromPlanId ? planNameMap.get(c.fromPlanId) ?? null : null,
      toPlanId: c.toPlanId,
      toPlanName: c.toPlanId ? planNameMap.get(c.toPlanId) ?? null : null,
      fromStatus: c.fromStatus,
      toStatus: c.toStatus,
      amount: c.amount !== null ? Number(c.amount) : null,
      currency: c.currency,
      reason: c.reason,
      actorEmail: c.actorEmail,
      actorRole: c.actorRole,
      metadata: (c.metadata as Record<string, any>) ?? null,
      createdAt: c.createdAt.toISOString(),
    }));

    return {
      id: sub.id,
      tenantId: sub.tenantId,
      tenantName: sub.tenant.name,
      tenantSubdomain: sub.tenant.subdomain,
      planId: sub.planId,
      planCode: sub.plan.code,
      planName: sub.plan.name,
      status: sub.status as SubscriptionState,
      billingCycle: sub.billingCycle as 'monthly' | 'annual',
      currency: sub.currency,
      baseAmount: activePrice ? Number(activePrice.amount) : 0,
      perSeatAmount:
        activePrice && activePrice.perSeatAmount !== null
          ? Number(activePrice.perSeatAmount)
          : null,
      currentPeriodStart: sub.currentPeriodStart.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      nextBillingAt: sub.nextBillingAt.toISOString(),
      trialEndsAt: sub.trialEndsAt ? sub.trialEndsAt.toISOString() : null,
      discountPercent:
        sub.discountPercent !== null ? Number(sub.discountPercent) : null,
      discountReason: sub.discountReason,
      creditBalance: Number(sub.creditBalance || 0),
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      canceledAt: sub.canceledAt ? sub.canceledAt.toISOString() : null,
      cancelReason: sub.cancelReason,
      pausedAt: sub.pausedAt ? sub.pausedAt.toISOString() : null,
      pauseReason: sub.pauseReason,
      pendingPlan: sub.pendingPlan
        ? {
            id: sub.pendingPlan.id,
            code: sub.pendingPlan.code,
            name: sub.pendingPlan.name,
          }
        : null,
      employeeCount,
      maxEmployees: maxEmpLimit ? maxEmpLimit.value : null,
      createdAt: sub.createdAt.toISOString(),
      changes,
      recentInvoices: sub.invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        total: Number(inv.total),
        amountPaid: Number(inv.amountPaid),
        amountDue: Number(inv.amountDue),
        status: inv.status as any,
        dueDate: inv.dueDate.toISOString(),
        paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
      })),
      limits: sub.plan.limits.map((l) => ({
        id: l.id,
        planId: l.planId,
        limitKey: l.limitKey,
        value: l.value,
      })),
      features: sub.plan.features.map((f) => ({
        id: f.id,
        planId: f.planId,
        featureKey: f.featureKey,
        enabled: f.enabled,
      })),
    };
  }

  async changePlan(
    id: string,
    dto: PlatformChangePlanDto,
    actor?: { id?: string; email?: string; roleName?: string },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformSubscriptionDetailView> {
    const sub = await this.prisma.unscoped.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!sub) {
      throw new NotFoundException(`Subscription ${id} not found.`);
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dto.targetPlanId);
    const targetPlan = await this.prisma.unscoped.plan.findFirst({
      where: isUuid ? { id: dto.targetPlanId } : { code: dto.targetPlanId },
    });

    if (!targetPlan) {
      throw new NotFoundException(`Target plan ${dto.targetPlanId} not found.`);
    }

    if (targetPlan.id === sub.planId && !sub.pendingPlanId) {
      throw new BadRequestException('Target plan is identical to the current plan.');
    }

    const oldPlanId = sub.planId;
    const isImmediate = dto.effectiveImmediately ?? true;

    if (isImmediate) {
      await this.prisma.unscoped.$transaction([
        this.prisma.unscoped.subscription.update({
          where: { id },
          data: {
            planId: targetPlan.id,
            pendingPlanId: null,
          },
        }),
        this.prisma.unscoped.tenant.update({
          where: { id: sub.tenantId },
          data: { planId: targetPlan.id },
        }),
        this.prisma.unscoped.subscriptionChange.create({
          data: {
            tenantId: sub.tenantId,
            subscriptionId: sub.id,
            action: 'plan_change',
            fromPlanId: oldPlanId,
            toPlanId: targetPlan.id,
            reason: dto.reason || 'Plan changed by platform administrator (immediate)',
            actorId: actor?.id,
            actorEmail: actor?.email,
            actorRole: actor?.roleName,
            metadata: { effectiveImmediately: true },
          },
        }),
      ]);
    } else {
      await this.prisma.unscoped.$transaction([
        this.prisma.unscoped.subscription.update({
          where: { id },
          data: {
            pendingPlanId: targetPlan.id,
          },
        }),
        this.prisma.unscoped.subscriptionChange.create({
          data: {
            tenantId: sub.tenantId,
            subscriptionId: sub.id,
            action: 'plan_change',
            fromPlanId: oldPlanId,
            toPlanId: targetPlan.id,
            reason: `${dto.reason || 'Downgrade/switch'} (Scheduled for next renewal: ${sub.currentPeriodEnd.toLocaleDateString()})`,
            actorId: actor?.id,
            actorEmail: actor?.email,
            actorRole: actor?.roleName,
            metadata: {
              effectiveImmediately: false,
              effectiveDate: sub.currentPeriodEnd.toISOString(),
            },
          },
        }),
      ]);
    }

    await this.auditService.log({
      userId: actor?.id,
      action: 'SUBSCRIPTION_PLAN_CHANGE',
      module: 'billing',
      recordId: sub.id,
      reason: dto.reason,
      oldValue: { planId: oldPlanId },
      newValue: {
        planId: isImmediate ? targetPlan.id : oldPlanId,
        pendingPlanId: isImmediate ? null : targetPlan.id,
      },
      ipAddress,
      userAgent,
    });

    return this.getSubscriptionDetail(id);
  }

  async extendTrial(
    id: string,
    dto: PlatformExtendTrialDto,
    actor?: { id?: string; email?: string; roleName?: string },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformSubscriptionDetailView> {
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('A reason is mandatory for trial extension.');
    }

    const sub = await this.prisma.unscoped.subscription.findUnique({
      where: { id },
    });

    if (!sub) {
      throw new NotFoundException(`Subscription ${id} not found.`);
    }

    let newTrialEnd: Date;
    if (dto.newTrialEndsAt) {
      newTrialEnd = new Date(dto.newTrialEndsAt);
      if (isNaN(newTrialEnd.getTime())) {
        throw new BadRequestException('Invalid newTrialEndsAt date format.');
      }
    } else {
      const days = dto.days ?? 14;
      const baseDate =
        sub.trialEndsAt && sub.trialEndsAt > new Date()
          ? sub.trialEndsAt
          : new Date();
      newTrialEnd = new Date(baseDate.getTime() + days * 86400000);
    }

    const updateData: Prisma.SubscriptionUpdateInput = {
      trialEndsAt: newTrialEnd,
    };

    if (['trialing', 'past_due', 'cancelled'].includes(sub.status)) {
      updateData.status = 'trialing';
    }

    await this.prisma.unscoped.$transaction([
      this.prisma.unscoped.subscription.update({
        where: { id },
        data: updateData,
      }),
      this.prisma.unscoped.subscriptionChange.create({
        data: {
          tenantId: sub.tenantId,
          subscriptionId: sub.id,
          action: 'trial_extension',
          reason: dto.reason,
          actorId: actor?.id,
          actorEmail: actor?.email,
          actorRole: actor?.roleName,
          metadata: {
            previousTrialEnd: sub.trialEndsAt?.toISOString() ?? null,
            newTrialEnd: newTrialEnd.toISOString(),
            days: dto.days,
          },
        },
      }),
    ]);

    await this.auditService.log({
      userId: actor?.id,
      action: 'SUBSCRIPTION_TRIAL_EXTEND',
      module: 'billing',
      recordId: sub.id,
      reason: dto.reason,
      oldValue: { trialEndsAt: sub.trialEndsAt },
      newValue: { trialEndsAt: newTrialEnd },
      ipAddress,
      userAgent,
    });

    return this.getSubscriptionDetail(id);
  }

  async applyDiscountOrCredit(
    id: string,
    dto: PlatformApplyDiscountDto,
    actor?: { id?: string; email?: string; roleName?: string },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformSubscriptionDetailView> {
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('A reason is mandatory for applying discounts or credits.');
    }

    const sub = await this.prisma.unscoped.subscription.findUnique({
      where: { id },
    });

    if (!sub) {
      throw new NotFoundException(`Subscription ${id} not found.`);
    }

    if (dto.discountPercent === undefined && dto.creditAmount === undefined) {
      throw new BadRequestException('Either discountPercent or creditAmount must be provided.');
    }

    const updateData: Prisma.SubscriptionUpdateInput = {};
    const changeCreates: any[] = [];

    if (dto.discountPercent !== undefined) {
      if (dto.discountPercent < 0 || dto.discountPercent > 100) {
        throw new BadRequestException('Discount percent must be between 0 and 100.');
      }
      updateData.discountPercent = new Prisma.Decimal(dto.discountPercent);
      updateData.discountReason = dto.reason;

      changeCreates.push(
        this.prisma.unscoped.subscriptionChange.create({
          data: {
            tenantId: sub.tenantId,
            subscriptionId: sub.id,
            action: 'discount_applied',
            amount: new Prisma.Decimal(dto.discountPercent),
            reason: dto.reason,
            actorId: actor?.id,
            actorEmail: actor?.email,
            actorRole: actor?.roleName,
          },
        }),
      );
    }

    if (dto.creditAmount !== undefined) {
      if (dto.creditAmount <= 0) {
        throw new BadRequestException('Credit amount must be greater than 0.');
      }
      const newCreditBalance = new Prisma.Decimal(sub.creditBalance || 0).plus(
        new Prisma.Decimal(dto.creditAmount),
      );
      updateData.creditBalance = newCreditBalance;

      changeCreates.push(
        this.prisma.unscoped.subscriptionChange.create({
          data: {
            tenantId: sub.tenantId,
            subscriptionId: sub.id,
            action: 'credit_applied',
            amount: new Prisma.Decimal(dto.creditAmount),
            currency: sub.currency,
            reason: dto.reason,
            actorId: actor?.id,
            actorEmail: actor?.email,
            actorRole: actor?.roleName,
          },
        }),
      );
    }

    await this.prisma.unscoped.$transaction([
      this.prisma.unscoped.subscription.update({
        where: { id },
        data: updateData,
      }),
      ...changeCreates,
    ]);

    await this.auditService.log({
      userId: actor?.id,
      action: 'SUBSCRIPTION_DISCOUNT_CREDIT',
      module: 'billing',
      recordId: sub.id,
      reason: dto.reason,
      oldValue: {
        discountPercent: sub.discountPercent,
        creditBalance: sub.creditBalance,
      },
      newValue: {
        discountPercent: updateData.discountPercent ?? sub.discountPercent,
        creditBalance: updateData.creditBalance ?? sub.creditBalance,
      },
      ipAddress,
      userAgent,
    });

    return this.getSubscriptionDetail(id);
  }

  async pauseSubscription(
    id: string,
    dto: PlatformPauseSubscriptionDto,
    actor?: { id?: string; email?: string; roleName?: string },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformSubscriptionDetailView> {
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('A reason is mandatory for pausing a subscription.');
    }

    const sub = await this.prisma.unscoped.subscription.findUnique({
      where: { id },
    });

    if (!sub) {
      throw new NotFoundException(`Subscription ${id} not found.`);
    }

    if (sub.status === 'paused') {
      throw new BadRequestException('Subscription is already paused.');
    }

    const oldStatus = sub.status;
    const now = new Date();

    await this.prisma.unscoped.$transaction([
      this.prisma.unscoped.subscription.update({
        where: { id },
        data: {
          status: 'paused',
          pausedAt: now,
          pauseReason: dto.reason,
        },
      }),
      this.prisma.unscoped.subscriptionChange.create({
        data: {
          tenantId: sub.tenantId,
          subscriptionId: sub.id,
          action: 'pause',
          fromStatus: oldStatus,
          toStatus: 'paused',
          reason: dto.reason,
          actorId: actor?.id,
          actorEmail: actor?.email,
          actorRole: actor?.roleName,
        },
      }),
    ]);

    await this.auditService.log({
      userId: actor?.id,
      action: 'SUBSCRIPTION_PAUSE',
      module: 'billing',
      recordId: sub.id,
      reason: dto.reason,
      oldValue: { status: oldStatus },
      newValue: { status: 'paused', pausedAt: now },
      ipAddress,
      userAgent,
    });

    return this.getSubscriptionDetail(id);
  }

  async resumeSubscription(
    id: string,
    dto?: PlatformResumeSubscriptionDto,
    actor?: { id?: string; email?: string; roleName?: string },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformSubscriptionDetailView> {
    const sub = await this.prisma.unscoped.subscription.findUnique({
      where: { id },
    });

    if (!sub) {
      throw new NotFoundException(`Subscription ${id} not found.`);
    }

    if (sub.status !== 'paused') {
      throw new BadRequestException('Subscription is not currently paused.');
    }

    const now = new Date();
    const reason = dto?.reason || 'Subscription resumed by platform administrator';

    await this.prisma.unscoped.$transaction([
      this.prisma.unscoped.subscription.update({
        where: { id },
        data: {
          status: 'active',
          pausedAt: null,
          pauseReason: null,
        },
      }),
      this.prisma.unscoped.subscriptionChange.create({
        data: {
          tenantId: sub.tenantId,
          subscriptionId: sub.id,
          action: 'resume',
          fromStatus: 'paused',
          toStatus: 'active',
          reason,
          actorId: actor?.id,
          actorEmail: actor?.email,
          actorRole: actor?.roleName,
        },
      }),
    ]);

    await this.auditService.log({
      userId: actor?.id,
      action: 'SUBSCRIPTION_RESUME',
      module: 'billing',
      recordId: sub.id,
      reason,
      oldValue: { status: 'paused' },
      newValue: { status: 'active' },
      ipAddress,
      userAgent,
    });

    return this.getSubscriptionDetail(id);
  }

  async cancelSubscription(
    id: string,
    dto: PlatformCancelSubscriptionDto,
    actor?: { id?: string; email?: string; roleName?: string },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformSubscriptionDetailView> {
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('A reason is mandatory for cancelling a subscription.');
    }

    const sub = await this.prisma.unscoped.subscription.findUnique({
      where: { id },
    });

    if (!sub) {
      throw new NotFoundException(`Subscription ${id} not found.`);
    }

    if (sub.status === 'cancelled') {
      throw new BadRequestException('Subscription is already cancelled.');
    }

    const oldStatus = sub.status;
    const now = new Date();

    if (dto.cancelImmediately) {
      await this.prisma.unscoped.$transaction([
        this.prisma.unscoped.subscription.update({
          where: { id },
          data: {
            status: 'cancelled',
            canceledAt: now,
            cancelReason: dto.reason,
            cancelAtPeriodEnd: false,
          },
        }),
        this.prisma.unscoped.subscriptionChange.create({
          data: {
            tenantId: sub.tenantId,
            subscriptionId: sub.id,
            action: 'cancel',
            fromStatus: oldStatus,
            toStatus: 'cancelled',
            reason: dto.reason,
            actorId: actor?.id,
            actorEmail: actor?.email,
            actorRole: actor?.roleName,
            metadata: { cancelImmediately: true },
          },
        }),
      ]);
    } else {
      await this.prisma.unscoped.$transaction([
        this.prisma.unscoped.subscription.update({
          where: { id },
          data: {
            cancelAtPeriodEnd: true,
            cancelReason: dto.reason,
          },
        }),
        this.prisma.unscoped.subscriptionChange.create({
          data: {
            tenantId: sub.tenantId,
            subscriptionId: sub.id,
            action: 'cancel',
            fromStatus: oldStatus,
            toStatus: oldStatus,
            reason: `${dto.reason} (Scheduled to cancel on renewal: ${sub.currentPeriodEnd.toLocaleDateString()})`,
            actorId: actor?.id,
            actorEmail: actor?.email,
            actorRole: actor?.roleName,
            metadata: {
              cancelImmediately: false,
              effectiveAt: sub.currentPeriodEnd.toISOString(),
            },
          },
        }),
      ]);
    }

    await this.auditService.log({
      userId: actor?.id,
      action: 'SUBSCRIPTION_CANCEL',
      module: 'billing',
      recordId: sub.id,
      reason: dto.reason,
      oldValue: { status: oldStatus },
      newValue: {
        status: dto.cancelImmediately ? 'cancelled' : oldStatus,
        cancelAtPeriodEnd: !dto.cancelImmediately,
      },
      ipAddress,
      userAgent,
    });

    return this.getSubscriptionDetail(id);
  }
}
