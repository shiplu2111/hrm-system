import { Injectable } from '@nestjs/common';
import { CountryStatus } from '@prisma/client';
import type {
  PublicCurrenciesMeta,
  PublicCurrencyCountryRef,
  PublicCurrencyView,
  PublicPlanFeatureView,
  PublicPlanLimitView,
  PublicPlanPriceView,
  PublicPlanPricingModel,
  PublicPlanView,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';

const PUBLIC_FEATURE_LABELS: Record<string, string> = {
  core_hr: 'Core HR & Employee Directory',
  attendance: 'Time & Mobile Attendance',
  leave: 'Leave & Holiday Management',
  basic_payroll: 'Payroll & Statutory Deductions',
  roster: 'Shift Rostering & Scheduling',
  timesheets: 'Project & Shift Timesheets',
  advanced_reports: 'Advanced Reports & Analytics',
  api_access: 'REST API & Webhooks Access',
  sso: 'Single Sign-On (SAML / OIDC)',
  custom_payroll_rules: 'Custom Country & Company Payroll Rules',
  advanced_workflow: 'Multi-Step Approval Workflows',
  custom_domains: 'Custom Portal Domains',
  white_label: 'White-Label Branding',
};

const PUBLIC_LIMIT_LABELS: Record<string, string> = {
  employees: 'Active employees',
  storage_gb: 'Document storage (GB)',
  api_calls: 'Monthly API calls',
  companies: 'Companies / entities',
};

const CURRENCY_CATALOG_META: Record<
  string,
  { symbol: string; name: string; decimalPlaces: number }
> = {
  USD: { symbol: '$', name: 'US Dollar', decimalPlaces: 2 },
  AUD: { symbol: 'A$', name: 'Australian Dollar', decimalPlaces: 2 },
  BDT: { symbol: '৳', name: 'Bangladeshi Taka', decimalPlaces: 2 },
  EUR: { symbol: '€', name: 'Euro', decimalPlaces: 2 },
  GBP: { symbol: '£', name: 'British Pound', decimalPlaces: 2 },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', decimalPlaces: 2 },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', decimalPlaces: 2 },
  INR: { symbol: '₹', name: 'Indian Rupee', decimalPlaces: 2 },
  MYR: { symbol: 'RM', name: 'Malaysian Ringgit', decimalPlaces: 2 },
  AED: { symbol: 'AED', name: 'UAE Dirham', decimalPlaces: 2 },
};

const DEFAULT_CURRENCY_CODE = 'USD';

/** Country fallback hints for major markets even before a country row is toggled active. */
const FALLBACK_COUNTRY_CURRENCIES: Record<string, string> = {
  US: 'USD',
  USA: 'USD',
  AU: 'AUD',
  AUS: 'AUD',
  BD: 'BDT',
  BGD: 'BDT',
  GB: 'GBP',
  GBR: 'GBP',
  UK: 'GBP',
  DE: 'EUR',
  FR: 'EUR',
  NL: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  IE: 'EUR',
  CA: 'CAD',
  SG: 'SGD',
  IN: 'INR',
  MY: 'MYR',
  AE: 'AED',
};

function humanizeKey(key: string): string {
  return key
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function sanitizeDescription(description: string | null | undefined, name: string): string {
  if (!description) {
    return `${name} plan for HR, attendance, and payroll teams.`;
  }
  const cleaned = description
    .replace(/\s*\((?:[A-Z0-9_]+\.md[^)]*)\)/g, '')
    .trim();
  return cleaned || `${name} plan for HR, attendance, and payroll teams.`;
}

function toCountrySlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

