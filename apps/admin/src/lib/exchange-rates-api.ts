import type {
  CreateExchangeRateInput,
  ExchangeRateRecord,
  UpdateExchangeRateInput,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function listExchangeRates(): Promise<ExchangeRateRecord[]> {
  return tenantApiRequest<ExchangeRateRecord[]>('/tenant/exchange-rates');
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

export function getCompanyPayrollCurrency(companyId: string): Promise<{
  companyId: string;
  payrollBaseCurrency: string;
}> {
  return tenantApiRequest<{ companyId: string; payrollBaseCurrency: string }>(
    `/organization/companies/${companyId}/payroll-currency`,
  );
}

export function updateCompanyPayrollCurrency(
  companyId: string,
  payrollBaseCurrency: string | null,
): Promise<{ companyId: string; payrollBaseCurrency: string; tenantId: string }> {
  return tenantApiRequest<{ companyId: string; payrollBaseCurrency: string; tenantId: string }>(
    `/organization/companies/${companyId}/payroll-currency`,
    {
      method: 'PATCH',
      body: JSON.stringify({ payrollBaseCurrency }),
    },
  );
}
