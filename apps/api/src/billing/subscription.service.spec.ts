import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import { SubscriptionService } from './subscription.service';

function setup(planId: string | null, billable: number) {
  const count = jest.fn().mockResolvedValue(billable);
  const prisma = {
    unscoped: {
      tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ planId, status: 'active' }) },
      employee: { count },
    },
  } as unknown as PrismaService;
  return { service: new SubscriptionService(prisma), count };
}

describe('SubscriptionService', () => {
  it('counts only employees still on the books', async () => {
    const { service, count } = setup('starter', 3);
    await service.countBillableEmployees('t1');
    expect(count).toHaveBeenCalledWith({
      where: { tenantId: 't1', deletedAt: null, employmentStatus: { not: 'terminated' } },
    });
  });

  it('reports usage against the plan cap', async () => {
    const { service } = setup('starter', 42);
    const view = await service.getSubscription('t1');
    expect(view.planId).toBe('starter');
    expect(view.usage).toEqual([{ key: 'employees', used: 42, limit: 50, level: 'approaching' }]);
    expect(view.nextPlanId).toBe('business');
    expect(view.plans.map((plan) => plan.planId)).toEqual(['free', 'starter', 'business', 'enterprise']);
  });

  it('treats a tenant without a plan as Starter', async () => {
    const { service } = setup(null, 0);
    expect((await service.getSubscription('t1')).planId).toBe('starter');
  });

  it('blocks a new employee once the cap is reached, with an upgrade message', async () => {
    const { service } = setup('free', 10);
    const attempt = service.assertEmployeeSeats('t1');
    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    await expect(attempt).rejects.toMatchObject({
      response: { code: 'PLAN_EMPLOYEE_LIMIT_REACHED', message: expect.stringContaining('Upgrade') },
    });
  });

  it('allows the last seat', async () => {
    const { service } = setup('free', 9);
    await expect(service.assertEmployeeSeats('t1')).resolves.toBeUndefined();
  });

  it('checks room for every reinstated employee at once', async () => {
    const { service } = setup('free', 8);
    await expect(service.assertEmployeeSeats('t1', 3)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('never counts for enterprise or for zero additional seats', async () => {
    const enterprise = setup('enterprise', 100_000);
    await expect(enterprise.service.assertEmployeeSeats('t1')).resolves.toBeUndefined();
    expect(enterprise.count).not.toHaveBeenCalled();

    const none = setup('free', 50);
    await expect(none.service.assertEmployeeSeats('t1', 0)).resolves.toBeUndefined();
  });
});
