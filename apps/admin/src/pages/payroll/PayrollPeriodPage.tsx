import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Info,
  Lock,
  MoreHorizontal,
  Pencil,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  PAYROLL_RUN_CONFIRMED_TARGETS,
  PAYROLL_RUN_FLOW,
  type GeneratePayrollRunsResult,
  type PayrollBulkFailure,
  type PayrollPeriodRecord,
  type PayrollRunRecord,
  type PayrollRunStatus,
} from '@hrm/shared-types';
import { usePermissions } from '@hrm/portal-ui';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar } from '@/components/ui/Toggle';
import { DataTable, DataTableBody, DataTableHead, SortableHeader, type SortDirection } from '@/components/ui/DataTable';
import { Dropdown, DropdownDivider, DropdownItem } from '@/components/ui/Dropdown';
import { OrgErrorBanner, OrgTableSkeleton } from '@/components/org/OrgScreenParts';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import { PayrollReviewDialog } from '@/components/payroll/PayrollReviewDialog';
import { PayrollPeriodFormModal } from '@/components/payroll/PayrollPeriodFormModal';
import { PayrollRunBreakdownModal } from '@/components/payroll/PayrollRunBreakdownModal';
import { PayrollRunActionReview } from '@/components/payroll/PayrollRunActionReview';
import { PayrollStatusFlow, type StepAction } from '@/components/payroll/PayrollStatusFlow';
import { RunStatusPill } from '@/components/payroll/PayrollRunStatus';
import { useCompany } from '@/context/CompanyContext';
import {
  calculatePayrollRuns,
  generatePayrollRuns,
  getPayrollPeriod,
  listPayrollPeriods,
  listPayrollRuns,
  transitionPayrollRuns,
} from '@/lib/payroll-runs-api';
import {
  actionsFor,
  baseAmounts,
  baseCurrencyOf,
  buildPlan,
  canCalculate,
  expectationFor,
  flowIndex,
  isCalendarMonth,
  isLockedRun,
  isStaleReview,
  monthName,
  needsConfirmation,
  periodLabel,
  permissionFor,
  sendBackTarget,
  toCents,
  totalsFor,
  type ActionPlan,
  type RunAction,
} from '@/lib/payroll-run-flow';
import { payrollRunsCopy } from '@/lib/payroll-runs-copy';
import { formatDate, formatMoney, payrollCopy } from '@/lib/payroll-copy';
import { downloadCsvFile } from '@/lib/csv';
import { ApiError } from '@/lib/tenant-api-client';

type SortKey = 'employee' | 'status' | 'gross' | 'deductions' | 'net';

interface ReviewState {
  plan: ActionPlan;
  /** A whole step picks up runs that joined it meanwhile; a selection stays limited to the chosen runs. */
  scope: 'step' | 'selection';
  stale: boolean;
  key: number;
}

const copy = payrollRunsCopy.detail;
const tableCopy = payrollRunsCopy.table;
const actionCopy = payrollRunsCopy.actions;

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError || err instanceof Error ? err.message : fallback;

function bulkLabel(action: RunAction, n: number, status: PayrollRunStatus): string {
  switch (action) {
    case 'calculate':
      return status === 'draft' ? actionCopy.calculate(n) : actionCopy.recalculate(n);
    case 'sendBack':
      return actionCopy.sendBack(n, payrollRunsCopy.status[sendBackTarget(status) ?? status]);
    default:
      return actionCopy[action](n);
  }
}

function singleLabel(action: RunAction, status: PayrollRunStatus): string {
  switch (action) {
    case 'calculate':
      return status === 'draft' ? actionCopy.one.calculate : actionCopy.one.recalculate;
    case 'sendBack':
      return actionCopy.one.sendBack(payrollRunsCopy.status[sendBackTarget(status) ?? status]);
    default:
      return actionCopy.one[action];
  }
}

