import { apiRequest } from './api-client';
import type {
  CreatePlatformExchangeRateInput,
  ManualOverridePlatformRateInput,
  PlatformExchangeRatePairSummary,
  PlatformExchangeRateProviderDef,
  PlatformExchangeRateRecord,
  ResolvedPlatformExchangeRate,
  SyncProviderRatesInput,
} from '@hrm/shared-types';

/**
 * List all currency pairs and their active rates
 */
export function listPlatformExchangeRatePairs(query?: {
  baseCurrency?: string;
  quoteCurrency?: string;
  source?: string;
}): Promise<PlatformExchangeRatePairSummary[]> {
  const params = new URLSearchParams();
  if (query?.baseCurrency && query.baseCurrency !== 'all') {
    params.set('baseCurrency', query.baseCurrency);
  }
  if (query?.quoteCurrency && query.quoteCurrency !== 'all') {
    params.set('quoteCurrency', query.quoteCurrency);
  }
  if (query?.source && query.source !== 'all') {
    params.set('source', query.source);
  }
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<PlatformExchangeRatePairSummary[]>(`/platform/exchange-rates${qs}`);
}

/**
 * Get the complete rate-history table for a currency pair (never overwritten)
 */
export function getPlatformExchangeRateHistory(
  baseCurrency: string,
  quoteCurrency: string,
): Promise<PlatformExchangeRateRecord[]> {
  const qs = `?baseCurrency=${encodeURIComponent(baseCurrency)}&quoteCurrency=${encodeURIComponent(quoteCurrency)}`;
  return apiRequest<PlatformExchangeRateRecord[]>(`/platform/exchange-rates/history${qs}`);
}

/**
 * Resolve rate on a specific date (tests fallback hierarchy)
 */
export function resolvePlatformExchangeRate(
  baseCurrency: string,
  quoteCurrency: string,
  asOfDate?: string,
): Promise<ResolvedPlatformExchangeRate> {
  const params = new URLSearchParams({
    baseCurrency,
    quoteCurrency,
  });
  if (asOfDate) params.set('asOfDate', asOfDate);
  return apiRequest<ResolvedPlatformExchangeRate>(`/platform/exchange-rates/resolve?${params.toString()}`);
}

/**
 * List rate source providers
 */
export function listPlatformExchangeRateProviders(): Promise<PlatformExchangeRateProviderDef[]> {
  return apiRequest<PlatformExchangeRateProviderDef[]>('/platform/exchange-rates/providers');
}

/**
 * Create a new platform exchange rate version
 */
export function createPlatformExchangeRate(
  input: CreatePlatformExchangeRateInput,
): Promise<PlatformExchangeRateRecord> {
  return apiRequest<PlatformExchangeRateRecord>('/platform/exchange-rates', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Create a manual override with mandatory reason
 */
export function createPlatformManualOverride(
  input: ManualOverridePlatformRateInput,
): Promise<PlatformExchangeRateRecord> {
  return apiRequest<PlatformExchangeRateRecord>('/platform/exchange-rates/override', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Sync rates from provider behind standard interface
 */
export function syncPlatformExchangeRates(
  input: SyncProviderRatesInput,
): Promise<{ syncedCount: number; rates: PlatformExchangeRateRecord[] }> {
  return apiRequest<{ syncedCount: number; rates: PlatformExchangeRateRecord[] }>(
    '/platform/exchange-rates/sync',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}
