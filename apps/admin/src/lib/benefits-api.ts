import type {
  BenefitAdminSummary,
  BenefitDependentRelationship,
  BenefitEnrollmentRecord,
  BenefitEnrollmentType,
  BenefitOpenEnrollmentPeriodRecord,
  BenefitPlanRecord,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export const BENEFIT_CATEGORY_LABELS: Record<string, string> = {
  health_insurance: 'Health Insurance',
  life_insurance: 'Life Insurance',
  dental_vision: 'Dental & Vision',
  wellness: 'Wellness',
  other: 'Other',
};

export const BENEFIT_PLAN_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  inactive: 'Inactive',
};

export const OPEN_ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  open: 'Open Enrollment',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export const DEPENDENT_RELATIONSHIP_LABELS: Record<
  BenefitDependentRelationship,
  string
> = {
  spouse: 'Spouse',
  child: 'Child',
  parent: 'Parent',
  domestic_partner: 'Domestic Partner',
  other: 'Other',
};

export interface CreateBenefitEnrollmentInput {
  employeeId: string;
  benefitPlanId: string;
  openEnrollmentPeriodId?: string;
  enrollmentType: BenefitEnrollmentType;
  effectiveFrom: string;
  effectiveTo?: string;
  employeeContributionAmount?: number;
  beneficiarySharePercent?: number;
  notes?: string;
  dependents?: Array<{
    fullName: string;
    relationship: BenefitDependentRelationship;
    dateOfBirth?: string;
    beneficiarySharePercent?: number;
  }>;
}

export function getBenefitsSummary(
  companyId: string,
): Promise<BenefitAdminSummary> {
  return tenantApiRequest<BenefitAdminSummary>(
    `/companies/${companyId}/benefits/summary`,
  );
}

export function listBenefitPlans(
  companyId: string,
): Promise<BenefitPlanRecord[]> {
  return tenantApiRequest<BenefitPlanRecord[]>(
    `/companies/${companyId}/benefit-plans`,
  );
}

export function listBenefitOpenEnrollments(
  companyId: string,
): Promise<BenefitOpenEnrollmentPeriodRecord[]> {
  return tenantApiRequest<BenefitOpenEnrollmentPeriodRecord[]>(
    `/companies/${companyId}/benefit-open-enrollments`,
  );
}

export function listBenefitEnrollments(
  companyId: string,
  query?: { employeeId?: string; benefitPlanId?: string },
): Promise<BenefitEnrollmentRecord[]> {
  const params = new URLSearchParams();
  if (query?.employeeId) params.set('employeeId', query.employeeId);
  if (query?.benefitPlanId) params.set('benefitPlanId', query.benefitPlanId);
  const qs = params.toString();
  return tenantApiRequest<BenefitEnrollmentRecord[]>(
    `/companies/${companyId}/benefit-enrollments${qs ? `?${qs}` : ''}`,
  );
}

export function createBenefitEnrollment(
  companyId: string,
  input: CreateBenefitEnrollmentInput,
): Promise<BenefitEnrollmentRecord> {
  return tenantApiRequest<BenefitEnrollmentRecord>(
    `/companies/${companyId}/benefit-enrollments`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function addBenefitEnrollmentDependent(
  enrollmentId: string,
  input: {
    fullName: string;
    relationship: BenefitDependentRelationship;
    dateOfBirth?: string;
    beneficiarySharePercent?: number;
  },
): Promise<BenefitEnrollmentRecord> {
  return tenantApiRequest<BenefitEnrollmentRecord>(
    `/benefit-enrollments/${enrollmentId}/dependents`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}
