export const ORG_NAME_MAX = 100;
export const ORG_CODE_MAX = 20;

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;

interface Named {
  id: string;
  name: string;
}

interface Coded {
  id: string;
  code: string;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Required, length-limited, and unique (case-insensitive) among `existing`. */
export function validateOrgName(
  value: string,
  label: string,
  existing: Named[] = [],
  currentId?: string | null,
  scopeLabel?: string,
): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required.`;
  if (trimmed.length > ORG_NAME_MAX) return `${label} must be ${ORG_NAME_MAX} characters or fewer.`;
  const clash = existing.find(
    (row) => row.id !== currentId && normalize(row.name) === normalize(trimmed),
  );
  if (clash) {
    return scopeLabel
      ? `"${clash.name}" already exists ${scopeLabel}.`
      : `"${clash.name}" already exists.`;
  }
  return undefined;
}

/** Codes are stored upper-case by the API; uniqueness is per company. */
export function validateOrgCode(
  value: string,
  label: string,
  existing: Coded[] = [],
  currentId?: string | null,
): string | undefined {
  const code = value.trim().toUpperCase();
  if (!code) return `${label} is required.`;
  if (code.length > ORG_CODE_MAX) return `${label} must be ${ORG_CODE_MAX} characters or fewer.`;
  if (!CODE_PATTERN.test(code)) {
    return `${label} can only contain letters, numbers, hyphens and underscores.`;
  }
  const clash = existing.find((row) => row.id !== currentId && row.code.toUpperCase() === code);
  if (clash) return `${label} ${code} is already in use.`;
  return undefined;
}

export function validatePositiveInt(value: string, label: string): string | undefined {
  if (!value.trim()) return `${label} is required.`;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return `${label} must be a whole number of 1 or more.`;
  return undefined;
}
