jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_DAY_AT_6AM: '0 6 * * *' },
}));

import { CertificationExpiryAlertsService } from './certification-expiry-alerts.service';

describe('CertificationExpiryAlertsService', () => {
  const prisma = {
    unscoped: {
      employeeCertification: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    },
  };

  const notificationEngine = {
    emit: jest.fn(),
  };

  let service: CertificationExpiryAlertsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CertificationExpiryAlertsService(
      prisma as never,
      notificationEngine as never,
    );
  });

  it('emits certification.expiring and marks alert sent', async () => {
    const expiryDate = new Date('2026-09-20T00:00:00.000Z');
    prisma.unscoped.employeeCertification.findMany.mockResolvedValue([
      {
        id: 'cert-1',
        employeeId: 'emp-1',
        name: 'First Aid at Work',
        expiryDate,
        employee: {
          id: 'emp-1',
          firstName: 'Jordan',
          lastName: 'Lee',
          companyId: 'company-1',
          tenantId: 'tenant-1',
        },
      },
    ]);
    prisma.unscoped.employeeCertification.update.mockResolvedValue({});

    const asOf = new Date('2026-09-07T12:00:00.000Z');
    const sent = await service.processExpiringCertifications(asOf);

    expect(sent).toBe(1);
    expect(notificationEngine.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'certification.expiring',
        subjectEmployeeId: 'emp-1',
      }),
    );
    expect(prisma.unscoped.employeeCertification.update).toHaveBeenCalledWith({
      where: { id: 'cert-1' },
      data: { expiryAlertSentAt: expect.any(Date) },
    });
  });

  it('skips when no certifications are in the warning window', async () => {
    prisma.unscoped.employeeCertification.findMany.mockResolvedValue([]);

    const sent = await service.processExpiringCertifications(
      new Date('2026-09-07T12:00:00.000Z'),
    );

    expect(sent).toBe(0);
    expect(notificationEngine.emit).not.toHaveBeenCalled();
  });
});
