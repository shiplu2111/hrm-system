export const HR_CASE_RESTRICTED_PLACEHOLDER =
  '[Restricted — reveal required to view confidential content]';

export function generateCaseNumber(
  countForYear: number,
  year = new Date().getUTCFullYear(),
): string {
  const sequence = String(countForYear + 1).padStart(3, '0');
  return `ER-${year}-${sequence}`;
}

export function startOfUtcQuarter(date: Date): Date {
  const month = date.getUTCMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1));
}
