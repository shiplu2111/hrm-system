/** Employee domain types (MODULES.md §04, DATABASE_SCHEMA.md §3) */

export type EmploymentStatus =
  | 'active'
  | 'inactive'
  | 'terminated'
  | 'on_leave';

export interface EmployeeContact {
  email?: string;
  phone?: string;
  mobile?: string;
}

export interface EmergencyContact {
  name?: string;
  phone?: string;
  relationship?: string;
}

export interface EmployeeAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface EmployeeDependent {
  name: string;
  relationship?: string;
  dateOfBirth?: string;
}

export interface EmployeePersonalInfo {
  contact?: EmployeeContact;
  emergencyContact?: EmergencyContact;
  address?: EmployeeAddress;
  dependents?: EmployeeDependent[];
  [key: string]: unknown;
}

export interface EmployeeSummary {
  id: string;
  tenantId: string;
  companyId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  employmentStatus: EmploymentStatus;
  departmentId: string | null;
  designationId: string | null;
  department?: { id: string; name: string } | null;
  designation?: { id: string; name: string } | null;
  employmentType?: { id: string; name: string } | null;
}

export interface EmployeeRecord extends EmployeeSummary {
  personalInfo: EmployeePersonalInfo;
  employmentTypeId: string | null;
  managerId: string | null;
  hireDate: string;
  probationEndDate: string | null;
  confirmationDate: string | null;
  workLocationId: string | null;
  costCentreId: string | null;
  createdAt: string;
  updatedAt: string;
  manager?: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    employeeNumber: string;
  } | null;
  workLocation?: { id: string; name: string } | null;
  costCentre?: { id: string; name: string; code: string } | null;
  company?: { id: string; name: string } | null;
}
