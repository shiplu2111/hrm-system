import type { EmployeeTaxProfileView, RevealedSensitiveField } from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function getEmployeeTaxProfile(
  employeeId: string,
): Promise<EmployeeTaxProfileView> {
  return tenantApiRequest<EmployeeTaxProfileView>(
    `/employees/${employeeId}/tax-profile`,
  );
}

export function revealEmployeeTaxField(
  employeeId: string,
  field: 'taxIdNumber' | 'bankAccountNumber',
): Promise<RevealedSensitiveField> {
  return tenantApiRequest<RevealedSensitiveField>(
    `/employees/${employeeId}/tax-profile/reveal?field=${encodeURIComponent(field)}`,
  );
}

export function updateEmployeeTaxProfile(
  employeeId: string,
  input: {
    taxIdNumber?: string | null;
    bankAccountNumber?: string | null;
    taxSettings?: Record<string, unknown>;
  },
): Promise<EmployeeTaxProfileView> {
  return tenantApiRequest<EmployeeTaxProfileView>(
    `/employees/${employeeId}/tax-profile`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}
