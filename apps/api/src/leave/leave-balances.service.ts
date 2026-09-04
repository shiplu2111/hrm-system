import { Injectable, NotFoundException } from '@nestjs/common';
import {
  LeaveAccrualType,
  type LeaveBalance,
  type LeavePolicy,
  type Prisma,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { LeaveBalanceRecord } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import {
  applyCarriedForwardExpiry,
  computeMonthlyAccrual,
  computeYearEndBalance,
  deductLeaveDays,
} from './leave-accrual.utils';
import {
  decimal,
  decimalToNumber,
  formatDateValue,
  getFinancialYearStart,
  getLeaveYear,
  parseDateString,
} from './leave.utils';

@Injectable()
export class LeaveBalancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
  ) {}

  async listForEmployee(employeeId: string, asOf?: string): Promise<LeaveBalanceRecord[]> {
    const employee = await this.assertEmployee(employeeId);
    const asOfDate = asOf ? parseDateString(asOf) : new Date();

    const leaveTypes = await this.prisma.unscoped.leaveType.findMany({
      where: { companyId: employee.companyId },
    });

    const results: LeaveBalanceRecord[] = [];
    for (const leaveType of leaveTypes) {
      results.push(
        await this.getBalanceRecord(employeeId, leaveType.id, asOfDate),
      );
    }
    return results;
  }

  async accrueEmployee(employeeId: string, asOf?: string): Promise<LeaveBalanceRecord[]> {
    const employee = await this.assertEmployee(employeeId);
    const asOfDate = asOf ? parseDateString(asOf) : new Date();

    const types = await this.prisma.unscoped.leaveType.findMany({
      where: { companyId: employee.companyId },
    });

    for (const leaveType of types) {
      await this.accrueUpTo(employeeId, leaveType.id, asOfDate);
    }

    return this.listForEmployee(employeeId, formatDateValue(asOfDate));
  }

  async runYearEnd(companyId: string, leaveYear: number): Promise<{ processed: number }> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const company = await this.prisma.unscoped.company.findUnique({
      where: { id: companyId },
      select: { financialYearStart: true },
    });
    if (!company) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Company not found' });
    }

    const employees = await this.prisma.scoped.employee.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true },
    });

    const leaveTypes = await this.prisma.unscoped.leaveType.findMany({
      where: { companyId },
    });

    let processed = 0;
    for (const employee of employees) {
      for (const leaveType of leaveTypes) {
        await this.processYearEndForEmployee(
          employee.id,
          leaveType.id,
          leaveYear,
          company.financialYearStart,
        );
        processed += 1;
      }
    }

    return { processed };
  }

  async deductBalance(input: {
    employeeId: string;
    leaveTypeId: string;
    days: Decimal;
  }): Promise<LeaveBalance> {
    const employee = await this.assertEmployee(input.employeeId);
    const asOfDate = new Date();
    await this.accrueUpTo(input.employeeId, input.leaveTypeId, asOfDate);
    await this.expireCarriedForward(input.employeeId, input.leaveTypeId, asOfDate);

    const leaveYear = getLeaveYear(
      (
        await this.prisma.unscoped.company.findUniqueOrThrow({
          where: { id: employee.companyId },
          select: { financialYearStart: true },
        })
      ).financialYearStart,
      asOfDate,
    );

    const balance = await this.getOrCreateBalance(
      input.employeeId,
      input.leaveTypeId,
      leaveYear,
    );

    const deducted = deductLeaveDays({
      balanceDays: decimal(balance.balanceDays),
      carriedForwardDays: decimal(balance.carriedForwardDays),
      days: input.days,
    });

    return this.prisma.unscoped.leaveBalance.update({
      where: { id: balance.id },
      data: {
        carriedForwardDays: deducted.carriedForwardDays,
        balanceDays: deducted.balanceDays,
      },
    });
  }

  async getAvailableBalance(
    employeeId: string,
    leaveTypeId: string,
    asOfDate: Date,
  ): Promise<number> {
    await this.accrueUpTo(employeeId, leaveTypeId, asOfDate);
    await this.expireCarriedForward(employeeId, leaveTypeId, asOfDate);

    const employee = await this.assertEmployee(employeeId);
    const leaveYear = getLeaveYear(
      (
        await this.prisma.unscoped.company.findUniqueOrThrow({
          where: { id: employee.companyId },
          select: { financialYearStart: true },
        })
      ).financialYearStart,
      asOfDate,
    );

    const balance = await this.getOrCreateBalance(employeeId, leaveTypeId, leaveYear);
    return decimalToNumber(balance.balanceDays);
  }

  async findEffectivePolicy(
    companyId: string,
    leaveTypeId: string,
    asOf: Date,
  ): Promise<LeavePolicy | null> {
    return this.prisma.unscoped.leavePolicy.findFirst({
      where: {
        companyId,
        leaveTypeId,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  private async getBalanceRecord(
    employeeId: string,
    leaveTypeId: string,
    asOfDate: Date,
  ): Promise<LeaveBalanceRecord> {
    await this.accrueUpTo(employeeId, leaveTypeId, asOfDate);
    await this.expireCarriedForward(employeeId, leaveTypeId, asOfDate);

    const employee = await this.assertEmployee(employeeId);
    const company = await this.prisma.unscoped.company.findUniqueOrThrow({
      where: { id: employee.companyId },
      select: { financialYearStart: true },
    });
    const leaveYear = getLeaveYear(company.financialYearStart, asOfDate);
    const policy = await this.findEffectivePolicy(
      employee.companyId,
      leaveTypeId,
      asOfDate,
    );
    const leaveType = await this.prisma.unscoped.leaveType.findUniqueOrThrow({
      where: { id: leaveTypeId },
    });
    const balance = await this.getOrCreateBalance(employeeId, leaveTypeId, leaveYear);

    return {
      id: balance.id,
      employeeId,
      leaveTypeId,
      leaveTypeName: leaveType.name,
      balanceDays: decimalToNumber(balance.balanceDays),
      carriedForwardDays: decimalToNumber(balance.carriedForwardDays),
      carriedForwardExpiresAt: balance.carriedForwardExpiresAt
        ? formatDateValue(balance.carriedForwardExpiresAt)
        : null,
      accruedToDate: decimalToNumber(balance.balanceDays),
      entitlementDays: policy ? decimalToNumber(policy.entitlementDays) : 0,
      asOfYear: leaveYear,
      lastAccrualAt: balance.lastAccrualAt
        ? formatDateValue(balance.lastAccrualAt)
        : null,
      negativeBalanceWarning: decimalToNumber(balance.balanceDays) < 0,
      updatedAt: balance.updatedAt.toISOString(),
    };
  }

  private async accrueUpTo(
    employeeId: string,
    leaveTypeId: string,
    asOfDate: Date,
  ): Promise<void> {
    const employee = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: {
        id: true,
        companyId: true,
        hireDate: true,
      },
    });
    if (!employee) return;

    const policy = await this.findEffectivePolicy(
      employee.companyId,
      leaveTypeId,
      asOfDate,
    );
    if (!policy) return;

    const company = await this.prisma.unscoped.company.findUniqueOrThrow({
      where: { id: employee.companyId },
      select: { financialYearStart: true },
    });
    const leaveYear = getLeaveYear(company.financialYearStart, asOfDate);
    const balance = await this.getOrCreateBalance(employeeId, leaveTypeId, leaveYear);
    const entitlement = decimal(policy.entitlementDays);
    const fyStart = getFinancialYearStart(company.financialYearStart, leaveYear);

    if (policy.accrualType === LeaveAccrualType.on_hire) {
      if (!balance.lastAccrualAt) {
        await this.prisma.unscoped.leaveBalance.update({
          where: { id: balance.id },
          data: {
            balanceDays: entitlement,
            lastAccrualAt: employee.hireDate,
          },
        });
      }
      return;
    }

    if (policy.accrualType === LeaveAccrualType.yearly) {
      const anchorDate =
        policy.yearlyAccrualAnchor === 'hire_anniversary'
          ? this.hireAnniversaryOnOrBefore(employee.hireDate, asOfDate)
          : fyStart;

      if (
        asOfDate >= anchorDate &&
        (!balance.lastAccrualAt || balance.lastAccrualAt < anchorDate)
      ) {
        await this.prisma.unscoped.leaveBalance.update({
          where: { id: balance.id },
          data: {
            balanceDays: decimal(balance.balanceDays).plus(entitlement),
            lastAccrualAt: anchorDate,
          },
        });
      }
      return;
    }

    if (policy.accrualType === LeaveAccrualType.monthly) {
      const fyStart = getFinancialYearStart(company.financialYearStart, leaveYear);
      const accrual = computeMonthlyAccrual({
        entitlementDays: entitlement,
        currentBalanceDays: decimal(balance.balanceDays),
        carriedForwardDays: decimal(balance.carriedForwardDays),
        lastAccrualAt: balance.lastAccrualAt,
        hireDate: employee.hireDate,
        fyStart,
        asOfDate,
      });

      if (
        accrual.lastAccrualAt &&
        accrual.lastAccrualAt !== balance.lastAccrualAt
      ) {
        await this.prisma.unscoped.leaveBalance.update({
          where: { id: balance.id },
          data: {
            balanceDays: accrual.balanceDays,
            lastAccrualAt: accrual.lastAccrualAt,
          },
        });
      }
    }
  }

  private async processYearEndForEmployee(
    employeeId: string,
    leaveTypeId: string,
    leaveYear: number,
    financialYearStartMonth: number,
  ): Promise<void> {
    const asOfDate = getFinancialYearStart(financialYearStartMonth, leaveYear + 1);
    asOfDate.setUTCDate(asOfDate.getUTCDate() - 1);

    const employee = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId },
      select: { companyId: true },
    });
    if (!employee) return;

    const policy = await this.findEffectivePolicy(
      employee.companyId,
      leaveTypeId,
      asOfDate,
    );
    if (!policy) return;

    await this.accrueUpTo(employeeId, leaveTypeId, asOfDate);
    const balance = await this.getOrCreateBalance(employeeId, leaveTypeId, leaveYear);
    const remaining = decimal(balance.balanceDays);
    const carryMax = policy.carryForwardMax
      ? decimal(policy.carryForwardMax)
      : decimal(0);
    const entitlement = decimal(policy.entitlementDays);

    const yearEnd = computeYearEndBalance({
      remainingBalance: remaining,
      carryForwardMax: carryMax,
      entitlementDays: entitlement,
      expiryMonths: policy.expiryMonths,
      yearEndDate: asOfDate,
    });

    await this.prisma.unscoped.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_asOfYear: {
          employeeId,
          leaveTypeId,
          asOfYear: leaveYear + 1,
        },
      },
      create: {
        employeeId,
        leaveTypeId,
        asOfYear: leaveYear + 1,
        balanceDays: yearEnd.balanceDays,
        carriedForwardDays: yearEnd.carriedForwardDays,
        carriedForwardExpiresAt: yearEnd.carriedForwardExpiresAt,
        lastAccrualAt: null,
      },
      update: {
        balanceDays: yearEnd.balanceDays,
        carriedForwardDays: yearEnd.carriedForwardDays,
        carriedForwardExpiresAt: yearEnd.carriedForwardExpiresAt,
        lastAccrualAt: null,
      },
    });
  }

  private async expireCarriedForward(
    employeeId: string,
    leaveTypeId: string,
    asOfDate: Date,
  ): Promise<void> {
    const employee = await this.assertEmployee(employeeId);
    const leaveYear = getLeaveYear(
      (
        await this.prisma.unscoped.company.findUniqueOrThrow({
          where: { id: employee.companyId },
          select: { financialYearStart: true },
        })
      ).financialYearStart,
      asOfDate,
    );
    const balance = await this.getOrCreateBalance(employeeId, leaveTypeId, leaveYear);

    const expired = applyCarriedForwardExpiry({
      balanceDays: decimal(balance.balanceDays),
      carriedForwardDays: decimal(balance.carriedForwardDays),
      carriedForwardExpiresAt: balance.carriedForwardExpiresAt,
      asOfDate,
    });

    if (
      expired.carriedForwardDays.lessThan(decimal(balance.carriedForwardDays))
    ) {
      await this.prisma.unscoped.leaveBalance.update({
        where: { id: balance.id },
        data: {
          balanceDays: expired.balanceDays,
          carriedForwardDays: expired.carriedForwardDays,
          carriedForwardExpiresAt: expired.carriedForwardExpiresAt,
        },
      });
    }
  }

  private hireAnniversaryOnOrBefore(hireDate: Date, asOf: Date): Date {
    let candidate = new Date(
      Date.UTC(asOf.getUTCFullYear(), hireDate.getUTCMonth(), hireDate.getUTCDate()),
    );
    if (candidate > asOf) {
      candidate = new Date(
        Date.UTC(
          asOf.getUTCFullYear() - 1,
          hireDate.getUTCMonth(),
          hireDate.getUTCDate(),
        ),
      );
    }
    return candidate;
  }

  private async getOrCreateBalance(
    employeeId: string,
    leaveTypeId: string,
    asOfYear: number,
  ): Promise<LeaveBalance> {
    return this.prisma.unscoped.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_asOfYear: { employeeId, leaveTypeId, asOfYear },
      },
      create: {
        employeeId,
        leaveTypeId,
        asOfYear,
        balanceDays: decimal(0),
        carriedForwardDays: decimal(0),
      },
      update: {},
    });
  }

  private async assertEmployee(employeeId: string) {
    const row = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true, companyId: true, hireDate: true, probationEndDate: true },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }
    return row;
  }
}
