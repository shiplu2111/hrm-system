import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import { buildCertificationExpiringVariables } from '../notifications/notification.helpers';
import { formatDateValue } from '../contracts/employment-contract.utils';
import {
  CERTIFICATION_EXPIRY_WARNING_DAYS,
  daysUntilExpiry,
  startOfUtcDay,
} from './training.utils';

@Injectable()
export class CertificationExpiryAlertsService {
  private readonly logger = new Logger(CertificationExpiryAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEngine: NotificationEngineService,
  ) {}

  /** Daily scan for certifications entering the expiry warning window (MODULES.md §26). */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async processDailyExpiryAlerts(): Promise<void> {
    try {
      const sent = await this.processExpiringCertifications();
      if (sent > 0) {
        this.logger.log(`Sent ${sent} certification expiry alert(s)`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Certification expiry scan failed';
      this.logger.error(message, error instanceof Error ? error.stack : undefined);
    }
  }

  async processExpiringCertifications(asOf: Date = new Date()): Promise<number> {
    const today = startOfUtcDay(asOf);
    const windowEnd = new Date(today);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + CERTIFICATION_EXPIRY_WARNING_DAYS);

    const certifications = await this.prisma.unscoped.employeeCertification.findMany({
      where: {
        status: 'active',
        expiryDate: { gte: today, lte: windowEnd },
        expiryAlertSentAt: null,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyId: true,
            tenantId: true,
          },
        },
      },
    });

    let sent = 0;
    for (const certification of certifications) {
      if (!certification.expiryDate) continue;

      const employeeName =
        `${certification.employee.firstName} ${certification.employee.lastName}`.trim();
      const expiryDate = formatDateValue(certification.expiryDate);
      const daysUntil = String(daysUntilExpiry(today, certification.expiryDate));

      await this.notificationEngine.emit({
        tenantId: certification.employee.tenantId,
        companyId: certification.employee.companyId,
        eventType: 'certification.expiring',
        subjectEmployeeId: certification.employeeId,
        variables: buildCertificationExpiringVariables({
          employeeName,
          certificationName: certification.name,
          expiryDate,
          daysUntil,
        }),
        payload: {
          certificationId: certification.id,
          employeeId: certification.employeeId,
          certificationName: certification.name,
          expiryDate,
          daysUntil: Number(daysUntil),
          eventType: 'certification.expiring',
        },
      });

      await this.prisma.unscoped.employeeCertification.update({
        where: { id: certification.id },
        data: { expiryAlertSentAt: new Date() },
      });

      sent += 1;
    }

    return sent;
  }
}
