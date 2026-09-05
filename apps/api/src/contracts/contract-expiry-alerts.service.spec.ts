jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_DAY_AT_6AM: '0 6 * * *' },
}));

import { ContractExpiryAlertsService } from './contract-expiry-alerts.service';

describe('ContractExpiryAlertsService', () => {
  const prisma = {
    unscoped: {
      employmentContract: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    },
  };

  const notificationEngine = {
    emit: jest.fn(),
  };

  let service: ContractExpiryAlertsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContractExpiryAlertsService(
      prisma as never,
      notificationEngine as never,
    );
  });

  it('emits contract.expiring and marks alert sent for expiring contracts', async () => {
    const endDate = new Date('2026-06-20T00:00:00.000Z');
    prisma.unscoped.employmentContract.findMany.mockResolvedValue([
      {
        id: 'contract-1',
        employeeId: 'emp-1',
        endDate,
        employee: {
          id: 'emp-1',
          firstName: 'Alex',
          lastName: 'Chen',
          companyId: 'company-1',
          tenantId: 'tenant-1',
        },
      },
    ]);
    prisma.unscoped.employmentContract.update.mockResolvedValue({});

    const asOf = new Date('2026-06-01T12:00:00.000Z');
    const sent = await service.processExpiringContracts(asOf);

    expect(sent).toBe(1);
    expect(notificationEngine.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'contract.expiring',
        subjectEmployeeId: 'emp-1',
      }),
    );
    expect(prisma.unscoped.employmentContract.update).toHaveBeenCalledWith({
      where: { id: 'contract-1' },
      data: { expiryAlertSentAt: expect.any(Date) },
    });
  });

  it('skips when no contracts are in the warning window', async () => {
    prisma.unscoped.employmentContract.findMany.mockResolvedValue([]);

    const sent = await service.processExpiringContracts(
      new Date('2026-06-01T12:00:00.000Z'),
    );

    expect(sent).toBe(0);
    expect(notificationEngine.emit).not.toHaveBeenCalled();
  });
});
