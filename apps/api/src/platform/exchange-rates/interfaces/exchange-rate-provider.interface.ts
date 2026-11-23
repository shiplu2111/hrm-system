import { Decimal } from '@prisma/client/runtime/library';

export interface ProviderRateResult {
  baseCurrency: string;
  quoteCurrency: string;
  rate: Decimal;
  inverseRate: Decimal;
  asOfDate: string;
  providerMetadata?: Record<string, any>;
}

export interface ExchangeRateProvider {
  readonly providerId: string;
  readonly providerName: string;
  readonly description: string;
  readonly supportedBases: string[];

  fetchRate(
    baseCurrency: string,
    quoteCurrency: string,
    asOfDate?: Date,
  ): Promise<ProviderRateResult | null>;

  fetchStandardRates(
    baseCurrency: string,
    quoteCurrencies?: string[],
  ): Promise<ProviderRateResult[]>;
}
