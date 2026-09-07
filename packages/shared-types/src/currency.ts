/** Multi-currency payroll (MODULES.md §46, RULES.md §4) */

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
