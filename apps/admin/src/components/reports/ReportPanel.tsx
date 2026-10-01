import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Download, FileSpreadsheet, Inbox, Loader2, RefreshCw, Search } from 'lucide-react';
import type { ReportDefinition, ReportExportFormat, ReportPeriod, ReportResult } from '@hrm/shared-types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/EmptyState';
import type { SortDirection } from '@/components/ui/DataTable';
import { OrgErrorBanner, OrgTableSkeleton } from '@/components/org/OrgScreenParts';
import { ReportPeriodControls } from '@/components/reports/ReportPeriodControls';
import { ReportResultTable } from '@/components/reports/ReportResultTable';
import { saveBlob } from '@/lib/download';
import { fetchReportExport, runReport } from '@/lib/reports-api';
import { reportsCopy as copy } from '@/lib/reports-copy';
import {
  analyzeColumns,
  columnTotals,
  filterRows,
  formatNumber,
  humanize,
  matchPreset,
  presetRange,
  sortRows,
  type PeriodError,
} from '@/lib/report-table';
import { ApiError } from '@/lib/tenant-api-client';

interface Props {
  companyId: string;
  report: ReportDefinition;
  period: ReportPeriod;
  periodError: PeriodError;
  onPeriodChange: (period: ReportPeriod) => void;
}

const RUN_DEBOUNCE_MS = 250;

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError || err instanceof Error ? err.message : fallback;

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function formatSummaryValue(value: string | number): string {
  if (typeof value === 'number') return formatNumber(value, Number.isInteger(value) ? 0 : 2);
  const n = Number(value);
  if (value.trim() === '' || !Number.isFinite(n)) return value;
  const dot = value.indexOf('.');
  return formatNumber(n, dot === -1 ? 0 : value.length - dot - 1);
}

export function ReportPanel({ companyId, report, period, periodError, onPeriodChange }: Props) {
  const snapshot = report.periodMode === 'snapshot';
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [runError, setRunError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: SortDirection } | null>(null);
  const [exporting, setExporting] = useState<ReportExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const request = useMemo(
    () => (periodError ? null : { from: snapshot ? undefined : period.from, to: snapshot ? undefined : period.to }),
    [periodError, snapshot, period.from, period.to],
  );

  useEffect(() => {
    if (!request) {
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setRunError(null);
    const timer = window.setTimeout(() => {
      runReport(companyId, report.id, request, controller.signal)
        .then((next) => {
          if (!controller.signal.aborted) setResult(next);
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) setRunError(errorText(err, copy.runError));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, RUN_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [companyId, report.id, request, reloadToken]);

  const columns = useMemo(() => (result ? analyzeColumns(result) : []), [result]);
  const visibleRows = useMemo(() => {
    if (!result) return [];
    const filtered = filterRows(result.rows, columns, search);
    const sortColumn = sort ? columns.find((column) => column.key === sort.key) : undefined;
    return sortColumn && sort ? sortRows(filtered, sortColumn, sort.dir) : filtered;
  }, [result, columns, search, sort]);
  const totals = useMemo(() => {
    if (visibleRows.length < 2 || !columns.some((column) => column.summable)) return null;
    return columnTotals(visibleRows, columns);
  }, [visibleRows, columns]);

  const toggleSort = (key: string) =>
    setSort((prev) => (prev?.key !== key ? { key, dir: 'asc' } : prev.dir === 'asc' ? { key, dir: 'desc' } : null));

  const exportReport = async (format: ReportExportFormat) => {
    if (!request) return;
    setExporting(format);
    setExportError(null);
    try {
      const { blob, filename } = await fetchReportExport(companyId, report.id, format, request);
      saveBlob(blob, filename);
    } catch (err) {
      setExportError(errorText(err, copy.exportError));
    } finally {
      setExporting(null);
    }
  };

  const widenPreset = report.periodMode === 'upcoming' ? 'next12Months' : 'yearToDate';
  const canWiden = !snapshot && matchPreset(report.periodMode, period) !== widenPreset;
  const summaryEntries = Object.entries(result?.summary ?? {});
  const searching = search.trim() !== '';
  const exportDisabled = !request || exporting !== null;

  let resultBody: ReactNode = null;
  if (result && result.rows.length === 0) {
    resultBody = (
      <EmptyState
        compact
        icon={Inbox}
        title={copy.empty.title}
        description={copy.empty[report.periodMode]}
        action={
          canWiden
            ? {
                label: report.periodMode === 'upcoming' ? copy.empty.widenUpcoming : copy.empty.widenHistorical,
                variant: 'secondary',
                onClick: () => onPeriodChange(presetRange(widenPreset)),
              }
            : undefined
        }
      />
    );
  } else if (result && visibleRows.length === 0) {
    resultBody = (
      <EmptyState
        compact
        icon={Search}
        title={copy.noMatchTitle}
        description={copy.noMatchDescription}
        action={{ label: copy.clearFilter, variant: 'secondary', onClick: () => setSearch('') }}
      />
    );
  } else if (result) {
    resultBody = (
      <ReportResultTable columns={columns} rows={visibleRows} sort={sort} onSort={toggleSort} totals={totals} />
    );
  }

  return (
    <Card className="overflow-hidden min-w-0">
      <div className="px-5 pt-4 pb-3 border-b border-base space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-primary">{report.title}</h2>
            <p className="text-sm text-secondary mt-0.5">{report.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={() => void exportReport('csv')} disabled={exportDisabled}>
              {exporting === 'csv' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {exporting === 'csv' ? copy.exporting : copy.exportCsv}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void exportReport('xlsx')} disabled={exportDisabled}>
              {exporting === 'xlsx' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5" />
              )}
              {exporting === 'xlsx' ? copy.exporting : copy.exportExcel}
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <ReportPeriodControls mode={report.periodMode} period={period} error={periodError} onChange={onPeriodChange} />
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" aria-hidden />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={copy.searchPlaceholder}
                aria-label={copy.searchLabel}
                className="pl-9 h-9"
                disabled={!result}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReloadToken((n) => n + 1)}
              disabled={!request || loading}
              aria-label={copy.refresh}
              title={copy.refresh}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {exportError ? <OrgErrorBanner message={exportError} /> : null}
        {searching && result ? <p className="text-xs text-muted">{copy.exportScopeHint}</p> : null}
      </div>

      {result && !runError ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-2.5 border-b border-base bg-[rgb(var(--bg-muted))]/40 text-xs text-secondary">
          <span className="font-medium text-primary">{copy.rowCount(visibleRows.length, result.rowCount)}</span>
          {summaryEntries.map(([key, value]) => (
            <span key={key}>
              {copy.summaryLabels[key] ?? humanize(key)}:{' '}
              <span className="font-semibold text-primary tabular-nums">{formatSummaryValue(value)}</span>
            </span>
          ))}
          <span className="ml-auto text-muted">{copy.generatedAt(timeFormat.format(new Date(result.generatedAt)))}</span>
        </div>
      ) : null}

      {runError ? (
        <div className="p-5">
          <OrgErrorBanner message={runError} onRetry={() => setReloadToken((n) => n + 1)} />
        </div>
      ) : !result ? (
        loading ? <OrgTableSkeleton columns={5} rows={6} /> : null
      ) : (
        <div aria-busy={loading} className={`transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
          {resultBody}
        </div>
      )}
    </Card>
  );
}
