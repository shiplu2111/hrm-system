import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function parseDateOnly(value: string, field: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `Invalid date for ${field}`,
    });
  }
  return parsed;
}

/** UTC midnight of `now`, for comparing against date-only columns. */
export function todayDateOnly(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function decimalToNumber(value: Decimal | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  return value.toNumber();
}

export function toDecimal(value: number | undefined | null): Decimal | undefined {
  if (value == null) {
    return undefined;
  }
  return new Decimal(value);
}

export const RELATIONSHIP_LABELS: Record<string, string> = {
  spouse: 'spouse',
  child: 'child',
  parent: 'parent',
  domestic_partner: 'domestic partner',
  other: 'other',
};

const PARTNER_RELATIONSHIPS = new Set(['spouse', 'domestic_partner']);

export interface PlanDependentRules {
  name: string;
  category: string;
  allowsDependents: boolean;
  maxDependents: number | null;
  eligibleRelationships: string[];
}

export interface DependentInput {
  fullName: string;
  relationship: string;
  dateOfBirth?: string | Date | null;
  beneficiarySharePercent?: number | null;
}

export function isLifeInsurance(category: string): boolean {
  return category === 'life_insurance';
}

function dependentNoun(category: string, plural = false): string {
  if (isLifeInsurance(category)) return plural ? 'beneficiaries' : 'beneficiary';
  return plural ? 'dependents' : 'dependent';
}

function invalid(message: string): never {
  throw new BadRequestException({ code: 'VALIDATION_ERROR', message });
}

/**
 * Check dependents being added to an enrollment against the plan's coverage rules.
 * `existing` are the enrollment's active dependents (empty for a new enrollment).
 * For life insurance plans the dependents are beneficiaries and each needs a share;
 * shares across the enrollment may not exceed 100%.
 */
export function validateDependents(
  plan: PlanDependentRules,
  existing: DependentInput[],
  added: DependentInput[],
  today: Date = todayDateOnly(),
): void {
  if (added.length === 0) return;

  const life = isLifeInsurance(plan.category);
  const noun = dependentNoun(plan.category);
  const nouns = dependentNoun(plan.category, true);

  if (!plan.allowsDependents) {
    invalid(`${plan.name} does not cover ${nouns}`);
  }

  const all = [...existing, ...added];

  if (plan.maxDependents != null && all.length > plan.maxDependents) {
    invalid(
      `${plan.name} covers at most ${plan.maxDependents} ${
        plan.maxDependents === 1 ? noun : nouns
      }`,
    );
  }

  if (plan.eligibleRelationships.length) {
    const ineligible = added.find(
      (dep) => !plan.eligibleRelationships.includes(dep.relationship),
    );
    if (ineligible) {
      const allowed = plan.eligibleRelationships
        .map((rel) => RELATIONSHIP_LABELS[rel] ?? rel)
        .join(', ');
      invalid(
        `${plan.name} only covers these relationships: ${allowed}. ${ineligible.fullName} is listed as ${
          RELATIONSHIP_LABELS[ineligible.relationship] ?? ineligible.relationship
        }.`,
      );
    }
  }

  if (!life && all.filter((dep) => PARTNER_RELATIONSHIPS.has(dep.relationship)).length > 1) {
    invalid('Only one spouse or domestic partner can be covered');
  }

  const seen = new Set<string>();
  for (const dep of all) {
    const key = dep.fullName.trim().toLowerCase();
    if (seen.has(key)) {
      invalid(`${dep.fullName.trim()} is already listed on this enrollment`);
    }
    seen.add(key);
  }

  for (const dep of added) {
    if (dep.dateOfBirth) {
      const dob =
        dep.dateOfBirth instanceof Date
          ? dep.dateOfBirth
          : parseDateOnly(dep.dateOfBirth, 'dateOfBirth');
      if (dob > today) {
        invalid(`${dep.fullName.trim()}'s date of birth cannot be in the future`);
      }
    }

    if (life && dep.beneficiarySharePercent == null) {
      invalid(`Enter ${dep.fullName.trim()}'s share of the life insurance payout`);
    }
    if (!life && dep.beneficiarySharePercent != null) {
      invalid('Beneficiary shares only apply to life insurance plans');
    }
  }

  if (life) {
    const total = all.reduce(
      (sum, dep) => sum + (dep.beneficiarySharePercent ?? 0),
      0,
    );
    if (Math.round(total * 100) > 100 * 100) {
      invalid(
        `Beneficiary shares add up to ${Math.round(total * 100) / 100}%; the total cannot exceed 100%`,
      );
    }
  }
}

/**
 * Whether existing active enrollments still fit after a plan's dependent rules change.
 * Returns a message describing the first conflict, or null.
 */
export function findDependentRuleConflict(
  plan: PlanDependentRules,
  enrollments: DependentInput[][],
): string | null {
  const nouns = dependentNoun(plan.category, true);
  const withDependents = enrollments.filter((deps) => deps.length > 0);

  if (!plan.allowsDependents && withDependents.length) {
    return `${withDependents.length} active ${
      withDependents.length === 1 ? 'enrollment covers' : 'enrollments cover'
    } ${nouns}. Remove them before turning off ${nouns}.`;
  }

  if (plan.maxDependents != null) {
    const over = enrollments.filter((deps) => deps.length > plan.maxDependents!);
    if (over.length) {
      const most = Math.max(...over.map((deps) => deps.length));
      return `${over.length} active ${
        over.length === 1 ? 'enrollment covers' : 'enrollments cover'
      } more than ${plan.maxDependents} ${nouns} (up to ${most}).`;
    }
  }

  if (plan.eligibleRelationships.length) {
    const used = new Set(
      enrollments.flat().map((dep) => dep.relationship),
    );
    const removed = [...used].filter(
      (rel) => !plan.eligibleRelationships.includes(rel),
    );
    if (removed.length) {
      return `Active enrollments still cover ${removed
        .map((rel) => RELATIONSHIP_LABELS[rel] ?? rel)
        .join(', ')} ${nouns}.`;
    }
  }

  return null;
}

export function isWithinWindow(
  startDate: Date,
  endDate: Date,
  today: Date = todayDateOnly(),
): boolean {
  return today >= startDate && today <= endDate;
}

export function monthlyEmployeeCost(
  enrollmentContribution: number | null,
  dependentContribution: number | null,
  activeDependentCount: number,
): number {
  const base = enrollmentContribution ?? 0;
  const perDependent = dependentContribution ?? 0;
  return Math.round((base + perDependent * activeDependentCount) * 100) / 100;
}
