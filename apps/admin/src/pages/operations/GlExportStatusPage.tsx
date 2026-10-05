import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  BookOpen,
  CheckCircle2,
  Clock3,
  Eye,
  FileSpreadsheet,
  Info,
  Loader2,
  RefreshCw,
  RotateCw,
  Settings2,
  XCircle,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import type {
  GlExportKind,
  GlExportStatusDetail,
  GlExportStatusList,
  GlExportStatusRecord,
} from '@hrm/shared-types';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { StatusPill } from '@/components/ui/StatusPill';
import { SummaryTile } from '@/components/ui/SummaryTile';
import { pathForPage } from '@/config/routes';
import {
  downloadCsv,
  exportPayrollJournal,
  getGlExport,
  listGlExports,
  retryAccountingSyncJob,
  type GlExportOutcomeFilter,
} from '@/lib/accounting-api';
import {
  GL_DESTINATION_LABELS,
  exportOutcomeDisplay,
  exportedByText,
  formatDateTime,
} from '@/lib/accounting-display';
import { formatMoney } from '@/lib/payroll-copy';
import { ApiError } from '@/lib/tenant-api-client';

const thClass = 'text-left px-4 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider';
const POLL_MS = 10_000;

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

const OUTCOME_TABS: Array<{ id: GlExportOutcomeFilter | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'needs_attention', label: 'Needs attention' },
  { id: 'failed', label: 'Failed' },
  { id: 'succeeded', label: 'Succeeded' },
  { id: 'in_progress', label: 'In progress' },
];

