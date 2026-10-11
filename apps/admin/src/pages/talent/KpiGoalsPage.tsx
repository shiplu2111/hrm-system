import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Info,
  Library,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  Target,
  Users,
  XCircle,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import {
  findKpiMeasurementWindow,
  formatKpiDateRange,
  KPI_ON_TRACK_PERCENT,
  KPI_WEIGHT_LIMIT_PERCENT,
  kpiMeasurementWindows,
  type EmployeeKpiAssignmentRecord,
  type EmployeeKpiAssignmentStatus,
  type EmployeeRecord,
  type KpiDefinitionRecord,
  type KpiDirection,
  type KpiMeasurementPeriod,
  type KpiUnit,
  type PerformanceReviewCycleRecord,
} from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { StatusPill, type StatusPillTone } from '@/components/ui/StatusPill';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
import { listEmployees } from '@/lib/employees-api';
import {
  bulkAssignKpi,
  createKpiAssignment,
  createKpiDefinition,
  formatKpiValue,
  KPI_ASSIGNMENT_STATUS_LABELS,
  KPI_DIRECTION_LABELS,
  KPI_UNIT_LABELS,
  listKpiAssignments,
  listKpiDefinitions,
  listReviewCycles,
  MEASUREMENT_PERIOD_LABELS,
  REVIEW_CYCLE_STATUS_LABELS,
  updateKpiAssignment,
  updateKpiDefinition,
  type UpdateKpiAssignmentInput,
} from '@/lib/performance-api';
import { ApiError } from '@/lib/tenant-api-client';

type Tab = 'assignments' | 'library';
type StatusFilter = 'open' | 'all' | EmployeeKpiAssignmentStatus;

const STATUS_TONE: Record<EmployeeKpiAssignmentStatus, StatusPillTone> = {
  draft: 'neutral',
  active: 'accent',
  completed: 'success',
  cancelled: 'neutral',
};

const CYCLE_TONE: Record<PerformanceReviewCycleRecord['status'], StatusPillTone> = {
  draft: 'neutral',
  active: 'accent',
  closed: 'success',
  archived: 'neutral',
};

const PERIOD_TYPES: KpiMeasurementPeriod[] = ['monthly', 'quarterly', 'semi_annual', 'annual', 'custom'];
const PERIOD_NOUN: Record<Exclude<KpiMeasurementPeriod, 'custom'>, string> = {
  monthly: 'month',
  quarterly: 'quarter',
  semi_annual: 'half-year',
  annual: 'year',
};
const UNITS = Object.keys(KPI_UNIT_LABELS) as KpiUnit[];
const DIRECTIONS = Object.keys(KPI_DIRECTION_LABELS) as KpiDirection[];
const ALL_WINDOWS = '__all__';

