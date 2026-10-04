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
  /** For life insurance these are the nominated beneficiaries. */
  allowsDependents: boolean;
  maxDependents: number | null;
  /** Empty means any relationship is eligible. */
  eligibleRelationships: BenefitDependentRelationship[];
  /** Extra monthly employee cost per covered dependent. */
  dependentContributionAmount: number | null;
  status: BenefitPlanStatus;
  /** True once any enrollment (active or not) exists — the plan can no longer return to draft. */
  hasEnrollments: boolean;
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
  /** Open, and today falls between the start and end dates. */
  acceptingEnrollments: boolean;
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
  benefitPlanCategory?: BenefitPlanCategory;
  benefitPlanProvider?: string;
  benefitPlanTier?: string;
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
  /** Employee contribution plus the plan's per-dependent cost for each active dependent. */
  monthlyEmployeeCost: number;
  monthlyEmployerCost: number | null;
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
