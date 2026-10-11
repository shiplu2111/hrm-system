import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmploymentContractStatus,
  PayrollRunStatus,
  Prisma,
  type ExchangeRate,
} from '@prisma/client';
import {
  addDaysToDateOnly,
  planNewRateVersion,
  planRateVersionUpdate,
  rateVersionEditability,
  type CompanyPayrollCurrencyView,
  type CreateExchangeRateInput,
  type CurrencySettingsOverview,
  type DeleteExchangeRateResult,
  type ExchangeRatePairSummary,
  type ExchangeRateRecord,
  type ExchangeRateUsage,
  type RatePlan,
  type ResolvedExchangeRate,
  type UpdateExchangeRateInput,
} from '@hrm/shared-types';
import { Decimal } from '@prisma/client/runtime/library';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { parseDateOnly } from '../rule-resolver/effective-date.utils';
import { formatRate, resolveExchangeRateRow } from './exchange-rate.utils';

/** Runs whose stored rate can no longer change (RULES.md Â§3). */
const LOCKED_RUN_WHERE: Prisma.PayrollRunWhereInput = {
  deletedAt: null,
  OR: [
    { locked: true },
    { status: { in: [PayrollRunStatus.finalized, PayrollRunStatus.paid] } },
  ],
};

const UNLOCKED_RUN_WHERE: Prisma.PayrollRunWhereInput = {
  deletedAt: null,
  locked: false,
  status: { notIn: [PayrollRunStatus.finalized, PayrollRunStatus.paid, PayrollRunStatus.cancelled] },
};

/** A current version ending within this many days without a successor is flagged. */
const ENDING_SOON_DAYS = 31;

const toDateOnly = (value: Date): string => value.toISOString().slice(0, 10);

