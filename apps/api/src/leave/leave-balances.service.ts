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
  addMonths,
  decimal,
  decimalToNumber,
  formatDateValue,
  getFinancialYearStart,
  getLeaveYear,
  maxDecimal,
  minDecimal,
  parseDateString,
  startOfMonth,
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

    let remaining = input.days;
    let carried = decimal(balance.carriedForwardDays);
    let pool = decimal(balance.balanceDays).minus(carried);

    if (carried.greaterThan(0)) {
      const fromCarried = minDecimal(carried, remaining);
      carried = carried.minus(fromCarried);
      remaining = remaining.minus(fromCarried);
    }

    if (remaining.greaterThan(0)) {
      pool = pool.minus(remaining);
    }

    return this.prisma.unscoped.leaveBalance.update({
      where: { id: balance.id },
      data: {
        carriedForwardDays: carried,
        balanceDays: carried.plus(pool),
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
      const monthlyRate = entitlement.div(12);
      let cursor = balance.lastAccrualAt
        ? startOfMonth(addMonths(balance.lastAccrualAt, 1))
        : startOfMonth(
            employee.hireDate > fyStart ? employee.hireDate : fyStart,
          );
      let currentBalance = decimal(balance.balanceDays);
      let lastProcessed = balance.lastAccrualAt;

      while (cursor <= startOfMonth(asOfDate)) {
        currentBalance = currentBalance.plus(monthlyRate);
        const carried = decimal(balance.carriedForwardDays);
        const currentYearPool = currentBalance.minus(carried);
        if (currentYearPool.greaterThan(entitlement)) {
          currentBalance = carried.plus(entitlement);
        }
        lastProcessed = cursor;
        cursor = addMonths(cursor, 1);
      }

      if (lastProcessed && lastProcessed !== balance.lastAccrualAt) {
        await this.prisma.unscoped.leaveBalance.update({
          where: { id: balance.id },
          data: {
            balanceDays: currentBalance,
            lastAccrualAt: lastProcessed,
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
    const carried = minDecimal(remaining, carryMax);
    const entitlement = decimal(policy.entitlementDays);

    const expiresAt =
      policy.expiryMonths && carried.greaterThan(0)
        ? addMonths(asOfDate, policy.expiryMonths)
        : null;

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
        balanceDays: entitlement.plus(carried),
        carriedForwardDays: carried,
        carriedForwardExpiresAt: expiresAt,
        lastAccrualAt: null,
      },
      update: {
        balanceDays: entitlement.plus(carried),
        carriedForwardDays: carried,
        carriedForwardExpiresAt: expiresAt,
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

    if (
      balance.carriedForwardExpiresAt &&
      balance.carriedForwardExpiresAt < asOfDate &&
      decimal(balance.carriedForwardDays).greaterThan(0)
    ) {
      const carried = decimal(balance.carriedForwardDays);
      await this.prisma.unscoped.leaveBalance.update({
        where: { id: balance.id },
        data: {
          balanceDays: decimal(balance.balanceDays).minus(carried),
          carriedForwardDays: decimal(0),
          carriedForwardExpiresAt: null,
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
