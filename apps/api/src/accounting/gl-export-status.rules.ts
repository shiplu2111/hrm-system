import type {
  AccountingSyncJobStatus,
  GlExportOutcome,
  GlExportStatusRecord,
  GlExportStatusSummary,
  PayrollJournalExportStatus,
} from '@hrm/shared-types';

export type GlExportOutcomeFilter = GlExportOutcome | 'needs_attention';

/** A sync job, when present, is the source of truth: the export row is one attempt inside it. */
export function deriveExportOutcome(input: {
  exportStatus: PayrollJournalExportStatus | null;
  syncStatus: AccountingSyncJobStatus | null;
}): GlExportOutcome {
  const { exportStatus, syncStatus } = input;
  if (syncStatus === 'queued' || syncStatus === 'processing') return 'in_progress';
  if (syncStatus === 'failed') return 'failed';
  if (syncStatus === 'completed') {
    return exportStatus === 'failed' ? 'failed' : 'succeeded';
  }
  if (exportStatus === 'completed') return 'succeeded';
  if (exportStatus === 'failed') return 'failed';
  return 'in_progress';
}

export type GlExportDraftRow = Omit<
  GlExportStatusRecord,
  'superseded' | 'canRetrySync' | 'canDownloadCsv'
>;

function groupKey(row: GlExportDraftRow): string {
  const subject = row.payrollPeriodId ?? row.contractorPaymentBatchId ?? row.id;
  return `${row.kind}:${subject}:${row.destination}`;
}

/** Newest first; older rows for the same period/batch and destination are superseded. */
export function finalizeExportRows(
  drafts: GlExportDraftRow[],
  queueAvailable: boolean,
): GlExportStatusRecord[] {
  const sorted = [...drafts].sort(
    (a, b) => b.startedAt.localeCompare(a.startedAt) || a.id.localeCompare(b.id),
  );
  const seenGroups = new Set<string>();

  return sorted.map((row) => {
    const key = groupKey(row);
    const superseded = seenGroups.has(key);
    seenGroups.add(key);
    return {
      ...row,
      superseded,
      canRetrySync:
        queueAvailable &&
        !superseded &&
        row.destination !== 'csv' &&
        row.kind === 'payroll' &&
        row.syncJobId != null &&
        row.outcome === 'failed',
      canDownloadCsv: row.exportId != null && row.outcome === 'succeeded',
    };
  });
}

export function summarizeExportRows(
  rows: GlExportStatusRecord[],
  queueAvailable: boolean,
): GlExportStatusSummary {
  let succeeded = 0;
  let failed = 0;
  let inProgress = 0;
  let needsAttention = 0;
  let lastSucceededAt: string | null = null;

  for (const row of rows) {
    if (row.outcome === 'succeeded') {
      succeeded += 1;
      const at = row.finishedAt ?? row.startedAt;
      if (!lastSucceededAt || at > lastSucceededAt) lastSucceededAt = at;
    } else if (row.outcome === 'failed') {
      failed += 1;
      if (!row.superseded) needsAttention += 1;
    } else {
      inProgress += 1;
    }
  }

  return {
    total: rows.length,
    succeeded,
    failed,
    inProgress,
    needsAttention,
    lastSucceededAt,
    queueAvailable,
  };
}

export function matchesOutcomeFilter(
  row: GlExportStatusRecord,
  filter: GlExportOutcomeFilter | undefined,
): boolean {
  if (!filter) return true;
  if (filter === 'needs_attention') return row.outcome === 'failed' && !row.superseded;
  return row.outcome === filter;
}

export function journalReferenceForPeriodEnd(endDate: Date): string {
  const year = endDate.getUTCFullYear();
  const month = String(endDate.getUTCMonth() + 1).padStart(2, '0');
  return `JE-${year}-${month}`;
}