@Injectable()
export class ExchangeRatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listRates(tenantId: string): Promise<ExchangeRateRecord[]> {
    const rows = await this.prisma.unscoped.exchangeRate.findMany({
      where: { tenantId },
      orderBy: [
        { baseCurrency: 'asc' },
        { quoteCurrency: 'asc' },
        { effectiveFrom: 'desc' },
      ],
    });
    return this.toRecords(rows);
  }

  async getOverview(tenantId: string, today = new Date()): Promise<CurrencySettingsOverview> {
    const todayKey = toDateOnly(today);
    const [rates, companies, lockedByPair, contracts] = await Promise.all([
      this.listRates(tenantId),
      this.prisma.unscoped.company.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          payrollBaseCurrency: true,
          country: { select: { currency: true } },
        },
      }),
      this.lockedThroughByPair(tenantId),
      this.prisma.unscoped.employmentContract.findMany({
        where: {
          tenantId,
          status: EmploymentContractStatus.active,
          startDate: { lte: parseDateOnly(todayKey) },
          OR: [{ endDate: null }, { endDate: { gte: parseDateOnly(todayKey) } }],
        },
        select: { employeeId: true, companyId: true, currency: true },
      }),
    ]);

    const companyViews: CompanyPayrollCurrencyView[] = companies.map((company) => {
      const countryCurrency = company.country.currency.toUpperCase();
      const base = company.payrollBaseCurrency?.toUpperCase() ?? countryCurrency;
      return {
        companyId: company.id,
        companyName: company.name,
        countryCurrency,
        payrollBaseCurrency: base,
        overridden: base !== countryCurrency,
      };
    });
    const companyById = new Map(companyViews.map((company) => [company.companyId, company]));

    const required = new Map<string, { employees: Set<string>; companies: Set<string> }>();
    for (const contract of contracts) {
      const company = companyById.get(contract.companyId);
      if (!company) continue;
      const quote = contract.currency.toUpperCase();
      if (quote === company.payrollBaseCurrency) continue;
      const key = pairKey(company.payrollBaseCurrency, quote);
      const entry = required.get(key) ?? { employees: new Set(), companies: new Set() };
      entry.employees.add(contract.employeeId);
      entry.companies.add(company.companyName);
      required.set(key, entry);
    }

    const byPair = new Map<string, ExchangeRateRecord[]>();
    for (const rate of rates) {
      const key = pairKey(rate.baseCurrency, rate.quoteCurrency);
      byPair.set(key, [...(byPair.get(key) ?? []), rate]);
    }

    const keys = new Set([...byPair.keys(), ...required.keys()]);
    const endingSoonBefore = addDaysToDateOnly(todayKey, ENDING_SOON_DAYS);
    const pairs: ExchangeRatePairSummary[] = [...keys].map((key) => {
      const [baseCurrency, quoteCurrency] = key.split('/');
      const versions = byPair.get(key) ?? [];
      const need = required.get(key);
      const current =
        versions.find(
          (v) => v.effectiveFrom <= todayKey && (v.effectiveTo === null || v.effectiveTo >= todayKey),
        ) ?? null;
      const next =
        [...versions]
          .filter((v) => v.effectiveFrom > todayKey)
          .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0] ?? null;

      let status: ExchangeRatePairSummary['status'];
      if (!need) status = 'unused';
      else if (!current) status = 'missing';
      else if (current.effectiveTo && current.effectiveTo <= endingSoonBefore && !next) status = 'ending_soon';
      else status = 'ok';

      return {
        baseCurrency,
        quoteCurrency,
        status,
        current,
        next,
        versionCount: versions.length,
        lockedThrough: lockedByPair.get(key) ?? null,
        employeesPaid: need?.employees.size ?? 0,
        companyNames: need ? [...need.companies].sort() : [],
      };
    });

    const statusOrder = { missing: 0, ending_soon: 1, ok: 2, unused: 3 };
    pairs.sort(
      (a, b) =>
        statusOrder[a.status] - statusOrder[b.status] ||
        b.employeesPaid - a.employeesPaid ||
        pairKey(a.baseCurrency, a.quoteCurrency).localeCompare(pairKey(b.baseCurrency, b.quoteCurrency)),
    );

    return { today: todayKey, companies: companyViews, pairs, rates };
  }

  async createRate(
    tenantId: string,
    input: CreateExchangeRateInput,
    user: AuthenticatedUser,
  ): Promise<ExchangeRateRecord> {
    const base = input.baseCurrency.toUpperCase();
    const quote = input.quoteCurrency.toUpperCase();
    this.assertDistinctCurrencies(base, quote);
    const rate = this.parseRate(input.rate);
    const effectiveFrom = toDateOnly(parseDateOnly(input.effectiveFrom));
    const requestedTo = input.effectiveTo ? toDateOnly(parseDateOnly(input.effectiveTo)) : null;

    const [versions, lockedThrough] = await Promise.all([
      this.pairVersions(tenantId, base, quote),
      this.lockedThroughForPair(tenantId, base, quote),
    ]);
    const plan = unwrapPlan(
      planNewRateVersion(
        versions.map(toPeriod),
        { effectiveFrom, effectiveTo: requestedTo },
        lockedThrough,
      ),
    );

    const previous = plan.closePrevious
      ? versions.find((v) => v.id === plan.closePrevious!.id) ?? null
      : null;

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      if (plan.closePrevious) {
        await tx.exchangeRate.update({
          where: { id: plan.closePrevious.id },
          data: { effectiveTo: parseDateOnly(plan.closePrevious.effectiveTo) },
        });
      }
      return tx.exchangeRate.create({
        data: {
          tenantId,
          baseCurrency: base,
          quoteCurrency: quote,
          rate,
          effectiveFrom: parseDateOnly(effectiveFrom),
          effectiveTo: plan.effectiveTo ? parseDateOnly(plan.effectiveTo) : null,
          createdByUserId: user.id,
        },
      });
    });

    if (previous && plan.closePrevious) {
      await this.auditService.log({
        tenantId,
        userId: user.id,
        action: 'update',
        module: 'settings',
        recordId: previous.id,
        oldValue: { effectiveTo: null },
        newValue: {
          effectiveTo: plan.closePrevious.effectiveTo,
          reason: `Superseded by ${base}/${quote} rate from ${effectiveFrom}`,
        },
      });
    }
    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'create',
      module: 'settings',
      recordId: row.id,
      newValue: {
        baseCurrency: row.baseCurrency,
        quoteCurrency: row.quoteCurrency,
        rate: formatRate(row.rate),
        effectiveFrom,
        effectiveTo: plan.effectiveTo,
      },
    });

    return this.toRecordWithUsage(row);
  }

  async updateRate(
    tenantId: string,
    rateId: string,
    input: UpdateExchangeRateInput,
    user: AuthenticatedUser,
  ): Promise<ExchangeRateRecord> {
    const existing = await this.findRate(tenantId, rateId);
    const [versions, lockedThrough] = await Promise.all([
      this.pairVersions(tenantId, existing.baseCurrency, existing.quoteCurrency),
      this.lockedThroughForPair(tenantId, existing.baseCurrency, existing.quoteCurrency),
    ]);

    const newRate = input.rate !== undefined ? this.parseRate(input.rate) : undefined;
    const plan = unwrapPlan(
      planRateVersionUpdate(
        toPeriod(existing),
        versions.map(toPeriod),
        {
          rateChanged: newRate !== undefined && !newRate.equals(existing.rate),
          effectiveFrom: input.effectiveFrom
            ? toDateOnly(parseDateOnly(input.effectiveFrom))
            : undefined,
          effectiveTo:
            input.effectiveTo === undefined
              ? undefined
              : input.effectiveTo
                ? toDateOnly(parseDateOnly(input.effectiveTo))
                : null,
        },
        lockedThrough,
      ),
    );

    const row = await this.prisma.unscoped.exchangeRate.update({
      where: { id: rateId },
      data: {
        rate: newRate,
        effectiveFrom: parseDateOnly(plan.effectiveFrom),
        effectiveTo: plan.effectiveTo ? parseDateOnly(plan.effectiveTo) : null,
      },
    });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'update',
      module: 'settings',
      recordId: row.id,
      oldValue: {
        rate: formatRate(existing.rate),
        effectiveFrom: toDateOnly(existing.effectiveFrom),
        effectiveTo: existing.effectiveTo ? toDateOnly(existing.effectiveTo) : null,
      },
      newValue: {
        rate: formatRate(row.rate),
        effectiveFrom: plan.effectiveFrom,
        effectiveTo: plan.effectiveTo,
      },
    });

    return this.toRecordWithUsage(row);
  }

  async deleteRate(
    tenantId: string,
    rateId: string,
    user: AuthenticatedUser,
  ): Promise<DeleteExchangeRateResult> {
    const existing = await this.findRate(tenantId, rateId);
    const lockedThrough = await this.lockedThroughForPair(
      tenantId,
      existing.baseCurrency,
      existing.quoteCurrency,
    );
    const lockedRuns = await this.prisma.unscoped.payrollRun.count({
      where: { ...LOCKED_RUN_WHERE, exchangeRateId: rateId },
    });
    if (!rateVersionEditability(toPeriod(existing), lockedThrough).delete || lockedRuns > 0) {
      throw new ConflictException({
        code: 'RATE_PERIOD_LOCKED',
        message:
          'This rate was in force for finalized payroll and is kept as part of the payroll history. Add a newer rate instead of deleting it.',
      });
    }

    const unlockedRunsAffected = await this.prisma.unscoped.payrollRun.count({
      where: { ...UNLOCKED_RUN_WHERE, exchangeRateId: rateId },
    });
    await this.prisma.unscoped.exchangeRate.delete({ where: { id: rateId } });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'delete',
      module: 'settings',
      recordId: rateId,
      oldValue: {
        baseCurrency: existing.baseCurrency,
        quoteCurrency: existing.quoteCurrency,
        rate: formatRate(existing.rate),
        effectiveFrom: toDateOnly(existing.effectiveFrom),
        effectiveTo: existing.effectiveTo ? toDateOnly(existing.effectiveTo) : null,
      },
    });

    return { deleted: true, id: rateId, unlockedRunsAffected };
  }

  async resolveRate(
    tenantId: string,
    baseCurrency: string,
    quoteCurrency: string,
    asOfDate: Date,
  ): Promise<ResolvedExchangeRate> {
    const base = baseCurrency.toUpperCase();
    const quote = quoteCurrency.toUpperCase();

    if (base === quote) {
      return {
        id: null,
        baseCurrency: base,
        quoteCurrency: quote,
        rate: '1',
        effectiveFrom: null,
        effectiveTo: null,
        asOfDate: toDateOnly(asOfDate),
        isIdentity: true,
      };
    }

    const rows = await this.pairVersions(tenantId, base, quote);
    const match = resolveExchangeRateRow(rows, base, quote, asOfDate);
    if (!match) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `No exchange rate for ${base}/${quote} effective on ${toDateOnly(asOfDate)}`,
      });
    }

    return {
      id: match.id,
      baseCurrency: match.baseCurrency,
      quoteCurrency: match.quoteCurrency,
      rate: formatRate(match.rate),
      effectiveFrom: toDateOnly(match.effectiveFrom),
      effectiveTo: match.effectiveTo ? toDateOnly(match.effectiveTo) : null,
      asOfDate: toDateOnly(asOfDate),
      isIdentity: false,
    };
  }

  /** Latest finalized payroll date that stored a rate for this pair. */
  async lockedThroughForPair(
    tenantId: string,
    baseCurrency: string,
    quoteCurrency: string,
  ): Promise<string | null> {
    const result = await this.prisma.unscoped.payrollRun.aggregate({
      where: {
        ...LOCKED_RUN_WHERE,
        baseCurrency: baseCurrency.toUpperCase(),
        payCurrency: quoteCurrency.toUpperCase(),
        exchangeRateDate: { not: null },
        payrollPeriod: { company: { tenantId } },
      },
      _max: { exchangeRateDate: true },
    });
    return result._max.exchangeRateDate ? toDateOnly(result._max.exchangeRateDate) : null;
  }

  private async lockedThroughByPair(tenantId: string): Promise<Map<string, string>> {
    const groups = await this.prisma.unscoped.payrollRun.groupBy({
      by: ['baseCurrency', 'payCurrency'],
      where: {
        ...LOCKED_RUN_WHERE,
        exchangeRateDate: { not: null },
        payrollPeriod: { company: { tenantId } },
      },
      _max: { exchangeRateDate: true },
    });
    const map = new Map<string, string>();
    for (const group of groups) {
      if (group.baseCurrency === group.payCurrency || !group._max.exchangeRateDate) continue;
      map.set(pairKey(group.baseCurrency, group.payCurrency), toDateOnly(group._max.exchangeRateDate));
    }
    return map;
  }

  private pairVersions(tenantId: string, base: string, quote: string): Promise<ExchangeRate[]> {
    return this.prisma.unscoped.exchangeRate.findMany({
      where: { tenantId, baseCurrency: base.toUpperCase(), quoteCurrency: quote.toUpperCase() },
      orderBy: { effectiveFrom: 'asc' },
    });
  }

  private async findRate(tenantId: string, rateId: string): Promise<ExchangeRate> {
    const row = await this.prisma.unscoped.exchangeRate.findFirst({
      where: { id: rateId, tenantId },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Exchange rate not found' });
    }
    return row;
  }

  private async toRecordWithUsage(row: ExchangeRate): Promise<ExchangeRateRecord> {
    const [record] = await this.toRecords([row]);
    return record;
  }

  private async toRecords(rows: ExchangeRate[]): Promise<ExchangeRateRecord[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const [locked, unlocked, users] = await Promise.all([
      this.prisma.unscoped.payrollRun.groupBy({
        by: ['exchangeRateId'],
        where: { ...LOCKED_RUN_WHERE, exchangeRateId: { in: ids } },
        _count: { _all: true },
        _max: { exchangeRateDate: true },
      }),
      this.prisma.unscoped.payrollRun.groupBy({
        by: ['exchangeRateId'],
        where: { ...UNLOCKED_RUN_WHERE, exchangeRateId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.unscoped.user.findMany({
        where: { id: { in: [...new Set(rows.map((row) => row.createdByUserId))] } },
        select: {
          id: true,
          email: true,
          employee: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const lockedById = new Map(locked.map((group) => [group.exchangeRateId, group]));
    const unlockedById = new Map(unlocked.map((group) => [group.exchangeRateId, group._count._all]));
    const names = new Map(
      users.map((user) => [
        user.id,
        user.employee ? `${user.employee.firstName} ${user.employee.lastName}`.trim() : user.email,
      ]),
    );

    return rows.map((row) => {
      const lockedGroup = lockedById.get(row.id);
      const usage: ExchangeRateUsage = {
        lockedRuns: lockedGroup?._count._all ?? 0,
        unlockedRuns: unlockedById.get(row.id) ?? 0,
        lastLockedDate: lockedGroup?._max.exchangeRateDate
          ? toDateOnly(lockedGroup._max.exchangeRateDate)
          : null,
      };
      return {
        id: row.id,
        tenantId: row.tenantId,
        baseCurrency: row.baseCurrency,
        quoteCurrency: row.quoteCurrency,
        rate: formatRate(row.rate),
        effectiveFrom: toDateOnly(row.effectiveFrom),
        effectiveTo: row.effectiveTo ? toDateOnly(row.effectiveTo) : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        createdByName: names.get(row.createdByUserId) ?? null,
        usage,
      };
    });
  }

  private parseRate(value: string): Decimal {
    let rate: Decimal;
    try {
      rate = new Decimal(value.trim());
    } catch {
      rate = new Decimal(NaN);
    }
    if (!rate.isFinite() || rate.lte(0)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Exchange rate must be a positive number',
      });
    }
    if (rate.decimalPlaces() > 8 || rate.gte(new Decimal('1e10'))) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Exchange rates support up to 10 digits before and 8 after the decimal point',
      });
    }
    return rate;
  }

  private assertDistinctCurrencies(base: string, quote: string): void {
    if (base.toUpperCase() === quote.toUpperCase()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Base and quote currency must differ',
      });
    }
  }
}

function pairKey(base: string, quote: string): string {
  return `${base.toUpperCase()}/${quote.toUpperCase()}`;
}

function toPeriod(row: { id: string; effectiveFrom: Date; effectiveTo: Date | null }) {
  return {
    id: row.id,
    effectiveFrom: toDateOnly(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? toDateOnly(row.effectiveTo) : null,
  };
}

function unwrapPlan<T>(plan: RatePlan<T>): T {
  if (plan.ok) return plan.value;
  const body = { code: plan.code, message: plan.message };
  throw plan.code === 'VALIDATION_ERROR'
    ? new BadRequestException(body)
    : new ConflictException(body);
}