const NEXT_STATUSES: Record<EmployeeKpiAssignmentStatus, EmployeeKpiAssignmentStatus[]> = {
  draft: ['draft', 'active', 'cancelled'],
  active: ['active', 'completed', 'cancelled'],
  completed: ['completed', 'active', 'cancelled'],
  cancelled: ['cancelled'],
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

function isCycleLocked(cycle: PerformanceReviewCycleRecord | null): boolean {
  return cycle?.status === 'closed' || cycle?.status === 'archived';
}

function periodLabel(
  assignment: Pick<
    EmployeeKpiAssignmentRecord,
    'measurementPeriod' | 'measurementPeriodStart' | 'measurementPeriodEnd'
  >,
  cycle: PerformanceReviewCycleRecord | null,
): string {
  if (cycle && assignment.measurementPeriod !== 'custom') {
    const window = findKpiMeasurementWindow(
      cycle.periodStart,
      cycle.periodEnd,
      assignment.measurementPeriod,
      assignment.measurementPeriodStart,
      assignment.measurementPeriodEnd,
    );
    if (window) return window.label;
  }
  return `${MEASUREMENT_PERIOD_LABELS[assignment.measurementPeriod]} · ${formatKpiDateRange(
    assignment.measurementPeriodStart,
    assignment.measurementPeriodEnd,
  )}`;
}

function weightTotal(rows: EmployeeKpiAssignmentRecord[]): number {
  const total = rows
    .filter((row) => row.status !== 'cancelled')
    .reduce((sum, row) => sum + (row.weightPercent ?? 0), 0);
  return Math.round(total * 100) / 100;
}

/** `undefined` for blank input, `NaN` for invalid input. */
function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function targetError(value: number | undefined, direction: KpiDirection): string | null {
  if (value === undefined) return 'Enter a target value';
  if (Number.isNaN(value) || value < 0) return 'Target must be a number of zero or more';
  if (value === 0 && direction === 'higher_is_better') {
    return 'Target must be greater than zero when higher is better';
  }
  return null;
}

function weightError(value: number | undefined): string | null {
  if (value === undefined) return null;
  if (Number.isNaN(value) || value < 0 || value > 100) return 'Weight must be between 0 and 100';
  return null;
}

function formatDay(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

// ── Measurement period picker ────────────────────────────────────────────────

interface PeriodValue {
  type: KpiMeasurementPeriod;
  /** `${start}|${end}` of the chosen window, or ALL_WINDOWS. Unused for custom. */
  window: string;
  start: string;
  end: string;
}

const windowKey = (start: string, end: string) => `${start}|${end}`;

function initialPeriod(
  cycle: PerformanceReviewCycleRecord,
  from?: Pick<EmployeeKpiAssignmentRecord, 'measurementPeriod' | 'measurementPeriodStart' | 'measurementPeriodEnd'>,
): PeriodValue {
  if (from) {
    const fits =
      from.measurementPeriod !== 'custom' &&
      findKpiMeasurementWindow(
        cycle.periodStart,
        cycle.periodEnd,
        from.measurementPeriod,
        from.measurementPeriodStart,
        from.measurementPeriodEnd,
      );
    return {
      type: fits ? from.measurementPeriod : 'custom',
      window: fits ? windowKey(from.measurementPeriodStart, from.measurementPeriodEnd) : '',
      start: from.measurementPeriodStart,
      end: from.measurementPeriodEnd,
    };
  }
  const first = kpiMeasurementWindows(cycle.periodStart, cycle.periodEnd, cycle.measurementPeriod)[0];
  return first
    ? { type: cycle.measurementPeriod, window: windowKey(first.start, first.end), start: first.start, end: first.end }
    : { type: 'custom', window: '', start: cycle.periodStart, end: cycle.periodEnd };
}

function periodError(value: PeriodValue, cycle: PerformanceReviewCycleRecord): string | null {
  if (value.type !== 'custom') return value.window ? null : 'Choose a measurement window';
  if (!value.start || !value.end) return 'Enter the measurement start and end dates';
  if (value.start > value.end) return 'Measurement start must be on or before the end';
  if (value.start < cycle.periodStart || value.end > cycle.periodEnd) {
    return `Measurement dates must fall within the cycle (${formatKpiDateRange(cycle.periodStart, cycle.periodEnd)})`;
  }
  return null;
}

function MeasurementPeriodFields({
  cycle,
  value,
  onChange,
  allowEveryWindow = false,
  disabled = false,
}: {
  cycle: PerformanceReviewCycleRecord;
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
  allowEveryWindow?: boolean;
  disabled?: boolean;
}) {
  const windows = useMemo(
    () => kpiMeasurementWindows(cycle.periodStart, cycle.periodEnd, value.type),
    [cycle.periodStart, cycle.periodEnd, value.type],
  );

  const changeType = (type: KpiMeasurementPeriod) => {
    if (type === 'custom') {
      onChange({ type, window: '', start: value.start || cycle.periodStart, end: value.end || cycle.periodEnd });
      return;
    }
    const options = kpiMeasurementWindows(cycle.periodStart, cycle.periodEnd, type);
    const match = options.find((w) => w.start <= value.start && value.start <= w.end) ?? options[0];
    onChange({
      type,
      window: match ? windowKey(match.start, match.end) : '',
      start: match?.start ?? cycle.periodStart,
      end: match?.end ?? cycle.periodEnd,
    });
  };

  const changeWindow = (key: string) => {
    if (key === ALL_WINDOWS) {
      onChange({ ...value, window: ALL_WINDOWS });
      return;
    }
    const [start, end] = key.split('|');
    onChange({ ...value, window: key, start, end });
  };

  const hasPartial = windows.some((w) => w.partial);

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <Label htmlFor="kpi-period-type">Measurement period</Label>
          <Select
            id="kpi-period-type"
            value={value.type}
            onChange={(e) => changeType(e.target.value as KpiMeasurementPeriod)}
            disabled={disabled}
          >
            {PERIOD_TYPES.map((type) => (
              <option key={type} value={type}>
                {MEASUREMENT_PERIOD_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>
        {value.type === 'custom' ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="kpi-period-start">From</Label>
              <Input
                id="kpi-period-start"
                type="date"
                min={cycle.periodStart}
                max={cycle.periodEnd}
                value={value.start}
                onChange={(e) => onChange({ ...value, start: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div>
              <Label htmlFor="kpi-period-end">To</Label>
              <Input
                id="kpi-period-end"
                type="date"
                min={cycle.periodStart}
                max={cycle.periodEnd}
                value={value.end}
                onChange={(e) => onChange({ ...value, end: e.target.value })}
                disabled={disabled}
              />
            </div>
          </div>
        ) : (
          <div>
            <Label htmlFor="kpi-period-window">Window</Label>
            <Select
              id="kpi-period-window"
              value={value.window}
              onChange={(e) => changeWindow(e.target.value)}
              disabled={disabled}
            >
              {windows.map((w) => (
                <option key={w.index} value={windowKey(w.start, w.end)}>
                  {w.label}
                  {w.partial ? ' (shortened)' : ''}
                </option>
              ))}
              {allowEveryWindow && windows.length > 1 ? (
                <option value={ALL_WINDOWS}>
                  Every {PERIOD_NOUN[value.type as Exclude<KpiMeasurementPeriod, 'custom'>]} in the cycle (
                  {windows.length} goals each)
                </option>
              ) : null}
            </Select>
          </div>
        )}
      </div>
      <p className="text-xs text-muted">
        Windows are counted from the cycle start ({formatKpiDateRange(cycle.periodStart, cycle.periodEnd)}).
        {hasPartial && value.type !== 'custom' ? ' The last window is shortened to end with the cycle.' : ''}
      </p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function KpiGoalsPage() {
  const { companyId } = useCompany();
  const { navigate } = useNav();
  const { can } = usePermissions();
  const canCreate = can('performance', 'create');
  const canEdit = can('performance', 'edit');

  const [tab, setTab] = useState<Tab>('assignments');
  const [cycles, setCycles] = useState<PerformanceReviewCycleRecord[]>([]);
  const [definitions, setDefinitions] = useState<KpiDefinitionRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [assignments, setAssignments] = useState<EmployeeKpiAssignmentRecord[]>([]);
  const [cycleId, setCycleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [definitionFilter, setDefinitionFilter] = useState('');

  const [definitionForm, setDefinitionForm] = useState<{ definition: KpiDefinitionRecord | null } | null>(null);
  const [assignForm, setAssignForm] = useState<{ definitionId?: string } | null>(null);
  const [editing, setEditing] = useState<EmployeeKpiAssignmentRecord | null>(null);
  const [cancelling, setCancelling] = useState<EmployeeKpiAssignmentRecord | null>(null);
  const [deactivating, setDeactivating] = useState<KpiDefinitionRecord | null>(null);

  const cycle = cycles.find((row) => row.id === cycleId) ?? null;
  const cycleLocked = isCycleLocked(cycle);

  const loadBase = useCallback(async () => {
    if (!companyId) return;
    const [cycleRows, definitionRows, employeeRows] = await Promise.all([
      listReviewCycles(companyId),
      listKpiDefinitions(companyId),
      listEmployees(companyId),
    ]);
    setCycles(cycleRows);
    setDefinitions(definitionRows);
    setEmployees(employeeRows);
    setCycleId((current) =>
      current && cycleRows.some((row) => row.id === current)
        ? current
        : ((cycleRows.find((row) => row.status === 'active') ?? cycleRows[0])?.id ?? ''),
    );
  }, [companyId]);

  const loadAssignments = useCallback(async () => {
    if (!companyId || !cycleId) {
      setAssignments([]);
      return;
    }
    setAssignmentsLoading(true);
    try {
      setAssignments(await listKpiAssignments(companyId, { reviewCycleId: cycleId }));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load KPI goals'));
    } finally {
      setAssignmentsLoading(false);
    }
  }, [companyId, cycleId]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    loadBase()
      .catch((err) => setError(errorMessage(err, 'Failed to load KPIs and goals')))
      .finally(() => setLoading(false));
  }, [companyId, loadBase]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await Promise.all([loadBase(), loadAssignments()]);
    } catch (err) {
      setError(errorMessage(err, 'Failed to refresh'));
    } finally {
      setRefreshing(false);
    }
  };

  const afterSave = async (message: string) => {
    setNotice(message);
    await Promise.all([loadBase(), loadAssignments()]);
  };

  const byEmployee = useMemo(() => {
    const map = new Map<string, EmployeeKpiAssignmentRecord[]>();
    for (const row of assignments) {
      map.set(row.employeeId, [...(map.get(row.employeeId) ?? []), row]);
    }
    return map;
  }, [assignments]);

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const visible = assignments.filter((row) => {
      if (statusFilter === 'open' && row.status === 'cancelled') return false;
      if (statusFilter !== 'open' && statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (definitionFilter && row.kpiDefinitionId !== definitionFilter) return false;
      if (!query) return true;
      return (
        row.employeeName.toLowerCase().includes(query) ||
        row.employeeNumber.toLowerCase().includes(query) ||
        row.title.toLowerCase().includes(query)
      );
    });
    const grouped = new Map<string, EmployeeKpiAssignmentRecord[]>();
    for (const row of visible) {
      grouped.set(row.employeeId, [...(grouped.get(row.employeeId) ?? []), row]);
    }
    return [...grouped.entries()]
      .map(([employeeId, rows]) => ({
        employeeId,
        employeeName: rows[0].employeeName,
        employeeNumber: rows[0].employeeNumber,
        rows,
        weight: weightTotal(byEmployee.get(employeeId) ?? []),
        hasWeights: (byEmployee.get(employeeId) ?? []).some(
          (row) => row.status !== 'cancelled' && row.weightPercent != null,
        ),
        targetsLocked: rows.some((row) => row.lockState === 'targets_locked'),
      }))
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [assignments, byEmployee, search, statusFilter, definitionFilter]);

  const stats = useMemo(() => {
    const live = assignments.filter((row) => row.status !== 'cancelled');
    const active = live.filter((row) => row.status === 'active');
    const measured = active.filter((row) => row.progressPercent != null);
    const employeesWithGoals = new Set(live.map((row) => row.employeeId));
    let weightIssues = 0;
    for (const employeeId of employeesWithGoals) {
      const rows = byEmployee.get(employeeId) ?? [];
      const hasWeights = rows.some((row) => row.status !== 'cancelled' && row.weightPercent != null);
      if (hasWeights && weightTotal(rows) !== KPI_WEIGHT_LIMIT_PERCENT) weightIssues += 1;
    }
    return {
      goals: live.length,
      employees: employeesWithGoals.size,
      averageProgress:
        measured.length > 0
          ? Math.round(measured.reduce((sum, row) => sum + (row.progressPercent ?? 0), 0) / measured.length)
          : null,
      atRisk: measured.filter((row) => (row.progressPercent ?? 0) < KPI_ON_TRACK_PERCENT).length,
      notMeasured: active.length - measured.length,
      weightIssues,
    };
  }, [assignments, byEmployee]);

  const markCompleted = async (assignment: EmployeeKpiAssignmentRecord) => {
    try {
      await updateKpiAssignment(assignment.id, { status: 'completed' });
      await afterSave(`"${assignment.title}" for ${assignment.employeeName} is marked completed.`);
    } catch (err) {
      setError(errorMessage(err, 'Failed to update goal'));
    }
  };

  const activateDefinition = async (definition: KpiDefinitionRecord) => {
    try {
      await updateKpiDefinition(definition.id, { isActive: true });
      await afterSave(`"${definition.name}" is active again and can be assigned.`);
    } catch (err) {
      setError(errorMessage(err, 'Failed to reactivate KPI'));
    }
  };

  if (!companyId) {
    return <div className="p-6 text-sm text-secondary">Select a company to manage KPIs and goals.</div>;
  }

  const activeDefinitions = definitions.filter((row) => row.isActive);
  const canAssign = canCreate && Boolean(cycle) && !cycleLocked;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-primary">KPIs &amp; Goals</h1>
          <p className="mt-0.5 text-sm text-secondary">
            Build the KPI library and assign measurable goals to employees, each with a target and a measurement
            period inside a review cycle.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:shrink-0 xl:flex-nowrap">
          <Button variant="secondary" onClick={() => void refresh()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          {canCreate ? (
            <Button variant="secondary" onClick={() => setDefinitionForm({ definition: null })}>
              <Library className="h-4 w-4" /> New KPI
            </Button>
          ) : null}
          {canCreate ? (
            <Button
              onClick={() => setAssignForm({})}
              disabled={!canAssign}
              title={cycleLocked ? 'This review cycle is closed' : undefined}
            >
              <Plus className="h-4 w-4" /> Assign KPI
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:bg-success-950/30 dark:text-success-300"
        >
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-secondary">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading KPIs and goals…
        </div>
      ) : (
        <>
          <section className="surface rounded-xl border border-base p-4 shadow-card">
            {cycles.length === 0 ? (
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <CalendarRange className="mt-0.5 h-5 w-5 text-muted" />
                  <div>
                    <p className="text-sm font-medium text-primary">No review cycles yet</p>
                    <p className="text-sm text-secondary">
                      KPI goals belong to a review cycle. Create one first, then come back to assign goals.
                    </p>
                  </div>
                </div>
                <Button variant="secondary" onClick={() => navigate('performance-cycles')}>
                  Go to review cycles
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="grid w-full gap-3 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-end">
                  <div>
                    <Label htmlFor="kpi-cycle">Review cycle</Label>
                    <Select id="kpi-cycle" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
                      {cycles.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name} · {REVIEW_CYCLE_STATUS_LABELS[row.status]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {cycle ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2 text-sm text-secondary">
                      <StatusPill tone={CYCLE_TONE[cycle.status]}>{REVIEW_CYCLE_STATUS_LABELS[cycle.status]}</StatusPill>
                      <span>{formatKpiDateRange(cycle.periodStart, cycle.periodEnd)}</span>
                      <span className="text-muted">·</span>
                      <span>{MEASUREMENT_PERIOD_LABELS[cycle.measurementPeriod]} measurement</span>
                      <span className="text-muted">·</span>
                      <span>Reviews due {formatDay(cycle.reviewDueDate)}</span>
                    </div>
                  ) : null}
                </div>
                <Button variant="ghost" size="sm" className="shrink-0" onClick={() => navigate('performance-cycles')}>
                  <CalendarRange className="h-3.5 w-3.5" /> Manage cycles
                </Button>
              </div>
            )}
          </section>

          {cycle && cycleLocked ? (
            <div className="flex items-start gap-2 rounded-lg border border-base bg-[rgb(var(--bg-muted))] px-4 py-3 text-sm text-secondary">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {cycle.name} is {REVIEW_CYCLE_STATUS_LABELS[cycle.status].toLowerCase()}, so its KPI goals are read-only.
              </p>
            </div>
          ) : null}

          <section className="flex gap-3 rounded-xl border border-accent-200 bg-accent-50/60 p-4 text-sm dark:border-accent-900 dark:bg-accent-950/20">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-600 dark:text-accent-400" />
            <div className="space-y-1 text-secondary">
              <p className="font-medium text-primary">How goals are measured</p>
              <p>
                Each goal has a target and a measurement window inside the cycle, such as a month, quarter or half-year
                counted from the cycle start. An employee’s goal weights in one cycle can add up to at most{' '}
                {KPI_WEIGHT_LIMIT_PERCENT}%. When an employee’s review launches, it takes a copy of their goals, so
                targets, windows and weights are then fixed. Progress, notes and status can still be updated.
              </p>
            </div>
          </section>

          <nav className="surface flex gap-1 rounded-xl border border-base p-1.5 shadow-card" aria-label="KPI sections">
            {(
              [
                ['assignments', 'Employee goals', Target],
                ['library', 'KPI library', Library],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  tab === id
                    ? 'bg-accent-600 text-white shadow-sm'
                    : 'text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
                <span className={`text-xs ${tab === id ? 'text-white/80' : 'text-muted'}`}>
                  {id === 'assignments' ? stats.goals : definitions.length}
                </span>
              </button>
            ))}
          </nav>

          {tab === 'assignments' ? (
            <>
              {cycle ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Goals" value={String(stats.goals)} detail={`${plural(stats.employees, 'employee')}`} />
                  <StatCard
                    label="Average progress"
                    value={stats.averageProgress != null ? `${stats.averageProgress}%` : '—'}
                    detail={
                      stats.notMeasured > 0
                        ? `${plural(stats.notMeasured, 'active goal')} not measured yet`
                        : 'Across active goals'
                    }
                  />
                  <StatCard
                    label="Below on-track"
                    value={String(stats.atRisk)}
                    detail={`Under ${KPI_ON_TRACK_PERCENT}% of target`}
                    tone={stats.atRisk > 0 ? 'warning' : undefined}
                  />
                  <StatCard
                    label="Weights to review"
                    value={String(stats.weightIssues)}
                    detail={`Employees whose weights don’t total ${KPI_WEIGHT_LIMIT_PERCENT}%`}
                    tone={stats.weightIssues > 0 ? 'warning' : undefined}
                  />
                </div>
              ) : null}

              <section className="surface rounded-xl border border-base shadow-card">
                <div className="flex flex-col gap-3 border-b border-base px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative w-full lg:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <Input
                      className="pl-9"
                      placeholder="Search employee or goal"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Search employee or goal"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:w-[420px]">
                    <Select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                      aria-label="Filter by status"
                    >
                      <option value="open">All except cancelled</option>
                      <option value="active">Active</option>
                      <option value="draft">Draft</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="all">All statuses</option>
                    </Select>
                    <Select
                      value={definitionFilter}
                      onChange={(e) => setDefinitionFilter(e.target.value)}
                      aria-label="Filter by KPI"
                    >
                      <option value="">All KPIs</option>
                      {definitions.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {assignmentsLoading ? (
                  <div className="flex items-center justify-center py-12 text-secondary">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading goals…
                  </div>
                ) : !cycle ? (
                  <div className="p-8 text-center text-sm text-secondary">Choose a review cycle to see its goals.</div>
                ) : groups.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 p-10 text-center">
                    <Target className="h-8 w-8 text-muted" />
                    <p className="text-sm text-secondary">
                      {assignments.length === 0
                        ? `No KPI goals in ${cycle.name} yet.`
                        : 'No goals match these filters.'}
                    </p>
                    {assignments.length === 0 && canAssign ? (
                      <Button size="sm" onClick={() => setAssignForm({})}>
                        <Plus className="h-3.5 w-3.5" /> Assign KPI
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="divide-y divide-[rgb(var(--border-base))]">
                    {groups.map((group) => (
                      <div key={group.employeeId}>
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-[rgb(var(--bg-muted))]/50 px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-primary">{group.employeeName}</span>
                            <span className="text-xs text-muted">{group.employeeNumber}</span>
                            {group.targetsLocked ? (
                              <span
                                className="inline-flex items-center gap-1 text-xs text-muted"
                                title="This employee's review has launched; targets, windows and weights are fixed"
                              >
                                <Lock className="h-3 w-3" /> Review launched
                              </span>
                            ) : null}
                          </div>
                          <WeightMeter total={group.weight} hasWeights={group.hasWeights} />
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                                <th className="px-4 py-2 font-medium">Goal</th>
                                <th className="px-4 py-2 font-medium">Measurement period</th>
                                <th className="px-4 py-2 text-right font-medium">Target</th>
                                <th className="px-4 py-2 text-right font-medium">Current</th>
                                <th className="px-4 py-2 font-medium">Progress</th>
                                <th className="px-4 py-2 text-right font-medium">Weight</th>
                                <th className="px-4 py-2 font-medium">Status</th>
                                <th className="px-4 py-2" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[rgb(var(--border-base))]">
                              {group.rows.map((row) => (
                                <GoalRow
                                  key={row.id}
                                  row={row}
                                  cycle={cycle}
                                  canEdit={canEdit}
                                  onEdit={() => setEditing(row)}
                                  onComplete={() => void markCompleted(row)}
                                  onCancel={() => setCancelling(row)}
                                />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="surface rounded-xl border border-base shadow-card">
              {definitions.length === 0 ? (
                <div className="flex flex-col items-center gap-3 p-10 text-center">
                  <Library className="h-8 w-8 text-muted" />
                  <p className="text-sm text-secondary">
                    The KPI library is empty. Add reusable KPIs, such as sales targets or resolution times, to assign
                    them to many employees at once.
                  </p>
                  {canCreate ? (
                    <Button size="sm" onClick={() => setDefinitionForm({ definition: null })}>
                      <Plus className="h-3.5 w-3.5" /> New KPI
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-base text-left text-xs uppercase tracking-wide text-muted">
                        <th className="px-4 py-2.5 font-medium">KPI</th>
                        <th className="px-4 py-2.5 font-medium">Category</th>
                        <th className="px-4 py-2.5 font-medium">Unit</th>
                        <th className="px-4 py-2.5 font-medium">Direction</th>
                        <th className="px-4 py-2.5 text-right font-medium">Default target</th>
                        <th className="px-4 py-2.5 text-right font-medium">Goals</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgb(var(--border-base))]">
                      {definitions.map((definition) => (
                        <tr key={definition.id} className={definition.isActive ? '' : 'opacity-70'}>
                          <td className="max-w-[320px] px-4 py-3">
                            <div className="font-medium text-primary">{definition.name}</div>
                            {definition.description ? (
                              <div className="mt-0.5 line-clamp-2 text-xs text-secondary">{definition.description}</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-secondary">{definition.category ?? '—'}</td>
                          <td className="px-4 py-3 text-secondary">{KPI_UNIT_LABELS[definition.unit]}</td>
                          <td className="px-4 py-3 text-secondary">{KPI_DIRECTION_LABELS[definition.direction]}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-primary">
                            {formatKpiValue(definition.defaultTargetValue, definition.unit)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-secondary">{definition.assignmentCount}</td>
                          <td className="px-4 py-3">
                            <StatusPill tone={definition.isActive ? 'success' : 'neutral'}>
                              {definition.isActive ? 'Active' : 'Inactive'}
                            </StatusPill>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              {canAssign && definition.isActive ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setAssignForm({ definitionId: definition.id })}
                                >
                                  <Users className="h-3.5 w-3.5" /> Assign
                                </Button>
                              ) : null}
                              {canEdit ? (
                                <Button variant="ghost" size="sm" onClick={() => setDefinitionForm({ definition })}>
                                  <Pencil className="h-3.5 w-3.5" /> Edit
                                </Button>
                              ) : null}
                              {canEdit ? (
                                definition.isActive ? (
                                  <Button variant="ghost" size="sm" onClick={() => setDeactivating(definition)}>
                                    <Power className="h-3.5 w-3.5" /> Deactivate
                                  </Button>
                                ) : (
                                  <Button variant="ghost" size="sm" onClick={() => void activateDefinition(definition)}>
                                    <Power className="h-3.5 w-3.5" /> Activate
                                  </Button>
                                )
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {definitionForm ? (
        <KpiDefinitionModal
          companyId={companyId}
          definition={definitionForm.definition}
          onClose={() => setDefinitionForm(null)}
          onSaved={(message) => {
            setDefinitionForm(null);
            void afterSave(message);
          }}
        />
      ) : null}

      {assignForm && cycle ? (
        <AssignKpiModal
          companyId={companyId}
          cycle={cycle}
          definitions={activeDefinitions}
          employees={employees}
          assignments={assignments}
          initialDefinitionId={assignForm.definitionId}
          onClose={() => setAssignForm(null)}
          onSaved={(message) => {
            setAssignForm(null);
            setTab('assignments');
            void afterSave(message);
          }}
        />
      ) : null}

      {editing && cycle ? (
        <EditGoalModal
          assignment={editing}
          cycle={cycle}
          employeeAssignments={byEmployee.get(editing.employeeId) ?? []}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            void afterSave(message);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={cancelling !== null}
        title="Cancel this goal?"
        description={
          cancelling ? (
            <p>
              “{cancelling.title}” for {cancelling.employeeName} will stop counting toward their weights
              {cancelling.lockState === 'targets_locked' ? '' : ' and their review'}. A cancelled goal can’t be reopened;
              assign it again if it’s needed later.
            </p>
          ) : null
        }
        confirmLabel="Cancel goal"
        onConfirm={async () => {
          if (!cancelling) return;
          await updateKpiAssignment(cancelling.id, { status: 'cancelled' });
          await afterSave(`“${cancelling.title}” for ${cancelling.employeeName} was cancelled.`);
        }}
        onClose={() => setCancelling(null)}
      />

      <ConfirmDialog
        open={deactivating !== null}
        title="Deactivate this KPI?"
        description={
          deactivating ? (
            <p>
              “{deactivating.name}” will no longer be offered when assigning goals. The{' '}
              {plural(deactivating.assignmentCount, 'goal')} already created from it stay as they are.
            </p>
          ) : null
        }
        confirmLabel="Deactivate"
        onConfirm={async () => {
          if (!deactivating) return;
          await updateKpiDefinition(deactivating.id, { isActive: false });
          await afterSave(`“${deactivating.name}” was deactivated.`);
        }}
        onClose={() => setDeactivating(null)}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'warning';
}) {
  return (
    <div className="surface rounded-xl border border-base p-4 shadow-card">
      <p className="text-xs font-medium text-secondary">{label}</p>
      <p
        className={`mt-1.5 text-2xl font-bold tabular-nums ${
          tone === 'warning' ? 'text-warning-700 dark:text-warning-300' : 'text-primary'
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

function WeightMeter({ total, hasWeights }: { total: number; hasWeights: boolean }) {
  if (!hasWeights) {
    return <span className="text-xs text-muted">No weights set</span>;
  }
  const remaining = Math.round((KPI_WEIGHT_LIMIT_PERCENT - total) * 100) / 100;
  const tone =
    remaining === 0
      ? 'bg-success-500'
      : remaining > 0
        ? 'bg-warning-500'
        : 'bg-error-500';
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="h-1.5 w-28 rounded-full bg-[rgb(var(--bg-muted))]">
        <div
          className={`h-1.5 rounded-full ${tone}`}
          style={{ width: `${Math.min(100, (total / KPI_WEIGHT_LIMIT_PERCENT) * 100)}%` }}
        />
      </div>
      <span className="tabular-nums text-secondary">
        Weight {total}%
        {remaining > 0 ? <span className="text-warning-700 dark:text-warning-300"> · {remaining}% unallocated</span> : null}
      </span>
    </div>
  );
}

function GoalRow({
  row,
  cycle,
  canEdit,
  onEdit,
  onComplete,
  onCancel,
}: {
  row: EmployeeKpiAssignmentRecord;
  cycle: PerformanceReviewCycleRecord;
  canEdit: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const progress = row.progressPercent;
  const editable = canEdit && row.lockState !== 'cycle_locked' && row.status !== 'cancelled';
  return (
    <tr className={row.status === 'cancelled' ? 'text-muted' : ''}>
      <td className="max-w-[280px] px-4 py-3">
        <div className={`font-medium ${row.status === 'cancelled' ? 'line-through' : 'text-primary'}`}>{row.title}</div>
        <div className="mt-0.5 text-xs text-muted">
          {row.kpiDefinitionName ? `Library KPI` : 'Custom goal'} · {KPI_DIRECTION_LABELS[row.direction]}
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-secondary">{periodLabel(row, cycle)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-primary">{formatKpiValue(row.targetValue, row.unit)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-secondary">{formatKpiValue(row.currentValue, row.unit)}</td>
      <td className="min-w-[150px] px-4 py-3">
        {progress == null ? (
          <span className="text-xs text-muted">Not measured</span>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-[rgb(var(--bg-muted))]">
              <div
                className={`h-1.5 rounded-full ${progress >= KPI_ON_TRACK_PERCENT ? 'bg-success-500' : 'bg-warning-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="w-9 text-right text-xs tabular-nums text-secondary">{progress}%</span>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-secondary">
        {row.weightPercent != null ? `${row.weightPercent}%` : '—'}
      </td>
      <td className="px-4 py-3">
        <StatusPill tone={STATUS_TONE[row.status]}>{KPI_ASSIGNMENT_STATUS_LABELS[row.status]}</StatusPill>
      </td>
      <td className="px-4 py-3">
        {editable ? (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit} title="Edit goal or update progress" aria-label={`Edit ${row.title}`}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {row.status === 'active' ? (
              <Button variant="ghost" size="icon" onClick={onComplete} title="Mark completed" aria-label={`Mark ${row.title} completed`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            <Button variant="ghost" size="icon" onClick={onCancel} title="Cancel goal" aria-label={`Cancel ${row.title}`}>
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : row.lockState === 'cycle_locked' ? (
          <Lock className="ml-auto h-3.5 w-3.5 text-muted" aria-label="Read-only" />
        ) : null}
      </td>
    </tr>
  );
}

// ── KPI definition modal ─────────────────────────────────────────────────────

function KpiDefinitionModal({
  companyId,
  definition,
  onClose,
  onSaved,
}: {
  companyId: string;
  definition: KpiDefinitionRecord | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(definition?.name ?? '');
  const [category, setCategory] = useState(definition?.category ?? '');
  const [description, setDescription] = useState(definition?.description ?? '');
  const [unit, setUnit] = useState<KpiUnit>(definition?.unit ?? 'percentage');
  const [direction, setDirection] = useState<KpiDirection>(definition?.direction ?? 'higher_is_better');
  const [defaultTarget, setDefaultTarget] = useState(
    definition?.defaultTargetValue != null ? String(definition.defaultTargetValue) : '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const target = parseOptionalNumber(defaultTarget);
    if (!name.trim()) return setError('Enter a KPI name');
    if (target !== undefined) {
      const problem = targetError(target, direction);
      if (problem) return setError(problem.replace('Target', 'Default target'));
    }
    setSubmitting(true);
    setError(null);
    try {
      if (definition) {
        await updateKpiDefinition(definition.id, {
          name: name.trim(),
          category: category.trim(),
          description: description.trim(),
          unit,
          direction,
          defaultTargetValue: target ?? null,
        });
        onSaved(`“${name.trim()}” was updated. Existing goals keep the values they were assigned with.`);
      } else {
        await createKpiDefinition(companyId, {
          name: name.trim(),
          category: category.trim() || undefined,
          description: description.trim() || undefined,
          unit,
          direction,
          defaultTargetValue: target,
        });
        onSaved(`“${name.trim()}” was added to the KPI library.`);
      }
    } catch (err) {
      setError(errorMessage(err, 'Failed to save KPI'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={submitting ? () => undefined : onClose}
      title={definition ? 'Edit KPI' : 'New KPI'}
      description="A reusable KPI that can be assigned to employees as a goal."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? 'Saving…' : definition ? 'Save changes' : 'Add KPI'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            <Label htmlFor="kpi-name">Name</Label>
            <Input id="kpi-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Customer satisfaction score" />
          </div>
          <div>
            <Label htmlFor="kpi-category">Category</Label>
            <Input id="kpi-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Customer experience" />
          </div>
        </div>
        <div>
          <Label htmlFor="kpi-description">How it’s measured</Label>
          <Textarea
            id="kpi-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Data source and calculation, so everyone measures it the same way"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="kpi-unit">Unit</Label>
            <Select id="kpi-unit" value={unit} onChange={(e) => setUnit(e.target.value as KpiUnit)}>
              {UNITS.map((value) => (
                <option key={value} value={value}>
                  {KPI_UNIT_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="kpi-direction">Direction</Label>
            <Select id="kpi-direction" value={direction} onChange={(e) => setDirection(e.target.value as KpiDirection)}>
              {DIRECTIONS.map((value) => (
                <option key={value} value={value}>
                  {KPI_DIRECTION_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="kpi-default-target">Default target</Label>
            <Input
              id="kpi-default-target"
              inputMode="decimal"
              value={defaultTarget}
              onChange={(e) => setDefaultTarget(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
        {definition && definition.assignmentCount > 0 ? (
          <p className="flex items-start gap-2 text-xs text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {plural(definition.assignmentCount, 'goal')} already use this KPI. They keep their own title, unit,
            direction and target; changes here apply to new assignments.
          </p>
        ) : null}
        {error ? <p className="text-sm text-error-600">{error}</p> : null}
      </div>
    </Modal>
  );
}

// ── Assign modal ─────────────────────────────────────────────────────────────

function AssignKpiModal({
  companyId,
  cycle,
  definitions,
  employees,
  assignments,
  initialDefinitionId,
  onClose,
  onSaved,
}: {
  companyId: string;
  cycle: PerformanceReviewCycleRecord;
  definitions: KpiDefinitionRecord[];
  employees: EmployeeRecord[];
  assignments: EmployeeKpiAssignmentRecord[];
  initialDefinitionId?: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [source, setSource] = useState<'library' | 'custom'>(definitions.length > 0 ? 'library' : 'custom');
  const [definitionId, setDefinitionId] = useState(initialDefinitionId ?? definitions[0]?.id ?? '');
  const definition = definitions.find((row) => row.id === definitionId) ?? null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState<KpiUnit>('count');
  const [direction, setDirection] = useState<KpiDirection>('higher_is_better');

  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');

  const [period, setPeriod] = useState<PeriodValue>(() => initialPeriod(cycle));
  const [target, setTarget] = useState(
    definition?.defaultTargetValue != null ? String(definition.defaultTargetValue) : '',
  );
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (source === 'library') {
      setTarget(definition?.defaultTargetValue != null ? String(definition.defaultTargetValue) : '');
    }
  }, [definition?.id, definition?.defaultTargetValue, source]);

  useEffect(() => {
    if (source === 'custom' && period.window === ALL_WINDOWS) {
      setPeriod(initialPeriod(cycle));
    }
  }, [source, period.window, cycle]);

  const eligible = useMemo(
    () =>
      employees
        .filter((row) => row.employmentStatus === 'active' || row.employmentStatus === 'on_leave')
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [employees],
  );
  const shownEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return eligible;
    return eligible.filter(
      (row) =>
        row.fullName.toLowerCase().includes(query) ||
        row.employeeNumber.toLowerCase().includes(query) ||
        (row.department?.name ?? '').toLowerCase().includes(query),
    );
  }, [eligible, employeeSearch]);

  const selected = source === 'library' ? employeeIds : employeeId ? [employeeId] : [];
  const windows = useMemo(
    () => kpiMeasurementWindows(cycle.periodStart, cycle.periodEnd, period.type),
    [cycle.periodStart, cycle.periodEnd, period.type],
  );
  const plannedPeriods =
    period.type !== 'custom' && period.window === ALL_WINDOWS
      ? windows.map((w) => ({ start: w.start, end: w.end }))
      : [{ start: period.start, end: period.end }];

  const effectiveDirection = source === 'library' ? (definition?.direction ?? 'higher_is_better') : direction;
  const effectiveUnit = source === 'library' ? (definition?.unit ?? 'count') : unit;
  const weightValue = parseOptionalNumber(weight);
  const nameOf = (id: string) => eligible.find((row) => row.id === id)?.fullName ?? 'Employee';

  const planning = (() => {
    const skipped: string[] = [];
    const overLimit: Array<{ name: string; from: number; to: number }> = [];
    let goalCount = 0;
    for (const id of selected) {
      const existing = assignments.filter((row) => row.employeeId === id);
      const duplicates =
        source === 'library' && definition
          ? plannedPeriods.filter((p) =>
              existing.some(
                (row) =>
                  row.status !== 'cancelled' &&
                  row.kpiDefinitionId === definition.id &&
                  row.measurementPeriodStart === p.start &&
                  row.measurementPeriodEnd === p.end,
              ),
            ).length
          : 0;
      if (duplicates > 0) skipped.push(nameOf(id));
      const newCount = plannedPeriods.length - duplicates;
      goalCount += newCount;
      if (weightValue && !Number.isNaN(weightValue) && newCount > 0) {
        const from = weightTotal(existing);
        const to = Math.round((from + weightValue * newCount) * 100) / 100;
        if (to > KPI_WEIGHT_LIMIT_PERCENT) overLimit.push({ name: nameOf(id), from, to });
      }
    }
    return { skipped, overLimit, goalCount };
  })();

  const toggleEmployee = (id: string) =>
    setEmployeeIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  const allShownSelected = shownEmployees.length > 0 && shownEmployees.every((row) => employeeIds.includes(row.id));

  const submit = async () => {
    const targetValue = parseOptionalNumber(target);
    const problem =
      (source === 'library' && !definition ? 'Choose a KPI from the library' : null) ??
      (source === 'custom' && !title.trim() ? 'Enter a goal title' : null) ??
      (selected.length === 0 ? 'Choose at least one employee' : null) ??
      targetError(targetValue, effectiveDirection) ??
      weightError(weightValue) ??
      periodError(period, cycle) ??
      (planning.overLimit.length > 0
        ? `${planning.overLimit[0].name}'s weights would total ${planning.overLimit[0].to}% (limit ${KPI_WEIGHT_LIMIT_PERCENT}%)`
        : null);
    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    setError(null);
    const periodInput =
      period.type !== 'custom' && period.window === ALL_WINDOWS
        ? { measurementPeriod: period.type, everyWindow: true }
        : { measurementPeriod: period.type, measurementPeriodStart: period.start, measurementPeriodEnd: period.end };
    try {
      if (source === 'library' && definition) {
        const result = await bulkAssignKpi(companyId, {
          reviewCycleId: cycle.id,
          kpiDefinitionId: definition.id,
          employeeIds: selected,
          targetValue,
          weightPercent: weightValue,
          notes: notes.trim() || undefined,
          ...periodInput,
        });
        const employeesCreated = new Set(result.created.map((row) => row.employeeId)).size;
        const skippedNames = [...new Set(result.skipped.map((row) => row.employeeName))];
        const parts = [
          result.created.length > 0
            ? `Assigned “${definition.name}” to ${plural(employeesCreated, 'employee')}${
                result.created.length !== employeesCreated ? ` (${plural(result.created.length, 'goal')})` : ''
              }.`
            : `No new goals were created.`,
        ];
        if (skippedNames.length > 0) {
          parts.push(`Skipped ${skippedNames.join(', ')}: they already have this KPI for that period.`);
        }
        onSaved(parts.join(' '));
      } else {
        await createKpiAssignment(companyId, {
          reviewCycleId: cycle.id,
          employeeId: selected[0],
          title: title.trim(),
          description: description.trim() || undefined,
          unit,
          direction,
          targetValue: targetValue!,
          weightPercent: weightValue,
          notes: notes.trim() || undefined,
          measurementPeriod: period.type,
          measurementPeriodStart: period.start,
          measurementPeriodEnd: period.end,
        });
        onSaved(`Added “${title.trim()}” for ${nameOf(selected[0])}.`);
      }
    } catch (err) {
      setError(errorMessage(err, 'Failed to assign KPI'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      onClose={submitting ? () => undefined : onClose}
      title="Assign KPI"
      description={`Goals for ${cycle.name} (${formatKpiDateRange(cycle.periodStart, cycle.periodEnd)})`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting || planning.goalCount === 0}>
            {submitting
              ? 'Assigning…'
              : planning.goalCount > 1
                ? `Assign ${planning.goalCount} goals`
                : 'Assign goal'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="inline-flex rounded-lg border border-base p-0.5 text-sm">
          {(
            [
              ['library', 'From KPI library'],
              ['custom', 'Custom goal'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={value === 'library' && definitions.length === 0}
              onClick={() => setSource(value)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                source === value ? 'bg-accent-600 text-white' : 'text-secondary hover:text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {source === 'library' ? (
          <div>
            <Label htmlFor="assign-kpi">KPI</Label>
            <Select id="assign-kpi" value={definitionId} onChange={(e) => setDefinitionId(e.target.value)}>
              {definitions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                  {row.category ? ` · ${row.category}` : ''}
                </option>
              ))}
            </Select>
            {definition ? (
              <p className="mt-1.5 text-xs text-muted">
                {KPI_UNIT_LABELS[definition.unit]} · {KPI_DIRECTION_LABELS[definition.direction]}
                {definition.description ? ` · ${definition.description}` : ''}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="assign-title">Goal title</Label>
              <Input id="assign-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Launch the partner onboarding programme" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="assign-unit">Unit</Label>
                <Select id="assign-unit" value={unit} onChange={(e) => setUnit(e.target.value as KpiUnit)}>
                  {UNITS.map((value) => (
                    <option key={value} value={value}>
                      {KPI_UNIT_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="assign-direction">Direction</Label>
                <Select id="assign-direction" value={direction} onChange={(e) => setDirection(e.target.value as KpiDirection)}>
                  {DIRECTIONS.map((value) => (
                    <option key={value} value={value}>
                      {KPI_DIRECTION_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="assign-description">Description</Label>
              <Textarea id="assign-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
        )}

        {source === 'library' ? (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-secondary">
                Employees {employeeIds.length > 0 ? `· ${employeeIds.length} selected` : ''}
              </span>
              <button
                type="button"
                className="text-xs font-medium text-accent-600 hover:underline disabled:opacity-50"
                disabled={shownEmployees.length === 0}
                onClick={() =>
                  setEmployeeIds((current) =>
                    allShownSelected
                      ? current.filter((id) => !shownEmployees.some((row) => row.id === id))
                      : [...new Set([...current, ...shownEmployees.map((row) => row.id)])],
                  )
                }
              >
                {allShownSelected ? 'Clear shown' : 'Select all shown'}
              </button>
            </div>
            <div className="rounded-lg border border-base">
              <div className="relative border-b border-base">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  className="w-full bg-transparent py-2 pl-9 pr-3 text-sm text-primary outline-none placeholder:text-muted"
                  placeholder="Search name, number or department"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  aria-label="Search employees"
                />
              </div>
              <ul className="max-h-48 divide-y divide-[rgb(var(--border-base))] overflow-y-auto">
                {shownEmployees.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-muted">No employees match.</li>
                ) : (
                  shownEmployees.map((row) => (
                    <li key={row.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-[rgb(var(--bg-hover))]">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={employeeIds.includes(row.id)}
                          onChange={() => toggleEmployee(row.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-primary">{row.fullName}</span>
                          <span className="ml-2 text-xs text-muted">
                            {row.employeeNumber}
                            {row.department?.name ? ` · ${row.department.name}` : ''}
                          </span>
                        </span>
                        <span className="text-xs tabular-nums text-muted">
                          {weightTotal(assignments.filter((a) => a.employeeId === row.id))}% weighted
                        </span>
                      </label>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        ) : (
          <div>
            <Label htmlFor="assign-employee">Employee</Label>
            <Select id="assign-employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Choose an employee</option>
              {eligible.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.fullName} · {row.employeeNumber}
                </option>
              ))}
            </Select>
          </div>
        )}

        <MeasurementPeriodFields cycle={cycle} value={period} onChange={setPeriod} allowEveryWindow={source === 'library'} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="assign-target">
              Target{effectiveUnit !== 'other' ? ` (${KPI_UNIT_LABELS[effectiveUnit].toLowerCase()})` : ''}
            </Label>
            <Input id="assign-target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
            <p className="mt-1 text-xs text-muted">{KPI_DIRECTION_LABELS[effectiveDirection]}</p>
          </div>
          <div>
            <Label htmlFor="assign-weight">Weight (%)</Label>
            <Input id="assign-weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Optional" />
            <p className="mt-1 text-xs text-muted">
              {plannedPeriods.length > 1
                ? `Applied to each of the ${plannedPeriods.length} goals`
                : `Share of the employee’s ${KPI_WEIGHT_LIMIT_PERCENT}% for this cycle`}
            </p>
          </div>
        </div>

        <div>
          <Label htmlFor="assign-notes">Notes</Label>
          <Textarea id="assign-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional context for the employee and manager" />
        </div>

        {planning.skipped.length > 0 || planning.overLimit.length > 0 ? (
          <div className="space-y-1.5 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2.5 text-sm text-warning-800 dark:border-warning-900 dark:bg-warning-950/30 dark:text-warning-200">
            {planning.overLimit.map((item) => (
              <p key={item.name} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {item.name}: weights would go from {item.from}% to {item.to}%, over the {KPI_WEIGHT_LIMIT_PERCENT}% limit.
              </p>
            ))}
            {planning.skipped.length > 0 ? (
              <p className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                {planning.skipped.join(', ')} already {planning.skipped.length === 1 ? 'has' : 'have'} this KPI for
                that period and will be skipped.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-error-600">{error}</p> : null}
      </div>
    </Modal>
  );
}

// ── Edit goal modal ──────────────────────────────────────────────────────────

function EditGoalModal({
  assignment,
  cycle,
  employeeAssignments,
  onClose,
  onSaved,
}: {
  assignment: EmployeeKpiAssignmentRecord;
  cycle: PerformanceReviewCycleRecord;
  employeeAssignments: EmployeeKpiAssignmentRecord[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const targetsLocked = assignment.lockState === 'targets_locked';
  const [title, setTitle] = useState(assignment.title);
  const [description, setDescription] = useState(assignment.description ?? '');
  const [target, setTarget] = useState(String(assignment.targetValue));
  const [current, setCurrent] = useState(assignment.currentValue != null ? String(assignment.currentValue) : '');
  const [period, setPeriod] = useState<PeriodValue>(() => initialPeriod(cycle, assignment));
  const [weight, setWeight] = useState(assignment.weightPercent != null ? String(assignment.weightPercent) : '');
  const [status, setStatus] = useState<EmployeeKpiAssignmentStatus>(assignment.status);
  const [notes, setNotes] = useState(assignment.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weightValue = parseOptionalNumber(weight);
  const otherWeights = weightTotal(employeeAssignments.filter((row) => row.id !== assignment.id));
  const nextTotal = Math.round((otherWeights + (weightValue && !Number.isNaN(weightValue) ? weightValue : 0)) * 100) / 100;

  const submit = async () => {
    const targetValue = parseOptionalNumber(target);
    const currentValue = parseOptionalNumber(current);
    const problem =
      (!title.trim() ? 'Enter a goal title' : null) ??
      targetError(targetValue, assignment.direction) ??
      (currentValue !== undefined && (Number.isNaN(currentValue) || currentValue < 0)
        ? 'Current value must be a number of zero or more'
        : null) ??
      weightError(weightValue) ??
      periodError(period, cycle) ??
      (status !== 'cancelled' && nextTotal > KPI_WEIGHT_LIMIT_PERCENT
        ? `Weights for ${assignment.employeeName} would total ${nextTotal}% (limit ${KPI_WEIGHT_LIMIT_PERCENT}%)`
        : null);
    if (problem) {
      setError(problem);
      return;
    }

    const input: UpdateKpiAssignmentInput = {};
    if (title.trim() !== assignment.title) input.title = title.trim();
    if (description.trim() !== (assignment.description ?? '')) input.description = description.trim();
    if (targetValue !== assignment.targetValue) input.targetValue = targetValue;
    if (currentValue !== undefined && currentValue !== assignment.currentValue) input.currentValue = currentValue;
    if (
      !targetsLocked &&
      (period.type !== assignment.measurementPeriod ||
        period.start !== assignment.measurementPeriodStart ||
        period.end !== assignment.measurementPeriodEnd)
    ) {
      input.measurementPeriod = period.type;
      input.measurementPeriodStart = period.start;
      input.measurementPeriodEnd = period.end;
    }
    const nextWeight = weightValue ?? null;
    if (nextWeight !== assignment.weightPercent) input.weightPercent = nextWeight;
    if (notes.trim() !== (assignment.notes ?? '')) input.notes = notes.trim();
    if (status !== assignment.status) input.status = status;

    if (Object.keys(input).length === 0) {
      onClose();
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await updateKpiAssignment(assignment.id, input);
      onSaved(`“${title.trim()}” for ${assignment.employeeName} was updated.`);
    } catch (err) {
      setError(errorMessage(err, 'Failed to update goal'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      onClose={submitting ? () => undefined : onClose}
      title="Edit goal"
      description={`${assignment.employeeName} · ${assignment.reviewCycleName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {targetsLocked ? (
          <div className="flex items-start gap-2 rounded-lg border border-base bg-[rgb(var(--bg-muted))] px-3 py-2.5 text-sm text-secondary">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {assignment.employeeName}’s review has launched with this goal, so the title, target, measurement period
              and weight are fixed. You can still update progress, notes and status.
            </p>
          </div>
        ) : null}

        <div>
          <Label htmlFor="edit-title">Goal title</Label>
          <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={targetsLocked} />
          <p className="mt-1 text-xs text-muted">
            {assignment.kpiDefinitionName ? `From library KPI “${assignment.kpiDefinitionName}”` : 'Custom goal'} ·{' '}
            {KPI_UNIT_LABELS[assignment.unit]} · {KPI_DIRECTION_LABELS[assignment.direction]}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="edit-target">Target</Label>
            <Input id="edit-target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} disabled={targetsLocked} />
          </div>
          <div>
            <Label htmlFor="edit-current">Current value</Label>
            <Input id="edit-current" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Not measured" />
          </div>
          <div>
            <Label htmlFor="edit-weight">Weight (%)</Label>
            <Input id="edit-weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} disabled={targetsLocked} placeholder="None" />
            <p className={`mt-1 text-xs ${nextTotal > KPI_WEIGHT_LIMIT_PERCENT ? 'text-error-600' : 'text-muted'}`}>
              Employee total {nextTotal}% of {KPI_WEIGHT_LIMIT_PERCENT}%
            </p>
          </div>
        </div>

        <MeasurementPeriodFields cycle={cycle} value={period} onChange={setPeriod} disabled={targetsLocked} />

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <Label htmlFor="edit-status">Status</Label>
            <Select id="edit-status" value={status} onChange={(e) => setStatus(e.target.value as EmployeeKpiAssignmentStatus)}>
              {NEXT_STATUSES[assignment.status].map((value) => (
                <option key={value} value={value}>
                  {KPI_ASSIGNMENT_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
            {status === 'cancelled' && assignment.status !== 'cancelled' ? (
              <p className="mt-1 text-xs text-warning-700 dark:text-warning-300">Cancelled goals can’t be reopened.</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="edit-description">Description</Label>
            <Input id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div>
          <Label htmlFor="edit-notes">Notes</Label>
          <Textarea id="edit-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error ? <p className="text-sm text-error-600">{error}</p> : null}
      </div>
    </Modal>
  );
}
