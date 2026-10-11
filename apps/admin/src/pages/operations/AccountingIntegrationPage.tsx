import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine,
  BookOpen,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileSpreadsheet,
  History,
  Loader2,
  PlugZap,
  Unplug,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import { ConnectionStatusPill } from '@/components/accounting/ConnectionStatusPill';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Form';
import { pathForPage } from '@/config/routes';
import { useCompany } from '@/context/CompanyContext';
import {
  downloadCsv,
  exportPayrollJournal,
  listAccountingConnections,
  listJournalExports,
  listPayrollPeriods,
  previewPayrollJournal,
} from '@/lib/accounting-api';
import { needsReconnect } from '@/lib/accounting-display';
import { ApiError } from '@/lib/tenant-api-client';
import type {
  AccountingConnectionRecord,
  PayrollJournalPreview,
  PayrollPeriodRecord,
} from '@hrm/shared-types';

export function AccountingIntegrationPage() {
  const navigate = useNavigate();
  const { companyId, loading: companyLoading, error: companyError } = useCompany();
  const { can } = usePermissions();
  const canExport = can('payroll', 'create');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [periods, setPeriods] = useState<PayrollPeriodRecord[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [journal, setJournal] = useState<PayrollJournalPreview | null>(null);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState<string | null>(null);
  const [lastExportStatus, setLastExportStatus] = useState<string | null>(null);

  const [connections, setConnections] = useState<AccountingConnectionRecord[]>([]);

  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const loadBase = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [periodRows, connectionRows] = await Promise.all([
        listPayrollPeriods(companyId),
        listAccountingConnections(companyId),
      ]);
      setPeriods(periodRows);
      setConnections(connectionRows);
      if (periodRows.length > 0) {
        setSelectedPeriodId((current) => current || periodRows[0].id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load accounting data');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  const loadJournal = useCallback(async () => {
    if (!companyId || !selectedPeriodId) return;
    setJournalLoading(true);
    setJournalError(null);
    try {
      const preview = await previewPayrollJournal(companyId, selectedPeriodId);
      setJournal(preview);
      const exports = await listJournalExports(companyId, selectedPeriodId);
      setLastExportStatus(exports[0]?.status ?? null);
    } catch (err) {
      setJournalError(
        err instanceof ApiError ? err.message : 'Failed to load journal preview',
      );
      setJournal(null);
    } finally {
      setJournalLoading(false);
    }
  }, [companyId, selectedPeriodId]);

  useEffect(() => {
    if (selectedPeriodId) {
      void loadJournal();
    }
  }, [selectedPeriodId, loadJournal]);

  const currency = (value: string | number) => {
    const amount = typeof value === 'string' ? Number(value) : value;
    return Number.isFinite(amount)
      ? amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })
      : '—';
  };

  const xeroConnection = connections.find((row) => row.provider === 'xero');

  const handleExportJournal = async () => {
    if (!companyId || !selectedPeriodId || !journal) return;
    setExporting(true);
    setJournalError(null);
    try {
      const result = await exportPayrollJournal(companyId, selectedPeriodId);
      setLastExportStatus(result.status);
      if (result.csvContent) {
        downloadCsv(`${result.referenceNumber}.csv`, result.csvContent);
        setExported(true);
        window.setTimeout(() => setExported(false), 1800);
      }
      if (result.status === 'failed' && result.errorMessage) {
        setJournalError(result.errorMessage);
      }
    } catch (err) {
      setJournalError(err instanceof ApiError ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (companyLoading || (companyId && loading)) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading payroll journal…
      </div>
    );
  }

  const pageError =
    companyError ??
    (companyId ? null : 'No company found for this tenant.') ??
    (error && periods.length === 0 && connections.length === 0 ? error : null);
  if (pageError) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
          {pageError}
        </div>
      </div>
    );
  }

  const totalDebit = journal ? Number(journal.totalDebit) : 0;
  const totalCredit = journal ? Number(journal.totalCredit) : 0;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400">
              <BookOpen className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold text-primary">Payroll Journal</h1>
          </div>
          <p className="text-sm text-secondary">
            Preview the journal entry for a payroll period and export it as CSV. When Xero is connected, it syncs
            automatically after payroll is finalized.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:flex-nowrap">
          <Button variant="secondary" onClick={() => navigate(pathForPage('accounting-connections'))}>
            <PlugZap className="h-4 w-4" /> Accounting connections
          </Button>
          <Button variant="secondary" onClick={() => navigate(pathForPage('accounting-mapping'))}>
            <BookOpen className="h-4 w-4" /> Account mapping
          </Button>
          <Button variant="secondary" onClick={() => navigate(pathForPage('accounting-exports'))}>
            <History className="h-4 w-4" /> Export &amp; sync status
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
          {error}
        </div>
      )}

      {xeroConnection ? (
        <div className="surface flex flex-col gap-3 rounded-xl border border-base px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-primary">Xero</span>
            <ConnectionStatusPill status={xeroConnection.status} />
            <span className="text-secondary">
              {xeroConnection.status === 'connected'
                ? `Finalized payroll posts to ${xeroConnection.externalOrgName ?? 'Xero'} automatically.`
                : needsReconnect(xeroConnection.status)
                  ? 'Automatic sync is paused until Xero is reconnected.'
                  : 'Not syncing. Export the journal as CSV below.'}
            </span>
          </div>
          <Button
            variant={needsReconnect(xeroConnection.status) ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => navigate(pathForPage('accounting-connections'))}
          >
            {needsReconnect(xeroConnection.status) ? 'Reconnect Xero' : 'Manage connection'}
          </Button>
        </div>
      ) : null}

      <div className="space-y-5">
          <div className="surface flex flex-col gap-3 rounded-xl border border-base p-4 shadow-card sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-secondary">Payroll period</label>
              <Select
                value={selectedPeriodId}
                onChange={(event) => setSelectedPeriodId(event.target.value)}
              >
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.startDate} – {period.endDate} ({period.status})
                  </option>
                ))}
              </Select>
            </div>
            <Button variant="secondary" onClick={() => void loadJournal()} disabled={journalLoading}>
              {journalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Refresh preview
            </Button>
          </div>

          {journalError && (
            <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
              {journalError}
            </div>
          )}

          {journal && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Payroll period', value: journal.periodLabel, icon: FileSpreadsheet },
                  { label: 'Posting date', value: journal.postingDate, icon: Clock3 },
                  { label: 'Journal total', value: currency(journal.totalDebit), icon: CircleDollarSign },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="surface flex items-center gap-3 rounded-xl border border-base p-4 shadow-card">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs text-secondary">{label}</div>
                      <div className="mt-0.5 text-sm font-bold text-primary">{value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {journal.unmapped.length > 0 && (
                <div className="flex flex-col gap-3 rounded-xl border border-warning-200 bg-warning-50 p-4 text-sm text-warning-800 sm:flex-row sm:items-center sm:justify-between dark:border-warning-900 dark:bg-warning-950/30 dark:text-warning-200">
                  <div>
                    Not mapped:{' '}
                    {journal.unmapped
                      .map((item) => (item.costCentreCode ? `${item.source} (${item.costCentreCode})` : item.source))
                      .join(', ')}
                    . Exporting this period will fail until they have GL accounts.
                  </div>
                  <Button variant="secondary" onClick={() => navigate(pathForPage('accounting-mapping'))}>
                    <BookOpen className="h-4 w-4" /> Fix mappings
                  </Button>
                </div>
              )}

              <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
                <div className="flex flex-col justify-between gap-3 border-b border-base px-5 py-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-primary">Journal entry preview</h2>
                      <Badge tone="neutral">{journal.referenceNumber}</Badge>
                      {lastExportStatus && (
                        <Badge tone={lastExportStatus === 'completed' ? 'success' : 'warning'}>
                          Last export: {lastExportStatus}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-secondary">
                      Aggregated from {journal.runCount} finalized/paid payroll run(s)
                      {journal.unmapped.length > 0 &&
                        ` · ${journal.unmapped.length} unmapped line(s)`}
                    </p>
                  </div>
                  {canExport && (
                    <Button variant="secondary" onClick={() => void handleExportJournal()} disabled={exporting}>
                      {exporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : exported ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <ArrowDownToLine className="h-4 w-4" />
                      )}
                      {exported ? 'CSV exported' : exporting ? 'Exporting…' : 'Export CSV'}
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                      <tr>
                        <th className="px-5 py-3">Account</th>
                        <th className="px-5 py-3">Description</th>
                        <th className="px-5 py-3 text-right">Debit</th>
                        <th className="px-5 py-3 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgb(var(--border-base))]">
                      {journal.lines.map((row) => (
                        <tr key={`${row.glAccountCode}-${row.description}`}>
                          <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs font-medium text-primary">
                            {row.glAccountCode} · {row.glAccountName}
                          </td>
                          <td className="px-5 py-3.5 text-secondary">{row.description}</td>
                          <td className="px-5 py-3.5 text-right font-mono text-primary">
                            {currency(row.debit)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-primary">
                            {currency(row.credit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-strong bg-[rgb(var(--bg-muted))]">
                      <tr>
                        <td className="px-5 py-4 font-bold text-primary" colSpan={2}>
                          Balanced totals
                        </td>
                        <td className="px-5 py-4 text-right font-mono font-bold text-primary">
                          {currency(journal.totalDebit)}
                        </td>
                        <td className="px-5 py-4 text-right font-mono font-bold text-primary">
                          {currency(journal.totalCredit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              <div
                className={`flex items-center gap-3 rounded-xl border p-4 ${journal.balanced ? 'border-success-200 bg-success-50/70 dark:border-success-800 dark:bg-success-950/30' : 'border-error-200 bg-error-50 dark:border-error-800 dark:bg-error-950/30'}`}
              >
                {journal.balanced ? (
                  <CheckCircle2 className="h-5 w-5 text-success-600 dark:text-success-400" />
                ) : (
                  <Unplug className="h-5 w-5 text-error-600" />
                )}
                <div>
                  <div className="text-sm font-semibold text-primary">
                    {journal.balanced
                      ? 'Journal is balanced and ready for CSV export'
                      : 'Journal is out of balance'}
                  </div>
                  <div className="mt-0.5 text-xs text-secondary">
                    {journal.balanced
                      ? 'Export creates an audit record; payroll finalization is never blocked by export failures.'
                      : `Debits and credits differ by ${currency(Math.abs(totalDebit - totalCredit))}.`}
                  </div>
                </div>
              </div>
            </>
          )}
      </div>
    </div>
  );
}
