/**
 * Platform Exchange Rates (MODULES.md §46, Phase 2 Stage 24.1)
 * Cross-tenant baseline exchange rates with rate provider interface,
 * historical effective-dated versions, rate-history per pair, and manual overrides with reason.
 * Tenants may override per Phase 2 Stage 24.1.
 */

export type PlatformRateSource = 'manual' | 'provider' | 'manual_override';

export interface PlatformExchangeRateRecord {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  /** Base currency units per 1 quote currency unit (e.g. 1 USD = 1.54 AUD -> rate = 1.54) */
  rate: string;
  /** Inverse rate: 1 base currency unit in quote currency (e.g. 1 AUD = 0.64935065 USD) */
  inverseRate?: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  source: PlatformRateSource;
  providerName?: string | null;
  overrideReason?: string | null;
  notes?: string | null;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PlatformPairStatus = 'active' | 'ending_soon' | 'missing';

export interface PlatformExchangeRatePairSummary {
  baseCurrency: string;
  quoteCurrency: string;
  currentRate: PlatformExchangeRateRecord | null;
  latestSource: PlatformRateSource;
  status: PlatformPairStatus;
  versionCount: number;
  lastUpdated: string;
  overrideCount: number;
}

export interface CreatePlatformExchangeRateInput {
  baseCurrency: string;
  quoteCurrency: string;
  rate: string | number;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  source?: PlatformRateSource;
  providerName?: string;
  notes?: string;
}

export interface ManualOverridePlatformRateInput {
  baseCurrency: string;
  quoteCurrency: string;
  rate: string | number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  reason: string; // Mandatory for manual override
  notes?: string;
}

export interface SyncProviderRatesInput {
  providerId?: string;
  baseCurrency?: string;
  quoteCurrencies?: string[];
}

export interface PlatformExchangeRateProviderDef {
  providerId: string;
  providerName: string;
  description: string;
  supportedBases: string[];
  isDefault: boolean;
}

export interface ResolvedPlatformExchangeRate {
  id: string | null;
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  inverseRate: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  asOfDate: string;
  source: 'identity' | 'tenant_override' | 'platform_default' | 'platform_manual_override';
  providerName?: string | null;
  overrideReason?: string | null;
}
