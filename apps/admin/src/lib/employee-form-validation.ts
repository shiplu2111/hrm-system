import type { EmploymentStatus } from '@hrm/shared-types';

export interface EmployeeFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelationship: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  employeeNumber: string;
  hireDate: string;
  employmentStatus: EmploymentStatus;
  departmentId: string;
  designationId: string;
  employmentTypeId: string;
  managerId: string;
  costCentreId: string;
  probationEndDate: string;
  confirmationDate: string;
  taxIdNumber: string;
  bankAccountNumber: string;
  taxRegime: string;
}

export interface PendingDocument {
  localId: string;
  documentTypeId: string;
  expiryDate: string;
  fieldValues: Record<string, string>;
  file: File | null;
}

export type EmployeeWizardStep = 'personal' | 'employment' | 'bankTax' | 'documents';

export type EmployeeFormErrors = Partial<Record<keyof EmployeeFormState, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createDefaultEmployeeFormState(): EmployeeFormState {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    mobile: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelationship: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    employeeNumber: '',
    hireDate: new Date().toISOString().slice(0, 10),
    employmentStatus: 'active',
    departmentId: '',
    designationId: '',
    employmentTypeId: '',
    managerId: '',
    costCentreId: '',
    probationEndDate: '',
    confirmationDate: '',
    taxIdNumber: '',
    bankAccountNumber: '',
    taxRegime: '',
  };
}

export function validatePersonalStep(state: EmployeeFormState): EmployeeFormErrors {
  const errors: EmployeeFormErrors = {};
  if (!state.firstName.trim()) {
    errors.firstName = 'First name is required.';
  }
  if (!state.lastName.trim()) {
    errors.lastName = 'Last name is required.';
  }
  if (state.email.trim() && !EMAIL_RE.test(state.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  return errors;
}

export function validateEmploymentStep(state: EmployeeFormState): EmployeeFormErrors {
  const errors: EmployeeFormErrors = {};
  if (!state.employeeNumber.trim()) {
    errors.employeeNumber = 'Employee number is required.';
  }
  if (!state.hireDate) {
    errors.hireDate = 'Hire date is required.';
  }
  return errors;
}

export function validateBankTaxStep(_state: EmployeeFormState): EmployeeFormErrors {
  return {};
}

export function validateDocumentDraft(
  documentTypeId: string,
  requiredFieldKeys: { key: string; label: string; required?: boolean }[],
  fieldValues: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!documentTypeId) {
    errors.documentTypeId = 'Select a document type.';
  }
  for (const field of requiredFieldKeys) {
    if (field.required && !fieldValues[field.key]?.trim()) {
      errors[field.key] = `${field.label} is required.`;
    }
  }
  return errors;
}
