import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Download, Eye, FilePlus2, Receipt, Search, X } from 'lucide-react';
import type { PayrollPeriodRecord, PayslipListItem } from '@hrm/shared-types';
import { usePermissions } from '@hrm/portal-ui';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { Avatar } from '@/components/ui/Toggle';
import { DataTable, DataTableBody, DataTableHead, SortableHeader, type SortDirection } from '@/components/ui/DataTable';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgErrorBanner, OrgTableSkeleton } from '@/components/org/OrgScreenParts';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import { PayslipViewerModal } from '@/components/payroll/PayslipViewerModal';
import { useCompany } from '@/context/CompanyContext';
import { fetchPayslipPdf, generatePayslip, listPayrollPeriods, listPayslips } from '@/lib/payroll-runs-api';
import { saveBlob } from '@/lib/download';
import { periodLabel, toCents } from '@/lib/payroll-run-flow';
import { payslipCopy as copy } from '@/lib/payslip-copy';
import { formatDate, formatMoney, payrollCopy } from '@/lib/payroll-copy';
import { downloadCsvFile } from '@/lib/csv';
import { ApiError } from '@/lib/tenant-api-client';

type Tab = 'all' | 'issued' | 'missing';
type SortKey = 'employee' | 'period' | 'net';

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError || err instanceof Error ? err.message : fallback;

