/** SECURITY.md §2 — mask sensitive values for list/API views (e.g. ****1234). */

export function maskSensitiveValue(
  value: string | null | undefined,
  visibleTail = 4,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= visibleTail) {
    return '*'.repeat(trimmed.length);
  }
  const maskedLength = Math.max(4, trimmed.length - visibleTail);
  return `${'*'.repeat(maskedLength)}${trimmed.slice(-visibleTail)}`;
}

export function isEncryptedFieldPayload(value: string): boolean {
  if (!value.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(value) as { v?: number };
    return parsed.v === 1;
  } catch {
    return false;
  }
}
