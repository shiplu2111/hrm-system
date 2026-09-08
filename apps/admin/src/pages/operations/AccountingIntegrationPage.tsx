import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  BookOpen,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Cloud,
  FileSpreadsheet,
  Link2,
  Loader2,
  Settings2,
  Unplug,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Form';
import { useCompany } from '@/context/CompanyContext';
import {
  downloadCsv,
  exportPayrollJournal,
  listAccountingConnections,
  listAccountingSyncJobs,
  listGlAccounts,
  listGlContractorMappings,
  listGlPayrollMappings,
  listJournalExports,
  listPayrollPeriods,
  previewPayrollJournal,
  saveGlContractorMappings,
  saveGlPayrollMappings,
  beginXeroConnect,
  disconnectXero,
  retryAccountingSyncJob,
} from '@/lib/accounting-api';
import { ApiError } from '@/lib/tenant-api-client';
import type {
  AccountingConnectionRecord,
  AccountingSyncJobRecord,
  GlAccountRecord,
  GlContractorMappingRecord,
  GlContractorSystemMappingKey,
  GlPayrollMappingRecord,
  GlSystemMappingKey,
  PayrollJournalPreview,
  PayrollPeriodRecord,
} from '@hrm/shared-types';
import { GL_CONTRACTOR_MAPPING_LABELS, GL_SYSTEM_MAPPING_LABELS } from '@hrm/shared-types';

type Tab = 'mapping' | 'connections' | 'journal';

const PLANNED_PROVIDERS = [
  {
    provider: 'QuickBooks' as const,
    key: 'quickbooks' as const,
    description: 'Accounting and financial reporting — OAuth coming soon',
    color: 'bg-emerald-500',
  },
  {
    provider: 'Tally' as const,
    key: 'tally' as const,
    description: 'ERP and statutory accounting — file-based export supported',
    color: 'bg-indigo-500',
  },
];

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString();
}

function connectionStatusTone(
  status: AccountingConnectionRecord['status'],
): 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'connected':
      return 'success';
    case 'error':
    case 'token_expired':
      return 'error';
    case 'disconnected':
      return 'neutral';
    default:
      return 'warning';
  }
}

function syncStatusTone(
  status: AccountingSyncJobRecord['status'],
): 'success' | 'warning' | 'error' | 'neutral' | 'accent' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    case 'processing':
      return 'accent';
    case 'queued':
      return 'warning';
    default:
      return 'neutral';
  }
}

function mappingLabel(row: GlPayrollMappingRecord): string {
  if (row.payComponentName) {
    return row.payComponentName;
  }
  if (row.systemKey) {
    return GL_SYSTEM_MAPPING_LABELS[row.systemKey as GlSystemMappingKey];
  }
  return 'Unknown';
}

function mappingType(row: GlPayrollMappingRecord): string {
  if (row.systemKey) {
    if (row.systemKey.includes('expense')) return 'Expense';
    if (row.systemKey.includes('liability') || row.systemKey.includes('payable')) {
      return 'Liability';
    }
  }
  return row.postingSide === 'debit' ? 'Earning' : 'Deduction';
}

