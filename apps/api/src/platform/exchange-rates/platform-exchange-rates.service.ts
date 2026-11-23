import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import {
  PlatformRateSource,
  type PlatformExchangeRate,
} from '@prisma/client';
import type {
  PlatformExchangeRatePairSummary,
  PlatformExchangeRateProviderDef,
  PlatformExchangeRateRecord,
  ResolvedPlatformExchangeRate,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import {
  CreatePlatformExchangeRateDto,
  ManualOverridePlatformRateDto,
  QueryPlatformExchangeRatesDto,
  SyncProviderRatesDto,
} from './dto/platform-exchange-rates.dto';
import { ManualRateProvider } from './providers/manual-rate.provider';
import { PlatformFxRateProvider } from './providers/platform-fx.provider';
import { ExchangeRateProvider } from './interfaces/exchange-rate-provider.interface';

const toDateOnly = (d: Date): string => d.toISOString().slice(0, 10);

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class PlatformExchangeRatesService implements OnModuleInit {
  private readonly logger = new Logger(PlatformExchangeRatesService.name);
  private readonly providers: Map<string, ExchangeRateProvider> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly manualProvider: ManualRateProvider,
    private readonly platformFxProvider: PlatformFxRateProvider,
    @Optional() private readonly auditService?: PlatformAuditService,
  ) {
    this.providers.set(this.manualProvider.providerId, this.manualProvider);
    this.providers.set(this.platformFxProvider.providerId, this.platformFxProvider);
  }

  async onModuleInit() {
    await this.seedBaselineRatesIfEmpty();
  }

  /**
   * Seed standard global currency pairs if no platform exchange rates exist
   */
  async seedBaselineRatesIfEmpty() {
    try {
      const count = await this.prisma.unscoped.platformExchangeRate.count();
      if (count > 0) return;

      this.logger.log('Seeding baseline platform exchange rates...');

      const baselineDate = new Date('2026-01-01T00:00:00Z');
      const seedPairs: Array<{
        base: string;
        quote: string;
        rate: string;
        inverseRate: string;
        source: PlatformRateSource;
        providerName: string;
        notes: string;
      }> = [
        // AUD pairs
        {
          base: 'AUD',
          quote: 'USD',
          rate: '1.54200000',
          inverseRate: '0.64850843',
          source: PlatformRateSource.provider,
          providerName: 'platform_fx_feed',
          notes: 'Global FX Baseline (1 USD = 1.542 AUD)',
        },
        {
          base: 'USD',
          quote: 'AUD',
          rate: '0.64850843',
          inverseRate: '1.54200000',
          source: PlatformRateSource.provider,
          providerName: 'platform_fx_feed',
          notes: 'Global FX Baseline (1 AUD = 0.6485 USD)',
        },
        // BDT pairs
        {
          base: 'USD',
          quote: 'BDT',
          rate: '121.50000000',
          inverseRate: '0.00823045',
          source: PlatformRateSource.provider,
          providerName: 'platform_fx_feed',
          notes: 'Benchmark exchange rate (1 BDT = 0.00823 USD)',
        },
        {
          base: 'BDT',
          quote: 'USD',
          rate: '0.00823045',
          inverseRate: '121.50000000',
          source: PlatformRateSource.provider,
          providerName: 'platform_fx_feed',
          notes: 'Benchmark exchange rate (1 USD = 121.50 BDT)',
        },
        {
          base: 'AUD',
          quote: 'BDT',
          rate: '78.80000000',
          inverseRate: '0.01269036',
          source: PlatformRateSource.provider,
          providerName: 'platform_fx_feed',
          notes: 'Cross-rate AUD/BDT (1 BDT = 0.01269 AUD)',
        },
        {
          base: 'BDT',
          quote: 'AUD',
          rate: '0.01269036',
          inverseRate: '78.80000000',
          source: PlatformRateSource.provider,
          providerName: 'platform_fx_feed',
          notes: 'Cross-rate BDT/AUD (1 AUD = 78.80 BDT)',
        },
        // EUR / GBP / CAD / SGD pairs
        {
          base: 'EUR',
          quote: 'USD',
          rate: '0.92150000',
          inverseRate: '1.08518720',
          source: PlatformRateSource.provider,
          providerName: 'platform_fx_feed',
          notes: 'European benchmark baseline',
        },
        {
          base: 'USD',
          quote: 'EUR',
          rate: '1.08518720',
          inverseRate: '0.92150000',
          source: PlatformRateSource.provider,
          providerName: 'platform_fx_feed',
          notes: 'European benchmark baseline',
        },
        {
          base: 'GBP',
          quote: 'USD',
          rate: '0.77250000',
          inverseRate: '1.29449838',
          source: PlatformRateSource.provider,
          providerName: 'platform_fx_feed',
          notes: 'Bank of England market benchmark baseline',
        },
        {
          base: 'USD',
          quote: 'GBP',
          rate: '1.29449838',
          inverseRate: '0.77250000',
          source: PlatformRateSource.provider,
          providerName: 'platform_fx_feed',
          notes: 'Bank of England market benchmark baseline',
        },
        {
          base: 'CAD',
          quote: 'USD',
          rate: '1.37900000',
          inverseRate: '0.72516316',
          source: PlatformRateSource.provider,
          providerName: 'platform_fx_feed',
          notes: 'Bank of Canada benchmark baseline',
        },
        {
          base: 'SGD',
          quote: 'USD',
          rate: '1.32500000',
          inverseRate: '0.75471698',
          source: PlatformRateSource.provider,
          providerName: 'platform_fx_feed',
          notes: 'Monetary Authority of Singapore benchmark',
        },
      ];

      for (const item of seedPairs) {
        await this.prisma.unscoped.platformExchangeRate.create({
          data: {
            baseCurrency: item.base,
            quoteCurrency: item.quote,
            rate: new Decimal(item.rate),
            inverseRate: new Decimal(item.inverseRate),
            effectiveFrom: baselineDate,
            effectiveTo: null,
            source: item.source,
            providerName: item.providerName,
            notes: item.notes,
          },
        });
      }

      this.logger.log(`Seeded ${seedPairs.length} baseline platform exchange rates.`);
    } catch (err: any) {
      this.logger.warn(`Failed to seed baseline exchange rates: ${err.message}`);
    }
  }

  /**
   * List all platform currency pairs with active rate summary, status, and version counts
   */
  async listPairs(query?: QueryPlatformExchangeRatesDto): Promise<PlatformExchangeRatePairSummary[]> {
    const today = new Date().toISOString().slice(0, 10);
    const todayDate = new Date(today + 'T00:00:00Z');

    const allRates = await this.prisma.unscoped.platformExchangeRate.findMany({
      orderBy: [
        { baseCurrency: 'asc' },
        { quoteCurrency: 'asc' },
        { effectiveFrom: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const groups = new Map<string, PlatformExchangeRate[]>();
    for (const r of allRates) {
      if (query?.baseCurrency && r.baseCurrency !== query.baseCurrency.toUpperCase()) continue;
      if (query?.quoteCurrency && r.quoteCurrency !== query.quoteCurrency.toUpperCase()) continue;
      if (query?.source && r.source !== query.source) continue;

      const key = `${r.baseCurrency}/${r.quoteCurrency}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }

    const summaries: PlatformExchangeRatePairSummary[] = [];

    for (const [key, rows] of groups.entries()) {
      const [base, quote] = key.split('/');

      // Find current version active today
      const current = rows.find(
        (r) =>
          r.effectiveFrom <= todayDate &&
          (!r.effectiveTo || r.effectiveTo >= todayDate),
      );

      const latest = rows[0];
      const overrides = rows.filter((r) => r.source === PlatformRateSource.manual_override);

      let status: 'active' | 'ending_soon' | 'missing' = 'missing';
      if (current) {
        if (current.effectiveTo) {
          const diffDays = Math.ceil(
            (current.effectiveTo.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          status = diffDays <= 31 ? 'ending_soon' : 'active';
        } else {
          status = 'active';
        }
      }

      summaries.push({
        baseCurrency: base,
        quoteCurrency: quote,
        currentRate: current ? this.mapToRecord(current) : (latest ? this.mapToRecord(latest) : null),
        latestSource: latest.source as any,
        status,
        versionCount: rows.length,
        lastUpdated: latest.updatedAt.toISOString(),
        overrideCount: overrides.length,
      });
    }

    return summaries.sort((a, b) => `${a.baseCurrency}/${a.quoteCurrency}`.localeCompare(`${b.baseCurrency}/${b.quoteCurrency}`));
  }

  /**
   * Rate-history table for a specific currency pair (never overwritten, full audit log)
   */
  async getPairHistory(
    baseCurrency: string,
    quoteCurrency: string,
  ): Promise<PlatformExchangeRateRecord[]> {
    const base = baseCurrency.toUpperCase();
    const quote = quoteCurrency.toUpperCase();

    const records = await this.prisma.unscoped.platformExchangeRate.findMany({
      where: {
        baseCurrency: base,
        quoteCurrency: quote,
      },
      orderBy: [
        { effectiveFrom: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return records.map((r) => this.mapToRecord(r));
  }

  /**
   * Resolve platform default rate for a pair on a given date
   * Used as the platform fallback when tenants have not defined a custom override.
   */
  async resolveRate(
    baseCurrency: string,
    quoteCurrency: string,
    asOfDate?: Date | string,
  ): Promise<ResolvedPlatformExchangeRate> {
    const base = baseCurrency.toUpperCase();
    const quote = quoteCurrency.toUpperCase();
    const targetDateStr = asOfDate
      ? typeof asOfDate === 'string'
        ? asOfDate
        : toDateOnly(asOfDate)
      : toDateOnly(new Date());
    const targetDate = new Date(targetDateStr + 'T00:00:00Z');

    // 1. Identity case (base === quote)
    if (base === quote) {
      return {
        id: null,
        baseCurrency: base,
        quoteCurrency: quote,
        rate: '1.00000000',
        inverseRate: '1.00000000',
        effectiveFrom: null,
        effectiveTo: null,
        asOfDate: targetDateStr,
        source: 'identity',
      };
    }

    // 2. Direct lookup in PlatformExchangeRate
    const directMatch = await this.prisma.unscoped.platformExchangeRate.findFirst({
      where: {
        baseCurrency: base,
        quoteCurrency: quote,
        effectiveFrom: { lte: targetDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: targetDate } },
        ],
      },
      orderBy: [
        { effectiveFrom: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    if (directMatch) {
      const isOverride = directMatch.source === PlatformRateSource.manual_override;
      return {
        id: directMatch.id,
        baseCurrency: directMatch.baseCurrency,
        quoteCurrency: directMatch.quoteCurrency,
        rate: directMatch.rate.toFixed(8),
        inverseRate: directMatch.inverseRate ? directMatch.inverseRate.toFixed(8) : (1 / directMatch.rate.toNumber()).toFixed(8),
        effectiveFrom: toDateOnly(directMatch.effectiveFrom),
        effectiveTo: directMatch.effectiveTo ? toDateOnly(directMatch.effectiveTo) : null,
        asOfDate: targetDateStr,
        source: isOverride ? 'platform_manual_override' : 'platform_default',
        providerName: directMatch.providerName,
        overrideReason: directMatch.overrideReason,
      };
    }

    // 3. Inverse lookup in PlatformExchangeRate (e.g. quote/base)
    const inverseMatch = await this.prisma.unscoped.platformExchangeRate.findFirst({
      where: {
        baseCurrency: quote,
        quoteCurrency: base,
        effectiveFrom: { lte: targetDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: targetDate } },
        ],
      },
      orderBy: [
        { effectiveFrom: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    if (inverseMatch) {
      const calculatedRate = (1 / inverseMatch.rate.toNumber()).toFixed(8);
      const isOverride = inverseMatch.source === PlatformRateSource.manual_override;
      return {
        id: inverseMatch.id,
        baseCurrency: base,
        quoteCurrency: quote,
        rate: calculatedRate,
        inverseRate: inverseMatch.rate.toFixed(8),
        effectiveFrom: toDateOnly(inverseMatch.effectiveFrom),
        effectiveTo: inverseMatch.effectiveTo ? toDateOnly(inverseMatch.effectiveTo) : null,
        asOfDate: targetDateStr,
        source: isOverride ? 'platform_manual_override' : 'platform_default',
        providerName: inverseMatch.providerName,
        overrideReason: inverseMatch.overrideReason,
      };
    }

    throw new NotFoundException({
      code: 'PLATFORM_RATE_NOT_FOUND',
      message: `No platform default exchange rate exists for pair ${base}/${quote} effective on ${targetDateStr}`,
    });
  }

  /**
   * Create a new platform exchange rate version.
   * Historical rates are never overwritten.
   */
  async createRateVersion(
    dto: CreatePlatformExchangeRateDto,
    actorUserId: string = 'system',
  ): Promise<PlatformExchangeRateRecord> {
    const base = dto.baseCurrency.toUpperCase();
    const quote = dto.quoteCurrency.toUpperCase();

    if (base === quote) {
      throw new BadRequestException('Base and quote currency cannot be identical');
    }

    const rateNum = Number(dto.rate);
    if (!Number.isFinite(rateNum) || rateNum <= 0) {
      throw new BadRequestException('Exchange rate must be a positive number');
    }

    const effectiveFromStr = dto.effectiveFrom || toDateOnly(new Date());
    const effectiveFromDate = new Date(effectiveFromStr + 'T00:00:00Z');
    const effectiveToDate = dto.effectiveTo ? new Date(dto.effectiveTo + 'T00:00:00Z') : null;

    if (effectiveToDate && effectiveToDate < effectiveFromDate) {
      throw new BadRequestException('effectiveTo cannot precede effectiveFrom');
    }

    const rateDecimal = new Decimal(rateNum.toFixed(8));
    const inverseDecimal = new Decimal((1 / rateNum).toFixed(8));

    // Preserve contiguous history: if previous open-ended version starts before this one,
    // end it the day before the new version starts (never delete or mutate historical rate value)
    const prevOpenEnded = await this.prisma.unscoped.platformExchangeRate.findFirst({
      where: {
        baseCurrency: base,
        quoteCurrency: quote,
        effectiveTo: null,
        effectiveFrom: { lt: effectiveFromDate },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    const created = await this.prisma.unscoped.$transaction(async (tx) => {
      if (prevOpenEnded) {
        const dayBefore = new Date(addDays(effectiveFromStr, -1) + 'T00:00:00Z');
        if (dayBefore >= prevOpenEnded.effectiveFrom) {
          await tx.platformExchangeRate.update({
            where: { id: prevOpenEnded.id },
            data: { effectiveTo: dayBefore },
          });
        }
      }

      return tx.platformExchangeRate.create({
        data: {
          baseCurrency: base,
          quoteCurrency: quote,
          rate: rateDecimal,
          inverseRate: inverseDecimal,
          effectiveFrom: effectiveFromDate,
          effectiveTo: effectiveToDate,
          source: (dto.source as PlatformRateSource) || PlatformRateSource.manual,
          providerName: dto.providerName || (dto.source === 'provider' ? 'platform_fx_feed' : 'manual_entry'),
          notes: dto.notes,
          createdByUserId: actorUserId !== 'system' ? actorUserId : null,
        },
      });
    });

    this.logger.log(`Created platform exchange rate version for ${base}/${quote} (v: ${created.id}, rate: ${created.rate})`);
    if (this.auditService) {
      await this.auditService.log({
        userId: actorUserId !== 'system' ? actorUserId : null,
        action: 'create_rate_version',
        module: 'platform_exchange_rates',
        recordId: created.id,
        reason: dto.notes || `Created platform rate version ${base}/${quote}`,
        newValue: { baseCurrency: base, quoteCurrency: quote, rate: created.rate.toString(), effectiveFrom: effectiveFromStr },
      });
    }
    return this.mapToRecord(created);
  }

  /**
   * Manual administrative override with mandatory reason (never overwritten)
   */
  async createManualOverride(
    dto: ManualOverridePlatformRateDto,
    actorUserId: string = 'system',
  ): Promise<PlatformExchangeRateRecord> {
    const base = dto.baseCurrency.toUpperCase();
    const quote = dto.quoteCurrency.toUpperCase();

    if (!dto.reason || dto.reason.trim().length < 5) {
      throw new BadRequestException('Override reason is required and must be at least 5 characters');
    }

    const rateNum = Number(dto.rate);
    if (!Number.isFinite(rateNum) || rateNum <= 0) {
      throw new BadRequestException('Exchange rate must be a positive number');
    }

    const effectiveFromDate = new Date(dto.effectiveFrom + 'T00:00:00Z');
    const effectiveToDate = dto.effectiveTo ? new Date(dto.effectiveTo + 'T00:00:00Z') : null;

    if (effectiveToDate && effectiveToDate < effectiveFromDate) {
      throw new BadRequestException('effectiveTo cannot precede effectiveFrom');
    }

    const rateDecimal = new Decimal(rateNum.toFixed(8));
    const inverseDecimal = new Decimal((1 / rateNum).toFixed(8));

    // Create manual override version
    const prevOpenEnded = await this.prisma.unscoped.platformExchangeRate.findFirst({
      where: {
        baseCurrency: base,
        quoteCurrency: quote,
        effectiveTo: null,
        effectiveFrom: { lt: effectiveFromDate },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    const created = await this.prisma.unscoped.$transaction(async (tx) => {
      if (prevOpenEnded) {
        const dayBefore = new Date(addDays(dto.effectiveFrom, -1) + 'T00:00:00Z');
        if (dayBefore >= prevOpenEnded.effectiveFrom) {
          await tx.platformExchangeRate.update({
            where: { id: prevOpenEnded.id },
            data: { effectiveTo: dayBefore },
          });
        }
      }

      return tx.platformExchangeRate.create({
        data: {
          baseCurrency: base,
          quoteCurrency: quote,
          rate: rateDecimal,
          inverseRate: inverseDecimal,
          effectiveFrom: effectiveFromDate,
          effectiveTo: effectiveToDate,
          source: PlatformRateSource.manual_override,
          providerName: 'manual_override',
          overrideReason: dto.reason.trim(),
          notes: dto.notes,
          createdByUserId: actorUserId !== 'system' ? actorUserId : null,
        },
      });
    });

    this.logger.log(`Created platform exchange rate manual override for ${base}/${quote}: reason="${dto.reason}"`);
    if (this.auditService) {
      await this.auditService.log({
        userId: actorUserId !== 'system' ? actorUserId : null,
        action: 'manual_override',
        module: 'platform_exchange_rates',
        recordId: created.id,
        reason: dto.reason,
        newValue: { baseCurrency: base, quoteCurrency: quote, rate: created.rate.toString(), effectiveFrom: dto.effectiveFrom, overrideReason: dto.reason },
      });
    }
    return this.mapToRecord(created);
  }

  /**
   * Sync rates from provider behind the interface
   */
  async syncFromProvider(
    dto: SyncProviderRatesDto,
    actorUserId: string = 'system',
  ): Promise<{ syncedCount: number; rates: PlatformExchangeRateRecord[] }> {
    const providerId = dto.providerId || this.platformFxProvider.providerId;
    const provider = this.providers.get(providerId);

    if (!provider) {
      throw new BadRequestException(`Provider "${providerId}" was not found or is unavailable`);
    }

    const base = (dto.baseCurrency || 'AUD').toUpperCase();
    const fetched = await provider.fetchStandardRates(base, dto.quoteCurrencies);

    const savedRecords: PlatformExchangeRateRecord[] = [];

    for (const item of fetched) {
      const record = await this.createRateVersion(
        {
          baseCurrency: item.baseCurrency,
          quoteCurrency: item.quoteCurrency,
          rate: item.rate.toString(),
          effectiveFrom: item.asOfDate,
          source: 'provider',
          providerName: provider.providerName,
          notes: `Synchronized from ${provider.providerName}`,
        },
        actorUserId,
      );
      savedRecords.push(record);
    }

    return {
      syncedCount: savedRecords.length,
      rates: savedRecords,
    };
  }

  /**
   * List available exchange rate providers
   */
  listProviders(): PlatformExchangeRateProviderDef[] {
    return Array.from(this.providers.values()).map((p) => ({
      providerId: p.providerId,
      providerName: p.providerName,
      description: p.description,
      supportedBases: p.supportedBases,
      isDefault: p.providerId === this.platformFxProvider.providerId,
    }));
  }

  private mapToRecord(row: PlatformExchangeRate): PlatformExchangeRateRecord {
    return {
      id: row.id,
      baseCurrency: row.baseCurrency,
      quoteCurrency: row.quoteCurrency,
      rate: row.rate.toFixed(8),
      inverseRate: row.inverseRate ? row.inverseRate.toFixed(8) : (1 / row.rate.toNumber()).toFixed(8),
      effectiveFrom: toDateOnly(row.effectiveFrom),
      effectiveTo: row.effectiveTo ? toDateOnly(row.effectiveTo) : null,
      source: row.source as any,
      providerName: row.providerName,
      overrideReason: row.overrideReason,
      notes: row.notes,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
