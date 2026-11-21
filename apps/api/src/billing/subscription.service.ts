import { ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { EmploymentStatus, type Prisma } from '@prisma/client';
import type {
  PlanDefinition,
  PlanFeatureKey,
  SubscriptionPlanTier,
  TenantSubscriptionView,
} from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { FeatureGateService } from './feature-gate.service';
import {
  hasSeatsFor,
  nextPlanId,
  normalizePlanId,
  PLAN_CATALOG,
  PLAN_LIMIT_APPROACHING_RATIO,
  planDefinition,
  usageLevel,
} from './plan-features.constants';

/** Everyone still on the books holds a seat; terminated and deleted employees do not. */
export const billableEmployeeWhere = (tenantId: string): Prisma.EmployeeWhereInput => ({
  tenantId,
  deletedAt: null,
  employmentStatus: { not: EmploymentStatus.terminated },
});

const planLabel = (planId: SubscriptionPlanTier) =>
  planId.charAt(0).toUpperCase() + planId.slice(1);

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly featureGate?: FeatureGateService,
  ) {}

  async getSubscription(tenantId: string): Promise<TenantSubscriptionView> {
    if (this.featureGate) {
      const details = await this.featureGate.getEffectivePlanDetails(tenantId);
      const usedEmployees =
        details.limits.find((l) => l.limitKey === 'employees')?.used ?? 0;
      const employeeLimit =
        details.limits.find((l) => l.limitKey === 'employees')?.limit ?? null;

      // Query database for catalog or fallback to PLAN_CATALOG
      let dbPlans: any[] = [];
      try {
        dbPlans = await (this.prisma.unscoped as any).plan?.findMany({
          where: { isActive: true },
          include: { features: true, limits: true },
          orderBy: { rank: 'asc' },
        }) ?? [];
      } catch {
        dbPlans = [];
      }

      const catalog: PlanDefinition[] =
        dbPlans && dbPlans.length > 0
          ? dbPlans.map((p: any) => ({
              planId: p.code as SubscriptionPlanTier,
              features: p.features
                .filter((f: any) => f.enabled)
                .map((f: any) => f.featureKey as PlanFeatureKey),
              limits: Object.fromEntries(p.limits.map((l: any) => [l.limitKey, l.value])),
            }))
          : [...PLAN_CATALOG];

      // Query for any scheduled downgrade pending on renewal
      let pendingPlanId: string | null = null;
      let pendingPlanCode: string | null = null;
      let pendingPlanName: string | null = null;
      let pendingEffectiveDate: string | null = null;
      try {
        const sub = await (this.prisma.unscoped as any).subscription?.findFirst({
          where: { tenantId, status: { not: 'cancelled' } },
          include: { pendingPlan: true },
          orderBy: { createdAt: 'desc' },
        });
        if (sub?.pendingPlanId && sub.pendingPlan) {
          pendingPlanId = sub.pendingPlanId;
          pendingPlanCode = sub.pendingPlan.code;
          pendingPlanName = sub.pendingPlan.name;
          pendingEffectiveDate = sub.currentPeriodEnd.toISOString();
        }
      } catch {
        // fallback
      }

      return {
        planId: details.planId,
        status: details.status,
        features: details.features
          .filter((f) => f.enabled)
          .map((f) => f.featureKey as PlanFeatureKey),
        usage: [
          {
            key: 'employees',
            used: usedEmployees,
            limit: employeeLimit,
            level: usageLevel(usedEmployees, employeeLimit),
          },
        ],
        plans: catalog,
        nextPlanId: nextPlanId(details.planId),
        approachingRatio: PLAN_LIMIT_APPROACHING_RATIO,
        pendingPlanId,
        pendingPlanCode,
        pendingPlanName,
        pendingEffectiveDate,
      };
    }

    const [tenant, used] = await Promise.all([
      this.prisma.unscoped.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { planId: true, status: true },
      }),
      this.countBillableEmployees(tenantId),
    ]);
    const planId = normalizePlanId(tenant.planId);
    const plan = planDefinition(planId);
    const limit = plan.limits.employees ?? null;

    return {
      planId,
      status: tenant.status,
      features: plan.features,
      usage: [{ key: 'employees', used, limit, level: usageLevel(used, limit) }],
      plans: [...PLAN_CATALOG],
      nextPlanId: nextPlanId(planId),
      approachingRatio: PLAN_LIMIT_APPROACHING_RATIO,
    };
  }

  /** Enforces the plan's employee cap (BILLING_SUBSCRIPTION.md §3) before `additional` employees take a seat. */
  async assertEmployeeSeats(tenantId: string, additional = 1): Promise<void> {
    if (this.featureGate) {
      return this.featureGate.assertWithinLimit(tenantId, 'employees', additional);
    }

    if (additional <= 0) return;
    const tenant = await this.prisma.unscoped.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { planId: true },
    });
    const planId = normalizePlanId(tenant.planId);
    const limit = planDefinition(planId).limits.employees ?? null;
    if (limit === null) return;

    const used = await this.countBillableEmployees(tenantId);
    if (hasSeatsFor(used, limit, additional)) return;

    throw new ForbiddenException({
      code: 'PLAN_EMPLOYEE_LIMIT_REACHED',
      message: `Your ${planLabel(planId)} plan includes up to ${limit} employees and ${used} are in use. Upgrade your plan to add more.`,
    });
  }

  countBillableEmployees(tenantId: string): Promise<number> {
    return this.prisma.unscoped.employee.count({ where: billableEmployeeWhere(tenantId) });
  }
}
