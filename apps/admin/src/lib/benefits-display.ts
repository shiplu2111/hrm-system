import type {
  BenefitDependentRelationship,
  BenefitEnrollmentRecord,
  BenefitPlanCategory,
  BenefitPlanRecord,
} from '@hrm/shared-types';
import { DEPENDENT_RELATIONSHIP_LABELS } from './benefits-api';
import { formatMoney } from './payroll-copy';

export const RELATIONSHIP_ORDER: BenefitDependentRelationship[] = [
  'spouse',
  'domestic_partner',
  'child',
  'parent',
  'other',
];

export function isLifePlan(plan: { category?: BenefitPlanCategory }): boolean {
  return plan.category === 'life_insurance';
}

/** Life insurance "dependents" are the beneficiaries who receive the payout. */
export function dependentNoun(plan: { category?: BenefitPlanCategory }, plural = false): string {
  if (isLifePlan(plan)) return plural ? 'beneficiaries' : 'beneficiary';
  return plural ? 'dependents' : 'dependent';
}

export function relationshipList(relationships: BenefitDependentRelationship[]): string {
  return RELATIONSHIP_ORDER.filter((r) => relationships.includes(r))
    .map((r) => DEPENDENT_RELATIONSHIP_LABELS[r].toLowerCase())
    .join(', ');
}

export function dependentRuleSummary(plan: BenefitPlanRecord): string {
  if (!plan.allowsDependents) {
    return isLifePlan(plan) ? 'No beneficiaries' : 'Employee only';
  }
  const noun = dependentNoun(plan, true);
  const limit = plan.maxDependents != null ? `Up to ${plan.maxDependents} ${noun}` : `Any number of ${noun}`;
  const who = plan.eligibleRelationships.length ? ` (${relationshipList(plan.eligibleRelationships)})` : '';
  return `${limit}${who}`;
}

export function employerCostText(plan: BenefitPlanRecord): string {
  if (plan.employerContributionAmount == null) return plan.employerContributionLabel ?? '—';
  return formatMoney(plan.employerContributionAmount);
}

export function relationshipAllowed(
  plan: Pick<BenefitPlanRecord, 'eligibleRelationships'>,
  relationship: BenefitDependentRelationship,
): boolean {
  return plan.eligibleRelationships.length === 0 || plan.eligibleRelationships.includes(relationship);
}

export function activeDependents(enrollment: BenefitEnrollmentRecord) {
  return enrollment.dependents.filter((d) => d.status === 'active');
}

export function beneficiaryShareTotal(dependents: Array<{ beneficiarySharePercent: number | null }>): number {
  return Math.round(dependents.reduce((sum, d) => sum + (d.beneficiarySharePercent ?? 0), 0) * 100) / 100;
}

/** Maps free-text relationships recorded on the employee profile to a benefit relationship. */
export function matchRelationship(text: string | undefined): BenefitDependentRelationship | null {
  const value = (text ?? '').trim().toLowerCase();
  if (!value) return null;
  if (['spouse', 'wife', 'husband'].includes(value)) return 'spouse';
  if (['partner', 'domestic partner', 'de facto', 'de facto partner'].includes(value)) return 'domestic_partner';
  if (['child', 'son', 'daughter', 'stepchild', 'step child'].includes(value)) return 'child';
  if (['parent', 'mother', 'father'].includes(value)) return 'parent';
  return 'other';
}
