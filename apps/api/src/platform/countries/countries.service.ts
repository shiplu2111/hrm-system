import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CountryRuleType, Prisma } from '@prisma/client';
import type {
  CountryConfiguration,
  CountryRuleKind,
  CountryRuleRecord,
  CountrySummary,
  TaxBracketRecord,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import type {
  CreateCountryDto,
  UpdateCountryDto,
  UpsertCountryRuleDto,
  UpsertTaxBracketDto,
} from './dto/country-config.dto';

const CONFIGURABLE_RULE_TYPES: CountryRuleKind[] = [
  'leave',
  'ot',
  'social_security',
  'public_holiday',
];

@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCountries(): Promise<CountrySummary[]> {
    const countries = await this.prisma.unscoped.country.findMany({
      orderBy: { name: 'asc' },
      include: {
        companies: { select: { tenantId: true } },
        countryRules: {
          select: { updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
        taxBrackets: {
          select: { updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });

    return countries.map((country) => {
      const latestRule = country.countryRules[0]?.updatedAt ?? null;
      const latestTax = country.taxBrackets[0]?.updatedAt ?? null;
      const lastRuleUpdate =
        latestRule && latestTax
          ? latestRule > latestTax
            ? latestRule
            : latestTax
          : latestRule ?? latestTax;

      return {
        id: country.id,
        name: country.name,
        isoCode: country.isoCode,
        currency: country.currency,
        timezone: country.timezone,
        dateFormat: country.dateFormat,
        tenantCount: new Set(country.companies.map((company) => company.tenantId))
          .size,
        lastRuleUpdate: lastRuleUpdate?.toISOString() ?? null,
      };
    });
  }

  async createCountry(dto: CreateCountryDto): Promise<CountrySummary> {
    const isoCode = dto.isoCode.trim().toUpperCase();

    try {
      const country = await this.prisma.unscoped.country.create({
        data: {
          name: dto.name.trim(),
          isoCode,
          currency: dto.currency.trim().toUpperCase(),
          timezone: dto.timezone.trim(),
          dateFormat: dto.dateFormat.trim(),
        },
      });

      return {
        id: country.id,
        name: country.name,
        isoCode: country.isoCode,
        currency: country.currency,
        timezone: country.timezone,
        dateFormat: country.dateFormat,
        tenantCount: 0,
        lastRuleUpdate: null,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: `Country with ISO code ${isoCode} already exists`,
        });
      }
      throw error;
    }
  }

  async updateCountry(
    countryId: string,
    dto: UpdateCountryDto,
  ): Promise<CountrySummary> {
    await this.assertCountryExists(countryId);

    const country = await this.prisma.unscoped.country.update({
      where: { id: countryId },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.currency != null
          ? { currency: dto.currency.trim().toUpperCase() }
          : {}),
        ...(dto.timezone != null ? { timezone: dto.timezone.trim() } : {}),
        ...(dto.dateFormat != null ? { dateFormat: dto.dateFormat.trim() } : {}),
      },
      include: {
        companies: { select: { tenantId: true } },
        countryRules: {
          select: { updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
        taxBrackets: {
          select: { updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });

    const latestRule = country.countryRules[0]?.updatedAt ?? null;
    const latestTax = country.taxBrackets[0]?.updatedAt ?? null;

    return {
      id: country.id,
      name: country.name,
      isoCode: country.isoCode,
      currency: country.currency,
      timezone: country.timezone,
      dateFormat: country.dateFormat,
      tenantCount: new Set(country.companies.map((company) => company.tenantId))
        .size,
      lastRuleUpdate: (latestRule ?? latestTax)?.toISOString() ?? null,
    };
  }

  async getConfiguration(countryId: string): Promise<CountryConfiguration> {
    const country = await this.prisma.unscoped.country.findUnique({
      where: { id: countryId },
      include: {
        taxBrackets: { orderBy: [{ taxYear: 'desc' }, { effectiveFrom: 'desc' }] },
        countryRules: {
          where: {
            ruleType: { in: CONFIGURABLE_RULE_TYPES as CountryRuleType[] },
          },
          orderBy: [{ ruleType: 'asc' }, { effectiveFrom: 'desc' }],
        },
      },
    });

    if (!country) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Country not found',
      });
    }

    return {
      country: {
        id: country.id,
        name: country.name,
        isoCode: country.isoCode,
        currency: country.currency,
        timezone: country.timezone,
        dateFormat: country.dateFormat,
      },
      taxBrackets: country.taxBrackets.map((row) => this.toTaxBracket(row)),
      rules: country.countryRules.map((row) => this.toCountryRule(row)),
    };
  }

  async createTaxBracket(
    countryId: string,
    dto: UpsertTaxBracketDto,
  ): Promise<TaxBracketRecord> {
    await this.assertCountryExists(countryId);
    const effectiveFrom = this.parseDateOnly(dto.effectiveFrom);

    await this.closeOpenTaxBracketVersions(countryId, dto.taxYear, effectiveFrom);

    const created = await this.prisma.unscoped.taxBracket.create({
      data: {
        countryId,
        taxYear: dto.taxYear,
        bracketJson: dto.bracketJson as Prisma.InputJsonValue,
        effectiveFrom,
        effectiveTo: dto.effectiveTo
          ? this.parseDateOnly(dto.effectiveTo)
          : null,
      },
    });

    return this.toTaxBracket(created);
  }

  async updateTaxBracket(
    countryId: string,
    bracketId: string,
    dto: UpsertTaxBracketDto,
  ): Promise<TaxBracketRecord> {
    await this.assertTaxBracketOwned(countryId, bracketId);

    const updated = await this.prisma.unscoped.taxBracket.update({
      where: { id: bracketId },
      data: {
        taxYear: dto.taxYear,
        bracketJson: dto.bracketJson as Prisma.InputJsonValue,
        effectiveFrom: this.parseDateOnly(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo
          ? this.parseDateOnly(dto.effectiveTo)
          : null,
      },
    });

    return this.toTaxBracket(updated);
  }

  async createCountryRule(
    countryId: string,
    dto: UpsertCountryRuleDto,
  ): Promise<CountryRuleRecord> {
    await this.assertCountryExists(countryId);
    this.assertConfigurableRuleType(dto.ruleType);

    const ruleType = dto.ruleType as CountryRuleType;
    const effectiveFrom = this.parseDateOnly(dto.effectiveFrom);

    await this.closeOpenCountryRuleVersions(countryId, ruleType, effectiveFrom);

    const created = await this.prisma.unscoped.countryRule.create({
      data: {
        countryId,
        ruleType,
        payload: dto.payload as Prisma.InputJsonValue,
        effectiveFrom,
        effectiveTo: dto.effectiveTo
          ? this.parseDateOnly(dto.effectiveTo)
          : null,
      },
    });

    return this.toCountryRule(created);
  }

  async updateCountryRule(
    countryId: string,
    ruleId: string,
    dto: {
      payload?: Record<string, unknown>;
      effectiveFrom?: string;
      effectiveTo?: string | null;
    },
  ): Promise<CountryRuleRecord> {
    const existing = await this.assertCountryRuleOwned(countryId, ruleId);

    const updated = await this.prisma.unscoped.countryRule.update({
      where: { id: ruleId },
      data: {
        ...(dto.payload != null
          ? { payload: dto.payload as Prisma.InputJsonValue }
          : {}),
        ...(dto.effectiveFrom != null
          ? { effectiveFrom: this.parseDateOnly(dto.effectiveFrom) }
          : {}),
        ...(dto.effectiveTo !== undefined
          ? {
              effectiveTo: dto.effectiveTo
                ? this.parseDateOnly(dto.effectiveTo)
                : null,
            }
          : {}),
      },
    });

    if (
      dto.effectiveFrom &&
      dto.effectiveFrom !== existing.effectiveFrom.toISOString().slice(0, 10)
    ) {
      await this.closeOpenCountryRuleVersions(
        countryId,
        existing.ruleType,
        this.parseDateOnly(dto.effectiveFrom),
        ruleId,
      );
    }

    return this.toCountryRule(updated);
  }

  private async closeOpenTaxBracketVersions(
    countryId: string,
    taxYear: number,
    newEffectiveFrom: Date,
    excludeId?: string,
  ): Promise<void> {
    const closeBefore = this.dayBefore(newEffectiveFrom);

    await this.prisma.unscoped.taxBracket.updateMany({
      where: {
        countryId,
        taxYear,
        effectiveTo: null,
        effectiveFrom: { lt: newEffectiveFrom },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: { effectiveTo: closeBefore },
    });
  }

  private async closeOpenCountryRuleVersions(
    countryId: string,
    ruleType: CountryRuleType,
    newEffectiveFrom: Date,
    excludeId?: string,
  ): Promise<void> {
    const closeBefore = this.dayBefore(newEffectiveFrom);

    await this.prisma.unscoped.countryRule.updateMany({
      where: {
        countryId,
        ruleType,
        effectiveTo: null,
        effectiveFrom: { lt: newEffectiveFrom },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: { effectiveTo: closeBefore },
    });
  }

  private async assertCountryExists(countryId: string): Promise<void> {
    const country = await this.prisma.unscoped.country.findUnique({
      where: { id: countryId },
      select: { id: true },
    });

    if (!country) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Country not found',
      });
    }
  }

  private async assertTaxBracketOwned(
    countryId: string,
    bracketId: string,
  ): Promise<void> {
    const row = await this.prisma.unscoped.taxBracket.findFirst({
      where: { id: bracketId, countryId },
    });

    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Tax bracket not found',
      });
    }
  }

  private async assertCountryRuleOwned(countryId: string, ruleId: string) {
    const row = await this.prisma.unscoped.countryRule.findFirst({
      where: { id: ruleId, countryId },
    });

    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Country rule not found',
      });
    }

    return row;
  }

  private assertConfigurableRuleType(ruleType: string): asserts ruleType is CountryRuleKind {
    if (!CONFIGURABLE_RULE_TYPES.includes(ruleType as CountryRuleKind)) {
      throw new ConflictException({
        code: 'VALIDATION_ERROR',
        message: `Unsupported rule type: ${ruleType}`,
      });
    }
  }

  private parseDateOnly(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private dayBefore(date: Date): Date {
    const copy = new Date(date.getTime());
    copy.setUTCDate(copy.getUTCDate() - 1);
    return copy;
  }

  private toTaxBracket(row: {
    id: string;
    countryId: string;
    taxYear: number;
    bracketJson: unknown;
    effectiveFrom: Date;
    effectiveTo: Date | null;
  }): TaxBracketRecord {
    return {
      id: row.id,
      countryId: row.countryId,
      taxYear: row.taxYear,
      bracketJson: row.bracketJson as Record<string, unknown>,
      effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: row.effectiveTo?.toISOString().slice(0, 10) ?? null,
    };
  }

  private toCountryRule(row: {
    id: string;
    countryId: string;
    ruleType: CountryRuleType;
    payload: unknown;
    effectiveFrom: Date;
    effectiveTo: Date | null;
  }): CountryRuleRecord {
    return {
      id: row.id,
      countryId: row.countryId,
      ruleType: row.ruleType as CountryRuleKind,
      payload: row.payload as Record<string, unknown>,
      effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: row.effectiveTo?.toISOString().slice(0, 10) ?? null,
    };
  }
}