function ExportsContent({ companyId }: { companyId: string }) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canRetry = can('payroll', 'edit');
  const canExport = can('payroll', 'create');

  const [data, setData] = useState<GlExportStatusList | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<GlExportOutcomeFilter | 'all'>('all');
  const [kind, setKind] = useState<GlExportKind | 'all'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<GlExportStatusRecord | null>(null);
  const [detail, setDetail] = useState<GlExportStatusDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await listGlExports(companyId, {
        outcome: outcome === 'all' ? undefined : outcome,
        kind: kind === 'all' ? undefined : kind,
        page,
        pageSize,
      });
      setData(result);
      setError(null);
    } catch (err) {
      setError(errorText(err, 'Failed to load GL exports'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, outcome, kind, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const inProgress = data?.summary.inProgress ?? 0;
  useEffect(() => {
    if (inProgress === 0) return;
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [inProgress, load]);

  const applyOutcome = (next: GlExportOutcomeFilter | 'all') => {
    setOutcome(next);
    setPage(1);
  };

  const openDetail = async (row: GlExportStatusRecord) => {
    setDetailRow(row);
    setDetail(null);
    setDetailError(null);
    if (!row.exportId) return;
    setDetailLoading(true);
    try {
      setDetail(await getGlExport(companyId, row.kind, row.exportId));
    } catch (err) {
      setDetailError(errorText(err, 'Could not load the journal'));
    } finally {
      setDetailLoading(false);
    }
  };

  const download = async (row: GlExportStatusRecord) => {
    if (!row.exportId) return;
    setBusyRowId(row.id);
    setError(null);
    try {
      const full =
        detail?.id === row.id && detail.csvContent
          ? detail
          : await getGlExport(companyId, row.kind, row.exportId);
      if (full.csvContent) {
        downloadCsv(`${row.referenceNumber}.csv`, full.csvContent);
      } else {
        setError('This export has no CSV file to download.');
      }
    } catch (err) {
      setError(errorText(err, 'Could not download the CSV'));
    } finally {
      setBusyRowId(null);
    }
  };

  const retry = async (row: GlExportStatusRecord) => {
    if (!row.syncJobId) return;
    setBusyRowId(row.id);
    setError(null);
    setNotice(null);
    try {
      await retryAccountingSyncJob(companyId, row.syncJobId);
      setNotice(
        `The ${GL_DESTINATION_LABELS[row.destination]} sync for ${row.subjectLabel} is queued again. This page refreshes while it runs.`,
      );
      await load();
    } catch (err) {
      setError(errorText(err, 'Could not retry the sync'));
    } finally {
      setBusyRowId(null);
    }
  };

  const exportAgain = async (row: GlExportStatusRecord) => {
    if (!row.payrollPeriodId) return;
    setBusyRowId(row.id);
    setError(null);
    setNotice(null);
    try {
      const result = await exportPayrollJournal(companyId, row.payrollPeriodId);
      if (result.status === 'completed' && result.csvContent) {
        downloadCsv(`${result.referenceNumber}.csv`, result.csvContent);
        setNotice(`${result.referenceNumber} for ${row.subjectLabel} exported and downloaded.`);
      } else {
        setError(
          `The export for ${row.subjectLabel} failed again: ${result.errorMessage ?? 'unknown problem'}`,
        );
      }
      setPage(1);
      await load();
    } catch (err) {
      setError(errorText(err, 'Could not export the journal'));
    } finally {
      setBusyRowId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading GL exports…
      </div>
    );
  }

  const summary = data?.summary;
  const rows = data?.items ?? [];

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-primary">GL Export &amp; Sync Status</h1>
          <p className="text-sm text-secondary mt-0.5">
            Every journal export and accounting sync, and whether it worked. Payroll stays finalized when an export
            fails; fix the cause, then export again or retry the sync.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:shrink-0 xl:flex-nowrap">
          <Button
            variant="secondary"
            onClick={() => {
              setRefreshing(true);
              void load();
            }}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="secondary" onClick={() => navigate(pathForPage('accounting-mapping'))}>
            <BookOpen className="h-4 w-4" /> Account mapping
          </Button>
          <Button variant="secondary" onClick={() => navigate(pathForPage('accounting'))}>
            <Settings2 className="h-4 w-4" /> Journal preview &amp; connections
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-lg border border-success-200 bg-success-50 dark:bg-success-950/30 px-4 py-3 text-sm text-success-700 dark:text-success-300">
          {notice}
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryTile
            icon={<AlertTriangle className="h-5 w-5" />}
            tone={summary.needsAttention > 0 ? 'error' : 'neutral'}
            value={String(summary.needsAttention)}
            label="Need attention"
            hint="Latest export for a period or batch failed"
            onClick={() => applyOutcome('needs_attention')}
          />
          <SummaryTile
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="success"
            value={String(summary.succeeded)}
            label="Succeeded"
            hint={
              summary.lastSucceededAt
                ? `Last on ${formatDateTime(summary.lastSucceededAt)}`
                : 'No successful exports yet'
            }
            onClick={() => applyOutcome('succeeded')}
          />
          <SummaryTile
            icon={<XCircle className="h-5 w-5" />}
            tone={summary.failed > 0 ? 'warning' : 'neutral'}
            value={String(summary.failed)}
            label="Failed"
            hint="Including attempts replaced by a later export"
            onClick={() => applyOutcome('failed')}
          />
          <SummaryTile
            icon={<Clock3 className="h-5 w-5" />}
            tone="accent"
            value={String(summary.inProgress)}
            label="In progress"
            hint={summary.inProgress > 0 ? 'Refreshing every 10 seconds' : 'Nothing queued'}
            onClick={() => applyOutcome('in_progress')}
          />
        </div>
      ) : null}

      {summary && summary.needsAttention > 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-800 dark:border-error-900 dark:bg-error-950/30 dark:text-error-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {summary.needsAttention} export{summary.needsAttention === 1 ? '' : 's'} did not reach the accounting
            system. The reason is shown on each row.
            {outcome !== 'needs_attention' ? (
              <button
                type="button"
                className="ml-2 font-medium underline"
                onClick={() => applyOutcome('needs_attention')}
              >
                Show them
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {summary && !summary.queueAvailable ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            Background jobs are not running on the server, so automatic Xero syncs will not run and failed syncs cannot
            be retried. CSV exports still work.
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Outcome">
          {OUTCOME_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={outcome === item.id}
              onClick={() => applyOutcome(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                outcome === item.id
                  ? 'bg-accent-600 text-white'
                  : 'surface border border-base text-secondary hover:text-primary hover:border-strong'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="w-full md:w-52">
          <Select
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as GlExportKind | 'all');
              setPage(1);
            }}
            aria-label="Journal type"
          >
            <option value="all">All journals</option>
            <option value="payroll">Payroll journals</option>
            <option value="contractor">Contractor payments</option>
          </Select>
        </div>
      </div>

      <Card>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-secondary">
              {summary?.total === 0
                ? 'No journals have been exported yet. Export one from Journal preview, or connect Xero to sync automatically when payroll is finalized.'
                : 'No exports match this filter.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                    <th className={thClass}>Outcome</th>
                    <th className={thClass}>Journal</th>
                    <th className={thClass}>Destination</th>
                    <th className={`${thClass} text-right`}>Amount</th>
                    <th className={thClass}>When</th>
                    <th className={thClass}>Details</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {rows.map((row) => {
                    const status = exportOutcomeDisplay(row);
                    const busy = busyRowId === row.id;
                    const canExportAgain =
                      canExport &&
                      row.kind === 'payroll' &&
                      row.destination === 'csv' &&
                      row.outcome === 'failed' &&
                      !row.superseded &&
                      row.payrollPeriodId != null;
                    return (
                      <tr key={row.id} className={row.superseded ? 'opacity-60' : undefined}>
                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <StatusPill tone={status.tone}>{status.label}</StatusPill>
                          {row.superseded ? (
                            <div className="text-xs text-muted mt-1">Replaced by a later export</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top min-w-[200px]">
                          <button
                            type="button"
                            onClick={() => void openDetail(row)}
                            className="font-mono text-xs font-medium text-primary hover:text-accent-600"
                          >
                            {row.referenceNumber}
                          </button>
                          {row.kind === 'contractor' ? (
                            <Badge tone="neutral" className="ml-2 align-middle">
                              Contractor
                            </Badge>
                          ) : null}
                          <div className="text-xs text-secondary mt-0.5">{row.subjectLabel}</div>
                        </td>
                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <div className="text-primary">{GL_DESTINATION_LABELS[row.destination]}</div>
                          {row.syncAttempts != null ? (
                            <div className="text-xs text-muted mt-0.5">
                              {row.syncAttempts} attempt{row.syncAttempts === 1 ? '' : 's'}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                          <div className="font-mono text-primary">
                            {row.totalDebit != null ? formatMoney(row.totalDebit) : '—'}
                          </div>
                          {row.lineCount > 0 ? (
                            <div className="text-xs text-muted mt-0.5">
                              {row.lineCount} line{row.lineCount === 1 ? '' : 's'}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top min-w-[170px]">
                          <div className="text-primary">{formatDateTime(row.startedAt)}</div>
                          <div className="text-xs text-muted mt-0.5">{exportedByText(row)}</div>
                        </td>
                        <td className="px-4 py-3 align-top min-w-[220px] max-w-[360px]">
                          {row.errorMessage ? (
                            <div className="text-xs text-error-700 dark:text-error-300 line-clamp-2" title={row.errorMessage}>
                              {row.errorMessage}
                            </div>
                          ) : row.outcome === 'succeeded' ? (
                            <div className="text-xs text-secondary">
                              {row.externalReferenceId
                                ? `Posted · ${GL_DESTINATION_LABELS[row.destination]} ID ${row.externalReferenceId.slice(0, 8)}…`
                                : 'Balanced journal exported'}
                            </div>
                          ) : row.outcome === 'in_progress' ? (
                            <div className="text-xs text-secondary">Waiting for the background job</div>
                          ) : null}
                          {row.unmappedCount > 0 && !row.superseded ? (
                            <button
                              type="button"
                              className="mt-1 text-xs font-medium text-accent-600 hover:underline"
                              onClick={() => navigate(pathForPage('accounting-mapping'))}
                            >
                              Map {row.unmappedCount} line{row.unmappedCount === 1 ? '' : 's'}
                            </button>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {row.exportId ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="View journal"
                                aria-label={`View ${row.referenceNumber}`}
                                onClick={() => void openDetail(row)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {row.canDownloadCsv ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Download CSV"
                                aria-label={`Download ${row.referenceNumber} CSV`}
                                disabled={busy}
                                onClick={() => void download(row)}
                              >
                                <ArrowDownToLine className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {canRetry && row.canRetrySync ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={busy}
                                onClick={() => void retry(row)}
                              >
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                                Retry sync
                              </Button>
                            ) : null}
                            {canExportAgain ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={busy}
                                onClick={() => void exportAgain(row)}
                              >
                                {busy ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <FileSpreadsheet className="h-4 w-4" />
                                )}
                                Export again
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {data && data.total > 0 ? (
            <Pagination
              page={page}
              pageSize={pageSize}
              totalItems={data.total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          ) : null}
        </CardBody>
      </Card>

      <ExportDetailModal
        row={detailRow}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        onClose={() => setDetailRow(null)}
        onDownload={(row) => void download(row)}
        onFixMappings={() => navigate(pathForPage('accounting-mapping'))}
      />
    </div>
  );
}

function ExportDetailModal({
  row,
  detail,
  loading,
  error,
  onClose,
  onDownload,
  onFixMappings,
}: {
  row: GlExportStatusRecord | null;
  detail: GlExportStatusDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onDownload: (row: GlExportStatusRecord) => void;
  onFixMappings: () => void;
}) {
  if (!row) return null;
  const status = exportOutcomeDisplay(row);
  const showCostCentre = detail?.lines.some((line) => line.costCentreCode) ?? false;
  const meta: Array<[string, string]> = [
    [row.kind === 'payroll' ? 'Payroll period' : 'Batch', row.subjectLabel],
    ['Destination', GL_DESTINATION_LABELS[row.destination]],
    ['Started', formatDateTime(row.startedAt)],
    ['Finished', row.finishedAt ? formatDateTime(row.finishedAt) : '—'],
    ['Exported', exportedByText(row)],
    ['Posting date', detail?.postingDate ?? '—'],
  ];
  if (row.syncAttempts != null) meta.push(['Sync attempts', String(row.syncAttempts)]);
  if (row.externalReferenceId) meta.push([`${GL_DESTINATION_LABELS[row.destination]} reference`, row.externalReferenceId]);

  return (
    <Modal
      open
      size="xl"
      onClose={onClose}
      title={row.referenceNumber}
      description={`${row.kind === 'payroll' ? 'Payroll journal' : 'Contractor payment journal'} · ${GL_DESTINATION_LABELS[row.destination]}`}
      footer={
        <>
          {row.unmappedCount > 0 ? (
            <Button variant="secondary" onClick={onFixMappings}>
              <BookOpen className="h-4 w-4" /> Fix mappings
            </Button>
          ) : null}
          {row.canDownloadCsv ? (
            <Button variant="secondary" onClick={() => onDownload(row)}>
              <ArrowDownToLine className="h-4 w-4" /> Download CSV
            </Button>
          ) : null}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
          {row.superseded ? <span className="text-xs text-muted">Replaced by a later export</span> : null}
        </div>

        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          {meta.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="text-primary mt-0.5 break-words">{value}</dd>
            </div>
          ))}
        </dl>

        {row.errorMessage ? (
          <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
            <div className="font-medium">Why it failed</div>
            <div className="mt-0.5">{row.errorMessage}</div>
          </div>
        ) : null}

        {!row.exportId ? (
          <p className="text-sm text-secondary">
            {row.outcome === 'in_progress'
              ? 'The background job has not built the journal yet.'
              : 'The sync stopped before a journal was built, so there are no lines to show.'}
          </p>
        ) : loading ? (
          <div className="flex items-center text-sm text-secondary">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading journal…
          </div>
        ) : error ? (
          <div className="text-sm text-error-700 dark:text-error-300">{error}</div>
        ) : detail ? (
          <>
            {detail.unmapped.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-primary mb-2">Not mapped</h3>
                <ul className="rounded-lg border border-warning-200 bg-warning-50 dark:border-warning-900 dark:bg-warning-950/30 divide-y divide-warning-200 dark:divide-warning-900 text-sm">
                  {detail.unmapped.map((item, index) => (
                    <li key={`${item.source}-${item.costCentreCode ?? ''}-${index}`} className="flex justify-between gap-3 px-3 py-2">
                      <span className="text-warning-900 dark:text-warning-100">
                        {item.source}
                        {item.costCentreCode ? <span className="text-xs text-warning-700 dark:text-warning-300"> · {item.costCentreCode}</span> : null}
                      </span>
                      <span className="font-mono text-warning-900 dark:text-warning-100">{formatMoney(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div>
              <h3 className="text-sm font-semibold text-primary mb-2">
                Journal lines{' '}
                <span className={`ml-1 text-xs font-normal ${detail.balanced ? 'text-success-600' : 'text-error-600'}`}>
                  {detail.balanced ? 'Balanced' : 'Not balanced'}
                </span>
              </h3>
              {detail.lines.length === 0 ? (
                <p className="text-sm text-secondary">No lines were produced.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-base">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                        <th className={thClass}>Account</th>
                        <th className={thClass}>Description</th>
                        {showCostCentre ? <th className={thClass}>Cost centre</th> : null}
                        <th className={`${thClass} text-right`}>Debit</th>
                        <th className={`${thClass} text-right`}>Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgb(var(--border-base))]">
                      {detail.lines.map((line, index) => (
                        <tr key={`${line.glAccountCode}-${line.costCentreCode ?? ''}-${index}`}>
                          <td className="px-4 py-2 font-mono text-xs text-primary whitespace-nowrap">
                            {line.glAccountCode} · {line.glAccountName}
                          </td>
                          <td className="px-4 py-2 text-secondary">{line.description}</td>
                          {showCostCentre ? (
                            <td className="px-4 py-2 text-secondary">{line.costCentreCode ?? '—'}</td>
                          ) : null}
                          <td className="px-4 py-2 text-right font-mono text-primary">
                            {Number(line.debit) > 0 ? formatMoney(line.debit) : ''}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-primary">
                            {Number(line.credit) > 0 ? formatMoney(line.credit) : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-strong bg-[rgb(var(--bg-muted))]">
                        <td className="px-4 py-2 font-semibold text-primary" colSpan={showCostCentre ? 3 : 2}>
                          Total
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-semibold text-primary">
                          {formatMoney(row.totalDebit)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-semibold text-primary">
                          {formatMoney(row.totalCredit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

export function GlExportStatusPage() {
  return (
    <OrgPageState>
      {(companyId) => (
        <>
          <div className="px-4 lg:px-6 pt-4">
            <CompanySelector />
          </div>
          <ExportsContent companyId={companyId} />
        </>
      )}
    </OrgPageState>
  );
}
