jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_DAY_AT_6AM: '0 6 * * *' },
}));

import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ContractExpiryAlertsService, nextDailyRunAt } from './contract-expiry-alerts.service';

const user = { id: 'user-1', tenantId: 'tenant-1' } as AuthenticatedUser;

function contract(id: string, endDate: string, companyId = 'company-1') {
  return {
    id,
    companyId,
    tenantId: 'tenant-1',
    employeeId: `emp-${id}`,
    endDate: new Date(`${endDate}T00:00:00.000Z`),
    employee: {
      id: `emp-${id}`,
      firstName: 'Alex',
      lastName: 'Chen',
      companyId,
      tenantId: 'tenant-1',
    },
  };
}

describe('ContractExpiryAlertsService', () => {
  const prisma = {
    unscoped: {
      employmentContract: {
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      workflowInstance: { findMany: jest.fn() },
    },
  };
  const notificationEngine = { emit: jest.fn() };
  const expirySettings = {
    windowsForCompanies: jest.fn(),
    getSettings: jest.fn(),
  };
  const companyScope = { assertCompanyInTenant: jest.fn() };
  const dataScope = { employeeIdFilter: jest.fn(), isOrgWide: jest.fn() };

  let service: ContractExpiryAlertsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.unscoped.employmentContract.updateMany.mockResolvedValue({ count: 1 });
    expirySettings.windowsForCompanies.mockResolvedValue(new Map([['company-1', 30]]));
    service = new ContractExpiryAlertsService(
      prisma as never,
      notificationEngine as never,
      expirySettings as never,
      companyScope as never,
      dataScope as never,
    );
  });

  const asOf = new Date('2026-06-01T12:00:00.000Z');

  it('emits contract.expiring and claims the alert for contracts inside the window', async () => {
    prisma.unscoped.employmentContract.findMany.mockResolvedValue([contract('c1', '2026-06-20')]);

    await expect(service.processExpiringContracts(asOf)).resolves.toBe(1);

    expect(prisma.unscoped.employmentContract.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', expiryAlertSentAt: null },
      data: { expiryAlertSentAt: expect.any(Date) },
    });
    expect(notificationEngine.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'contract.expiring',
        subjectEmployeeId: 'emp-c1',
        variables: expect.objectContaining({ days_until: '19' }),
      }),
    );
  });

  it("uses each company's own window", async () => {
    expirySettings.windowsForCompanies.mockResolvedValue(
      new Map([
        ['company-1', 14],
        ['company-2', 60],
      ]),
    );
    prisma.unscoped.employmentContract.findMany.mockResolvedValue([
      contract('c1', '2026-06-20', 'company-1'),
      contract('c2', '2026-07-20', 'company-2'),
    ]);

    await expect(service.processExpiringContracts(asOf)).resolves.toBe(1);

    expect(notificationEngine.emit).toHaveBeenCalledTimes(1);
    expect(notificationEngine.emit).toHaveBeenCalledWith(
      expect.objectContaining({ subjectEmployeeId: 'emp-c2' }),
    );
  });

  it('skips contracts with a renewal in progress and limits a manual run to one company', async () => {
    prisma.unscoped.employmentContract.findMany.mockResolvedValue([]);

    await service.processExpiringContracts(asOf, { companyId: 'company-1' });

    expect(prisma.unscoped.employmentContract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-1',
          renewals: { none: { status: { not: 'terminated' } } },
        }),
      }),
    );
  });

  it('does not send when another run already claimed the contract', async () => {
    prisma.unscoped.employmentContract.findMany.mockResolvedValue([contract('c1', '2026-06-20')]);
    prisma.unscoped.employmentContract.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.processExpiringContracts(asOf)).resolves.toBe(0);
    expect(notificationEngine.emit).not.toHaveBeenCalled();
  });

  it('releases the claim when the notification fails', async () => {
    prisma.unscoped.employmentContract.findMany.mockResolvedValue([contract('c1', '2026-06-20')]);
    notificationEngine.emit.mockRejectedValueOnce(new Error('smtp down'));

    await expect(service.processExpiringContracts(asOf)).rejects.toThrow('smtp down');
    expect(prisma.unscoped.employmentContract.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { expiryAlertSentAt: null },
    });
  });

  it('skips when no contracts are in the warning window', async () => {
    prisma.unscoped.employmentContract.findMany.mockResolvedValue([]);

    await expect(service.processExpiringContracts(asOf)).resolves.toBe(0);
    expect(notificationEngine.emit).not.toHaveBeenCalled();
  });

  describe('getAlerts', () => {
    const row = (id: string, endDate: string, renewal?: { status: 'draft' | 'active' }) => ({
      id,
      employeeId: `emp-${id}`,
      contractType: 'fixed_term',
      startDate: new Date('2025-01-01T00:00:00Z'),
      endDate: new Date(`${endDate}T00:00:00Z`),
      expiryAlertSentAt: null,
      employee: { firstName: 'Sam', lastName: 'Lee', employeeNumber: 'E1', department: null },
      renewals: renewal
        ? [
            {
              id: `${id}-renewal`,
              status: renewal.status,
              startDate: new Date('2026-08-01T00:00:00Z'),
              endDate: new Date('2027-07-31T00:00:00Z'),
            },
          ]
        : [],
    });

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-01T09:00:00Z'));
      expirySettings.getSettings.mockResolvedValue({ windowDays: 45, updatedAt: null });
      dataScope.employeeIdFilter.mockResolvedValue({ in: ['emp-a'] });
      prisma.unscoped.workflowInstance.findMany.mockResolvedValue([
        { entityId: 'b-renewal', status: 'pending' },
      ]);
    });

    afterEach(() => jest.useRealTimers());

    it('splits upcoming and overdue contracts within the data scope', async () => {
      prisma.unscoped.employmentContract.findMany.mockResolvedValue([
        row('a', '2026-05-20'),
        row('c', '2026-05-25', { status: 'active' }),
        row('b', '2026-06-10', { status: 'draft' }),
      ]);

      const view = await service.getAlerts('company-1', user);

      expect(view.windowDays).toBe(45);
      expect(prisma.unscoped.employmentContract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: { in: ['emp-a'] },
            endDate: { not: null, lte: new Date('2026-07-16T00:00:00Z') },
          }),
        }),
      );
      expect(view.overdue.map((i) => i.contractId)).toEqual(['a']);
      expect(view.overdue[0]?.daysUntil).toBe(-12);
      expect(view.upcoming).toHaveLength(1);
      expect(view.upcoming[0]).toMatchObject({
        contractId: 'b',
        daysUntil: 9,
        renewal: { contractId: 'b-renewal', displayStatus: 'pending_approval' },
      });
    });

    it('honours a window override', async () => {
      prisma.unscoped.employmentContract.findMany.mockResolvedValue([]);

      const view = await service.getAlerts('company-1', user, 90);

      expect(view.windowDays).toBe(90);
      expect(view.settings.windowDays).toBe(45);
    });
  });

  it('refuses a manual run for team-scoped users', async () => {
    dataScope.isOrgWide.mockResolvedValue(false);

    await expect(service.runNow('company-1', user)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.unscoped.employmentContract.findMany).not.toHaveBeenCalled();
  });

  it('schedules the next run at 06:00 local time', () => {
    const before = new Date(2026, 5, 1, 5, 30);
    const after = new Date(2026, 5, 1, 7, 0);
    expect(nextDailyRunAt(before)).toEqual(new Date(2026, 5, 1, 6, 0));
    expect(nextDailyRunAt(after)).toEqual(new Date(2026, 5, 2, 6, 0));
  });
});
