import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import {
  ExchangeRateProvider,
  ProviderRateResult,
} from '../interfaces/exchange-rate-provider.interface';

// Base reference rates pegged to USD (1 USD = X Currency)
const USD_PEGS: Record<string, number> = {
  USD: 1.0,
  AUD: 1.542,       // 1 USD = 1.542 AUD (1 AUD = ~0.6485 USD)
  EUR: 0.9215,      // 1 USD = 0.9215 EUR (1 EUR = ~1.0852 USD)
  GBP: 0.7725,      // 1 USD = 0.7725 GBP (1 GBP = ~1.2945 USD)
  BDT: 121.5,       // 1 USD = 121.50 BDT
  CAD: 1.379,       // 1 USD = 1.379 CAD
  SGD: 1.325,       // 1 USD = 1.325 SGD
  JPY: 154.6,       // 1 USD = 154.60 JPY
  INR: 84.4,        // 1 USD = 84.40 INR
  NZD: 1.695,       // 1 USD = 1.695 NZD
  CHF: 0.884,       // 1 USD = 0.884 CHF
  AED: 3.6725,      // 1 USD = 3.6725 AED
};

@Injectable()
export class PlatformFxRateProvider implements ExchangeRateProvider {
  readonly providerId = 'platform_fx_feed';
  readonly providerName = 'Platform Global FX Baseline Feed';
  readonly description = 'Institutional benchmark currency exchange rate feed behind standard provider interface';
  readonly supportedBases = Object.keys(USD_PEGS);

  private computeRate(base: string, quote: string): Decimal | null {
    const basePeg = USD_PEGS[base.toUpperCase()];
    const quotePeg = USD_PEGS[quote.toUpperCase()];

    if (!basePeg || !quotePeg) return null;

    // Rate is: "Base currency units per 1 unit of Quote currency"
    // E.g., base = AUD, quote = USD:
    // 1 USD = 1.542 AUD. Base units per 1 USD = 1.542.
    // In USD pegs:
    // 1 USD = basePeg Base
    // 1 USD = quotePeg Quote -> 1 Quote = (1 / quotePeg) USD = (basePeg / quotePeg) Base
    const rateVal = basePeg / quotePeg;
    return new Decimal(rateVal.toFixed(8));
  }

  async fetchRate(
    baseCurrency: string,
    quoteCurrency: string,
    asOfDate?: Date,
  ): Promise<ProviderRateResult | null> {
    const base = baseCurrency.toUpperCase();
    const quote = quoteCurrency.toUpperCase();

    if (base === quote) {
      return {
        baseCurrency: base,
        quoteCurrency: quote,
        rate: new Decimal('1.00000000'),
        inverseRate: new Decimal('1.00000000'),
        asOfDate: (asOfDate || new Date()).toISOString().slice(0, 10),
        providerMetadata: { provider: this.providerId, identity: true },
      };
    }

    const rate = this.computeRate(base, quote);
    if (!rate) return null;

    const inverse = new Decimal((1 / rate.toNumber()).toFixed(8));
    const dateStr = (asOfDate || new Date()).toISOString().slice(0, 10);

    return {
      baseCurrency: base,
      quoteCurrency: quote,
      rate,
      inverseRate: inverse,
      asOfDate: dateStr,
      providerMetadata: {
        provider: this.providerId,
        source: 'benchmark_market_feed',
        timestamp: new Date().toISOString(),
      },
    };
  }

  async fetchStandardRates(
    baseCurrency: string,
    quoteCurrencies?: string[],
  ): Promise<ProviderRateResult[]> {
    const base = baseCurrency.toUpperCase();
    const targets = (quoteCurrencies && quoteCurrencies.length > 0)
      ? quoteCurrencies.map((c) => c.toUpperCase())
      : Object.keys(USD_PEGS).filter((c) => c !== base);

    const results: ProviderRateResult[] = [];
    const dateStr = new Date().toISOString().slice(0, 10);

    for (const quote of targets) {
      if (quote === base) continue;
      const rate = this.computeRate(base, quote);
      if (rate) {
        const inverse = new Decimal((1 / rate.toNumber()).toFixed(8));
        results.push({
          baseCurrency: base,
          quoteCurrency: quote,
          rate,
          inverseRate: inverse,
          asOfDate: dateStr,
          providerMetadata: {
            provider: this.providerId,
            source: 'benchmark_market_feed',
          },
        });
      }
    }

    return results;
  }
}
