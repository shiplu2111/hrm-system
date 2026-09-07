import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateExchangeRateInput,
  ExchangeRateRecord,
  ResolvedExchangeRate,
  UpdateExchangeRateInput,
} from '@hrm/shared-types';
import { Decimal } from '@prisma/client/runtime/library';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { parseDateOnly } from '../rule-resolver/effective-date.utils';
import {
  formatRate,
  identityRate,
  resolveExchangeRateRow,
} from './exchange-rate.utils';

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
    return rows.map((row) => this.toRecord(row));
  }

  async createRate(
    tenantId: string,
    input: CreateExchangeRateInput,
    user: AuthenticatedUser,
  ): Promise<ExchangeRateRecord> {
    this.assertDistinctCurrencies(input.baseCurrency, input.quoteCurrency);
    const rate = this.parseRate(input.rate);
    const effectiveFrom = parseDateOnly(input.effectiveFrom);
    const effectiveTo = input.effectiveTo
      ? parseDateOnly(input.effectiveTo)
      : null;

    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'effectiveTo must be on or after effectiveFrom',
      });
    }

    const row = await this.prisma.unscoped.exchangeRate.create({
      data: {
        tenantId,
        baseCurrency: input.baseCurrency.toUpperCase(),
        quoteCurrency: input.quoteCurrency.toUpperCase(),
        rate,
        effectiveFrom,
        effectiveTo,
        createdByUserId: user.id,
      },
    });

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
        effectiveFrom: input.effectiveFrom,
      },
    });

    return this.toRecord(row);
  }

  async updateRate(
    tenantId: string,
    rateId: string,
    input: UpdateExchangeRateInput,
    user: AuthenticatedUser,
  ): Promise<ExchangeRateRecord> {
    const existing = await this.prisma.unscoped.exchangeRate.findFirst({
      where: { id: rateId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Exchange rate not found' });
    }

    const effectiveFrom = input.effectiveFrom
      ? parseDateOnly(input.effectiveFrom)
      : undefined;
    const effectiveTo =
      input.effectiveTo !== undefined
        ? input.effectiveTo
          ? parseDateOnly(input.effectiveTo)
          : null
        : undefined;

    const row = await this.prisma.unscoped.exchangeRate.update({
      where: { id: rateId },
      data: {
        rate: input.rate ? this.parseRate(input.rate) : undefined,
        effectiveFrom,
        effectiveTo,
      },
    });

    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'update',
      module: 'settings',
      recordId: row.id,
      newValue: {
        rate: formatRate(row.rate),
        effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
        effectiveTo: row.effectiveTo?.toISOString().slice(0, 10) ?? null,
      },
    });

    return this.toRecord(row);
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
      const identity = identityRate(base, asOfDate);
      return {
        id: null,
        baseCurrency: base,
        quoteCurrency: quote,
        rate: '1',
        effectiveFrom: null,
        effectiveTo: null,
        asOfDate: asOfDate.toISOString().slice(0, 10),
        isIdentity: true,
      };
    }

    const rows = await this.prisma.unscoped.exchangeRate.findMany({
      where: { tenantId, baseCurrency: base, quoteCurrency: quote },
    });

    const match = resolveExchangeRateRow(rows, base, quote, asOfDate);
    if (!match) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `No exchange rate for ${quote}/${base} effective on ${asOfDate.toISOString().slice(0, 10)}`,
      });
    }

    return {
      id: match.id,
      baseCurrency: match.baseCurrency,
      quoteCurrency: match.quoteCurrency,
      rate: formatRate(match.rate),
      effectiveFrom: match.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: match.effectiveTo?.toISOString().slice(0, 10) ?? null,
      asOfDate: asOfDate.toISOString().slice(0, 10),
      isIdentity: false,
    };
  }

  private parseRate(value: string): Decimal {
    const rate = new Decimal(value);
    if (!rate.isFinite() || rate.lte(0)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Exchange rate must be a positive number',
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

  private toRecord(row: {
    id: string;
    tenantId: string;
    baseCurrency: string;
    quoteCurrency: string;
    rate: Decimal;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ExchangeRateRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      baseCurrency: row.baseCurrency,
      quoteCurrency: row.quoteCurrency,
      rate: formatRate(row.rate),
      effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: row.effectiveTo?.toISOString().slice(0, 10) ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
