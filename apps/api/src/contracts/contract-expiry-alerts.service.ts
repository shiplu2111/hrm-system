import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import { buildContractExpiringVariables } from '../notifications/notification.helpers';
import {
  EXPIRY_WARNING_DAYS,
  formatDateValue,
} from './employment-contract.utils';

@Injectable()
export class ContractExpiryAlertsService {
  private readonly logger = new Logger(ContractExpiryAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEngine: NotificationEngineService,
  ) {}

  /** Daily scan for contracts entering the expiry warning window (MODULES.md §06). */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async processDailyExpiryAlerts(): Promise<void> {
    try {
      const sent = await this.processExpiringContracts();
      if (sent > 0) {
        this.logger.log(`Sent ${sent} contract expiry alert(s)`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Contract expiry scan failed';
      this.logger.error(message, error instanceof Error ? error.stack : undefined);
    }
  }

  async processExpiringContracts(asOf: Date = new Date()): Promise<number> {
    const today = new Date(
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
    );
    const windowEnd = new Date(today);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + EXPIRY_WARNING_DAYS);

    const contracts = await this.prisma.unscoped.employmentContract.findMany({
      where: {
        status: 'active',
        endDate: { gte: today, lte: windowEnd },
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
    for (const contract of contracts) {
      if (!contract.endDate) continue;

      const employeeName =
        `${contract.employee.firstName} ${contract.employee.lastName}`.trim();
      const expiryDate = formatDateValue(contract.endDate);
      const daysUntil = String(
        Math.max(
          0,
          Math.ceil(
            (contract.endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
          ),
        ),
      );

      await this.notificationEngine.emit({
        tenantId: contract.employee.tenantId,
        companyId: contract.employee.companyId,
        eventType: 'contract.expiring',
        subjectEmployeeId: contract.employeeId,
        variables: buildContractExpiringVariables({
          employeeName,
          expiryDate,
          daysUntil,
        }),
        payload: {
          contractId: contract.id,
          employeeId: contract.employeeId,
          expiryDate,
          daysUntil: Number(daysUntil),
          eventType: 'contract.expiring',
        },
      });

      await this.prisma.unscoped.employmentContract.update({
        where: { id: contract.id },
        data: { expiryAlertSentAt: new Date() },
      });

      sent += 1;
    }

    return sent;
  }
}
