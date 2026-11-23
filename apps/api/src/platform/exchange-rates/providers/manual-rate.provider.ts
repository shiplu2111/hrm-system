import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import {
  ExchangeRateProvider,
  ProviderRateResult,
} from '../interfaces/exchange-rate-provider.interface';

@Injectable()
export class ManualRateProvider implements ExchangeRateProvider {
  readonly providerId = 'manual';
  readonly providerName = 'Manual Platform Operator Entry';
  readonly description = 'Manual exchange rate entry and administrative overrides';
  readonly supportedBases = ['*'];

  async fetchRate(
    baseCurrency: string,
    quoteCurrency: string,
    asOfDate?: Date,
  ): Promise<ProviderRateResult | null> {
    // Manual provider does not fetch live rates automatically
    return null;
  }

  async fetchStandardRates(
    baseCurrency: string,
    quoteCurrencies?: string[],
  ): Promise<ProviderRateResult[]> {
    return [];
  }
}
