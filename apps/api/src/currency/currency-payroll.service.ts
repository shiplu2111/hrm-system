import { Injectable } from '@nestjs/common';
import { EmploymentContractStatus } from '@prisma/client';
import type { CompanyPayrollCurrencyView, PayrollCurrencySnapshot } from '@hrm/shared-types';
import { Decimal } from '@prisma/client/runtime/library';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { ExchangeRatesService } from './exchange-rates.service';
import { convertQuoteToBase } from './exchange-rate.utils';

@Injectable()
export class CurrencyPayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exchangeRates: ExchangeRatesService,
    private readonly auditService: AuditService,
  ) {}

  /** `null` falls back to the company's country currency. Finalized runs keep the base they stored. */
  async setCompanyBaseCurrency(
    tenantId: string,
    companyId: string,
    currency: string | null,
    user: AuthenticatedUser,
  ): Promise<CompanyPayrollCurrencyView> {
    const before = await this.prisma.unscoped.company.findFirstOrThrow({
      where: { id: companyId, tenantId },
      select: { payrollBaseCurrency: true },
    });
    const row = await this.prisma.unscoped.company.update({
      where: { id: companyId },
      data: { payrollBaseCurrency: currency?.trim().toUpperCase() || null },
      select: {
        id: true,
        name: true,
        payrollBaseCurrency: true,
        country: { select: { currency: true } },
      },
    });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'update',
      module: 'settings',
      recordId: companyId,
      oldValue: { payrollBaseCurrency: before.payrollBaseCurrency },
      newValue: { payrollBaseCurrency: row.payrollBaseCurrency },
    });

    const countryCurrency = row.country.currency.toUpperCase();
    const base = row.payrollBaseCurrency?.toUpperCase() ?? countryCurrency;
    return {
      companyId: row.id,
      companyName: row.name,
      countryCurrency,
      payrollBaseCurrency: base,
      overridden: base !== countryCurrency,
    };
  }

  async resolveCompanyBaseCurrency(companyId: string): Promise<string> {
    const company = await this.prisma.unscoped.company.findUnique({
      where: { id: companyId },
      select: {
        payrollBaseCurrency: true,
        country: { select: { currency: true } },
      },
    });
    if (!company) {
      return 'AUD';
    }
    return (
      company.payrollBaseCurrency?.toUpperCase() ??
      company.country.currency.toUpperCase()
    );
  }

  async resolveEmployeePayCurrency(
    employeeId: string,
    asOfDate: Date,
  ): Promise<string> {
    const contract = await this.prisma.unscoped.employmentContract.findFirst({
      where: {
        employeeId,
        status: EmploymentContractStatus.active,
        startDate: { lte: asOfDate },
        OR: [{ endDate: null }, { endDate: { gte: asOfDate } }],
      },
      orderBy: [{ startDate: 'desc' }],
      select: { currency: true },
    });

    if (contract?.currency) {
      return contract.currency.toUpperCase();
    }

    const employee = await this.prisma.unscoped.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true },
    });
    if (!employee) {
      return 'AUD';
    }
    return this.resolveCompanyBaseCurrency(employee.companyId);
  }

  async buildPayrollCurrencySnapshot(input: {
    tenantId: string;
    companyId: string;
    employeeId: string;
    asOfDate: Date;
    grossPay: string;
    totalDeductions: string;
    netPay: string;
  }): Promise<PayrollCurrencySnapshot> {
    const [payCurrency, baseCurrency] = await Promise.all([
      this.resolveEmployeePayCurrency(input.employeeId, input.asOfDate),
      this.resolveCompanyBaseCurrency(input.companyId),
    ]);

    const resolved = await this.exchangeRates.resolveRate(
      input.tenantId,
      baseCurrency,
      payCurrency,
      input.asOfDate,
    );

    const rate = new Decimal(resolved.rate);
    const grossPayBase = convertQuoteToBase(input.grossPay, rate);
    const totalDeductionsBase = convertQuoteToBase(input.totalDeductions, rate);
    const netPayBase = convertQuoteToBase(input.netPay, rate);

    return {
      payCurrency,
      baseCurrency,
      exchangeRate: resolved.rate,
      exchangeRateDate: resolved.asOfDate,
      exchangeRateId: resolved.id,
      grossPayBase: grossPayBase.toFixed(2),
      totalDeductionsBase: totalDeductionsBase.toFixed(2),
      netPayBase: netPayBase.toFixed(2),
    };
  }

  /** True when an active contract currency differs from company base on the payroll date. */
  async requiresFxConversion(
    employeeId: string,
    companyId: string,
    asOfDate: Date,
  ): Promise<boolean> {
    const [payCurrency, baseCurrency] = await Promise.all([
      this.resolveEmployeePayCurrency(employeeId, asOfDate),
      this.resolveCompanyBaseCurrency(companyId),
    ]);
    return payCurrency !== baseCurrency;
  }
}
