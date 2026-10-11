import type {
  CompanyPayrollCurrencyView,
  CreateExchangeRateInput,
  CurrencySettingsOverview,
  DeleteExchangeRateResult,
  ExchangeRateRecord,
  ResolvedExchangeRate,
  UpdateExchangeRateInput,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function listExchangeRates(): Promise<ExchangeRateRecord[]> {
  return tenantApiRequest<ExchangeRateRecord[]>('/tenant/exchange-rates');
}

export function getCurrencyOverview(): Promise<CurrencySettingsOverview> {
  return tenantApiRequest<CurrencySettingsOverview>('/tenant/exchange-rates/overview');
}

export function resolveExchangeRate(
  baseCurrency: string,
  quoteCurrency: string,
  date: string,
): Promise<ResolvedExchangeRate> {
  const query = new URLSearchParams({ base: baseCurrency, quote: quoteCurrency, date });
  return tenantApiRequest<ResolvedExchangeRate>(`/tenant/exchange-rates/resolve?${query.toString()}`);
}

export function createExchangeRate(
  input: CreateExchangeRateInput,
): Promise<ExchangeRateRecord> {
  return tenantApiRequest<ExchangeRateRecord>('/tenant/exchange-rates', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateExchangeRate(
  rateId: string,
  input: UpdateExchangeRateInput,
): Promise<ExchangeRateRecord> {
  return tenantApiRequest<ExchangeRateRecord>(
    `/tenant/exchange-rates/${rateId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteExchangeRate(rateId: string): Promise<DeleteExchangeRateResult> {
  return tenantApiRequest<DeleteExchangeRateResult>(`/tenant/exchange-rates/${rateId}`, {
    method: 'DELETE',
  });
}

export function getCompanyPayrollCurrency(companyId: string): Promise<{
  companyId: string;
  payrollBaseCurrency: string;
}> {
  return tenantApiRequest<{ companyId: string; payrollBaseCurrency: string }>(
    `/organization/companies/${companyId}/payroll-currency`,
  );
}

/** `null` reverts to the company's country currency. */
export function updateCompanyPayrollCurrency(
  companyId: string,
  payrollBaseCurrency: string | null,
): Promise<CompanyPayrollCurrencyView> {
  return tenantApiRequest<CompanyPayrollCurrencyView>(
    `/organization/companies/${companyId}/payroll-currency`,
    {
      method: 'PATCH',
      body: JSON.stringify({ payrollBaseCurrency }),
    },
  );
}
