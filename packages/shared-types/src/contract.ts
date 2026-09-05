export type EmploymentContractType =
  | 'permanent'
  | 'fixed_term'
  | 'casual'
  | 'project_based';

export type EmploymentContractStatus = 'draft' | 'active' | 'terminated';

/** UI-facing status including computed expiry states */
export type EmploymentContractDisplayStatus =
  | 'draft'
  | 'pending_approval'
  | 'active'
  | 'expiring_soon'
  | 'expired'
  | 'terminated';

export type PayFrequency = 'hourly' | 'weekly' | 'biweekly' | 'monthly' | 'annual';

export interface EmploymentContractRenewalWorkflow {
  instanceId: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  currentStep: {
    order: number;
    roleName: string;
    assigneeType: 'role' | 'direct_manager';
  } | null;
}

export interface OvertimeRule {
  type: 'none' | 'multiplier_after_weekly_hours' | 'multiplier_after_daily_hours';
  thresholdHours?: number;
  multiplier?: number;
  description?: string;
}

export interface EmploymentContractDocumentRecord {
  id: string;
  contractId: string;
  label: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmploymentContractRecord {
  id: string;
  tenantId: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  employeeNumber?: string;
  contractType: EmploymentContractType;
  status: EmploymentContractStatus;
  displayStatus: EmploymentContractDisplayStatus;
  startDate: string;
  endDate: string | null;
  probationEndDate: string | null;
  workingHoursPerWeek: number | null;
  payRate: number | null;
  payFrequency: PayFrequency | null;
  currency: string;
  leaveEntitlementDays: number | null;
  overtimeRule: OvertimeRule | null;
  noticePeriodDays: number | null;
  employerNoticeDays: number | null;
  terminationConditions: string | null;
  renewedFromId: string | null;
  signedAt: string | null;
  renewalWorkflow: EmploymentContractRenewalWorkflow | null;
  documents: EmploymentContractDocumentRecord[];
  createdAt: string;
  updatedAt: string;
}
