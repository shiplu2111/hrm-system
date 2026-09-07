import { Decimal } from '@prisma/client/runtime/library';
import { selectEffectiveRule } from '../rule-resolver/effective-date.utils';

export interface ExchangeRateRow {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: Decimal;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

/** Convert quote-currency amount to base currency using locked rate. */
export function convertQuoteToBase(
  amount: Decimal | string,
  rate: Decimal | string,
): Decimal {
  const value = amount instanceof Decimal ? amount : new Decimal(amount);
  const fx = rate instanceof Decimal ? rate : new Decimal(rate);
  return value.mul(fx).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function identityRate(
  currency: string,
  asOfDate: Date,
): {
  id: null;
  baseCurrency: string;
  quoteCurrency: string;
  rate: Decimal;
  effectiveFrom: null;
  effectiveTo: null;
  asOfDate: Date;
  isIdentity: true;
} {
  return {
    id: null,
    baseCurrency: currency,
    quoteCurrency: currency,
    rate: new Decimal(1),
    effectiveFrom: null,
    effectiveTo: null,
    asOfDate,
    isIdentity: true,
  };
}

export function resolveExchangeRateRow(
  rows: ExchangeRateRow[],
  baseCurrency: string,
  quoteCurrency: string,
  asOfDate: Date,
): ExchangeRateRow | null {
  const normalizedBase = baseCurrency.toUpperCase();
  const normalizedQuote = quoteCurrency.toUpperCase();

  if (normalizedBase === normalizedQuote) {
    return null;
  }

  const matching = rows.filter(
    (row) =>
      row.baseCurrency.toUpperCase() === normalizedBase &&
      row.quoteCurrency.toUpperCase() === normalizedQuote,
  );

  return selectEffectiveRule(matching, asOfDate);
}

export function formatRate(value: Decimal): string {
  return value.toFixed(8).replace(/\.?0+$/, '') || '0';
}
