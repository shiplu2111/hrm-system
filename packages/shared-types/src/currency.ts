/** Multi-currency payroll (MODULES.md §46, RULES.md §4) */

export interface ExchangeRateUsage {
  /** Finalized or paid payroll runs that stored this rate. */
  lockedRuns: number;
  /** Draft or calculated runs that stored this rate; they pick up edits only when recalculated. */
  unlockedRuns: number;
  /** Latest payroll date (period end) among the locked runs. */
  lastLockedDate: string | null;
}

export interface ExchangeRateRecord {
  id: string;
  tenantId: string;
  baseCurrency: string;
  quoteCurrency: string;
  /** Base currency units per 1 quote currency unit */
  rate: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName?: string | null;
  usage?: ExchangeRateUsage;
}

export type ExchangeRatePairStatus = 'ok' | 'missing' | 'ending_soon' | 'unused';

export interface ExchangeRatePairSummary {
  baseCurrency: string;
  quoteCurrency: string;
  status: ExchangeRatePairStatus;
  /** Version in force today, if any. */
  current: ExchangeRateRecord | null;
  /** Earliest version that starts after today. */
  next: ExchangeRateRecord | null;
  versionCount: number;
  /** Payroll for this pair is locked on and before this date (latest finalized period end). */
  lockedThrough: string | null;
  /** Employees with an active contract in the quote currency at a company paying in the base currency. */
  employeesPaid: number;
  companyNames: string[];
}

export interface CompanyPayrollCurrencyView {
  companyId: string;
  companyName: string;
  countryCurrency: string;
  payrollBaseCurrency: string;
  /** True when the company overrides its country's currency. */
  overridden: boolean;
}

export interface CurrencySettingsOverview {
  today: string;
  companies: CompanyPayrollCurrencyView[];
  pairs: ExchangeRatePairSummary[];
  rates: ExchangeRateRecord[];
}

export interface DeleteExchangeRateResult {
  deleted: true;
  id: string;
  /** Unlocked runs that referenced the rate; they keep their stored rate until recalculated. */
  unlockedRunsAffected: number;
}

export const COMMON_CURRENCIES: Array<{ code: string; name: string }> = [
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'BDT', name: 'Bangladeshi Taka' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'LKR', name: 'Sri Lankan Rupee' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'NPR', name: 'Nepalese Rupee' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'PKR', name: 'Pakistani Rupee' },
  { code: 'QAR', name: 'Qatari Riyal' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'VND', name: 'Vietnamese Dong' },
  { code: 'ZAR', name: 'South African Rand' },
];

export function currencyName(code: string): string | null {
  return COMMON_CURRENCIES.find((c) => c.code === code.toUpperCase())?.name ?? null;
}

/** Shift a `YYYY-MM-DD` date by whole days (UTC). */
export function addDaysToDateOnly(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

export interface RateVersionPeriod {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export type RatePlanIssueCode = 'RATE_PERIOD_LOCKED' | 'RATE_OVERLAP' | 'VALIDATION_ERROR';

export type RatePlan<T> = { ok: true; value: T } | { ok: false; code: RatePlanIssueCode; message: string };

function periodsOverlap(
  aFrom: string,
  aTo: string | null,
  bFrom: string,
  bTo: string | null,
): boolean {
  return aFrom <= (bTo ?? '9999-12-31') && bFrom <= (aTo ?? '9999-12-31');
}

function describePeriod(period: { effectiveFrom: string; effectiveTo: string | null }): string {
  return period.effectiveTo
    ? `${period.effectiveFrom} – ${period.effectiveTo}`
    : `from ${period.effectiveFrom}`;
}

function lockedMessage(lockedThrough: string): string {
  return `Payroll for this currency pair is finalized through ${lockedThrough}, so rates on or before that date are locked. Add a new rate starting ${addDaysToDateOnly(lockedThrough, 1)} or later instead.`;
}

/**
 * Plan a new rate version for one currency pair (historical rate lock, RULES.md §3–4).
 * - It must start after `lockedThrough`.
 * - An open-ended version that covers the start date is closed the day before.
 * - Without an end date, it ends the day before the next later version.
 * - It may not overlap any other version.
 */
export function planNewRateVersion(
  versions: RateVersionPeriod[],
  input: { effectiveFrom: string; effectiveTo: string | null },
  lockedThrough: string | null,
): RatePlan<{ effectiveTo: string | null; closePrevious: { id: string; effectiveTo: string } | null }> {
  const from = input.effectiveFrom;
  if (input.effectiveTo && input.effectiveTo < from) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'The end date must be on or after the start date' };
  }
  if (lockedThrough && from <= lockedThrough) {
    return { ok: false, code: 'RATE_PERIOD_LOCKED', message: lockedMessage(lockedThrough) };
  }
  const sameStart = versions.find((v) => v.effectiveFrom === from);
  if (sameStart) {
    return {
      ok: false,
      code: 'RATE_OVERLAP',
      message: `A rate already starts on ${from}. Edit that version instead.`,
    };
  }

  const next = versions
    .filter((v) => v.effectiveFrom > from)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
  const effectiveTo = input.effectiveTo ?? (next ? addDaysToDateOnly(next.effectiveFrom, -1) : null);

  const previous = versions
    .filter((v) => v.effectiveFrom < from && (v.effectiveTo === null || v.effectiveTo >= from))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  let closePrevious: { id: string; effectiveTo: string } | null = null;
  if (previous) {
    if (previous.effectiveTo !== null) {
      return {
        ok: false,
        code: 'RATE_OVERLAP',
        message: `The rate ${describePeriod(previous)} already covers ${from}. Shorten it first or pick another start date.`,
      };
    }
    closePrevious = { id: previous.id, effectiveTo: addDaysToDateOnly(from, -1) };
  }

  const clash = versions.find(
    (v) =>
      v.id !== closePrevious?.id &&
      periodsOverlap(from, effectiveTo, v.effectiveFrom, v.effectiveTo),
  );
  if (clash) {
    return {
      ok: false,
      code: 'RATE_OVERLAP',
      message: `This period overlaps the rate ${describePeriod(clash)}.`,
    };
  }

  return { ok: true, value: { effectiveTo, closePrevious } };
}

