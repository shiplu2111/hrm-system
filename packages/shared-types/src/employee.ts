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

/** Colleague picker row — safe for self-service users (no personal or employment details). */
export interface EmployeeDirectoryEntry {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  department: { id: string; name: string } | null;
  designation: { id: string; name: string } | null;
  workLocation?: { id: string; name: string } | null;
  email?: string | null;
  phone?: string | null;
}

export interface BulkUpdateEmployeeStatusInput {
  employeeIds: string[];
  employmentStatus: EmploymentStatus;
}

export interface BulkUpdateEmployeeStatusResult {
  updatedCount: number;
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

export type ProfileFieldAccessTier = 'direct_edit' | 'hr_approval' | 'read_only';

export type ProfileUpdateFieldKey =
  | 'first_name'
  | 'last_name'
  | 'work_location'
  | 'department'
  | 'designation'
  | 'manager'
  | 'dependents'
  | 'bank_or_tax'
  | 'other';

export type ProfileUpdateRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface UpdateSelfProfileInput {
  contact?: EmployeeContact;
  emergencyContact?: EmergencyContact;
  address?: EmployeeAddress;
}

export interface CreateProfileUpdateRequestInput {
  fieldKey: ProfileUpdateFieldKey;
  requestedValue: string;
  reason: string;
  effectiveDate?: string;
}

export interface ProfileUpdateRequestRecord {
  id: string;
  tenantId: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  employeeNumber?: string;
  fieldKey: ProfileUpdateFieldKey;
  currentValue: string | null;
  requestedValue: string;
  reason: string;
  effectiveDate: string | null;
  status: ProfileUpdateRequestStatus;
  requestedByUserId: string;
  reviewedByUserId: string | null;
  reviewedByName?: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  appliedOnApproval: boolean;
  createdAt: string;
  updatedAt: string;
}
