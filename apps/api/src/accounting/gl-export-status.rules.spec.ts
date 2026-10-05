import {
  deriveExportOutcome,
  finalizeExportRows,
  journalReferenceForPeriodEnd,
  matchesOutcomeFilter,
  summarizeExportRows,
  type GlExportDraftRow,
} from './gl-export-status.rules';
import {
  costCentreAccountError,
  costCentreSourceKey,
  parseCostCentreSourceKey,
} from './gl-mapping.rules';

function draft(overrides: Partial<GlExportDraftRow>): GlExportDraftRow {
  return {
    id: 'payroll:1',
    kind: 'payroll',
    destination: 'csv',
    outcome: 'succeeded',
    exportId: '1',
    syncJobId: null,
    referenceNumber: 'JE-2026-09',
    subjectLabel: '2026-09-01 – 2026-09-30',
    payrollPeriodId: 'period-sep',
    contractorPaymentBatchId: null,
    totalDebit: '100.00',
    totalCredit: '100.00',
    lineCount: 2,
    unmappedCount: 0,
    errorMessage: null,
    externalReferenceId: null,
    exportedByName: 'Admin',
    automatic: false,
    syncAttempts: null,
    startedAt: '2026-10-01T00:00:00.000Z',
    finishedAt: '2026-10-01T00:00:01.000Z',
    ...overrides,
  };
}

describe('gl-export-status.rules', () => {
  describe('deriveExportOutcome', () => {
    it('lets the sync job decide when one is linked', () => {
      expect(deriveExportOutcome({ exportStatus: 'failed', syncStatus: 'queued' })).toBe(
        'in_progress',
      );
      expect(deriveExportOutcome({ exportStatus: 'completed', syncStatus: 'failed' })).toBe(
        'failed',
      );
      expect(deriveExportOutcome({ exportStatus: 'completed', syncStatus: 'completed' })).toBe(
        'succeeded',
      );
      expect(deriveExportOutcome({ exportStatus: 'failed', syncStatus: 'completed' })).toBe(
        'failed',
      );
    });

    it('falls back to the export status for CSV exports', () => {
      expect(deriveExportOutcome({ exportStatus: 'completed', syncStatus: null })).toBe(
        'succeeded',
      );
      expect(deriveExportOutcome({ exportStatus: 'failed', syncStatus: null })).toBe('failed');
      expect(deriveExportOutcome({ exportStatus: 'pending', syncStatus: null })).toBe(
        'in_progress',
      );
    });
  });

  describe('finalizeExportRows', () => {
    it('marks older exports for the same period and destination as superseded', () => {
      const rows = finalizeExportRows(
        [
          draft({ id: 'payroll:old', outcome: 'failed', startedAt: '2026-10-01T00:00:00.000Z' }),
          draft({ id: 'payroll:new', startedAt: '2026-10-02T00:00:00.000Z' }),
          draft({
            id: 'payroll:xero',
            destination: 'xero',
            outcome: 'failed',
            syncJobId: 'job-1',
            startedAt: '2026-09-30T00:00:00.000Z',
          }),
        ],
        true,
      );

      expect(rows.map((row) => [row.id, row.superseded])).toEqual([
        ['payroll:new', false],
        ['payroll:old', true],
        ['payroll:xero', false],
      ]);
    });

    it('offers retry only for the latest failed sync when the queue is running', () => {
      const failedSync = draft({
        id: 'sync:job-1',
        destination: 'xero',
        outcome: 'failed',
        exportId: null,
        syncJobId: 'job-1',
      });
      expect(finalizeExportRows([failedSync], true)[0].canRetrySync).toBe(true);
      expect(finalizeExportRows([failedSync], false)[0].canRetrySync).toBe(false);
      expect(
        finalizeExportRows([draft({ outcome: 'failed' })], true)[0].canRetrySync,
      ).toBe(false);
    });

    it('allows CSV download only for successful exports with a stored journal', () => {
      const [ok, failed, syncOnly] = finalizeExportRows(
        [
          draft({ id: 'payroll:a', payrollPeriodId: 'p1', startedAt: '2026-10-03T00:00:00.000Z' }),
          draft({
            id: 'payroll:b',
            payrollPeriodId: 'p2',
            outcome: 'failed',
            startedAt: '2026-10-02T00:00:00.000Z',
          }),
          draft({
            id: 'sync:c',
            payrollPeriodId: 'p3',
            exportId: null,
            destination: 'xero',
            startedAt: '2026-10-01T00:00:00.000Z',
          }),
        ],
        true,
      );
      expect([ok.canDownloadCsv, failed.canDownloadCsv, syncOnly.canDownloadCsv]).toEqual([
        true,
        false,
        false,
      ]);
    });
  });

  it('summarizes outcomes and counts only current failures as needing attention', () => {
    const rows = finalizeExportRows(
      [
        draft({ id: 'payroll:1', outcome: 'failed', startedAt: '2026-10-01T00:00:00.000Z' }),
        draft({
          id: 'payroll:2',
          outcome: 'succeeded',
          startedAt: '2026-10-02T00:00:00.000Z',
          finishedAt: '2026-10-02T00:00:05.000Z',
        }),
        draft({
          id: 'payroll:3',
          payrollPeriodId: 'period-oct',
          outcome: 'failed',
          startedAt: '2026-10-03T00:00:00.000Z',
        }),
        draft({
          id: 'sync:4',
          payrollPeriodId: 'period-nov',
          destination: 'xero',
          outcome: 'in_progress',
          startedAt: '2026-10-04T00:00:00.000Z',
        }),
      ],
      false,
    );
    const summary = summarizeExportRows(rows, false);

    expect(summary).toEqual({
      total: 4,
      succeeded: 1,
      failed: 2,
      inProgress: 1,
      needsAttention: 1,
      lastSucceededAt: '2026-10-02T00:00:05.000Z',
      queueAvailable: false,
    });
    expect(rows.filter((row) => matchesOutcomeFilter(row, 'needs_attention')).map((row) => row.id)).toEqual([
      'payroll:3',
    ]);
  });

  it('builds the journal reference from the period end month', () => {
    expect(journalReferenceForPeriodEnd(new Date('2026-09-30T00:00:00.000Z'))).toBe('JE-2026-09');
  });
});

describe('gl-mapping.rules', () => {
  it('parses and normalizes cost-centre source keys', () => {
    expect(parseCostCentreSourceKey('default')).toEqual({ kind: 'default' });
    expect(parseCostCentreSourceKey('system:employer_superannuation_expense')).toEqual({
      kind: 'employer_super',
    });
    const source = parseCostCentreSourceKey('component:ABCDEF00-0000-4000-8000-000000000001');
    expect(source).toEqual({
      kind: 'component',
      payComponentId: 'abcdef00-0000-4000-8000-000000000001',
    });
    expect(costCentreSourceKey(source!)).toBe('component:abcdef00-0000-4000-8000-000000000001');
    expect(parseCostCentreSourceKey('system:net_pay_salary_payable')).toBeNull();
  });

  it('only accepts active expense accounts for cost-centre overrides', () => {
    const account = { code: '6100', name: 'Sales Wages', accountType: 'expense' as const, isActive: true };
    expect(costCentreAccountError(account)).toBeNull();
    expect(costCentreAccountError({ ...account, isActive: false })).toMatch(/inactive/);
    expect(costCentreAccountError({ ...account, accountType: 'liability' })).toMatch(
      /must post to an expense account/,
    );
  });
});
