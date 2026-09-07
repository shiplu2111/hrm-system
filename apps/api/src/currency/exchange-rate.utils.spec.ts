import { describe, expect, it } from '@jest/globals';
import { Decimal } from '@prisma/client/runtime/library';
import {
  convertQuoteToBase,
  resolveExchangeRateRow,
} from './exchange-rate.utils';

describe('resolveExchangeRateRow', () => {
  const rows = [
    {
      id: 'old',
      baseCurrency: 'AUD',
      quoteCurrency: 'USD',
      rate: new Decimal('1.40000000'),
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: new Date('2026-06-30T00:00:00.000Z'),
    },
    {
      id: 'new',
      baseCurrency: 'AUD',
      quoteCurrency: 'USD',
      rate: new Decimal('1.48000000'),
      effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
      effectiveTo: null,
    },
  ];

  it('selects the rate active on the payroll date, not today', () => {
    const march = new Date('2026-03-15T00:00:00.000Z');
    const august = new Date('2026-08-01T00:00:00.000Z');

    expect(
      resolveExchangeRateRow(rows, 'AUD', 'USD', march)?.id,
    ).toBe('old');
    expect(
      resolveExchangeRateRow(rows, 'AUD', 'USD', august)?.id,
    ).toBe('new');
  });

  it('returns null for same-currency pairs', () => {
    expect(
      resolveExchangeRateRow(rows, 'AUD', 'AUD', new Date('2026-03-15')),
    ).toBeNull();
  });
});

describe('convertQuoteToBase', () => {
  it('converts using the locked historical rate', () => {
    expect(
      convertQuoteToBase('5000.00', '1.48').toString(),
    ).toBe('7400');
  });
});
