/** Benefits administration (MODULES.md §21 — separate from superannuation) */

export type BenefitPlanCategory =
  | 'health_insurance'
  | 'life_insurance'
  | 'dental_vision'
  | 'wellness'
  | 'other';

export type BenefitPlanStatus = 'draft' | 'active' | 'inactive';

export type BenefitOpenEnrollmentStatus =
  | 'scheduled'
  | 'open'
  | 'closed'
  | 'cancelled';

export type BenefitEnrollmentStatus =
  | 'pending'
  | 'active'
  | 'cancelled'
  | 'terminated';

export type BenefitEnrollmentType =
  | 'open_enrollment'
  | 'new_hire'
  | 'life_event'
  | 'admin';

export type BenefitDependentRelationship =
  | 'spouse'
  | 'child'
  | 'parent'
  | 'domestic_partner'
  | 'other';

export type BenefitDependentStatus = 'active' | 'cancelled';

export interface BenefitPlanRecord {
  id: string;
  companyId: string;
  name: string;
  category: BenefitPlanCategory;
  provider: string;
  planTier: string;
  description: string | null;
  employerContributionLabel: string | null;
  employerContributionAmount: number | null;
  employeeContributionAmount: number;
  employeeContributionLabel: string | null;
  coverageLimitLabel: string | null;
  status: BenefitPlanStatus;
  enrolledCount: number;
  dependentCount: number;
  inOpenEnrollment: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BenefitOpenEnrollmentPeriodRecord {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: BenefitOpenEnrollmentStatus;
  openedAt: string | null;
  closedAt: string | null;
  planIds: string[];
  enrollmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BenefitEnrollmentDependentRecord {
  id: string;
  enrollmentId: string;
  fullName: string;
  relationship: BenefitDependentRelationship;
  dateOfBirth: string | null;
  beneficiarySharePercent: number | null;
  status: BenefitDependentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BenefitEnrollmentRecord {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  employeeNumber?: string;
  benefitPlanId: string;
  benefitPlanName?: string;
  openEnrollmentPeriodId: string | null;
  enrollmentType: BenefitEnrollmentType;
  status: BenefitEnrollmentStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  employeeContributionAmount: number | null;
  beneficiarySharePercent: number | null;
  notes: string | null;
  enrolledAt: string | null;
  cancelledAt: string | null;
  dependents: BenefitEnrollmentDependentRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface BenefitAdminSummary {
  activePlanCount: number;
  activeEnrollmentCount: number;
  dependentCoverageCount: number;
  monthlyEmployerSubsidy: number;
  openEnrollmentPeriod: BenefitOpenEnrollmentPeriodRecord | null;
}
