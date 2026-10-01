import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarRange, ChevronRight, Download, Lock, Plus } from 'lucide-react';
import type { PayrollPeriodRecord } from '@hrm/shared-types';
import { usePermissions } from '@hrm/portal-ui';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { DataTable, DataTableBody, DataTableHead, SortableHeader, type SortDirection } from '@/components/ui/DataTable';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgErrorBanner, OrgTableSkeleton } from '@/components/org/OrgScreenParts';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import { PayrollPeriodFormModal } from '@/components/payroll/PayrollPeriodFormModal';
import { PayrollStatusBar, RunStatusPill } from '@/components/payroll/PayrollRunStatus';
import { useCompany } from '@/context/CompanyContext';
import { listPayrollPeriods } from '@/lib/payroll-runs-api';
import { periodLabel, periodStage } from '@/lib/payroll-run-flow';
import { payrollRunsCopy } from '@/lib/payroll-runs-copy';
import { formatDate, formatMoney, payrollCopy } from '@/lib/payroll-copy';
import { downloadCsvFile } from '@/lib/csv';
import { ApiError } from '@/lib/tenant-api-client';

type SortKey = 'period' | 'payment' | 'employees' | 'net';

const copy = payrollRunsCopy.periods;

export function PayrollPeriodsPage() {
  const { companyId, loading: companyLoading, error: companyError, refresh: refreshCompanies } = useCompany();
  const { can } = usePermissions();
  const canCreate = can('payroll', 'create');
  const navigate = useNavigate();

  const [periods, setPeriods] = useState<PayrollPeriodRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDirection }>({ key: 'period', dir: 'desc' });

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      setPeriods(await listPayrollPeriods(companyId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    const value = (p: PayrollPeriodRecord): string | number => {
      switch (sort.key) {
        case 'payment':
          return p.paymentDate;
        case 'employees':
          return p.summary?.employeeCount ?? 0;
        case 'net':
          return Number(p.summary?.netPay ?? 0);
        default:
          return p.startDate;
      }
    };
    return [...periods].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return (cmp || b.startDate.localeCompare(a.startDate)) * dir;
    });
  }, [periods, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));

  const statusText = (period: PayrollPeriodRecord) => {
    const { stage, mixed } = periodStage(period.summary?.statusCounts);
    if (!stage) return copy.notStarted;
    return mixed ? `${payrollRunsCopy.status[stage]} ${copy.mixed}` : payrollRunsCopy.status[stage];
  };

  const exportCsv = () => {
    downloadCsvFile(
      'payroll-periods.csv',
      [copy.colPeriod, 'Start date', 'End date', copy.colPayment, copy.colEmployees, 'Total gross', 'Total deductions', copy.colNet, 'Currency', copy.colStatus],
      sorted.map((p) => [
        periodLabel(p),
        p.startDate.slice(0, 10),
        p.endDate.slice(0, 10),
        p.paymentDate.slice(0, 10),
        p.summary?.employeeCount ?? 0,
        p.summary?.grossPay ?? '0.00',
        p.summary?.totalDeductions ?? '0.00',
        p.summary?.netPay ?? '0.00',
        p.summary?.baseCurrency ?? '',
        statusText(p),
      ]),
    );
  };

  if (companyLoading) return <PageLoadingState />;
  if (companyError) return <PageErrorState error={companyError} onRetry={() => void refreshCompanies()} />;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">{payrollCopy.common.eyebrow}</p>
          <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
          <p className="text-sm text-secondary mt-0.5 max-w-2xl">{copy.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          {canCreate ? (
            <Button variant="primary" onClick={() => setFormOpen(true)} disabled={!companyId}>
              <Plus className="h-4 w-4" /> {copy.create}
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-b border-base">
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={sorted.length === 0}>
            <Download className="h-4 w-4" /> {payrollCopy.common.exportCsv}
          </Button>
        </div>

        {error ? (
          <div className="p-5">
            <OrgErrorBanner message={error} onRetry={() => void load()} />
          </div>
        ) : loading ? (
          <OrgTableSkeleton columns={5} rows={5} />
        ) : periods.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title={copy.emptyTitle}
            description={copy.emptyDescription}
            action={canCreate ? { label: copy.emptyAction, onClick: () => setFormOpen(true), icon: Plus } : undefined}
          />
        ) : (
          <DataTable className="max-h-[70vh] overflow-y-auto">
            <DataTableHead>
              <tr>
                <th className="text-left px-5 py-3">
                  <SortableHeader label={copy.colPeriod} active={sort.key === 'period'} direction={sort.dir} onSort={() => toggleSort('period')} />
                </th>
                <th className="text-left px-5 py-3 hidden md:table-cell">
                  <SortableHeader label={copy.colPayment} active={sort.key === 'payment'} direction={sort.dir} onSort={() => toggleSort('payment')} />
                </th>
                <th className="text-right px-5 py-3">
                  <SortableHeader label={copy.colEmployees} active={sort.key === 'employees'} direction={sort.dir} onSort={() => toggleSort('employees')} />
                </th>
                <th className="text-right px-5 py-3">
                  <SortableHeader label={copy.colNet} active={sort.key === 'net'} direction={sort.dir} onSort={() => toggleSort('net')} />
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wide w-64">
                  {copy.colStatus}
                </th>
                <th className="px-3 py-3 w-10">
                  <span className="sr-only">{payrollCopy.common.actions}</span>
                </th>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {sorted.map((period) => {
                const { stage, mixed, locked } = periodStage(period.summary?.statusCounts);
                const open = () => navigate(`/payroll/runs/${period.id}`);
                return (
                  <tr
                    key={period.id}
                    onClick={open}
                    className={`cursor-pointer transition-colors hover:bg-[rgb(var(--bg-hover))] ${
                      locked ? 'bg-[rgb(var(--bg-muted))]/50' : ''
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          open();
                        }}
                        className="font-semibold text-primary hover:text-accent-600 text-left inline-flex items-center gap-1.5"
                      >
                        {locked ? <Lock className="h-3.5 w-3.5 text-muted" aria-label={copy.locked} /> : null}
                        {periodLabel(period)}
                      </button>
                      <div className="text-xs text-secondary mt-0.5">
                        {formatDate(period.startDate)} – {formatDate(period.endDate)}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-secondary hidden md:table-cell">{formatDate(period.paymentDate)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-primary">{period.summary?.employeeCount ?? 0}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      <span className="font-medium text-primary">{formatMoney(period.summary?.netPay ?? 0)}</span>
                      {period.summary?.baseCurrency ? (
                        <span className="ml-1 text-xs text-muted">{period.summary.baseCurrency}</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {stage ? (
                          <RunStatusPill status={stage} locked={locked} />
                        ) : (
                          <StatusPill tone="neutral">{copy.notStarted}</StatusPill>
                        )}
                        {mixed ? <span className="text-xs text-muted">{copy.mixed}</span> : null}
                      </div>
                      <PayrollStatusBar counts={period.summary?.statusCounts} className="mt-2 max-w-[14rem]" />
                    </td>
                    <td className="px-3 py-3.5 text-muted">
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </td>
                  </tr>
                );
              })}
            </DataTableBody>
          </DataTable>
        )}
      </Card>

      {companyId ? (
        <PayrollPeriodFormModal
          open={formOpen}
          companyId={companyId}
          period={null}
          existing={periods}
          onClose={() => setFormOpen(false)}
          onSaved={(created) => {
            setFormOpen(false);
            navigate(`/payroll/runs/${created.id}`, { state: { notice: copy.created(periodLabel(created)) } });
          }}
        />
      ) : null}
    </div>
  );
}
