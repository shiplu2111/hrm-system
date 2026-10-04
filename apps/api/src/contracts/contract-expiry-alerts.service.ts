import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmploymentContractStatus } from '@prisma/client';
import {
  CONTRACT_EXPIRY_WINDOW_MAX_DAYS,
  type ContractExpiryAlertItem,
  type ContractExpiryAlertRunResult,
  type ContractExpiryAlertsView,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import { buildContractExpiringVariables } from '../notifications/notification.helpers';
import { CompanyScopeService } from '../organization/company-scope.service';
import { DataScopeService } from '../rbac/data-scope.service';
import { ContractExpirySettingsService } from './contract-expiry-settings.service';
import {
  computeDisplayStatus,
  daysBetween,
  formatDateValue,
  startOfUtcDate,
} from './employment-contract.utils';

const DAILY_RUN_HOUR = 6;

/** A renewal that isn't terminated means HR is already handling the contract's expiry. */
const OPEN_RENEWAL = { status: { not: EmploymentContractStatus.terminated } };

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Next local-time occurrence of the daily cron (server timezone, like @Cron). */
export function nextDailyRunAt(now: Date, hour = DAILY_RUN_HOUR): Date {
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

@Injectable()
export class ContractExpiryAlertsService {
  private readonly logger = new Logger(ContractExpiryAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEngine: NotificationEngineService,
    private readonly expirySettings: ContractExpirySettingsService,
    private readonly companyScope: CompanyScopeService,
    private readonly dataScope: DataScopeService,
  ) {}

  /** Daily scan for contracts entering each company's expiry window (MODULES.md §06). */
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

  async processExpiringContracts(
    asOf: Date = new Date(),
    options: { companyId?: string } = {},
  ): Promise<number> {
    const today = startOfUtcDate(asOf);

    const contracts = await this.prisma.unscoped.employmentContract.findMany({
      where: {
        ...(options.companyId ? { companyId: options.companyId } : {}),
        status: EmploymentContractStatus.active,
        endDate: { gte: today, lte: addUtcDays(today, CONTRACT_EXPIRY_WINDOW_MAX_DAYS) },
        expiryAlertSentAt: null,
        renewals: { none: OPEN_RENEWAL },
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
    if (contracts.length === 0) return 0;

    const windows = await this.expirySettings.windowsForCompanies(
      [...new Map(contracts.map((c) => [c.companyId, c.tenantId])).entries()].map(
        ([companyId, tenantId]) => ({ companyId, tenantId }),
      ),
    );

    let sent = 0;
    for (const contract of contracts) {
      if (!contract.endDate) continue;
      const daysUntil = daysBetween(today, contract.endDate);
      if (daysUntil > (windows.get(contract.companyId) ?? 0)) continue;

      // Claim first so an overlapping manual run can't send the same alert twice.
      const claimed = await this.prisma.unscoped.employmentContract.updateMany({
        where: { id: contract.id, expiryAlertSentAt: null },
        data: { expiryAlertSentAt: new Date() },
      });
      if (claimed.count === 0) continue;

      const expiryDate = formatDateValue(contract.endDate);
      try {
        await this.notificationEngine.emit({
          tenantId: contract.employee.tenantId,
          companyId: contract.employee.companyId,
          eventType: 'contract.expiring',
          subjectEmployeeId: contract.employeeId,
          variables: buildContractExpiringVariables({
            employeeName: `${contract.employee.firstName} ${contract.employee.lastName}`.trim(),
            expiryDate,
            daysUntil: String(daysUntil),
          }),
          payload: {
            contractId: contract.id,
            employeeId: contract.employeeId,
            expiryDate,
            daysUntil,
            eventType: 'contract.expiring',
          },
        });
      } catch (error) {
        await this.prisma.unscoped.employmentContract.update({
          where: { id: contract.id },
          data: { expiryAlertSentAt: null },
        });
        throw error;
      }

      sent += 1;
    }

    return sent;
  }

  async getAlerts(
    companyId: string,
    user: AuthenticatedUser,
    windowDaysOverride?: number,
  ): Promise<ContractExpiryAlertsView> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const settings = await this.expirySettings.getSettings(companyId);
    const windowDays = windowDaysOverride ?? settings.windowDays;
    const now = new Date();
    const today = startOfUtcDate(now);

    const rows = await this.prisma.unscoped.employmentContract.findMany({
      where: {
        companyId,
        status: EmploymentContractStatus.active,
        endDate: { not: null, lte: addUtcDays(today, windowDays) },
        employeeId: await this.dataScope.employeeIdFilter(user),
        employee: { deletedAt: null },
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            department: { select: { name: true } },
          },
        },
        renewals: {
          where: OPEN_RENEWAL,
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, startDate: true, endDate: true },
        },
      },
      orderBy: { endDate: 'asc' },
    });

    const renewalIds = rows.flatMap((row) => row.renewals.map((r) => r.id));
    const workflows = renewalIds.length
      ? await this.prisma.unscoped.workflowInstance.findMany({
          where: { entityType: 'contract', entityId: { in: renewalIds } },
          select: { entityId: true, status: true },
        })
      : [];
    const workflowStatus = new Map(workflows.map((w) => [w.entityId, w.status]));

    const upcoming: ContractExpiryAlertItem[] = [];
    const overdue: ContractExpiryAlertItem[] = [];
    for (const row of rows) {
      if (!row.endDate) continue;
      const renewal = row.renewals[0];
      const item: ContractExpiryAlertItem = {
        contractId: row.id,
        employeeId: row.employeeId,
        employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
        employeeNumber: row.employee.employeeNumber,
        departmentName: row.employee.department?.name ?? null,
        contractType: row.contractType,
        startDate: formatDateValue(row.startDate),
        endDate: formatDateValue(row.endDate),
        daysUntil: daysBetween(today, row.endDate),
        alertSentAt: row.expiryAlertSentAt?.toISOString() ?? null,
        renewal: renewal
          ? {
              contractId: renewal.id,
              startDate: formatDateValue(renewal.startDate),
              displayStatus: computeDisplayStatus({
                status: renewal.status,
                startDate: renewal.startDate,
                endDate: renewal.endDate,
                renewalWorkflowStatus: workflowStatus.get(renewal.id) ?? null,
                asOf: now,
                warningDays: settings.windowDays,
              }),
            }
          : null,
      };
      if (item.daysUntil >= 0) {
        upcoming.push(item);
      } else if (renewal?.status !== EmploymentContractStatus.active) {
        overdue.push(item);
      }
    }

    return {
      asOf: now.toISOString(),
      windowDays,
      settings,
      nextRunAt: nextDailyRunAt(now).toISOString(),
      upcoming,
      overdue,
    };
  }

  /** Runs the notification job immediately for one company. */
  async runNow(companyId: string, user: AuthenticatedUser): Promise<ContractExpiryAlertRunResult> {
    await this.companyScope.assertCompanyInTenant(companyId);
    if (!(await this.dataScope.isOrgWide(user))) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only company-wide roles can send contract expiry alerts',
      });
    }
    return { sent: await this.processExpiringContracts(new Date(), { companyId }) };
  }
}
