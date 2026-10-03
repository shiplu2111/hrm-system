import { ForbiddenException, Injectable } from '@nestjs/common';
import { EmploymentStatus, type Prisma } from '@prisma/client';
import type { SubscriptionPlanTier, TenantSubscriptionView } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  async getSubscription(tenantId: string): Promise<TenantSubscriptionView> {
    const [tenant, used] = await Promise.all([
      this.prisma.unscoped.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { planId: true, status: true },
      }),
      this.countBillableEmployees(tenantId),
    ]);
    const planId = normalizePlanId(tenant.planId);
    const plan = planDefinition(planId);
    const limit = plan.limits.employees;

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
    if (additional <= 0) return;
    const tenant = await this.prisma.unscoped.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { planId: true },
    });
    const planId = normalizePlanId(tenant.planId);
    const limit = planDefinition(planId).limits.employees;
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
