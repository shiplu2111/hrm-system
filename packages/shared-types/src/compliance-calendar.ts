export type ComplianceRecurrence =
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'fixed_date';

export type ComplianceEventCategory =
  | 'tax_filing'
  | 'statutory_reporting'
  | 'social_security_remittance'
  | 'license_renewal'
  | 'labor_audit'
  | 'general';

export type ComplianceEventStatus = 'active' | 'inactive' | 'archived';

export interface ComplianceDueDateRule {
  /** Day of the month for monthly or quarterly recurrence (1-31). Defaults to 21 if unspecified. */
  dayOfMonth?: number;
  /** Month of the year for yearly recurrence (1-12). */
  month?: number;
  /** Months in which quarterly compliance occurs (e.g. [1, 4, 7, 10] or [3, 6, 9, 12]). */
  quarterMonthOffsets?: number[];
  /** Fixed ISO date (YYYY-MM-DD) for fixed_date recurrence. */
  specificDate?: string;
  /** Whether the due date is strictly the last calendar day of the relevant month. */
  lastDayOfMonth?: boolean;
  /** Optional business days offset (+/-). */
  businessDaysOffset?: number;
}

export interface ComplianceEventView {
  id: string;
  countryId: string;
  countryName: string;
  countryIsoCode: string;
  stateProvinceId: string | null;
  stateProvinceName: string | null;
  stateProvinceCode: string | null;
  title: string;
  description: string | null;
  category: ComplianceEventCategory;
  recurrence: ComplianceRecurrence;
  dueDateRule: ComplianceDueDateRule;
  applicablePlans: string[];
  companyType: string | null;
  sourceReference: string | null;
  noticeDaysBefore: number;
  penaltiesSummary: string | null;
  filingPortalUrl: string | null;
  actionRequired: string | null;
  status: ComplianceEventStatus;
  nextDueDate?: string | null;
  daysUntilDue?: number | null;
  isNoticeWindowActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateComplianceEventInput {
  countryId: string;
  stateProvinceId?: string | null;
  title: string;
  description?: string | null;
  category?: ComplianceEventCategory;
  recurrence: ComplianceRecurrence;
  dueDateRule: ComplianceDueDateRule;
  applicablePlans?: string[];
  companyType?: string | null;
  sourceReference?: string | null;
  noticeDaysBefore?: number;
  penaltiesSummary?: string | null;
  filingPortalUrl?: string | null;
  actionRequired?: string | null;
  status?: ComplianceEventStatus;
}

export interface UpdateComplianceEventInput {
  countryId?: string;
  stateProvinceId?: string | null;
  title?: string;
  description?: string | null;
  category?: ComplianceEventCategory;
  recurrence?: ComplianceRecurrence;
  dueDateRule?: ComplianceDueDateRule;
  applicablePlans?: string[];
  companyType?: string | null;
  sourceReference?: string | null;
  noticeDaysBefore?: number;
  penaltiesSummary?: string | null;
  filingPortalUrl?: string | null;
  actionRequired?: string | null;
  status?: ComplianceEventStatus;
}

export interface ComplianceNoticeJobRunInput {
  asOfDate?: string; // YYYY-MM-DD
  countryId?: string;
}

export interface ComplianceNoticeGeneratedItem {
  tenantId: string;
  tenantName: string;
  companyId: string;
  companyName: string;
  eventId: string;
  eventTitle: string;
  dueDate: string;
  daysRemaining: number;
}

export interface ComplianceNoticeJobRunResult {
  asOfDate: string;
  scannedEventsCount: number;
  eligibleTenantsCount: number;
  noticesGeneratedCount: number;
  skippedExistingCount: number;
  generatedNotices: ComplianceNoticeGeneratedItem[];
  errors: string[];
}

export interface ComplianceNoticeView {
  id: string;
  tenantId: string;
  companyId: string;
  companyName: string;
  complianceEventId: string;
  title: string;
  description: string | null;
  category: ComplianceEventCategory;
  dueDate: string;
  noticeDate: string;
  daysRemaining: number;
  status: 'sent' | 'acknowledged' | 'completed' | 'dismissed';
  sourceReference: string | null;
  filingPortalUrl: string | null;
  actionRequired: string | null;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
}
