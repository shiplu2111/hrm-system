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
    assigneeType: import('./workflow').WorkflowAssigneeType;
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

export const CONTRACT_EXPIRY_WINDOW_DEFAULT_DAYS = 30;
export const CONTRACT_EXPIRY_WINDOW_MIN_DAYS = 7;
export const CONTRACT_EXPIRY_WINDOW_MAX_DAYS = 180;

/** Per-company settings for the daily `contract.expiring` notification job. */
export interface ContractExpiryAlertSettings {
  /** Contracts ending within this many days are flagged "expiring soon" and alerted once. */
  windowDays: number;
  updatedAt: string | null;
}

export interface UpdateContractExpiryAlertSettingsInput {
  windowDays: number;
}

export interface ContractExpiryAlertItem {
  contractId: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  departmentName: string | null;
  contractType: EmploymentContractType;
  startDate: string;
  endDate: string;
  /** Negative once the end date has passed. */
  daysUntil: number;
  /** When the `contract.expiring` notification went out; null if it hasn't yet. */
  alertSentAt: string | null;
  renewal: {
    contractId: string;
    displayStatus: EmploymentContractDisplayStatus;
    startDate: string;
  } | null;
}

export interface ContractExpiryAlertsView {
  asOf: string;
  /** Window applied to `upcoming` (the query override, or the company setting). */
  windowDays: number;
  settings: ContractExpiryAlertSettings;
  /** Next scheduled run of the daily notification job. */
  nextRunAt: string;
  upcoming: ContractExpiryAlertItem[];
  /** Still-active contracts whose end date has passed. */
  overdue: ContractExpiryAlertItem[];
}

export interface ContractExpiryAlertRunResult {
  sent: number;
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
