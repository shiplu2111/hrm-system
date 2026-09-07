import type { HrCase } from '@prisma/client';

const SENSITIVE_KEYS = new Set([
  'details',
  'detailsEncrypted',
  'resolutionNotes',
  'resolutionNotesEncrypted',
  'content',
  'contentEncrypted',
]);

/** AUDIT_LOG.md §3 — never log raw sensitive values in audit payloads. */
export function auditSnapshotForCase(row: HrCase): Record<string, unknown> {
  return {
    caseNumber: row.caseNumber,
    title: row.title,
    caseType: row.caseType,
    status: row.status,
    priority: row.priority,
    outcome: row.outcome,
    subjectEmployeeId: row.subjectEmployeeId,
    reportingEmployeeId: row.reportingEmployeeId,
    assignedOfficerEmployeeId: row.assignedOfficerEmployeeId,
    isRestricted: row.isRestricted,
    hasDetails: Boolean(row.detailsEncrypted),
    hasResolutionNotes: Boolean(row.resolutionNotesEncrypted),
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}

export function sanitizeAuditPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_KEYS.has(key)) {
      sanitized[key] = value ? '[encrypted]' : null;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