export function PayrollPeriodPage() {
  const { periodId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { companyId, loading: companyLoading, error: companyError, refresh: refreshCompanies } = useCompany();
  const { can } = usePermissions();
  const canCreate = can('payroll', 'create');
  const canEdit = can('payroll', 'edit');
  const allowed = useCallback((action: RunAction) => can('payroll', permissionFor(action)), [can]);

  const [period, setPeriod] = useState<PayrollPeriodRecord | null>(null);
  const [runs, setRuns] = useState<PayrollRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; notFound: boolean } | null>(null);

  const [notice, setNotice] = useState<string | null>(
    () => (location.state as { notice?: string } | null)?.notice ?? null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [failures, setFailures] = useState<PayrollBulkFailure[]>([]);
  const [generated, setGenerated] = useState<GeneratePayrollRunsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [breakdownRun, setBreakdownRun] = useState<PayrollRunRecord | null>(null);
  const [editPeriods, setEditPeriods] = useState<PayrollPeriodRecord[] | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PayrollRunStatus | 'all'>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDirection }>({ key: 'employee', dir: 'asc' });
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const loadSeq = useRef(0);
  const loaded = useRef(false);

  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const load = useCallback(async (): Promise<PayrollRunRecord[] | null> => {
    if (!companyId || !periodId) return null;
    const seq = ++loadSeq.current;
    try {
      const [nextPeriod, nextRuns] = await Promise.all([
        getPayrollPeriod(companyId, periodId),
        listPayrollRuns(companyId, periodId),
      ]);
      if (seq !== loadSeq.current) return null;
      loaded.current = true;
      setPeriod(nextPeriod);
      setRuns(nextRuns);
      setLoadError(null);
      setSelected((prev) => {
        const ids = new Set(nextRuns.map((run) => run.id));
        return new Set([...prev].filter((id) => ids.has(id)));
      });
      return nextRuns;
    } catch (err) {
      if (seq !== loadSeq.current) return null;
      const message = errorText(err, copy.loadError);
      if (loaded.current) setActionError(message);
      else setLoadError({ message, notFound: err instanceof ApiError && err.status === 404 });
      return null;
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [companyId, periodId]);

  useEffect(() => {
    loaded.current = false;
    setLoading(true);
    void load();
  }, [load]);

  const activeRuns = useMemo(() => runs.filter((run) => run.status !== 'cancelled'), [runs]);
  const totals = useMemo(() => totalsFor(activeRuns), [activeRuns]);
  const currency = baseCurrencyOf(activeRuns);
  const lockedCount = runs.filter(isLockedRun).length;
  const cancelledCount = runs.length - activeRuns.length;
  const zeroNet = runs.filter(
    (run) => ['calculated', 'under_review', 'approved'].includes(run.status) && toCents(run.netPay) === 0,
  ).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = runs.filter(
      (run) =>
        (statusFilter === 'all' || run.status === statusFilter) &&
        (!q ||
          (run.employeeName ?? '').toLowerCase().includes(q) ||
          (run.employeeNumber ?? '').toLowerCase().includes(q)),
    );
    const dir = sort.dir === 'asc' ? 1 : -1;
    const value = (run: PayrollRunRecord): number => {
      const amounts = baseAmounts(run);
      switch (sort.key) {
        case 'status':
          return run.status === 'cancelled' ? PAYROLL_RUN_FLOW.length : flowIndex(run.status);
        case 'gross':
          return amounts.gross;
        case 'deductions':
          return amounts.deductions;
        case 'net':
          return amounts.net;
        default:
          return 0;
      }
    };
    return [...rows].sort((a, b) => {
      const byName = (a.employeeName ?? '').localeCompare(b.employeeName ?? '');
      return ((sort.key === 'employee' ? byName : value(a) - value(b)) || byName) * dir;
    });
  }, [runs, statusFilter, search, sort]);

  const selectable = (run: PayrollRunRecord) => actionsFor(run.status).some(allowed);
  const selectableShown = filtered.filter(selectable);
  const selectedRuns = runs.filter((run) => selected.has(run.id));
  const selectionStatus =
    selectedRuns.length > 0 && selectedRuns.every((run) => run.status === selectedRuns[0].status)
      ? selectedRuns[0].status
      : null;
  const allShownSelected = selectableShown.length > 0 && selectableShown.every((run) => selected.has(run.id));

  const toggleSort = (key: SortKey) =>
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllShown = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const run of selectableShown) {
        if (allShownSelected) next.delete(run.id);
        else next.add(run.id);
      }
      return next;
    });

  const clearMessages = () => {
    setActionError(null);
    setFailures([]);
    setGenerated(null);
  };

  const execute = async (plan: ActionPlan) => {
    if (!companyId) return;
    const runIds = plan.runs.map((run) => run.id);
    const result =
      plan.action === 'calculate'
        ? await calculatePayrollRuns(companyId, periodId, { runIds })
        : await transitionPayrollRuns(companyId, periodId, {
            fromStatus: plan.fromStatus as PayrollRunStatus,
            targetStatus: plan.targetStatus as PayrollRunStatus,
            runIds,
            ...(PAYROLL_RUN_CONFIRMED_TARGETS.includes(plan.targetStatus as PayrollRunStatus)
              ? { expected: expectationFor(plan.totals) }
              : {}),
          });
    setFailures(result.failed);
    const done = result.succeeded.length;
    if (done > 0) {
      setNotice(
        plan.action === 'calculate'
          ? payrollRunsCopy.results.calculated(done)
          : payrollRunsCopy.results.transitioned(done, payrollRunsCopy.status[plan.targetStatus as PayrollRunStatus]),
      );
    }
    setSelected(new Set());
    await load();
  };

  const startAction = async (action: RunAction, targetRuns: PayrollRunRecord[], scope: ReviewState['scope']) => {
    const plan = buildPlan(action, targetRuns);
    if (!plan) return;
    clearMessages();
    if (needsConfirmation(plan)) {
      setReview({ plan, scope, stale: false, key: Date.now() });
      return;
    }
    setBusy(true);
    try {
      await execute(plan);
    } catch (err) {
      setActionError(errorText(err, copy.loadError));
    } finally {
      setBusy(false);
    }
  };

  const confirmReview = async () => {
    if (!review) return;
    try {
      await execute(review.plan);
      setReview(null);
    } catch (err) {
      if (!isStaleReview(err)) throw err;
      const fresh = (await load()) ?? [];
      const { plan, scope } = review;
      const ids = new Set(plan.runs.map((run) => run.id));
      const inStep = (run: PayrollRunRecord) =>
        plan.fromStatus ? run.status === plan.fromStatus : canCalculate(run.status);
      const next = buildPlan(
        plan.action,
        fresh.filter((run) => inStep(run) && (scope === 'step' || ids.has(run.id))),
      );
      if (!next) {
        setReview(null);
        setActionError(payrollRunsCopy.confirm.staleNothingLeft);
        return;
      }
      setReview({ plan: next, scope, stale: true, key: review.key + 1 });
    }
  };

  const generate = async () => {
    if (!companyId) return;
    clearMessages();
    setBusy(true);
    try {
      const result = await generatePayrollRuns(companyId, periodId);
      setGenerated(result);
      await load();
    } catch (err) {
      setActionError(errorText(err, copy.loadError));
    } finally {
      setBusy(false);
    }
  };

  const openEdit = async () => {
    if (!companyId) return;
    try {
      setEditPeriods(await listPayrollPeriods(companyId));
    } catch {
      setEditPeriods([]);
    }
  };

  const stepActions = (status: PayrollRunStatus, stepRuns: PayrollRunRecord[]): StepAction[] =>
    actionsFor(status)
      .filter(allowed)
      .map((action) => ({
        key: action,
        label: bulkLabel(action, stepRuns.length, status),
        danger: action === 'cancel',
        onClick: () => void startAction(action, stepRuns, 'step'),
      }));

  const exportCsv = () => {
    if (!period) return;
    downloadCsvFile(
      `payroll-${period.startDate.slice(0, 10)}-${period.endDate.slice(0, 10)}.csv`,
      [
        'Employee ID',
        tableCopy.colEmployee,
        tableCopy.colStatus,
        'Pay currency',
        tableCopy.colGross,
        tableCopy.colDeductions,
        tableCopy.colNet,
        'Base currency',
        'Exchange rate',
        `${tableCopy.colGross} (base)`,
        `${tableCopy.colNet} (base)`,
        'Finalized at',
      ],
      filtered.map((run) => [
        run.employeeNumber ?? '',
        run.employeeName ?? '',
        payrollRunsCopy.status[run.status],
        run.payCurrency ?? '',
        run.grossPay,
        run.totalDeductions,
        run.netPay,
        run.baseCurrency ?? '',
        run.exchangeRate ?? '',
        run.grossPayBase ?? '',
        run.netPayBase ?? '',
        run.finalizedAt ?? '',
      ]),
    );
  };

  if (companyLoading) return <PageLoadingState />;
  if (companyError) return <PageErrorState error={companyError} onRetry={() => void refreshCompanies()} />;

  const backLink = (
    <button
      type="button"
      onClick={() => navigate('/payroll/runs')}
      className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary"
    >
      <ArrowLeft className="h-4 w-4" /> {copy.back}
    </button>
  );

  if (loadError) {
    return (
      <div className="p-4 lg:p-6 space-y-4 max-w-[1400px] mx-auto">
        {backLink}
        <OrgErrorBanner
          message={loadError.notFound ? copy.notFound : loadError.message}
          onRetry={loadError.notFound ? undefined : () => void load()}
        />
      </div>
    );
  }

  if (loading || !period) {
    return (
      <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
        {backLink}
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Card className="overflow-hidden">
          <OrgTableSkeleton columns={6} rows={5} />
        </Card>
      </div>
    );
  }

  const label = periodLabel(period);
  const filtersActive = statusFilter !== 'all' || search.trim() !== '';
  const money = (value: string) => (
    <>
      {formatMoney(value)}
      {currency ? <span className="ml-1 text-sm font-normal text-muted">{currency}</span> : null}
    </>
  );

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="space-y-3">
        {backLink}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted uppercase tracking-wide">{payrollCopy.common.eyebrow}</p>
            <h1 className="text-xl font-bold text-primary flex items-center gap-2">
              {lockedCount > 0 && lockedCount === activeRuns.length ? (
                <Lock className="h-4 w-4 text-muted" aria-label={payrollRunsCopy.periods.locked} />
              ) : null}
              {label}
            </h1>
            <p className="text-sm text-secondary mt-0.5">
              {formatDate(period.startDate)} – {formatDate(period.endDate)} · {copy.paidOn(formatDate(period.paymentDate))}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && period.status !== 'closed' ? (
              <Button variant="secondary" onClick={() => void openEdit()} disabled={busy}>
                <Pencil className="h-4 w-4" /> {copy.edit}
              </Button>
            ) : null}
            {canCreate ? (
              <Button variant={runs.length === 0 ? 'primary' : 'secondary'} onClick={() => void generate()} disabled={busy}>
                <UserPlus className="h-4 w-4" /> {runs.length === 0 ? copy.addEmployees : copy.addMissing}
              </Button>
            ) : null}
          </div>
        </div>
        {!isCalendarMonth(period.startDate, period.endDate) ? (
          <p className="flex items-start gap-2 text-xs text-secondary max-w-3xl">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted" />
            {payrollRunsCopy.periodForm.calendarMonthHint(monthName(period.endDate))}
          </p>
        ) : null}
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

      {actionError ? (
        <div
          role="alert"
          className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-2.5"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{actionError}</span>
          <DismissButton onClick={() => setActionError(null)} />
        </div>
      ) : null}

      {generated ? <GenerateResult result={generated} onDismiss={() => setGenerated(null)} /> : null}
      {failures.length > 0 ? <FailureList failures={failures} onDismiss={() => setFailures([])} /> : null}

      {lockedCount > 0 ? (
        <div className="flex items-start gap-2 text-sm text-secondary rounded-lg border border-base bg-[rgb(var(--bg-muted))] px-4 py-2.5">
          <Lock className="h-4 w-4 shrink-0 mt-0.5 text-muted" />
          {copy.lockedBanner}
        </div>
      ) : null}

      {runs.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={copy.noRunsTitle}
            description={copy.noRunsDescription}
            action={canCreate ? { label: copy.addEmployees, onClick: () => void generate(), icon: UserPlus } : undefined}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label={copy.statEmployees} value={String(activeRuns.length)} />
            <Stat label={copy.statGross} value={money(totals.grossPay)} />
            <Stat label={copy.statDeductions} value={money(totals.totalDeductions)} />
            <Stat label={copy.statNet} value={money(totals.netPay)} strong />
          </div>

          {zeroNet > 0 ? (
            <div className="flex items-start gap-2 text-sm rounded-lg border border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-900/20 px-4 py-2.5 text-warning-800 dark:text-warning-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning-600" />
              {copy.zeroNet(zeroNet)}
            </div>
          ) : null}

          <Card className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-primary">{copy.flowTitle}</h2>
                <p className="text-xs text-secondary mt-0.5">{copy.flowHint}</p>
              </div>
              {cancelledCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'cancelled' ? 'all' : 'cancelled')}
                  className="text-xs text-muted hover:text-primary underline-offset-2 hover:underline"
                >
                  {copy.cancelledCount(cancelledCount)}
                </button>
              ) : null}
            </div>
            <PayrollStatusFlow
              runs={runs}
              filter={statusFilter}
              onFilter={setStatusFilter}
              actionsFor={stepActions}
              busy={busy}
            />
          </Card>

          <Card className="overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-5 py-4 border-b border-base">
              <h2 className="text-sm font-semibold text-primary">{tableCopy.title}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-44">
                  <Select
                    aria-label={tableCopy.colStatus}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as PayrollRunStatus | 'all')}
                    className="h-9 py-1"
                  >
                    <option value="all">{tableCopy.allStatuses}</option>
                    {[...PAYROLL_RUN_FLOW, 'cancelled' as const].map((status) => (
                      <option key={status} value={status}>
                        {payrollRunsCopy.status[status]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <Input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={tableCopy.searchPlaceholder}
                    aria-label={tableCopy.searchPlaceholder}
                    className="pl-9 h-9"
                  />
                </div>
                <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
                  <Download className="h-4 w-4" /> {payrollCopy.common.exportCsv}
                </Button>
              </div>
            </div>

            {selectedRuns.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b border-base bg-accent-50/60 dark:bg-accent-950/20">
                <span className="text-sm font-medium text-primary">{tableCopy.selected(selectedRuns.length)}</span>
                {selectionStatus ? (
                  actionsFor(selectionStatus)
                    .filter(allowed)
                    .map((action, index) => (
                      <Button
                        key={action}
                        size="sm"
                        variant={action === 'cancel' ? 'ghost' : index === 0 ? 'primary' : 'secondary'}
                        onClick={() => void startAction(action, selectedRuns, 'selection')}
                        disabled={busy}
                        className={action === 'cancel' ? 'text-error-600' : undefined}
                      >
                        {bulkLabel(action, selectedRuns.length, selectionStatus)}
                      </Button>
                    ))
                ) : (
                  <span className="text-xs text-secondary">{tableCopy.mixedSelection}</span>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="ml-auto">
                  {tableCopy.clearSelection}
                </Button>
              </div>
            ) : null}

            {filtered.length === 0 ? (
              <EmptyState
                compact
                icon={Search}
                title={tableCopy.noMatchTitle}
                description={tableCopy.noMatchDescription}
                action={
                  filtersActive
                    ? {
                        label: tableCopy.clearFilters,
                        variant: 'secondary',
                        onClick: () => {
                          setStatusFilter('all');
                          setSearch('');
                        },
                      }
                    : undefined
                }
              />
            ) : (
              <DataTable className="max-h-[65vh] overflow-y-auto">
                <DataTableHead>
                  <tr>
                    <th className="pl-5 pr-2 py-3 w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-base accent-accent-600"
                        aria-label={tableCopy.selectAll}
                        checked={allShownSelected}
                        disabled={selectableShown.length === 0}
                        onChange={toggleAllShown}
                      />
                    </th>
                    <th className="text-left px-3 py-3">
                      <SortableHeader label={tableCopy.colEmployee} active={sort.key === 'employee'} direction={sort.dir} onSort={() => toggleSort('employee')} />
                    </th>
                    <th className="text-left px-3 py-3">
                      <SortableHeader label={tableCopy.colStatus} active={sort.key === 'status'} direction={sort.dir} onSort={() => toggleSort('status')} />
                    </th>
                    <th className="text-right px-3 py-3 hidden md:table-cell">
                      <SortableHeader label={tableCopy.colGross} active={sort.key === 'gross'} direction={sort.dir} onSort={() => toggleSort('gross')} />
                    </th>
                    <th className="text-right px-3 py-3 hidden md:table-cell">
                      <SortableHeader
                        label={tableCopy.colDeductions}
                        active={sort.key === 'deductions'}
                        direction={sort.dir}
                        onSort={() => toggleSort('deductions')}
                      />
                    </th>
                    <th className="text-right px-3 py-3">
                      <SortableHeader label={tableCopy.colNet} active={sort.key === 'net'} direction={sort.dir} onSort={() => toggleSort('net')} />
                    </th>
                    <th className="px-5 py-3 w-12">
                      <span className="sr-only">{payrollCopy.common.actions}</span>
                    </th>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {filtered.map((run) => {
                    const locked = isLockedRun(run);
                    const name = run.employeeName ?? run.employeeNumber ?? run.employeeId;
                    const rowActions = actionsFor(run.status).filter(allowed);
                    const notCalculated = run.status === 'draft';
                    const foreign = run.payCurrency && currency && run.payCurrency !== currency ? run.payCurrency : null;
                    const amount = (value: string) =>
                      notCalculated ? (
                        <span className="text-muted" title={tableCopy.notCalculated}>
                          {payrollCopy.common.none}
                        </span>
                      ) : (
                        formatMoney(value)
                      );
                    return (
                      <tr
                        key={run.id}
                        onClick={() => setBreakdownRun(run)}
                        className={`cursor-pointer transition-colors hover:bg-[rgb(var(--bg-hover))] ${
                          selected.has(run.id) ? 'bg-accent-50/60 dark:bg-accent-950/20' : locked ? 'bg-[rgb(var(--bg-muted))]/50' : ''
                        } ${run.status === 'cancelled' ? 'opacity-60' : ''}`}
                        title={locked ? tableCopy.lockedRow : undefined}
                      >
                        <td className="pl-5 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-base accent-accent-600"
                            aria-label={tableCopy.selectRow(name)}
                            checked={selected.has(run.id)}
                            disabled={!selectable(run)}
                            onChange={() => toggleRow(run.id)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={name} size="sm" />
                            <div className="min-w-0">
                              <div className="font-medium text-primary truncate">{name}</div>
                              <div className="text-xs text-muted">{run.employeeNumber}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <RunStatusPill status={run.status} locked={locked} />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-secondary hidden md:table-cell">{amount(run.grossPay)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-secondary hidden md:table-cell">
                          {amount(run.totalDeductions)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          <span className="font-semibold text-primary">{amount(run.netPay)}</span>
                          {foreign && !notCalculated ? (
                            <div className="text-xs text-muted">{tableCopy.otherCurrency(foreign)}</div>
                          ) : null}
                        </td>
                        <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <Dropdown
                            width="w-60"
                            trigger={
                              <button
                                type="button"
                                aria-label={`${payrollCopy.common.actions}: ${name}`}
                                className="text-muted hover:text-primary p-1 rounded hover:bg-[rgb(var(--bg-muted))] transition-colors"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            }
                          >
                            <DropdownItem onClick={() => setBreakdownRun(run)}>{actionCopy.viewBreakdown}</DropdownItem>
                            {rowActions.length > 0 ? <DropdownDivider /> : null}
                            {rowActions.map((action) => (
                              <DropdownItem
                                key={action}
                                onClick={() => void startAction(action, [run], 'selection')}
                                disabled={busy}
                              >
                                <span className={action === 'cancel' ? 'text-error-600' : undefined}>
                                  {singleLabel(action, run.status)}
                                </span>
                              </DropdownItem>
                            ))}
                          </Dropdown>
                        </td>
                      </tr>
                    );
                  })}
                </DataTableBody>
              </DataTable>
            )}
          </Card>
        </>
      )}

      {review ? (
        <PayrollReviewDialog
          key={review.key}
          open
          title={
            review.plan.action === 'calculate'
              ? payrollRunsCopy.confirm.titles.recalculate
              : payrollRunsCopy.confirm.titles[review.plan.action as 'approve' | 'finalize' | 'pay' | 'cancel']
          }
          intro={
            review.plan.action === 'calculate'
              ? payrollRunsCopy.confirm.intros.recalculate(
                  review.plan.runs.filter((run) => run.status === 'under_review').length,
                )
              : payrollRunsCopy.confirm.intros[review.plan.action as 'approve' | 'finalize' | 'pay' | 'cancel']
          }
          acknowledgement={
            review.plan.action === 'finalize' || review.plan.action === 'pay'
              ? payrollRunsCopy.confirm.acknowledge[review.plan.action]
              : null
          }
          tone={review.plan.action === 'cancel' ? 'danger' : 'primary'}
          confirmLabel={
            review.plan.fromStatus
              ? bulkLabel(review.plan.action, review.plan.runs.length, review.plan.fromStatus)
              : actionCopy.recalculate(review.plan.runs.length)
          }
          onClose={() => setReview(null)}
          onConfirm={confirmReview}
        >
          <PayrollRunActionReview plan={review.plan} period={period} allRuns={runs} stale={review.stale} />
        </PayrollReviewDialog>
      ) : null}

      {companyId ? (
        <>
          <PayrollRunBreakdownModal
            companyId={companyId}
            run={breakdownRun}
            periodLabel={label}
            onClose={() => setBreakdownRun(null)}
          />
          <PayrollPeriodFormModal
            open={editPeriods !== null}
            companyId={companyId}
            period={period}
            existing={editPeriods ?? []}
            onClose={() => setEditPeriods(null)}
            onSaved={() => {
              setEditPeriods(null);
              setNotice(payrollRunsCopy.periodForm.saved);
              void load();
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="surface rounded-xl border border-base shadow-card px-4 py-3.5">
      <div className="text-xs text-secondary">{label}</div>
      <div className={`mt-1 tabular-nums text-primary ${strong ? 'text-2xl font-bold' : 'text-xl font-semibold'}`}>{value}</div>
    </div>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={payrollRunsCopy.results.dismiss}
      className="shrink-0 p-0.5 rounded text-current opacity-70 hover:opacity-100"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

function GenerateResult({ result, onDismiss }: { result: GeneratePayrollRunsResult; onDismiss: () => void }) {
  const copyResults = payrollRunsCopy.results;
  const skipped = result.withoutSalaryStructure.length + result.inOverlappingPeriod.length;
  return (
    <div
      role="status"
      className={`rounded-lg border px-4 py-3 text-sm ${
        skipped > 0
          ? 'border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-900/20 text-warning-900 dark:text-warning-100'
          : 'border-success-200 dark:border-success-800 bg-success-50 dark:bg-success-900/20 text-success-800 dark:text-success-200'
      }`}
    >
      <div className="flex items-start gap-2">
        {skipped > 0 ? (
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning-600" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 space-y-2">
          <p>
            {copyResults.generated(result.created.length)}
            {result.alreadyIncluded > 0 ? ` ${copyResults.alreadyIncluded(result.alreadyIncluded)}` : ''}
          </p>
          {result.withoutSalaryStructure.length > 0 ? (
            <div>
              <p className="font-semibold">{copyResults.withoutStructureTitle(result.withoutSalaryStructure.length)}</p>
              <p className="mt-0.5">
                {result.withoutSalaryStructure.map((e) => `${e.fullName} (${e.employeeNumber})`).join(', ')}
              </p>
            </div>
          ) : null}
          {result.inOverlappingPeriod.length > 0 ? (
            <div>
              <p className="font-semibold">{copyResults.overlapTitle(result.inOverlappingPeriod.length)}</p>
              <p className="mt-0.5">
                {result.inOverlappingPeriod
                  .map((e) =>
                    copyResults.overlapItem(
                      e.fullName,
                      periodLabel({ startDate: e.periodStartDate, endDate: e.periodEndDate }),
                    ),
                  )
                  .join(', ')}
              </p>
            </div>
          ) : null}
        </div>
        <DismissButton onClick={onDismiss} />
      </div>
    </div>
  );
}

function FailureList({ failures, onDismiss }: { failures: PayrollBulkFailure[]; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-800 dark:text-error-200"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold">{payrollRunsCopy.results.failuresTitle(failures.length)}</p>
          <ul className="mt-1.5 space-y-1 max-h-40 overflow-y-auto">
            {failures.map((failure) => (
              <li key={failure.runId}>
                <span className="font-medium">
                  {failure.employeeName} ({failure.employeeNumber})
                </span>
                : {failure.message}
              </li>
            ))}
          </ul>
        </div>
        <DismissButton onClick={onDismiss} />
      </div>
    </div>
  );
}