export function AccountingIntegrationPage() {
  const { companyId } = useCompany();
  const [tab, setTab] = useState<Tab>('mapping');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<GlAccountRecord[]>([]);
  const [mappings, setMappings] = useState<GlPayrollMappingRecord[]>([]);
  const [contractorMappings, setContractorMappings] = useState<GlContractorMappingRecord[]>([]);
  const [draftGlByKey, setDraftGlByKey] = useState<Record<string, string>>({});
  const [draftContractorGlByKey, setDraftContractorGlByKey] = useState<Record<string, string>>({});
  const [periods, setPeriods] = useState<PayrollPeriodRecord[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [journal, setJournal] = useState<PayrollJournalPreview | null>(null);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState<string | null>(null);
  const [lastExportStatus, setLastExportStatus] = useState<string | null>(null);

  const [connections, setConnections] = useState<AccountingConnectionRecord[]>([]);
  const [syncJobs, setSyncJobs] = useState<AccountingSyncJobRecord[]>([]);
  const [connectMessage, setConnectMessage] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [saved, setSaved] = useState(false);
  const [contractorSaved, setContractorSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contractorSaving, setContractorSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const mappingKey = (row: GlPayrollMappingRecord) =>
    row.payComponentId ?? row.systemKey ?? row.id;

  const loadBase = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [accountRows, mappingRows, contractorMappingRows, periodRows, connectionRows, syncJobRows] =
        await Promise.all([
        listGlAccounts(companyId),
        listGlPayrollMappings(companyId),
        listGlContractorMappings(companyId),
        listPayrollPeriods(companyId),
        listAccountingConnections(companyId),
        listAccountingSyncJobs(companyId),
      ]);
      setAccounts(accountRows);
      setMappings(mappingRows);
      setContractorMappings(contractorMappingRows);
      setPeriods(periodRows);
      setConnections(connectionRows);
      setSyncJobs(syncJobRows);
      setDraftGlByKey(
        Object.fromEntries(
          mappingRows
            .filter((row) => row.glAccountId)
            .map((row) => [mappingKey(row), row.glAccountId]),
        ),
      );
      setDraftContractorGlByKey(
        Object.fromEntries(
          contractorMappingRows
            .filter((row) => row.glAccountId)
            .map((row) => [row.systemKey, row.glAccountId]),
        ),
      );
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const xeroResult = params.get('xero');
    if (!xeroResult) return;

    if (xeroResult === 'connected') {
      const org = params.get('org');
      setConnectMessage(
        org ? `Connected to Xero organization “${org}”.` : 'Xero connected successfully.',
      );
      setTab('connections');
    } else if (xeroResult === 'error') {
      setConnectMessage(
        params.get('message') ?? 'Failed to connect Xero. Please try again.',
      );
      setTab('connections');
    }

    params.delete('xero');
    params.delete('org');
    params.delete('message');
    params.delete('companyId');
    params.delete('tab');
    const remaining = params.toString();
    const nextUrl = remaining
      ? `${window.location.pathname}?${remaining}`
      : window.location.pathname;
    window.history.replaceState({}, '', nextUrl);
  }, []);

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
    if (tab === 'journal' && selectedPeriodId) {
      void loadJournal();
    }
  }, [tab, selectedPeriodId, loadJournal]);

  const mappedCount = useMemo(
    () =>
      mappings.filter((row) => {
        const key = mappingKey(row);
        return Boolean(draftGlByKey[key]);
      }).length,
    [mappings, draftGlByKey],
  );

  const coveragePercent = mappings.length
    ? Math.round((mappedCount / mappings.length) * 100)
    : 0;

  const accountName = (accountId: string) =>
    accounts.find((account) => account.id === accountId)?.name ?? 'Unmapped';

  const accountLabel = (accountId: string) => {
    const account = accounts.find((item) => item.id === accountId);
    return account ? `${account.code} · ${account.name}` : 'Unmapped';
  };

  const currency = (value: string | number) => {
    const amount = typeof value === 'string' ? Number(value) : value;
    return Number.isFinite(amount)
      ? amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })
      : '—';
  };

  const updateDraft = (key: string, glAccountId: string) => {
    setSaved(false);
    setDraftGlByKey((current) => ({ ...current, [key]: glAccountId }));
  };

  const handleSaveMappings = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      const payload = mappings
        .map((row) => {
          const key = mappingKey(row);
          const glAccountId = draftGlByKey[key];
          if (!glAccountId) return null;
          return {
            payComponentId: row.payComponentId ?? undefined,
            systemKey: row.systemKey ?? undefined,
            postingSide: row.postingSide,
            glAccountId,
          };
        })
        .filter(Boolean) as Array<{
        payComponentId?: string;
        systemKey?: GlSystemMappingKey;
        postingSide: 'debit' | 'credit';
        glAccountId: string;
      }>;

      const updated = await saveGlPayrollMappings(companyId, payload);
      setMappings(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save mappings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContractorMappings = async () => {
    if (!companyId) return;
    setContractorSaving(true);
    try {
      const payload = contractorMappings
        .map((row) => {
          const glAccountId = draftContractorGlByKey[row.systemKey];
          if (!glAccountId) return null;
          return {
            systemKey: row.systemKey,
            postingSide: row.postingSide,
            glAccountId,
          };
        })
        .filter(Boolean) as Array<{
        systemKey: GlContractorSystemMappingKey;
        postingSide: 'debit' | 'credit';
        glAccountId: string;
      }>;

      const updated = await saveGlContractorMappings(companyId, payload);
      setContractorMappings(updated);
      setContractorSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save contractor mappings');
    } finally {
      setContractorSaving(false);
    }
  };

  const xeroConnection = connections.find((row) => row.provider === 'xero');

  const handleConnectXero = async () => {
    if (!companyId) return;
    setConnecting(true);
    setConnectMessage(null);
    try {
      const { authorizeUrl } = await beginXeroConnect(companyId);
      window.location.href = authorizeUrl;
    } catch (err) {
      setConnectMessage(
        err instanceof ApiError ? err.message : 'Failed to start Xero connection',
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectXero = async () => {
    if (!companyId) return;
    setDisconnecting(true);
    try {
      await disconnectXero(companyId);
      await loadBase();
      setConnectMessage('Xero disconnected.');
    } catch (err) {
      setConnectMessage(
        err instanceof ApiError ? err.message : 'Failed to disconnect Xero',
      );
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRetrySync = async (jobId: string) => {
    if (!companyId) return;
    try {
      await retryAccountingSyncJob(companyId, jobId);
      const rows = await listAccountingSyncJobs(companyId);
      setSyncJobs(rows);
    } catch (err) {
      setConnectMessage(
        err instanceof ApiError ? err.message : 'Failed to retry sync job',
      );
    }
  };

  const handleExportJournal = async () => {
    if (!companyId || !selectedPeriodId || !journal) return;
    setExporting(true);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading accounting integration…
      </div>
    );
  }

  if (error && mappings.length === 0) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
          {error}
        </div>
      </div>
    );
  }

  const totalDebit = journal ? Number(journal.totalDebit) : 0;
  const totalCredit = journal ? Number(journal.totalCredit) : 0;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400">
              <BookOpen className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold text-primary">Accounting Integration</h1>
          </div>
          <p className="text-sm text-secondary">
            Map payroll to GL accounts, export CSV journals, and push to Xero automatically when payroll is finalized.
          </p>
        </div>
        <Badge tone={xeroConnection?.status === 'connected' ? 'success' : 'accent'} dot>
          {xeroConnection?.status === 'connected' ? 'Xero connected' : 'CSV + Xero sync'}
        </Badge>
      </div>

      <div className="surface flex gap-1 overflow-x-auto rounded-xl border border-base p-1 shadow-card">
        {([
          ['mapping', 'Chart of accounts', Settings2],
          ['connections', 'Connected software', Cloud],
          ['journal', 'Journal preview', FileSpreadsheet],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex min-w-fit flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${tab === id ? 'bg-accent-600 text-white shadow-sm' : 'text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'mapping' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
            <div className="flex flex-col justify-between gap-2 border-b border-base px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-sm font-semibold text-primary">Payroll component mapping</h2>
                <p className="mt-0.5 text-xs text-secondary">
                  Map pay components and system lines to GL accounts before exporting journals.
                </p>
              </div>
              <Badge tone="accent">{mappings.length} lines</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                  <tr>
                    <th className="px-5 py-3">Payroll source</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">GL account</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {mappings.map((mapping) => {
                    const key = mappingKey(mapping);
                    const glAccountId = draftGlByKey[key] ?? '';
                    return (
                      <tr key={key} className="hover:bg-[rgb(var(--bg-hover))]">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-primary">{mappingLabel(mapping)}</div>
                          <div className="mt-0.5 text-[11px] text-muted">
                            {mapping.systemKey ? 'System journal line' : 'Pay component'}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={mapping.postingSide === 'debit' ? 'success' : 'warning'}>
                            {mappingType(mapping)}
                          </Badge>
                        </td>
                        <td className="min-w-[280px] px-5 py-3.5">
                          <Select
                            value={glAccountId}
                            onChange={(event) => updateDraft(key, event.target.value)}
                          >
                            <option value="">Choose GL account</option>
                            {accounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.code} · {account.name}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-medium ${glAccountId ? 'text-success-600 dark:text-success-400' : 'text-warning-600 dark:text-warning-400'}`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {glAccountId ? 'Ready' : 'Action needed'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end border-t border-base px-5 py-4">
              <Button onClick={() => void handleSaveMappings()} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Settings2 className="h-4 w-4" />
                )}
                {saved ? 'Mappings saved' : saving ? 'Saving…' : 'Save mappings'}
              </Button>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="surface rounded-xl border border-base p-5 shadow-card">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400">
                <Link2 className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-primary">Mapping coverage</h3>
              <div className="mt-2 text-3xl font-bold text-primary">{coveragePercent}%</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgb(var(--bg-muted))]">
                <div
                  className="h-full rounded-full bg-accent-600"
                  style={{ width: `${coveragePercent}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-secondary">
                All payroll components and system lines (net pay, employer super) should be mapped before CSV export.
              </p>
            </div>
            {mappings[0] && draftGlByKey[mappingKey(mappings[0])] && (
              <div className="rounded-xl border border-accent-200 bg-accent-50/70 p-4 dark:border-accent-800 dark:bg-accent-950/30">
                <div className="text-xs font-semibold uppercase tracking-wide text-accent-700 dark:text-accent-300">
                  Example mapping
                </div>
                <div className="mt-2 text-sm font-semibold text-primary">
                  {mappingLabel(mappings[0])} → {accountLabel(draftGlByKey[mappingKey(mappings[0])])}
                </div>
                <div className="mt-1 text-xs text-secondary">
                  {accountName(draftGlByKey[mappingKey(mappings[0])])}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {tab === 'mapping' && (
        <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
          <div className="flex flex-col justify-between gap-2 border-b border-base px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-semibold text-primary">Contractor payment mapping</h2>
              <p className="mt-0.5 text-xs text-secondary">
                Separate from payroll journals — paid contractor batches export to these accounts.
              </p>
            </div>
            <Badge tone="accent">{contractorMappings.length} lines</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                <tr>
                  <th className="px-5 py-3">Contractor source</th>
                  <th className="px-5 py-3">Side</th>
                  <th className="px-5 py-3">GL account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {contractorMappings.map((mapping) => (
                  <tr key={mapping.systemKey} className="hover:bg-[rgb(var(--bg-hover))]">
                    <td className="px-5 py-3.5 font-semibold text-primary">
                      {GL_CONTRACTOR_MAPPING_LABELS[mapping.systemKey]}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={mapping.postingSide === 'debit' ? 'success' : 'warning'}>
                        {mapping.postingSide === 'debit' ? 'Expense' : 'Liability'}
                      </Badge>
                    </td>
                    <td className="min-w-[280px] px-5 py-3.5">
                      <Select
                        value={draftContractorGlByKey[mapping.systemKey] ?? ''}
                        onChange={(event) => {
                          setContractorSaved(false);
                          setDraftContractorGlByKey((current) => ({
                            ...current,
                            [mapping.systemKey]: event.target.value,
                          }));
                        }}
                      >
                        <option value="">Choose GL account</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} · {account.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end border-t border-base px-5 py-4">
            <Button onClick={() => void handleSaveContractorMappings()} disabled={contractorSaving}>
              {contractorSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : contractorSaved ? (
                <Check className="h-4 w-4" />
              ) : (
                <Settings2 className="h-4 w-4" />
              )}
              {contractorSaved
                ? 'Contractor mappings saved'
                : contractorSaving
                  ? 'Saving…'
                  : 'Save contractor mappings'}
            </Button>
          </div>
        </section>
      )}

      {tab === 'connections' && (
        <div className="space-y-5">
          {connectMessage && (
            <div
              className={`rounded-xl border p-4 text-sm ${connectMessage.includes('Failed') || connectMessage.includes('disconnect') ? 'border-error-200 bg-error-50 text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-300' : 'border-success-200 bg-success-50/70 text-success-800 dark:border-success-800 dark:bg-success-950/30 dark:text-success-300'}`}
            >
              {connectMessage}
            </div>
          )}

          <div className="rounded-xl border border-base bg-[rgb(var(--bg-muted))] p-4 text-sm text-secondary">
            When payroll runs are finalized, journal entries push to Xero asynchronously via the job queue.
            Sync failures appear below — payroll finalization is never blocked.
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="surface rounded-xl border border-base p-5 shadow-card lg:col-span-1">
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500 text-lg font-bold text-white">
                  X
                </div>
                <Badge
                  tone={connectionStatusTone(xeroConnection?.status ?? 'disconnected')}
                  dot
                >
                  {xeroConnection?.status ?? 'disconnected'}
                </Badge>
              </div>
              <h2 className="mt-4 text-base font-bold text-primary">Xero</h2>
              <p className="mt-1 text-xs text-secondary">
                OAuth connection per company — pushes manual journals on payroll finalization.
              </p>
              <div className="mt-5 space-y-3 border-y border-base py-4 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-muted">
                    <Link2 className="h-3.5 w-3.5" /> Organization
                  </span>
                  <span className="font-medium text-primary">
                    {xeroConnection?.externalOrgName ?? '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-muted">
                    <Clock3 className="h-3.5 w-3.5" /> Last sync
                  </span>
                  <span className="font-medium text-primary">
                    {formatWhen(xeroConnection?.lastSyncAt)}
                  </span>
                </div>
              </div>
              {xeroConnection?.lastSyncError && (
                <div className="mt-3 rounded-lg border border-error-200 bg-error-50 p-3 text-xs text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-300">
                  {xeroConnection.lastSyncError}
                </div>
              )}
              {xeroConnection?.status === 'connected' ? (
                <Button
                  className="mt-4 w-full"
                  variant="secondary"
                  onClick={() => void handleDisconnectXero()}
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Unplug className="h-4 w-4" />
                  )}
                  {disconnecting ? 'Disconnecting…' : 'Disconnect Xero'}
                </Button>
              ) : (
                <Button
                  className="mt-4 w-full"
                  onClick={() => void handleConnectXero()}
                  disabled={connecting || xeroConnection?.oauthConfigured === false}
                >
                  {connecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                  {connecting
                    ? 'Redirecting…'
                    : xeroConnection?.oauthConfigured === false
                      ? 'OAuth not configured on server'
                      : 'Connect Xero'}
                </Button>
              )}
            </section>

            {PLANNED_PROVIDERS.map((provider) => (
              <section
                key={provider.key}
                className="surface rounded-xl border border-base p-5 shadow-card"
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white ${provider.color}`}
                  >
                    {provider.provider.charAt(0)}
                  </div>
                  <Badge tone="neutral" dot>Coming soon</Badge>
                </div>
                <h2 className="mt-4 text-base font-bold text-primary">{provider.provider}</h2>
                <p className="mt-1 text-xs text-secondary">{provider.description}</p>
                <Button className="mt-8 w-full" variant="secondary" disabled>
                  <Unplug className="h-4 w-4" /> Not available
                </Button>
              </section>
            ))}
          </div>

          <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
            <div className="border-b border-base px-5 py-4">
              <h2 className="text-sm font-semibold text-primary">Xero sync jobs</h2>
              <p className="mt-1 text-xs text-secondary">
                Recent automatic journal pushes triggered by payroll finalization.
              </p>
            </div>
            {syncJobs.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-secondary">
                No sync jobs yet — connect Xero and finalize payroll to enqueue a journal push.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                    <tr>
                      <th className="px-5 py-3">Period</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Attempts</th>
                      <th className="px-5 py-3">Error</th>
                      <th className="px-5 py-3">Queued</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgb(var(--border-base))]">
                    {syncJobs.map((job) => {
                      const period = periods.find((row) => row.id === job.payrollPeriodId);
                      const periodLabel = period
                        ? `${period.startDate} – ${period.endDate}`
                        : job.payrollPeriodId.slice(0, 8);
                      return (
                        <tr key={job.id}>
                          <td className="px-5 py-3.5 font-medium text-primary">{periodLabel}</td>
                          <td className="px-5 py-3.5">
                            <Badge tone={syncStatusTone(job.status)}>{job.status}</Badge>
                          </td>
                          <td className="px-5 py-3.5 text-secondary">{job.attempts}</td>
                          <td className="max-w-xs truncate px-5 py-3.5 text-xs text-error-600 dark:text-error-400">
                            {job.errorMessage ?? '—'}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-xs text-secondary">
                            {formatWhen(job.queuedAt)}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {job.status === 'failed' && (
                              <Button
                                variant="secondary"
                                onClick={() => void handleRetrySync(job.id)}
                              >
                                Retry
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'journal' && (
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
      )}
    </div>
  );
}
