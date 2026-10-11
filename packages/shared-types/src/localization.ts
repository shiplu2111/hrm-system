/** Localization settings per company/branch and per-user language (MODULES.md §46) */

export type UiLanguage = 'en' | 'bn';

export const UI_LANGUAGES: ReadonlyArray<{ code: UiLanguage; name: string; nativeName: string; intlTag: string }> = [
  { code: 'en', name: 'English', nativeName: 'English', intlTag: 'en-GB' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', intlTag: 'bn-BD' },
];

export const DEFAULT_UI_LANGUAGE: UiLanguage = 'en';

export function isUiLanguage(value: unknown): value is UiLanguage {
  return value === 'en' || value === 'bn';
}

const COUNTRY_LANGUAGES: Record<string, UiLanguage> = { BGD: 'bn', BD: 'bn' };

/** Countries don't store a UI language; derive it from the ISO code and fall back to English. */
export function countryDefaultLanguage(isoCode: string): UiLanguage {
  return COUNTRY_LANGUAGES[isoCode.trim().toUpperCase()] ?? DEFAULT_UI_LANGUAGE;
}

export const DATE_FORMAT_OPTIONS = [
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'YYYY-MM-DD',
  'DD-MM-YYYY',
  'DD.MM.YYYY',
  'DD MMM YYYY',
  'MMM DD, YYYY',
] as const;

export interface NumberFormatOption {
  id: string;
  label: string;
  group: string;
  decimal: string;
  /** `indian` groups the last three digits, then pairs (12,34,567.89). */
  grouping: 'standard' | 'indian';
}

export const NUMBER_FORMAT_OPTIONS: ReadonlyArray<NumberFormatOption> = [
  { id: '1,234.56', label: 'Comma groups, dot decimal', group: ',', decimal: '.', grouping: 'standard' },
  { id: '1.234,56', label: 'Dot groups, comma decimal', group: '.', decimal: ',', grouping: 'standard' },
  { id: '1 234,56', label: 'Space groups, comma decimal', group: '\u00a0', decimal: ',', grouping: 'standard' },
  { id: "1'234.56", label: 'Apostrophe groups, dot decimal', group: "'", decimal: '.', grouping: 'standard' },
  { id: '12,34,567.89', label: 'Lakh/crore groups (South Asia)', group: ',', decimal: '.', grouping: 'indian' },
];

export function isDateFormatOption(value: string): boolean {
  return (DATE_FORMAT_OPTIONS as readonly string[]).includes(value);
}

export function findNumberFormat(id: string): NumberFormatOption {
  return NUMBER_FORMAT_OPTIONS.find((option) => option.id === id) ?? NUMBER_FORMAT_OPTIONS[0];
}

export function isNumberFormatOption(value: string): boolean {
  return NUMBER_FORMAT_OPTIONS.some((option) => option.id === value);
}

export function isValidTimezone(value: string): boolean {
  if (!value || (!value.includes('/') && value !== 'UTC')) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const FALLBACK_TIMEZONES = [
  'UTC',
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Karachi',
  'Asia/Kathmandu',
  'Asia/Colombo',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Jakarta',
  'Asia/Manila',
  'Asia/Bangkok',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Perth',
  'Australia/Adelaide',
  'Australia/Brisbane',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Africa/Johannesburg',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
];

/** IANA timezones known to the runtime, or a short common list on runtimes without `Intl.supportedValuesOf`. */
export function listTimezones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const zones = intl.supportedValuesOf?.('timeZone');
  if (!zones?.length) return [...FALLBACK_TIMEZONES];
  return zones.includes('UTC') ? zones : ['UTC', ...zones];
}

/** e.g. "UTC+06:00" for Asia/Dhaka at `at`. */
export function timezoneOffsetLabel(timezone: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value;
    if (!part || part === 'GMT') return 'UTC+00:00';
    return part.replace('GMT', 'UTC');
  } catch {
    return '';
  }
}

export interface DateParts {
  year: string;
  month: string;
  day: string;
}

function monthShortName(month: number, language: UiLanguage): string {
  const tag = UI_LANGUAGES.find((l) => l.code === language)?.intlTag ?? 'en-GB';
  return new Intl.DateTimeFormat(tag, { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2000, month - 1, 1)),
  );
}

/** Apply a YYYY / YY / MMM / MM / DD pattern. Other characters are kept as literals. */
export function applyDatePattern(pattern: string, parts: DateParts, language: UiLanguage = 'en'): string {
  return pattern.replace(/YYYY|YY|MMM|MM|DD/g, (token) => {
    switch (token) {
      case 'YYYY':
        return parts.year;
      case 'YY':
        return parts.year.slice(-2);
      case 'MMM':
        return monthShortName(Number(parts.month), language);
      case 'MM':
        return parts.month;
      default:
        return parts.day;
    }
  });
}

