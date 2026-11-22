import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CountryRuleType, CountryStatus, Prisma, RuleVersionStatus, StateProvinceStatus } from '@prisma/client';
import type {
  BulkImportStatesResult,
  CountryConfigCategoryStatus,
  CountryConfigStatusView,
  CountryConfiguration,
  CountryRuleKind,
  CountryRuleRecord,
  CountrySummary,
  InheritingTenantsResponse,
  InheritingTenantView,
  StateProvinceView,
  TaxBracketRecord,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import type {
  BulkImportStatesDto,
  CreateCountryDto,
  CreateStateProvinceDto,
  UpdateCountryDto,
  UpdateStateProvinceDto,
  UpsertCountryRuleDto,
  UpsertTaxBracketDto,
} from './dto/country-config.dto';

const CONFIGURABLE_RULE_TYPES: CountryRuleKind[] = [
  'tax',
  'leave',
  'ot',
  'social_security',
  'public_holiday',
  'health_safety',
  'employment_rules',
];

const REQUIRED_CATEGORIES: { category: CountryRuleKind; label: string }[] = [
  { category: 'tax', label: 'Tax Brackets / Rates' },
  { category: 'leave', label: 'Leave Entitlements & Policies' },
  { category: 'ot', label: 'Overtime & Working Hours' },
  { category: 'public_holiday', label: 'Public Holidays' },
  { category: 'employment_rules', label: 'Employment & Statutory Rules' },
];

const OPTIONAL_CATEGORIES: { category: CountryRuleKind; label: string }[] = [
  { category: 'social_security', label: 'Social Security / Pension' },
  { category: 'health_safety', label: 'Workplace Health & Safety' },
];

@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCountries(): Promise<CountrySummary[]> {
    const countries = await this.prisma.unscoped.country.findMany({
      orderBy: { name: 'asc' },
      include: {
        companies: { select: { tenantId: true } },
        statesProvinces: { select: { id: true } },
        countryRules: {
          select: { ruleType: true, status: true, updatedAt: true, effectiveFrom: true },
          orderBy: { updatedAt: 'desc' },
        },
        taxBrackets: {
          select: { status: true, updatedAt: true, effectiveFrom: true },
          orderBy: { updatedAt: 'desc' },
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

      // Calculate category completeness
      const publishedRules = country.countryRules.filter((r) => r.status === 'published');
      const publishedTaxBrackets = country.taxBrackets.filter((tb) => tb.status === 'published');

      const missingCategories: string[] = [];
      let completedRequiredCount = 0;

      for (const req of REQUIRED_CATEGORIES) {
        let complete = false;
        if (req.category === 'tax') {
          complete =
            publishedTaxBrackets.length > 0 ||
            publishedRules.some((r) => r.ruleType === 'tax');
        } else {
          complete = publishedRules.some((r) => r.ruleType === (req.category as CountryRuleType));
        }

        if (complete) {
          completedRequiredCount++;
        } else {
          missingCategories.push(req.category);
        }
      }

      return {
        id: country.id,
        name: country.name,
        isoCode: country.isoCode,
        currency: country.currency,
        timezone: country.timezone,
        defaultTimezone: country.timezone,
        dateFormat: country.dateFormat,
        numberFormat: country.numberFormat,
        defaultFinancialYearStart: country.defaultFinancialYearStart,
        defaultPayFrequency: country.defaultPayFrequency,
        status: country.status,
        tenantCount: new Set(country.companies.map((company) => company.tenantId)).size,
        statesCount: country.statesProvinces.length,
        lastRuleUpdate: lastRuleUpdate?.toISOString() ?? null,
        configStatus: {
          isReadyForActivation: missingCategories.length === 0,
          completedRequiredCount,
          totalRequiredCount: REQUIRED_CATEGORIES.length,
          missingCategories,
        },
      };
    });
  }

  async getCountryConfigStatus(countryId: string): Promise<CountryConfigStatusView> {
    const country = await this.prisma.unscoped.country.findUnique({
      where: { id: countryId },
      include: {
        taxBrackets: {
          where: { status: 'published' },
          orderBy: { effectiveFrom: 'desc' },
        },
        countryRules: {
          where: { status: 'published' },
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });

    if (!country) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Country not found',
      });
    }

    const missingCategories: string[] = [];
    const categories: CountryConfigCategoryStatus[] = [];

    for (const req of REQUIRED_CATEGORIES) {
      let complete = false;
      let ruleCount = 0;
      let latestEffectiveFrom: string | null = null;

      if (req.category === 'tax') {
        const taxRules = country.countryRules.filter((r) => r.ruleType === 'tax');
        ruleCount = taxRules.length + country.taxBrackets.length;
        complete = ruleCount > 0;
        const latestBracket = country.taxBrackets[0]?.effectiveFrom;
        const latestRule = taxRules[0]?.effectiveFrom;
        const latest =
          latestBracket && latestRule
            ? latestBracket > latestRule
              ? latestBracket
              : latestRule
            : latestBracket ?? latestRule;
        latestEffectiveFrom = latest ? latest.toISOString().slice(0, 10) : null;
      } else {
        const rules = country.countryRules.filter(
          (r) => r.ruleType === (req.category as CountryRuleType),
        );
        ruleCount = rules.length;
        complete = ruleCount > 0;
        latestEffectiveFrom = rules[0]?.effectiveFrom
          ? rules[0].effectiveFrom.toISOString().slice(0, 10)
          : null;
      }

      if (!complete) {
        missingCategories.push(req.category);
      }

      categories.push({
        category: req.category,
        label: req.label,
        required: true,
        complete,
        ruleCount,
        latestEffectiveFrom,
        status: complete ? 'published' : undefined,
      });
    }

    for (const opt of OPTIONAL_CATEGORIES) {
      const rules = country.countryRules.filter(
        (r) => r.ruleType === (opt.category as CountryRuleType),
      );
      const ruleCount = rules.length;
      categories.push({
        category: opt.category,
        label: opt.label,
        required: false,
        complete: ruleCount > 0,
        ruleCount,
        latestEffectiveFrom: rules[0]?.effectiveFrom
          ? rules[0].effectiveFrom.toISOString().slice(0, 10)
          : null,
        status: ruleCount > 0 ? 'published' : undefined,
      });
    }

    return {
      countryId: country.id,
      countryName: country.name,
      isoCode: country.isoCode,
      status: country.status,
      isReadyForActivation: missingCategories.length === 0,
      missingCategories,
      categories,
    };
  }

  async createCountry(dto: CreateCountryDto): Promise<CountrySummary> {
    const isoCode = dto.isoCode.trim().toUpperCase();

    if (dto.status === 'active') {
      throw new BadRequestException({
        code: 'CANNOT_ACTIVATE_INCOMPLETE_COUNTRY',
        message:
          'A new country cannot be set to active immediately: all required rule categories (tax, leave, overtime/working hours, public holidays, employment rules) must have at least one published rule version first.',
        missingCategories: REQUIRED_CATEGORIES.map((c) => c.category),
      });
    }

    try {
      const country = await this.prisma.unscoped.country.create({
        data: {
          name: dto.name.trim(),
          isoCode,
          currency: dto.currency.trim().toUpperCase(),
          timezone: dto.timezone.trim(),
          dateFormat: dto.dateFormat.trim(),
          numberFormat: dto.numberFormat?.trim() ?? '1,234.56',
          defaultFinancialYearStart: dto.defaultFinancialYearStart?.trim() ?? '01-01',
          defaultPayFrequency: dto.defaultPayFrequency?.trim() ?? 'monthly',
          status: dto.status ?? 'draft',
        },
      });

      return {
        id: country.id,
        name: country.name,
        isoCode: country.isoCode,
        currency: country.currency,
        timezone: country.timezone,
        defaultTimezone: country.timezone,
        dateFormat: country.dateFormat,
        numberFormat: country.numberFormat,
        defaultFinancialYearStart: country.defaultFinancialYearStart,
        defaultPayFrequency: country.defaultPayFrequency,
        status: country.status,
        tenantCount: 0,
        statesCount: 0,
        lastRuleUpdate: null,
        configStatus: {
          isReadyForActivation: false,
          completedRequiredCount: 0,
          totalRequiredCount: REQUIRED_CATEGORIES.length,
          missingCategories: REQUIRED_CATEGORIES.map((c) => c.category),
        },
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

    if (dto.status === 'active') {
      const configStatus = await this.getCountryConfigStatus(countryId);
      if (!configStatus.isReadyForActivation) {
        throw new BadRequestException({
          code: 'CANNOT_ACTIVATE_INCOMPLETE_COUNTRY',
          message: `Country cannot be set to active: missing published rule version for required categories: ${configStatus.missingCategories.join(', ')}`,
          missingCategories: configStatus.missingCategories,
        });
      }
    }

    const country = await this.prisma.unscoped.country.update({
      where: { id: countryId },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.currency != null
          ? { currency: dto.currency.trim().toUpperCase() }
          : {}),
        ...(dto.timezone != null ? { timezone: dto.timezone.trim() } : {}),
        ...(dto.dateFormat != null ? { dateFormat: dto.dateFormat.trim() } : {}),
        ...(dto.numberFormat != null
          ? { numberFormat: dto.numberFormat.trim() }
          : {}),
        ...(dto.defaultFinancialYearStart != null
          ? { defaultFinancialYearStart: dto.defaultFinancialYearStart.trim() }
          : {}),
        ...(dto.defaultPayFrequency != null
          ? { defaultPayFrequency: dto.defaultPayFrequency.trim() }
          : {}),
        ...(dto.status != null ? { status: dto.status } : {}),
      },
      include: {
        companies: { select: { tenantId: true } },
        statesProvinces: { select: { id: true } },
        countryRules: {
          select: { ruleType: true, status: true, updatedAt: true, effectiveFrom: true },
          orderBy: { updatedAt: 'desc' },
        },
        taxBrackets: {
          select: { status: true, updatedAt: true, effectiveFrom: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    const latestRule = country.countryRules[0]?.updatedAt ?? null;
    const latestTax = country.taxBrackets[0]?.updatedAt ?? null;

    const publishedRules = country.countryRules.filter((r) => r.status === 'published');
    const publishedTaxBrackets = country.taxBrackets.filter((tb) => tb.status === 'published');

    const missingCategories: string[] = [];
    let completedRequiredCount = 0;

    for (const req of REQUIRED_CATEGORIES) {
      let complete = false;
      if (req.category === 'tax') {
        complete =
          publishedTaxBrackets.length > 0 ||
          publishedRules.some((r) => r.ruleType === 'tax');
      } else {
        complete = publishedRules.some((r) => r.ruleType === (req.category as CountryRuleType));
      }

      if (complete) {
        completedRequiredCount++;
      } else {
        missingCategories.push(req.category);
      }
    }

    return {
      id: country.id,
      name: country.name,
      isoCode: country.isoCode,
      currency: country.currency,
      timezone: country.timezone,
      defaultTimezone: country.timezone,
      dateFormat: country.dateFormat,
      numberFormat: country.numberFormat,
      defaultFinancialYearStart: country.defaultFinancialYearStart,
      defaultPayFrequency: country.defaultPayFrequency,
      status: country.status,
      tenantCount: new Set(country.companies.map((company) => company.tenantId)).size,
      statesCount: country.statesProvinces.length,
      lastRuleUpdate: (latestRule ?? latestTax)?.toISOString() ?? null,
      configStatus: {
        isReadyForActivation: missingCategories.length === 0,
        completedRequiredCount,
        totalRequiredCount: REQUIRED_CATEGORIES.length,
        missingCategories,
      },
    };
  }

  async getConfiguration(countryId: string): Promise<CountryConfiguration> {
    const country = await this.prisma.unscoped.country.findUnique({
      where: { id: countryId },
      include: {
        statesProvinces: { orderBy: { name: 'asc' } },
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

    const configStatus = await this.getCountryConfigStatus(countryId);
    const states = await this.listStates(countryId);

    return {
      country: {
        id: country.id,
        name: country.name,
        isoCode: country.isoCode,
        currency: country.currency,
        timezone: country.timezone,
        defaultTimezone: country.timezone,
        dateFormat: country.dateFormat,
        numberFormat: country.numberFormat,
        defaultFinancialYearStart: country.defaultFinancialYearStart,
        defaultPayFrequency: country.defaultPayFrequency,
        status: country.status,
      },
      states,
      taxBrackets: country.taxBrackets.map((row) => this.toTaxBracket(row)),
      rules: country.countryRules.map((row) => this.toCountryRule(row)),
      configStatus,
    };
  }

  /**
   * Get all tenants and companies operating within a country jurisdiction
   * with location breakdown and employee headcount.
   */
  async getInheritingTenants(countryId: string): Promise<InheritingTenantsResponse> {
    await this.assertCountryExists(countryId);

    const country = await this.prisma.unscoped.country.findUniqueOrThrow({
      where: { id: countryId },
      select: { id: true, name: true, isoCode: true },
    });

    const companies = await this.prisma.unscoped.company.findMany({
      where: { countryId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            planId: true,
          },
        },
        stateProvince: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        locations: {
          include: {
            stateProvince: {
              select: {
                id: true,
                code: true,
              },
            },
            _count: {
              select: {
                employees: true,
              },
            },
          },
        },
        _count: {
          select: {
            employees: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const tenantMap = new Map<string, InheritingTenantView>();

    for (const comp of companies) {
      const t = comp.tenant;
      if (!t) continue;

      if (!tenantMap.has(t.id)) {
        tenantMap.set(t.id, {
          tenantId: t.id,
          tenantName: t.name,
          subdomain: t.subdomain,
          plan: t.planId || 'Standard',
          companies: [],
          totalEmployeesInCountry: 0,
        });
      }

      const tenantEntry = tenantMap.get(t.id)!;
      const empCount = comp._count?.employees || 0;
      tenantEntry.totalEmployeesInCountry += empCount;

      tenantEntry.companies.push({
        id: comp.id,
        name: comp.name,
        stateProvinceId: comp.stateProvinceId,
        stateCode: comp.stateProvince?.code || null,
        stateName: comp.stateProvince?.name || null,
        employeeCount: empCount,
        locations: comp.locations.map((loc) => ({
          id: loc.id,
          name: loc.name,
          stateProvinceId: loc.stateProvinceId,
          stateCode: loc.stateProvince?.code || null,
          employeeCount: loc._count?.employees || 0,
        })),
      });
    }

    const tenants = Array.from(tenantMap.values());
    const totalEmployees = tenants.reduce((acc, t) => acc + t.totalEmployeesInCountry, 0);

    return {
      countryId: country.id,
      countryName: country.name,
      isoCode: country.isoCode,
      totalTenants: tenants.length,
      totalEmployees,
      tenants,
    };
  }

  // --- States / Provinces Management ---

  async listStates(countryId: string): Promise<StateProvinceView[]> {
    await this.assertCountryExists(countryId);
    const states = await this.prisma.unscoped.stateProvince.findMany({
      where: { countryId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: {
        companies: {
          select: { id: true, tenantId: true },
        },
        locations: {
          select: {
            company: {
              select: { id: true, tenantId: true },
            },
          },
        },
      },
    });

    return states.map((s) => {
      const companyIds = new Set<string>();
      const tenantIds = new Set<string>();

      for (const comp of s.companies) {
        companyIds.add(comp.id);
        tenantIds.add(comp.tenantId);
      }
      for (const loc of s.locations) {
        if (loc.company) {
          companyIds.add(loc.company.id);
          tenantIds.add(loc.company.tenantId);
        }
      }

      return {
        id: s.id,
        countryId: s.countryId,
        name: s.name,
        code: s.code,
        status: s.status,
        companiesCount: companyIds.size,
        tenantsCount: tenantIds.size,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      };
    });
  }

  async createState(
    countryId: string,
    dto: CreateStateProvinceDto,
  ): Promise<StateProvinceView> {
    await this.assertCountryExists(countryId);
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();

    try {
      const created = await this.prisma.unscoped.stateProvince.create({
        data: {
          countryId,
          name,
          code,
          status: dto.status ?? 'active',
        },
      });

      return {
        id: created.id,
        countryId: created.countryId,
        name: created.name,
        code: created.code,
        status: created.status,
        companiesCount: 0,
        tenantsCount: 0,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: `State/province with code ${code} already exists for this country`,
        });
      }
      throw error;
    }
  }

  async updateState(
    countryId: string,
    stateId: string,
    dto: UpdateStateProvinceDto,
  ): Promise<StateProvinceView> {
    await this.assertCountryExists(countryId);
    const existing = await this.prisma.unscoped.stateProvince.findFirst({
      where: { id: stateId, countryId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'State/province not found',
      });
    }

    const code = dto.code != null ? dto.code.trim().toUpperCase() : undefined;
    const name = dto.name != null ? dto.name.trim() : undefined;

    try {
      const updated = await this.prisma.unscoped.stateProvince.update({
        where: { id: stateId },
        data: {
          ...(name != null ? { name } : {}),
          ...(code != null ? { code } : {}),
          ...(dto.status != null ? { status: dto.status } : {}),
        },
        include: {
          companies: { select: { id: true, tenantId: true } },
          locations: { select: { company: { select: { id: true, tenantId: true } } } },
        },
      });

      const companyIds = new Set<string>();
      const tenantIds = new Set<string>();
      for (const comp of updated.companies) {
        companyIds.add(comp.id);
        tenantIds.add(comp.tenantId);
      }
      for (const loc of updated.locations) {
        if (loc.company) {
          companyIds.add(loc.company.id);
          tenantIds.add(loc.company.tenantId);
        }
      }

      return {
        id: updated.id,
        countryId: updated.countryId,
        name: updated.name,
        code: updated.code,
        status: updated.status,
        companiesCount: companyIds.size,
        tenantsCount: tenantIds.size,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: `State/province with code ${code} already exists for this country`,
        });
      }
      throw error;
    }
  }

  async bulkImportStates(
    countryId: string,
    dto: BulkImportStatesDto,
  ): Promise<BulkImportStatesResult> {
    await this.assertCountryExists(countryId);

    let createdCount = 0;
    let updatedCount = 0;
    const errors: { line?: number; code?: string; message: string }[] = [];

    for (let i = 0; i < dto.states.length; i++) {
      const item = dto.states[i];
      const code = item.code?.trim().toUpperCase();
      const name = item.name?.trim();
      const status: StateProvinceStatus = item.status === 'retired' ? 'retired' : 'active';

      if (!code || !name) {
        errors.push({
          line: i + 1,
          code: code || 'UNKNOWN',
          message: 'Both state name and code are required',
        });
        continue;
      }

      if (code.length > 16) {
        errors.push({
          line: i + 1,
          code,
          message: `Code "${code}" exceeds maximum length of 16 characters`,
        });
        continue;
      }

      try {
        const existing = await this.prisma.unscoped.stateProvince.findFirst({
          where: { countryId, code },
        });

        if (existing) {
          await this.prisma.unscoped.stateProvince.update({
            where: { id: existing.id },
            data: {
              name,
              status,
            },
          });
          updatedCount++;
        } else {
          await this.prisma.unscoped.stateProvince.create({
            data: {
              countryId,
              name,
              code,
              status,
            },
          });
          createdCount++;
        }
      } catch (err: any) {
        errors.push({
          line: i + 1,
          code,
          message: err?.message || 'Database error processing state',
        });
      }
    }

    const states = await this.listStates(countryId);

    return {
      createdCount,
      updatedCount,
      errors,
      states,
    };
  }

  async deleteState(countryId: string, stateId: string): Promise<void> {
    await this.assertCountryExists(countryId);
    const state = await this.prisma.unscoped.stateProvince.findFirst({
      where: { id: stateId, countryId },
    });

    if (!state) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'State/province not found',
      });
    }

    await this.prisma.unscoped.stateProvince.delete({
      where: { id: stateId },
    });
  }

  // --- Tax Brackets & Rules ---

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
        status: dto.status ?? 'published',
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
        ...(dto.status != null ? { status: dto.status } : {}),
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
        status: dto.status ?? 'published',
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
      status?: RuleVersionStatus;
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
        ...(dto.status != null ? { status: dto.status } : {}),
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
    status?: RuleVersionStatus;
  }): TaxBracketRecord {
    return {
      id: row.id,
      countryId: row.countryId,
      taxYear: row.taxYear,
      bracketJson: row.bracketJson as Record<string, unknown>,
      effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: row.effectiveTo?.toISOString().slice(0, 10) ?? null,
      status: row.status ?? 'published',
    };
  }

  private toCountryRule(row: {
    id: string;
    countryId: string;
    ruleType: CountryRuleType;
    payload: unknown;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    status?: RuleVersionStatus;
  }): CountryRuleRecord {
    return {
      id: row.id,
      countryId: row.countryId,
      ruleType: row.ruleType as CountryRuleKind,
      payload: row.payload as Record<string, unknown>,
      effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: row.effectiveTo?.toISOString().slice(0, 10) ?? null,
      status: row.status ?? 'published',
    };
  }
}
