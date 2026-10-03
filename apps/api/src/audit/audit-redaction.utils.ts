import { maskSensitiveValue } from '../crypto/sensitive-field.utils';

export const REDACTED = '[redacted]';
const MAX_DEPTH = 8;

/** Keys whose string values are never shown, even to audit viewers. */
function isSecretKey(normalized: string): boolean {
  return (
    normalized.includes('password') ||
    normalized.includes('secret') ||
    normalized.includes('token') ||
    normalized.endsWith('encrypted') ||
    normalized.endsWith('apikey') ||
    normalized.endsWith('privatekey')
  );
}

/** Identifiers shown masked to the last four characters — SECURITY.md §2. */
const MASKED_KEYS: ReadonlySet<string> = new Set([
  'bankaccountnumber',
  'accountnumber',
  'iban',
  'taxid',
  'tin',
  'tfn',
  'taxfilenumber',
  'nationalid',
  'nid',
  'nidnumber',
  'passportnumber',
  'ssn',
  'socialsecuritynumber',
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function redactValue(key: string | null, value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;

  if (key !== null && (typeof value === 'string' || typeof value === 'number')) {
    const normalized = normalizeKey(key);
    if (isSecretKey(normalized)) return REDACTED;
    if (MASKED_KEYS.has(normalized)) return maskSensitiveValue(String(value));
    return value;
  }

  if (depth >= MAX_DEPTH) return Array.isArray(value) || typeof value === 'object' ? REDACTED : value;

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(key, item, depth + 1));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, redactValue(k, v, depth + 1)]),
    );
  }

  return value;
}

/**
 * Strips secrets and masks identifiers in stored audit values before they are returned.
 * AUDIT_LOG.md §3 asks writers not to store them; this keeps older or careless writes from leaking.
 */
export function redactAuditValue(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { value: redactValue(null, value, 0) };
  }
  return redactValue(null, value, 0) as Record<string, unknown>;
}