@Injectable()
export class PublicPlansService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns ONLY publicly listed plans (isActive = true AND isCustom = false),
   * with customer-friendly labels and effective-dated active prices.
   * Never exposes hidden plans, custom plans, internal notes, cost data, or tenant info.
   */
  async listPublicPlans(now = new Date()): Promise<PublicPlanView[]> {
    const plans = await this.prisma.unscoped.plan.findMany({
      where: {
        isActive: true,
        isCustom: false,
      },
      orderBy: { rank: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        rank: true,
        features: {
          orderBy: { featureKey: 'asc' },
          select: {
            featureKey: true,
            enabled: true,
          },
        },
        limits: {
          orderBy: { limitKey: 'asc' },
          select: {
            limitKey: true,
            value: true,
          },
        },
        prices: {
          where: {
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
          orderBy: [
            { currency: 'asc' },
            { billingCycle: 'asc' },
            { effectiveFrom: 'desc' },
          ],
          select: {
            currency: true,
            billingCycle: true,
            amount: true,
            perSeatAmount: true,
            effectiveFrom: true,
          },
        },
      },
    });

    return plans.map((plan) => this.mapPublicPlan(plan));
  }

  /**
   * Returns supported public billing currencies alongside active country references,
   * and resolves a default currency from the visitor's country hint (falling back to USD).
   */
  async listPublicCurrencies(
    countryHint?: string | null,
    now = new Date(),
  ): Promise<{ currencies: PublicCurrencyView[]; meta: PublicCurrenciesMeta }> {
    const [activePrices, activeCountries] = await Promise.all([
      this.prisma.unscoped.planPrice.findMany({
        where: {
          plan: { isActive: true, isCustom: false },
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
        distinct: ['currency'],
        select: { currency: true },
        orderBy: { currency: 'asc' },
      }),
      this.prisma.unscoped.country.findMany({
        where: { status: CountryStatus.active },
        select: {
          isoCode: true,
          name: true,
          currency: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const priceCurrencyCodes = new Set<string>(
      activePrices.map((p) => p.currency.trim().toUpperCase()),
    );
    if (priceCurrencyCodes.size === 0) {
      priceCurrencyCodes.add(DEFAULT_CURRENCY_CODE);
    }

    const countriesByCurrency = new Map<string, PublicCurrencyCountryRef[]>();
    for (const c of activeCountries) {
      const code = c.currency.trim().toUpperCase();
      if (!priceCurrencyCodes.has(code)) continue;
      const list = countriesByCurrency.get(code) ?? [];
      list.push({
        isoCode: c.isoCode.toUpperCase(),
        name: c.name,
        slug: toCountrySlug(c.name),
      });
      countriesByCurrency.set(code, list);
    }

    const orderedCodes = Array.from(priceCurrencyCodes).sort((a, b) => {
      if (a === DEFAULT_CURRENCY_CODE) return -1;
      if (b === DEFAULT_CURRENCY_CODE) return 1;
      return a.localeCompare(b);
    });

    const fallbackDefault = priceCurrencyCodes.has(DEFAULT_CURRENCY_CODE)
      ? DEFAULT_CURRENCY_CODE
      : orderedCodes[0];

    const currencies: PublicCurrencyView[] = orderedCodes.map((code) => {
      const meta = CURRENCY_CATALOG_META[code] ?? {
        symbol: code,
        name: code,
        decimalPlaces: 2,
      };
      return {
        code,
        symbol: meta.symbol,
        name: meta.name,
        decimalPlaces: meta.decimalPlaces,
        isDefault: code === fallbackDefault,
        countries: countriesByCurrency.get(code) ?? [],
      };
    });

    const detectedCountry = this.normalizeCountryHint(countryHint);
    const defaultCurrency = this.resolveDefaultCurrency(
      currencies,
      activeCountries,
      detectedCountry,
      fallbackDefault,
    );

    return {
      currencies,
      meta: {
        detectedCountry,
        defaultCurrency,
      },
    };
  }

  private mapPublicPlan(plan: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    rank: number;
    features: Array<{ featureKey: string; enabled: boolean }>;
    limits: Array<{ limitKey: string; value: number | null }>;
    prices: Array<{
      currency: string;
      billingCycle: string;
      amount: unknown;
      perSeatAmount: unknown | null;
      effectiveFrom: Date;
    }>;
  }): PublicPlanView {
    // Keep latest effective price per (currency, billingCycle)
    const priceByKey = new Map<string, PublicPlanPriceView>();
    for (const row of plan.prices) {
      const currency = row.currency.trim().toUpperCase();
      const billingCycle = row.billingCycle === 'annual' ? 'annual' : 'monthly';
      const key = `${currency}:${billingCycle}`;
      if (priceByKey.has(key)) continue;

      priceByKey.set(key, {
        currency,
        billingCycle,
        amount: Number(row.amount),
        perSeatAmount:
          row.perSeatAmount !== null && row.perSeatAmount !== undefined
            ? Number(row.perSeatAmount)
            : null,
        effectiveFrom:
          row.effectiveFrom instanceof Date
            ? row.effectiveFrom.toISOString()
            : String(row.effectiveFrom),
      });
    }

    const prices = Array.from(priceByKey.values());
    const empLimit = plan.limits.find((l) => l.limitKey === 'employees')?.value ?? null;
    const { pricingModel, includedSeats } = this.resolvePricingModel(prices, empLimit);

    const features: PublicPlanFeatureView[] = plan.features.map((f) => ({
      key: f.featureKey,
      label: PUBLIC_FEATURE_LABELS[f.featureKey] ?? humanizeKey(f.featureKey),
      included: Boolean(f.enabled),
    }));

    const limits: PublicPlanLimitView[] = plan.limits.map((l) => ({
      key: l.limitKey,
      label: PUBLIC_LIMIT_LABELS[l.limitKey] ?? humanizeKey(l.limitKey),
      value: l.value !== null && l.value !== undefined ? Number(l.value) : null,
    }));

    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: sanitizeDescription(plan.description, plan.name),
      rank: plan.rank ?? 0,
      pricingModel,
      includedSeats,
      isPopular: plan.code === 'business' || plan.code === 'starter' ? plan.code === 'business' : false,
      features,
      limits,
      prices,
    };
  }

  /**
   * Mirrors BillingInvoicingService.calculateCycleAmounts so the public
   * Pricing calculator produces identical numbers to billing invoices.
   */
  private resolvePricingModel(
    prices: PublicPlanPriceView[],
    empLimit: number | null,
  ): { pricingModel: PublicPlanPricingModel; includedSeats: number } {
    if (prices.length === 0) {
      return { pricingModel: 'custom', includedSeats: 0 };
    }

    const refPrice =
      prices.find((p) => p.currency === DEFAULT_CURRENCY_CODE && p.billingCycle === 'monthly') ??
      prices.find((p) => p.billingCycle === 'monthly') ??
      prices[0];

    const baseAmount = refPrice.amount;
    const perSeatAmount = refPrice.perSeatAmount ?? 0;

    if (baseAmount === 0 && perSeatAmount === 0) {
      return { pricingModel: 'free', includedSeats: 0 };
    }
    if (baseAmount > 0 && perSeatAmount > 0) {
      return {
        pricingModel: 'base_plus_employee',
        includedSeats: empLimit ? Math.min(10, empLimit) : 10,
      };
    }
    if (baseAmount === 0 && perSeatAmount > 0) {
      return { pricingModel: 'per_employee', includedSeats: 0 };
    }
    return { pricingModel: 'flat', includedSeats: empLimit ?? 0 };
  }

  private normalizeCountryHint(raw?: string | null): string | null {
    if (!raw) return null;
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed || trimmed === 'XX' || trimmed === 'T1' || trimmed === 'UNKNOWN') {
      return null;
    }
    return trimmed;
  }

  private resolveDefaultCurrency(
    currencies: PublicCurrencyView[],
    activeCountries: Array<{ isoCode: string; name: string; currency: string }>,
    countryHint: string | null,
    fallbackDefault: string,
  ): string {
    if (!countryHint) return fallbackDefault;

    const supportedSet = new Set(currencies.map((c) => c.code));
    const lowerHint = countryHint.toLowerCase();

    const matchedCountry = activeCountries.find(
      (c) =>
        c.isoCode.toUpperCase() === countryHint ||
        toCountrySlug(c.name) === lowerHint ||
        c.name.toUpperCase() === countryHint,
    );

    if (matchedCountry) {
      const candidate = matchedCountry.currency.trim().toUpperCase();
      if (supportedSet.has(candidate)) {
        return candidate;
      }
    }

    const fallbackCandidate = FALLBACK_COUNTRY_CURRENCIES[countryHint];
    if (fallbackCandidate && supportedSet.has(fallbackCandidate)) {
      return fallbackCandidate;
    }

    return fallbackDefault;
  }
}