/** Format a calendar date key (YYYY-MM-DD) with a date pattern. */
export function formatDateKeyWithPattern(dateKey: string, pattern: string, language: UiLanguage = 'en'): string {
  const [year, month, day] = dateKey.slice(0, 10).split('-');
  if (!year || !month || !day) return dateKey;
  return applyDatePattern(pattern, { year, month, day }, language);
}

/** Format an instant as a calendar date in `timezone` with a date pattern. */
export function formatInstantWithPattern(
  instant: Date,
  pattern: string,
  timezone: string,
  language: UiLanguage = 'en',
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return applyDatePattern(pattern, { year: get('year'), month: get('month'), day: get('day') }, language);
}

function groupDigits(digits: string, option: NumberFormatOption): string {
  if (digits.length <= 3) return digits;
  if (option.grouping === 'indian') {
    const last = digits.slice(-3);
    const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, option.group);
    return `${rest}${option.group}${last}`;
  }
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, option.group);
}

/** Format a number with one of the `NUMBER_FORMAT_OPTIONS` patterns (Latin digits). */
export function formatNumberWithPattern(
  value: number,
  pattern: string,
  fractionDigits: { min?: number; max?: number } = {},
): string {
  if (!Number.isFinite(value)) return String(value);
  const option = findNumberFormat(pattern);
  const min = fractionDigits.min ?? 0;
  const max = Math.max(min, fractionDigits.max ?? 2);
  const plain = new Intl.NumberFormat('en-US', {
    useGrouping: false,
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(Math.abs(value));
  const [intPart, fracPart] = plain.split('.');
  const sign = value < 0 && Number(plain) !== 0 ? '-' : '';
  return `${sign}${groupDigits(intPart ?? '0', option)}${fracPart ? `${option.decimal}${fracPart}` : ''}`;
}

export interface LocalizationFields {
  language: UiLanguage;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
}

export type LocalizationField = keyof LocalizationFields;

export const LOCALIZATION_FIELDS: ReadonlyArray<LocalizationField> = [
  'language',
  'timezone',
  'dateFormat',
  'numberFormat',
];

/** `null` inherits from the level above. */
export interface LocalizationOverrides {
  language: UiLanguage | null;
  timezone: string | null;
  dateFormat: string | null;
  numberFormat: string | null;
}

export type LocalizationSource = 'country' | 'company' | 'branch';

export interface ResolvedLocalization {
  effective: LocalizationFields;
  sources: Record<LocalizationField, LocalizationSource>;
}

export interface CountryLocalizationDefaults {
  isoCode: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
}

export function countryLocalization(country: CountryLocalizationDefaults): LocalizationFields {
  return {
    language: countryDefaultLanguage(country.isoCode),
    timezone: country.timezone,
    dateFormat: country.dateFormat,
    numberFormat: country.numberFormat,
  };
}

/** Branch overrides company, company overrides country (ARCHITECTURE.md §3 inheritance). */
export function resolveLocalization(input: {
  country: CountryLocalizationDefaults;
  company?: Partial<LocalizationOverrides> | null;
  branch?: Partial<LocalizationOverrides> | null;
}): ResolvedLocalization {
  const base = countryLocalization(input.country);
  const effective = { ...base };
  const sources = {} as Record<LocalizationField, LocalizationSource>;
  for (const field of LOCALIZATION_FIELDS) {
    const branchValue = input.branch?.[field];
    const companyValue = input.company?.[field];
    if (branchValue) {
      (effective as Record<LocalizationField, string>)[field] = branchValue;
      sources[field] = 'branch';
    } else if (companyValue) {
      (effective as Record<LocalizationField, string>)[field] = companyValue;
      sources[field] = 'company';
    } else {
      sources[field] = 'country';
    }
  }
  return { effective, sources };
}

export interface BranchLocalizationView {
  locationId: string;
  name: string;
  employeeCount: number;
  overrides: LocalizationOverrides;
  effective: LocalizationFields;
  sources: Record<LocalizationField, LocalizationSource>;
}

export interface CompanyLocalizationView {
  companyId: string;
  companyName: string;
  countryName: string;
  countryIsoCode: string;
  countryDefaults: LocalizationFields;
  overrides: LocalizationOverrides;
  effective: LocalizationFields;
  sources: Record<LocalizationField, LocalizationSource>;
  employeeCount: number;
  branches: BranchLocalizationView[];
}

export interface LocalizationSettingsOverview {
  companies: CompanyLocalizationView[];
}

export type UpdateLocalizationInput = Partial<LocalizationOverrides>;

export type MyLanguageSource = 'user' | LocalizationSource;

/** Effective settings for the signed-in user: their own language choice wins over the organization default. */
export interface MyLocalization extends LocalizationFields {
  preferredLanguage: UiLanguage | null;
  organizationLanguage: UiLanguage;
  languageSource: MyLanguageSource;
  sources: Record<LocalizationField, LocalizationSource>;
  companyId: string | null;
  companyName: string | null;
  branchName: string | null;
}

export interface UpdateMyLocalizationInput {
  language: UiLanguage | null;
}
