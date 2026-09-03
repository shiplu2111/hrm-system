/** Normalize to UTC midnight for date-only effective-dated comparisons (RULES.md §4). */
export function normalizeToDateOnly(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

export function isEffectiveOn(
  effectiveFrom: Date,
  effectiveTo: Date | null | undefined,
  calculationDate: Date,
): boolean {
  const date = normalizeToDateOnly(calculationDate);
  const from = normalizeToDateOnly(effectiveFrom);

  if (date < from) {
    return false;
  }

  if (effectiveTo == null) {
    return true;
  }

  const to = normalizeToDateOnly(effectiveTo);
  return date <= to;
}

export interface EffectiveDated {
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

/**
 * Pick the rule version active on `calculationDate`.
 * When multiple versions overlap, the one with the latest `effectiveFrom` wins.
 */
export function selectEffectiveRule<T extends EffectiveDated>(
  rules: T[],
  calculationDate: Date,
): T | null {
  const matching = rules.filter((rule) =>
    isEffectiveOn(rule.effectiveFrom, rule.effectiveTo, calculationDate),
  );

  if (matching.length === 0) {
    return null;
  }

  if (matching.length === 1) {
    return matching[0];
  }

  return matching.sort(
    (left, right) =>
      right.effectiveFrom.getTime() - left.effectiveFrom.getTime(),
  )[0];
}

export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