export function PayslipPage() {
  const { companyId, loading: companyLoading, error: companyError, refresh: refreshCompanies } = useCompany();
  const { can } = usePermissions();
  const canGenerate = can('payroll', 'finalize');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const periodId = searchParams.get('period') ?? '';
  const employeeId = searchParams.get('employee') ?? '';

  const [items, setItems] = useState<PayslipListItem[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriodRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyRun, setBusyRun] = useState<string | null>(null);
  const [viewing, setViewing] = useState<PayslipListItem | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDirection }>({ key: 'period', dir: 'desc' });

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [nextItems, nextPeriods] = await Promise.all([
        listPayslips(companyId, { payrollPeriodId: periodId || undefined, employeeId: employeeId || undefined }),
        listPayrollPeriods(companyId),
      ]);
      setItems(nextItems);
      setPeriods(nextPeriods);
    } catch (err) {
      setError(errorText(err, copy.loadError));
    } finally {
      setLoading(false);
    }
  }, [companyId, periodId, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const setParam = (key: 'period' | 'employee', value: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const counts = useMemo(
    () => ({
      all: items.length,
      issued: items.filter((item) => item.payslip).length,
      missing: items.filter((item) => !item.payslip).length,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = items.filter(
      (item) =>
        (tab === 'all' || (tab === 'issued' ? item.payslip : !item.payslip)) &&
        (!q ||
          item.employeeName.toLowerCase().includes(q) ||
          item.employeeNumber.toLowerCase().includes(q) ||
          (item.departmentName ?? '').toLowerCase().includes(q)),
    );
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const byName = a.employeeName.localeCompare(b.employeeName);
      let cmp = 0;
      if (sort.key === 'period') cmp = a.periodStartDate.localeCompare(b.periodStartDate);
      else if (sort.key === 'net') cmp = toCents(a.netPay) - toCents(b.netPay);
      else cmp = byName;
      return (cmp || byName) * dir;
    });
  }, [items, tab, search, sort]);

  const issuedSequence = useMemo(() => filtered.filter((item) => item.payslip), [filtered]);
  const employeeName = employeeId ? items.find((item) => item.employeeId === employeeId)?.employeeName : undefined;

  const toggleSort = (key: SortKey) =>
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));

  const download = async (item: PayslipListItem) => {
    if (!item.payslip) return;
    setActionError(null);
    setBusyRun(item.payrollRunId);
    try {
      const { blob, filename } = await fetchPayslipPdf(item.employeeId, item.payslip.id);
      saveBlob(blob, filename);
    } catch (err) {
      setActionError(errorText(err, copy.viewer.error));
    } finally {
      setBusyRun(null);
    }
  };

  const generate = async (item: PayslipListItem) => {
    if (!companyId) return;
    setActionError(null);
    setBusyRun(item.payrollRunId);
    try {
      const payslip = await generatePayslip(companyId, item.payrollRunId);
      const updated: PayslipListItem = {
        ...item,
        payslip: { id: payslip.id, generatedAt: payslip.generatedAt, downloadUrl: payslip.downloadUrl ?? '' },
      };
      setItems((prev) => prev.map((entry) => (entry.payrollRunId === item.payrollRunId ? updated : entry)));
      setNotice(copy.generated(item.employeeName));
    } catch (err) {
      setActionError(errorText(err, copy.loadError));
    } finally {
      setBusyRun(null);
    }
  };

  const exportCsv = () =>
    downloadCsvFile(
      'payslips.csv',
      ['Employee ID', copy.colEmployee, 'Department', 'Period start', 'Period end', copy.colPayment, 'Currency', 'Gross pay', 'Deductions', copy.colNet, 'Run status', copy.colStatus, 'Issued at'],
      filtered.map((item) => [
        item.employeeNumber,
        item.employeeName,
        item.departmentName ?? '',
        item.periodStartDate,
        item.periodEndDate,
        item.paymentDate,
        item.payCurrency,
        item.grossPay,
        item.totalDeductions,
        item.netPay,
        item.runStatus,
        item.payslip ? copy.issued : copy.missing,
        item.payslip?.generatedAt ?? '',
      ]),
    );

  if (companyLoading) return <PageLoadingState />;
  if (companyError) return <PageErrorState error={companyError} onRetry={() => void refreshCompanies()} />;

  const filtersActive = tab !== 'all' || search.trim() !== '' || periodId !== '';
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'all', label: copy.tabs.all(counts.all) },
    { key: 'issued', label: copy.tabs.issued(counts.issued) },
    { key: 'missing', label: copy.tabs.missing(counts.missing) },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">{payrollCopy.common.eyebrow}</p>
          <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
          <p className="text-sm text-secondary mt-0.5 max-w-2xl">{copy.description}</p>
        </div>
        <CompanySelector />
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-success-700 dark:text-success-300 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg px-4 py-2.5"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {notice}
        </div>
      ) : null}
      {actionError ? <OrgErrorBanner message={actionError} /> : null}

      {employeeId ? (
        <div className="flex items-center gap-2 text-sm text-secondary">
          <span>{copy.employeeFilter(employeeName ?? employeeId)}</span>
          <Button variant="ghost" size="sm" onClick={() => setParam('employee', '')}>
            <X className="h-3.5 w-3.5" /> {copy.clearEmployee}
          </Button>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-5 py-4 border-b border-base">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex p-1 rounded-lg border border-base surface gap-1" role="tablist">
              {tabs.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === entry.key}
                  onClick={() => setTab(entry.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    tab === entry.key ? 'bg-accent-600 text-white shadow-sm' : 'text-secondary hover:text-primary'
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <div className="w-56">
              <Select
                aria-label={copy.periodFilter}
                value={periodId}
                onChange={(e) => setParam('period', e.target.value)}
                className="h-9 py-1"
              >
                <option value="">{copy.allPeriods}</option>
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {periodLabel(period)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={copy.searchPlaceholder}
                aria-label={copy.searchPlaceholder}
                className="pl-9 h-9"
              />
            </div>
            <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> {payrollCopy.common.exportCsv}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="p-5">
            <OrgErrorBanner message={error} onRetry={() => void load()} />
          </div>
        ) : loading ? (
          <OrgTableSkeleton columns={5} rows={6} />
        ) : items.length === 0 && !periodId && !employeeId ? (
          <EmptyState
            icon={Receipt}
            title={copy.emptyTitle}
            description={copy.emptyDescription}
            action={{ label: copy.emptyAction, onClick: () => navigate('/payroll/runs') }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            compact
            icon={Search}
            title={copy.noMatchTitle}
            description={copy.noMatchDescription}
            action={
              filtersActive
                ? {
                    label: copy.clearFilters,
                    variant: 'secondary',
                    onClick: () => {
                      setTab('all');
                      setSearch('');
                      setParam('period', '');
                    },
                  }
                : undefined
            }
          />
        ) : (
          <DataTable className="max-h-[65vh] overflow-y-auto">
            <DataTableHead>
              <tr>
                <th className="text-left px-5 py-3">
                  <SortableHeader label={copy.colEmployee} active={sort.key === 'employee'} direction={sort.dir} onSort={() => toggleSort('employee')} />
                </th>
                <th className="text-left px-5 py-3">
                  <SortableHeader label={copy.colPeriod} active={sort.key === 'period'} direction={sort.dir} onSort={() => toggleSort('period')} />
                </th>
                <th className="text-right px-5 py-3">
                  <SortableHeader label={copy.colNet} active={sort.key === 'net'} direction={sort.dir} onSort={() => toggleSort('net')} />
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wide">{copy.colStatus}</th>
                <th className="px-5 py-3">
                  <span className="sr-only">{payrollCopy.common.actions}</span>
                </th>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {filtered.map((item) => {
                const busy = busyRun === item.payrollRunId;
                return (
                  <tr
                    key={item.payrollRunId}
                    onClick={() => item.payslip && setViewing(item)}
                    className={`transition-colors ${item.payslip ? 'cursor-pointer hover:bg-[rgb(var(--bg-hover))]' : ''}`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={item.employeeName} size="sm" />
                        <div className="min-w-0">
                          <div className="font-medium text-primary truncate">{item.employeeName}</div>
                          <div className="text-xs text-muted truncate">
                            {item.employeeNumber}
                            {item.departmentName ? ` · ${item.departmentName}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-primary">{periodLabel({ startDate: item.periodStartDate, endDate: item.periodEndDate })}</div>
                      <div className="text-xs text-muted">
                        {copy.colPayment}: {formatDate(item.paymentDate)}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span className="font-semibold text-primary">{formatMoney(item.netPay)}</span>
                      <span className="ml-1 text-xs text-muted">{item.payCurrency}</span>
                    </td>
                    <td className="px-5 py-3">
                      {item.payslip ? (
                        <div>
                          <StatusPill tone="success">{copy.issued}</StatusPill>
                          <div className="text-xs text-muted mt-0.5">{copy.issuedOn(formatDate(item.payslip.generatedAt))}</div>
                        </div>
                      ) : (
                        <span title={copy.missingHint}>
                          <StatusPill tone="warning">
                            <AlertTriangle className="h-3 w-3 -ml-0.5" aria-hidden />
                            {copy.missing}
                          </StatusPill>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {item.payslip ? (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => setViewing(item)}>
                              <Eye className="h-3.5 w-3.5" /> {copy.view}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void download(item)}
                              disabled={busy}
                              aria-label={`${copy.download}: ${item.employeeName}`}
                              title={copy.download}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : canGenerate ? (
                          <Button size="sm" variant="secondary" onClick={() => void generate(item)} disabled={busy}>
                            <FilePlus2 className="h-3.5 w-3.5" /> {busy ? copy.generating : copy.generate}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </DataTableBody>
          </DataTable>
        )}
      </Card>

      <PayslipViewerModal
        item={viewing}
        sequence={issuedSequence}
        onNavigate={setViewing}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}