/** Which parts of a version may still change given the pair's locked-through date. */
export function rateVersionEditability(
  version: { effectiveFrom: string; effectiveTo: string | null },
  lockedThrough: string | null,
): { rate: boolean; effectiveFrom: boolean; effectiveTo: boolean; delete: boolean; minEffectiveTo: string | null } {
  if (!lockedThrough || version.effectiveFrom > lockedThrough) {
    return { rate: true, effectiveFrom: true, effectiveTo: true, delete: true, minEffectiveTo: null };
  }
  const fullyLocked = version.effectiveTo !== null && version.effectiveTo <= lockedThrough;
  return {
    rate: false,
    effectiveFrom: false,
    effectiveTo: !fullyLocked,
    delete: false,
    minEffectiveTo: fullyLocked ? null : lockedThrough,
  };
}

export function planRateVersionUpdate(
  version: RateVersionPeriod,
  others: RateVersionPeriod[],
  changes: { rateChanged: boolean; effectiveFrom?: string; effectiveTo?: string | null },
  lockedThrough: string | null,
): RatePlan<{ effectiveFrom: string; effectiveTo: string | null }> {
  const allowed = rateVersionEditability(version, lockedThrough);
  const effectiveFrom = changes.effectiveFrom ?? version.effectiveFrom;
  const effectiveTo = changes.effectiveTo !== undefined ? changes.effectiveTo : version.effectiveTo;
  const fromChanged = effectiveFrom !== version.effectiveFrom;
  const toChanged = effectiveTo !== version.effectiveTo;

  if (lockedThrough) {
    if ((changes.rateChanged && !allowed.rate) || (fromChanged && !allowed.effectiveFrom)) {
      return { ok: false, code: 'RATE_PERIOD_LOCKED', message: lockedMessage(lockedThrough) };
    }
    if (fromChanged && effectiveFrom <= lockedThrough) {
      return { ok: false, code: 'RATE_PERIOD_LOCKED', message: lockedMessage(lockedThrough) };
    }
    if (toChanged && !allowed.effectiveTo) {
      return { ok: false, code: 'RATE_PERIOD_LOCKED', message: lockedMessage(lockedThrough) };
    }
    if (toChanged && allowed.minEffectiveTo && effectiveTo !== null && effectiveTo < allowed.minEffectiveTo) {
      return {
        ok: false,
        code: 'RATE_PERIOD_LOCKED',
        message: `Payroll used this rate through ${lockedThrough}, so it can't end before then.`,
      };
    }
  }
  if (effectiveTo !== null && effectiveTo < effectiveFrom) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'The end date must be on or after the start date' };
  }
  const clash = others.find(
    (v) => v.id !== version.id && periodsOverlap(effectiveFrom, effectiveTo, v.effectiveFrom, v.effectiveTo),
  );
  if (clash) {
    return {
      ok: false,
      code: 'RATE_OVERLAP',
      message: `This period overlaps the rate ${describePeriod(clash)}.`,
    };
  }
  return { ok: true, value: { effectiveFrom, effectiveTo } };
}

export interface ResolvedExchangeRate {
  id: string | null;
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  asOfDate: string;
  /** True when pay and base currency match (rate = 1) */
  isIdentity: boolean;
}

export interface PayrollCurrencySnapshot {
  payCurrency: string;
  baseCurrency: string;
  exchangeRate: string;
  exchangeRateDate: string;
  exchangeRateId?: string | null;
  grossPayBase: string;
  totalDeductionsBase: string;
  netPayBase: string;
}

export interface CreateExchangeRateInput {
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface UpdateExchangeRateInput {
  rate?: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
}

export interface PayrollRunCurrencyFields {
  payCurrency: string;
  baseCurrency: string;
  exchangeRate: string | null;
  exchangeRateId: string | null;
  exchangeRateDate: string | null;
  grossPayBase: string | null;
  totalDeductionsBase: string | null;
  netPayBase: string | null;
}
