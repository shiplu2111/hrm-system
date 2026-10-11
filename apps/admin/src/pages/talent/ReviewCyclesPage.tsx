import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Rocket,
  Search,
  Target,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import {
  formatKpiDateRange,
  KPI_WEIGHT_LIMIT_PERCENT,
  kpiMeasurementWindows,
  type EmployeePerformanceReviewStatus,
  type EmployeeRecord,
  type KpiMeasurementPeriod,
  type PerformanceReviewCycleRecord,
  type PerformanceReviewParticipantRecord,
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
  createReviewCycle,
  launchReviewCycle,
  listReviewCycles,
  listReviewParticipants,
  MEASUREMENT_PERIOD_LABELS,
  REVIEW_CYCLE_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  setReviewParticipants,
  updateReviewCycle,
  type UpdateReviewCycleInput,
} from '@/lib/performance-api';
import { ApiError } from '@/lib/tenant-api-client';

const CYCLE_TONE: Record<PerformanceReviewCycleRecord['status'], StatusPillTone> = {
  draft: 'neutral',
  active: 'accent',
  closed: 'success',
  archived: 'neutral',
};

const REVIEW_TONE: Record<EmployeePerformanceReviewStatus, StatusPillTone> = {
  not_started: 'neutral',
  self_assessment_draft: 'accent',
  self_submitted: 'warning',
  manager_review: 'accent',
  pending_approval: 'warning',
  approved: 'success',
  returned: 'error',
  cancelled: 'neutral',
};

const STAGES: Array<{ label: string; statuses: EmployeePerformanceReviewStatus[] }> = [
  { label: 'Not started', statuses: ['not_started'] },
  { label: 'Self-assessment', statuses: ['self_assessment_draft'] },
  { label: 'Manager assessment', statuses: ['self_submitted', 'manager_review', 'returned'] },
  { label: 'Pending approval', statuses: ['pending_approval'] },
  { label: 'Approved', statuses: ['approved'] },
];

const PERIOD_TYPES: KpiMeasurementPeriod[] = ['monthly', 'quarterly', 'semi_annual', 'annual', 'custom'];

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

function formatDay(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonths(dateKey: string, months: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

const SETTLED_REVIEW_STATUSES = new Set(['pending_approval', 'approved', 'cancelled']);

/** Readiness notes shown before and after launch; settled reviews have a frozen KPI list. */
function participantWarnings(row: PerformanceReviewParticipantRecord): string[] {
  if (row.reviewStatus && SETTLED_REVIEW_STATUSES.has(row.reviewStatus)) return [];
  const warnings: string[] = [];
  if (!row.managerEmployeeId) warnings.push('No manager, so HR completes the manager assessment');
  if (row.ratedKpiCount === 0) warnings.push('No active KPI goals; only competencies will be rated');
  if (row.draftKpiCount > 0) {
    warnings.push(`${plural(row.draftKpiCount, 'draft goal')} won’t be rated until activated`);
  }
  if (row.ratedKpiCount > 0 && row.kpiWeightTotal > 0 && row.kpiWeightTotal !== KPI_WEIGHT_LIMIT_PERCENT) {
    warnings.push(`Goal weights total ${row.kpiWeightTotal}%, not ${KPI_WEIGHT_LIMIT_PERCENT}%`);
  }
  return warnings;
}

type CycleAction = 'close' | 'reopen' | 'archive';

export function ReviewCyclesPage() {
  const { companyId } = useCompany();
  const { navigate } = useNav();
  const { can } = usePermissions();
  const canCreate = can('performance', 'create');
  const canEdit = can('performance', 'edit');

  const [cycles, setCycles] = useState<PerformanceReviewCycleRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [cycleId, setCycleId] = useState('');
  const [participants, setParticipants] = useState<PerformanceReviewParticipantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [cycleForm, setCycleForm] = useState<{ cycle: PerformanceReviewCycleRecord | null } | null>(null);
  const [addingParticipants, setAddingParticipants] = useState(false);
  const [removing, setRemoving] = useState<PerformanceReviewParticipantRecord | null>(null);
  const [launching, setLaunching] = useState(false);
  const [cycleAction, setCycleAction] = useState<CycleAction | null>(null);

  const cycle = cycles.find((row) => row.id === cycleId) ?? null;
  const launched = Boolean(cycle?.launchedAt);
  const participantsOpen = cycle?.status === 'draft' || cycle?.status === 'active';

  const loadBase = useCallback(async () => {
    if (!companyId) return;
    const [cycleRows, employeeRows] = await Promise.all([listReviewCycles(companyId), listEmployees(companyId)]);
    setCycles(cycleRows);
    setEmployees(employeeRows);
    setCycleId((current) =>
      current && cycleRows.some((row) => row.id === current)
        ? current
        : ((cycleRows.find((row) => row.status === 'active') ?? cycleRows[0])?.id ?? ''),
    );
  }, [companyId]);

  const loadParticipants = useCallback(async () => {
    if (!companyId || !cycleId) {
      setParticipants([]);
      return;
    }
    setParticipantsLoading(true);
    try {
      setParticipants(await listReviewParticipants(companyId, cycleId));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load participants'));
    } finally {
      setParticipantsLoading(false);
    }
  }, [companyId, cycleId]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    loadBase()
      .catch((err) => setError(errorMessage(err, 'Failed to load review cycles')))
      .finally(() => setLoading(false));
  }, [companyId, loadBase]);

  useEffect(() => {
    void loadParticipants();
  }, [loadParticipants]);

  const reload = async () => {
    await Promise.all([loadBase(), loadParticipants()]);
  };

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await reload();
    } catch (err) {
      setError(errorMessage(err, 'Failed to refresh'));
    } finally {
      setRefreshing(false);
    }
  };

  const afterSave = async (message: string) => {
    setNotice(message);
    setError(null);
    await reload();
  };

  const visibleParticipants = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return participants;
    return participants.filter(
      (row) =>
        row.employeeName.toLowerCase().includes(query) ||
        row.employeeNumber.toLowerCase().includes(query) ||
        (row.departmentName ?? '').toLowerCase().includes(query) ||
        (row.managerName ?? '').toLowerCase().includes(query),
    );
  }, [participants, search]);

  const readiness = useMemo(() => computeReadiness(participants), [participants]);
  const pendingReadiness = useMemo(
    () => computeReadiness(participants.filter((row) => !row.reviewId)),
    [participants],
  );

  const stageCounts = useMemo(
    () =>
      STAGES.map((stage) => ({
        ...stage,
        count: participants.filter((row) => row.reviewStatus && stage.statuses.includes(row.reviewStatus)).length,
      })),
    [participants],
  );

  if (!companyId) {
    return <div className="p-6 text-sm text-secondary">Select a company to manage review cycles.</div>;
  }

  const incompleteReviews = participants.filter(
    (row) => row.reviewStatus && row.reviewStatus !== 'approved' && row.reviewStatus !== 'cancelled',
  ).length;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-primary">Review Cycles</h1>
          <p className="mt-0.5 text-sm text-secondary">
            Set the review period, choose who takes part, then launch to open self and manager assessments built on
            each employee’s KPI goals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:shrink-0 xl:flex-nowrap">
          <Button variant="secondary" onClick={() => void refresh()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="secondary" onClick={() => navigate('performance-assessments')}>
            <ClipboardCheck className="h-4 w-4" /> Assessments
          </Button>
          {canCreate ? (
            <Button onClick={() => setCycleForm({ cycle: null })}>
              <Plus className="h-4 w-4" /> New cycle
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
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading review cycles…
        </div>
      ) : cycles.length === 0 ? (
        <section className="surface flex flex-col items-center gap-3 rounded-xl border border-base p-10 text-center shadow-card">
          <CalendarRange className="h-8 w-8 text-muted" />
          <div>
            <p className="text-sm font-medium text-primary">No review cycles yet</p>
            <p className="mt-1 text-sm text-secondary">
              A review cycle sets the period that KPI goals and assessments cover.
            </p>
          </div>
          {canCreate ? (
            <Button onClick={() => setCycleForm({ cycle: null })}>
              <Plus className="h-4 w-4" /> Create the first cycle
            </Button>
          ) : null}
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <nav className="space-y-2" aria-label="Review cycles">
            {cycles.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  setCycleId(row.id);
                  setNotice(null);
                  setSearch('');
                }}
                className={`surface w-full rounded-xl border p-4 text-left shadow-card transition-colors ${
                  row.id === cycleId
                    ? 'border-accent-500 ring-1 ring-accent-500'
                    : 'border-base hover:border-accent-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-primary">{row.name}</span>
                  <StatusPill tone={CYCLE_TONE[row.status]}>{REVIEW_CYCLE_STATUS_LABELS[row.status]}</StatusPill>
                </div>
                <p className="mt-1 text-xs text-secondary">{formatKpiDateRange(row.periodStart, row.periodEnd)}</p>
                <p className="mt-2 text-xs text-muted">
                  {plural(row.participantCount, 'participant')} · {row.completedReviewCount}/{row.reviewCount} reviews
                  approved
                </p>
              </button>
            ))}
          </nav>

          {cycle ? (
            <div className="min-w-0 space-y-5">
              <section className="surface rounded-xl border border-base p-5 shadow-card">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-primary">{cycle.name}</h2>
                      <StatusPill tone={CYCLE_TONE[cycle.status]}>{REVIEW_CYCLE_STATUS_LABELS[cycle.status]}</StatusPill>
                    </div>
                    {cycle.description ? <p className="mt-1 text-sm text-secondary">{cycle.description}</p> : null}
                  </div>
                  {canEdit ? (
                    <div className="flex flex-wrap gap-2 md:shrink-0 md:justify-end">
                      {cycle.status === 'draft' || cycle.status === 'active' ? (
                        <Button variant="secondary" size="sm" onClick={() => setCycleForm({ cycle })}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      ) : null}
                      {cycle.status === 'draft' ? (
                        <>
                          <Button variant="secondary" size="sm" onClick={() => setCycleAction('archive')}>
                            <Archive className="h-3.5 w-3.5" /> Discard
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setLaunching(true)}
                            disabled={participants.length === 0}
                            title={participants.length === 0 ? 'Add participants before launching' : undefined}
                          >
                            <Rocket className="h-3.5 w-3.5" /> Launch cycle
                          </Button>
                        </>
                      ) : null}
                      {cycle.status === 'active' ? (
                        <>
                          {readiness.withoutReview > 0 ? (
                            <Button size="sm" onClick={() => setLaunching(true)}>
                              <Rocket className="h-3.5 w-3.5" /> Create {plural(readiness.withoutReview, 'review')}
                            </Button>
                          ) : null}
                          <Button variant="secondary" size="sm" onClick={() => setCycleAction('close')}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Close cycle
                          </Button>
                        </>
                      ) : null}
                      {cycle.status === 'closed' ? (
                        <>
                          <Button variant="secondary" size="sm" onClick={() => setCycleAction('reopen')}>
                            <RotateCcw className="h-3.5 w-3.5" /> Reopen
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => setCycleAction('archive')}>
                            <Archive className="h-3.5 w-3.5" /> Archive
                          </Button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <dl className="mt-5 grid gap-4 border-t border-base pt-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                  <Fact label="Review period" value={formatKpiDateRange(cycle.periodStart, cycle.periodEnd)} />
                  <Fact
                    label="KPI measurement"
                    value={`${MEASUREMENT_PERIOD_LABELS[cycle.measurementPeriod]}${
                      cycle.measurementPeriod === 'custom'
                        ? ''
                        : ` · ${plural(kpiMeasurementWindows(cycle.periodStart, cycle.periodEnd, cycle.measurementPeriod).length, 'window')}`
                    }`}
                  />
                  <Fact label="Reviews due" value={formatDay(cycle.reviewDueDate)} />
                  <Fact
                    label="Sign-off"
                    value={cycle.requiresWorkflowApproval ? 'Manager, then approval workflow' : 'Manager only'}
                  />
                </dl>

                {launched ? (
                  <div className="mt-4 flex items-start gap-2 rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs text-secondary">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Launched {formatDay(cycle.launchedAt!)}. The period, measurement period and sign-off setting are now
                      fixed; the name, description and due date can still change.
                    </span>
                  </div>
                ) : null}
              </section>

              {launched ? (
                <section className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  {stageCounts.map((stage) => (
                    <div key={stage.label} className="surface rounded-xl border border-base p-4 shadow-card">
                      <p className="text-xs font-medium text-secondary">{stage.label}</p>
                      <p className="mt-1.5 text-2xl font-bold tabular-nums text-primary">{stage.count}</p>
                    </div>
                  ))}
                </section>
              ) : null}

              <section className="surface rounded-xl border border-base shadow-card">
                <div className="flex flex-col gap-3 border-b border-base px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-primary">Participants</h3>
                    <p className="mt-0.5 text-xs text-secondary">
                      {launched
                        ? 'People added after launch get their review when you create pending reviews.'
                        : 'Each participant gets a self-assessment and a manager assessment when the cycle launches.'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative sm:w-64">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                      <Input
                        className="pl-9"
                        placeholder="Search participants"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Search participants"
                      />
                    </div>
                    <Button variant="secondary" size="sm" className="whitespace-nowrap" onClick={() => navigate('performance-goals')}>
                      <Target className="h-3.5 w-3.5" /> KPI goals
                    </Button>
                    {canEdit && participantsOpen ? (
                      <Button size="sm" className="whitespace-nowrap" onClick={() => setAddingParticipants(true)}>
                        <UserPlus className="h-3.5 w-3.5" /> Add participants
                      </Button>
                    ) : null}
                  </div>
                </div>

                {!launched && participants.length > 0 ? <ReadinessSummary readiness={readiness} /> : null}

                {participantsLoading ? (
                  <div className="flex items-center justify-center py-12 text-secondary">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading participants…
                  </div>
                ) : participants.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 p-10 text-center">
                    <Users className="h-8 w-8 text-muted" />
                    <p className="text-sm text-secondary">No one is taking part in this cycle yet.</p>
                    {canEdit && participantsOpen ? (
                      <Button size="sm" onClick={() => setAddingParticipants(true)}>
                        <UserPlus className="h-3.5 w-3.5" /> Add participants
                      </Button>
                    ) : null}
                  </div>
                ) : visibleParticipants.length === 0 ? (
                  <div className="p-8 text-center text-sm text-secondary">No participants match “{search}”.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b border-base text-left text-xs font-medium uppercase tracking-wide text-muted">
                          <th className="px-4 py-2.5">Employee</th>
                          <th className="px-4 py-2.5">Manager</th>
                          <th className="px-4 py-2.5">KPI goals</th>
                          <th className="px-4 py-2.5">Review</th>
                          <th className="px-4 py-2.5">Notes</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgb(var(--border-base))]">
                        {visibleParticipants.map((row) => {
                          const warnings = participantWarnings(row);
                          return (
                            <tr key={row.id} className="align-top">
                              <td className="px-4 py-3">
                                <div className="font-medium text-primary">{row.employeeName}</div>
                                <div className="text-xs text-muted">
                                  {row.employeeNumber}
                                  {row.departmentName ? ` · ${row.departmentName}` : ''}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-secondary">{row.managerName ?? '—'}</td>
                              <td className="px-4 py-3 text-secondary">
                                {plural(row.ratedKpiCount, 'goal')}
                                {row.kpiWeightTotal > 0 ? (
                                  <span className="text-muted"> · {row.kpiWeightTotal}%</span>
                                ) : null}
                              </td>
                              <td className="px-4 py-3">
                                {row.reviewStatus ? (
                                  <StatusPill tone={REVIEW_TONE[row.reviewStatus]}>
                                    {REVIEW_STATUS_LABELS[row.reviewStatus]}
                                  </StatusPill>
                                ) : (
                                  <span className="text-xs text-muted">{launched ? 'Not created yet' : 'At launch'}</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {warnings.length === 0 ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-success-700 dark:text-success-300">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                                  </span>
                                ) : (
                                  <ul className="space-y-0.5 text-xs text-warning-700 dark:text-warning-300">
                                    {warnings.map((warning) => (
                                      <li key={warning} className="flex gap-1">
                                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {warning}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {canEdit && participantsOpen && !row.reviewId ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setRemoving(row)}
                                    aria-label={`Remove ${row.employeeName}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                ) : null}
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
          ) : null}
        </div>
      )}

      {cycleForm ? (
        <CycleFormModal
          companyId={companyId}
          cycle={cycleForm.cycle}
          cycles={cycles}
          onClose={() => setCycleForm(null)}
          onSaved={async (saved, created) => {
            setCycleForm(null);
            if (created) setCycleId(saved.id);
            await afterSave(
              created
                ? `${saved.name} was created as a draft. Add participants, then launch it.`
                : `${saved.name} was updated.`,
            );
          }}
        />
      ) : null}

      {addingParticipants && cycle ? (
        <AddParticipantsModal
          companyId={companyId}
          cycle={cycle}
          employees={employees}
          participants={participants}
          onClose={() => setAddingParticipants(false)}
          onSaved={async (message) => {
            setAddingParticipants(false);
            await afterSave(message);
          }}
        />
      ) : null}

      {launching && cycle ? (
        <LaunchModal
          companyId={companyId}
          cycle={cycle}
          readiness={pendingReadiness}
          onClose={() => setLaunching(false)}
          onLaunched={async (message) => {
            setLaunching(false);
            await afterSave(message);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title="Remove participant?"
        description={
          removing ? <p>{removing.employeeName} will no longer take part in {cycle?.name}.</p> : null
        }
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!removing || !cycle) return;
          await setReviewParticipants(
            companyId,
            cycle.id,
            participants.filter((row) => row.id !== removing.id).map((row) => row.employeeId),
          );
          await afterSave(`${removing.employeeName} was removed from ${cycle.name}.`);
        }}
        onClose={() => setRemoving(null)}
      />

      <ConfirmDialog
        open={cycleAction !== null}
        tone={cycleAction === 'reopen' ? 'primary' : 'danger'}
        title={
          cycleAction === 'close'
            ? 'Close this review cycle?'
            : cycleAction === 'reopen'
              ? 'Reopen this review cycle?'
              : cycle?.status === 'draft'
                ? 'Discard this draft cycle?'
                : 'Archive this review cycle?'
        }
        description={
          cycle ? (
            <p>
              {cycleAction === 'close'
                ? `Assessments and KPI goals in ${cycle.name} become read-only.${
                    incompleteReviews > 0
                      ? ` ${plural(incompleteReviews, 'review')} ${incompleteReviews === 1 ? 'is' : 'are'} not approved yet and will stay unfinished unless you reopen the cycle.`
                      : ''
                  }`
                : cycleAction === 'reopen'
                  ? `${cycle.name} goes back in progress so its assessments and KPI goals can change again.`
                  : cycle.status === 'draft'
                    ? `${cycle.name} was never launched. Archiving hides it from active work and can’t be undone.`
                    : `${cycle.name} becomes permanently read-only. This can’t be undone.`}
            </p>
          ) : null
        }
        confirmLabel={
          cycleAction === 'close' ? 'Close cycle' : cycleAction === 'reopen' ? 'Reopen' : cycle?.status === 'draft' ? 'Discard' : 'Archive'
        }
        onConfirm={async () => {
          if (!cycle || !cycleAction) return;
          const status = cycleAction === 'close' ? 'closed' : cycleAction === 'reopen' ? 'active' : 'archived';
          await updateReviewCycle(cycle.id, { status });
          await afterSave(`${cycle.name} is now ${REVIEW_CYCLE_STATUS_LABELS[status].toLowerCase()}.`);
        }}
        onClose={() => setCycleAction(null)}
      />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-primary">{value}</dd>
    </div>
  );
}

interface Readiness {
  total: number;
  noManager: number;
  noGoals: number;
  draftGoals: number;
  weightIssues: number;
  withoutReview: number;
}

function computeReadiness(rows: PerformanceReviewParticipantRecord[]): Readiness {
  return {
    total: rows.length,
    noManager: rows.filter((row) => !row.managerEmployeeId).length,
    noGoals: rows.filter((row) => row.ratedKpiCount === 0).length,
    draftGoals: rows.reduce((sum, row) => sum + row.draftKpiCount, 0),
    weightIssues: rows.filter(
      (row) => row.ratedKpiCount > 0 && row.kpiWeightTotal > 0 && row.kpiWeightTotal !== KPI_WEIGHT_LIMIT_PERCENT,
    ).length,
    withoutReview: rows.filter((row) => !row.reviewId).length,
  };
}

function readinessLines(readiness: Readiness): string[] {
  const lines: string[] = [];
  if (readiness.noManager > 0) {
    lines.push(`${plural(readiness.noManager, 'participant')} without a manager; HR completes their manager assessment.`);
  }
  if (readiness.noGoals > 0) {
    lines.push(`${plural(readiness.noGoals, 'participant')} with no active KPI goals; only competencies will be rated.`);
  }
  if (readiness.draftGoals > 0) {
    lines.push(`${plural(readiness.draftGoals, 'draft KPI goal')} won’t be part of the reviews until activated.`);
  }
  if (readiness.weightIssues > 0) {
    lines.push(`${plural(readiness.weightIssues, 'participant')} whose goal weights don’t total ${KPI_WEIGHT_LIMIT_PERCENT}%.`);
  }
  return lines;
}

function ReadinessSummary({ readiness }: { readiness: Readiness }) {
  const lines = readinessLines(readiness);
  return (
    <div
      className={`flex gap-2 border-b border-base px-4 py-3 text-sm ${
        lines.length > 0 ? 'bg-warning-50/60 dark:bg-warning-950/20' : 'bg-success-50/60 dark:bg-success-950/20'
      }`}
    >
      {lines.length > 0 ? (
        <>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
          <div className="text-secondary">
            <p className="font-medium text-primary">Check before launching</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <>
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-600" />
          <p className="text-secondary">
            {readiness.total === 1 ? 'The participant has' : `All ${readiness.total} participants have`} a manager and
            active KPI goals.
          </p>
        </>
      )}
    </div>
  );
}

// ── Create / edit cycle ──────────────────────────────────────────────────────

function defaultPeriod(cycles: PerformanceReviewCycleRecord[]): { start: string; end: string } {
  const latestEnd = cycles.map((row) => row.periodEnd).sort().pop();
  const today = new Date().toISOString().slice(0, 10);
  const start = latestEnd ? addDays(latestEnd, 1) : `${today.slice(0, 7)}-01`;
  return { start, end: addDays(addMonths(start, 6), -1) };
}

function CycleFormModal({
  companyId,
  cycle,
  cycles,
  onClose,
  onSaved,
}: {
  companyId: string;
  cycle: PerformanceReviewCycleRecord | null;
  cycles: PerformanceReviewCycleRecord[];
  onClose: () => void;
  onSaved: (cycle: PerformanceReviewCycleRecord, created: boolean) => Promise<void>;
}) {
  const initial = useMemo(() => {
    if (cycle) {
      return {
        name: cycle.name,
        description: cycle.description ?? '',
        start: cycle.periodStart,
        end: cycle.periodEnd,
        measurementPeriod: cycle.measurementPeriod,
        due: cycle.reviewDueDate,
        workflow: cycle.requiresWorkflowApproval,
      };
    }
    const period = defaultPeriod(cycles);
    return {
      name: '',
      description: '',
      start: period.start,
      end: period.end,
      measurementPeriod: 'quarterly' as KpiMeasurementPeriod,
      due: period.end,
      workflow: true,
    };
  }, [cycle, cycles]);

  const [form, setForm] = useState(initial);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = Boolean(cycle?.launchedAt);

  const windows = useMemo(
    () => (form.start && form.end && form.start <= form.end ? kpiMeasurementWindows(form.start, form.end, form.measurementPeriod) : []),
    [form.start, form.end, form.measurementPeriod],
  );

  const errors = {
    name: form.name.trim() ? null : 'Enter a cycle name',
    period:
      !form.start || !form.end
        ? 'Enter the start and end dates'
        : form.start > form.end
          ? 'The cycle must end on or after it starts'
          : null,
    due: !form.due ? 'Enter a review due date' : form.start && form.due < form.start ? 'Reviews can’t be due before the cycle starts' : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const overlapping = cycles.filter(
    (row) => row.id !== cycle?.id && row.status !== 'archived' && row.periodStart <= form.end && form.start <= row.periodEnd,
  );

  const save = async () => {
    setTouched(true);
    if (hasErrors) return;
    setSaving(true);
    setError(null);
    try {
      if (cycle) {
        const input: UpdateReviewCycleInput = {};
        if (form.name.trim() !== cycle.name) input.name = form.name.trim();
        if ((form.description.trim() || null) !== cycle.description) input.description = form.description.trim() || null;
        if (form.due !== cycle.reviewDueDate) input.reviewDueDate = form.due;
        if (!locked) {
          if (form.start !== cycle.periodStart) input.periodStart = form.start;
          if (form.end !== cycle.periodEnd) input.periodEnd = form.end;
          if (form.measurementPeriod !== cycle.measurementPeriod) input.measurementPeriod = form.measurementPeriod;
          if (form.workflow !== cycle.requiresWorkflowApproval) input.requiresWorkflowApproval = form.workflow;
        }
        if (Object.keys(input).length === 0) {
          onClose();
          return;
        }
        await onSaved(await updateReviewCycle(cycle.id, input), false);
      } else {
        const created = await createReviewCycle(companyId, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          periodStart: form.start,
          periodEnd: form.end,
          measurementPeriod: form.measurementPeriod,
          reviewDueDate: form.due,
          requiresWorkflowApproval: form.workflow,
        });
        await onSaved(created, true);
      }
    } catch (err) {
      setError(errorMessage(err, 'Failed to save the review cycle'));
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (message: string | null) =>
    touched && message ? <p className="mt-1 text-xs text-error-600">{message}</p> : null;

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      title={cycle ? 'Edit review cycle' : 'New review cycle'}
      description="The period every KPI goal and assessment in this cycle covers."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : cycle ? 'Save changes' : 'Create draft cycle'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
            {error}
          </div>
        ) : null}
        {locked ? (
          <div className="flex items-start gap-2 rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs text-secondary">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            This cycle has launched, so its period, measurement period and sign-off setting are fixed.
          </div>
        ) : null}
        <div>
          <Label htmlFor="cycle-name">Cycle name</Label>
          <Input
            id="cycle-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="H1 2027 Performance Review"
          />
          {fieldError(errors.name)}
        </div>
        <div>
          <Label htmlFor="cycle-description">Description (optional)</Label>
          <Textarea
            id="cycle-description"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What this cycle focuses on"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="cycle-start">Period start</Label>
            <Input
              id="cycle-start"
              type="date"
              value={form.start}
              disabled={locked}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="cycle-end">Period end</Label>
            <Input
              id="cycle-end"
              type="date"
              value={form.end}
              min={form.start}
              disabled={locked}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
            />
          </div>
        </div>
        {fieldError(errors.period)}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="cycle-measurement">KPI measurement period</Label>
            <Select
              id="cycle-measurement"
              value={form.measurementPeriod}
              disabled={locked}
              onChange={(e) => setForm({ ...form, measurementPeriod: e.target.value as KpiMeasurementPeriod })}
            >
              {PERIOD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {MEASUREMENT_PERIOD_LABELS[type]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="cycle-due">Reviews due</Label>
            <Input
              id="cycle-due"
              type="date"
              value={form.due}
              min={form.start}
              onChange={(e) => setForm({ ...form, due: e.target.value })}
            />
            {fieldError(errors.due)}
          </div>
        </div>
        {form.measurementPeriod === 'custom' ? (
          <p className="text-xs text-muted">Custom: each KPI goal sets its own measurement dates inside the cycle.</p>
        ) : windows.length > 0 ? (
          <div>
            <p className="text-xs text-muted">
              KPI goals default to these {plural(windows.length, 'window')}, counted from the cycle start:
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {windows.slice(0, 12).map((w) => (
                <span key={w.index} className="rounded-md bg-[rgb(var(--bg-muted))] px-2 py-0.5 text-xs text-secondary">
                  {w.label}
                  {w.partial ? ' (shortened)' : ''}
                </span>
              ))}
              {windows.length > 12 ? <span className="text-xs text-muted">+{windows.length - 12} more</span> : null}
            </div>
          </div>
        ) : null}
        {overlapping.length > 0 ? (
          <p className="text-xs text-warning-700 dark:text-warning-300">
            Overlaps with {overlapping.map((row) => row.name).join(', ')}. Employees in both cycles will be reviewed twice
            for the overlapping dates.
          </p>
        ) : null}
        <label className="flex items-start gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={form.workflow}
            disabled={locked}
            onChange={(e) => setForm({ ...form, workflow: e.target.checked })}
          />
          <span>
            Send finished reviews through the approval workflow
            <span className="block text-xs text-muted">
              Otherwise a review is approved as soon as the manager submits it.
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}

// ── Participants ─────────────────────────────────────────────────────────────

function AddParticipantsModal({
  companyId,
  cycle,
  employees,
  participants,
  onClose,
  onSaved,
}: {
  companyId: string;
  cycle: PerformanceReviewCycleRecord;
  employees: EmployeeRecord[];
  participants: PerformanceReviewParticipantRecord[];
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [createReviews, setCreateReviews] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const launched = Boolean(cycle.launchedAt);

  const current = useMemo(() => new Set(participants.map((row) => row.employeeId)), [participants]);
  const eligible = useMemo(
    () =>
      employees
        .filter(
          (row) =>
            !current.has(row.id) && row.employmentStatus !== 'terminated' && row.employmentStatus !== 'inactive',
        )
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [employees, current],
  );
  const departments = useMemo(
    () =>
      [...new Map(eligible.filter((row) => row.department).map((row) => [row.department!.id, row.department!.name]))]
        .sort((a, b) => a[1].localeCompare(b[1])),
    [eligible],
  );
  const visible = eligible.filter((row) => {
    if (department && row.department?.id !== department) return false;
    const query = search.trim().toLowerCase();
    return !query || row.fullName.toLowerCase().includes(query) || row.employeeNumber.toLowerCase().includes(query);
  });
  const allVisibleSelected = visible.length > 0 && visible.every((row) => selected.includes(row.id));

  const toggleAllVisible = () => {
    setSelected((prev) =>
      allVisibleSelected
        ? prev.filter((id) => !visible.some((row) => row.id === id))
        : [...new Set([...prev, ...visible.map((row) => row.id)])],
    );
  };

  const save = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await setReviewParticipants(companyId, cycle.id, [...current, ...selected]);
      let message = `${plural(selected.length, 'participant')} added to ${cycle.name}.`;
      if (launched && createReviews) {
        const result = await launchReviewCycle(companyId, cycle.id);
        message = `${plural(selected.length, 'participant')} added and ${plural(result.createdCount, 'review')} created.`;
      }
      await onSaved(message);
    } catch (err) {
      setError(errorMessage(err, 'Failed to add participants'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      title="Add participants"
      description={`Choose who takes part in ${cycle.name}. People who have left the company aren’t listed.`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || selected.length === 0}>
            {saving ? 'Adding…' : `Add ${plural(selected.length, 'participant')}`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? (
          <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
            {error}
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              className="pl-9"
              placeholder="Search name or employee number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search employees"
            />
          </div>
          <Select value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Filter by department">
            <option value="">All departments</option>
            {departments.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </div>
        {eligible.length === 0 ? (
          <p className="rounded-lg border border-base p-6 text-center text-sm text-secondary">
            Everyone currently employed is already taking part.
          </p>
        ) : (
          <div className="rounded-lg border border-base">
            <label className="flex items-center gap-2 border-b border-base px-3 py-2 text-sm font-medium text-primary">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={visible.length === 0} />
              Select all shown ({visible.length})
              <span className="ml-auto text-xs font-normal text-muted">{selected.length} selected</span>
            </label>
            <div className="max-h-72 divide-y divide-[rgb(var(--border-base))] overflow-y-auto">
              {visible.map((row) => (
                <label key={row.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-[rgb(var(--bg-hover))]">
                  <input
                    type="checkbox"
                    checked={selected.includes(row.id)}
                    onChange={(e) =>
                      setSelected((prev) => (e.target.checked ? [...prev, row.id] : prev.filter((id) => id !== row.id)))
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-primary">{row.fullName}</span>
                    <span className="block text-xs text-muted">
                      {row.employeeNumber}
                      {row.department ? ` · ${row.department.name}` : ''}
                      {row.designation ? ` · ${row.designation.name}` : ''}
                    </span>
                  </span>
                  {!row.managerId ? <span className="text-xs text-warning-700 dark:text-warning-300">No manager</span> : null}
                </label>
              ))}
              {visible.length === 0 ? <p className="p-4 text-center text-sm text-secondary">No employees match.</p> : null}
            </div>
          </div>
        )}
        {launched ? (
          <label className="flex items-start gap-2 text-sm text-secondary">
            <input type="checkbox" className="mt-0.5" checked={createReviews} onChange={(e) => setCreateReviews(e.target.checked)} />
            <span>
              Create their reviews now
              <span className="block text-xs text-muted">
                The cycle has launched; their self-assessments open straight away with their current KPI goals.
              </span>
            </span>
          </label>
        ) : null}
      </div>
    </Modal>
  );
}

// ── Launch ───────────────────────────────────────────────────────────────────

function LaunchModal({
  companyId,
  cycle,
  readiness,
  onClose,
  onLaunched,
}: {
  companyId: string;
  cycle: PerformanceReviewCycleRecord;
  /** Readiness of the participants who don't have a review yet. */
  readiness: Readiness;
  onClose: () => void;
  onLaunched: (message: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstLaunch = !cycle.launchedAt;
  const creating = readiness.total;
  const lines = readinessLines(readiness);

  const launch = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await launchReviewCycle(companyId, cycle.id);
      await onLaunched(
        firstLaunch
          ? `${cycle.name} launched: ${plural(result.createdCount, 'review')} created and self-assessments are open.`
          : `${plural(result.createdCount, 'review')} created.`,
      );
    } catch (err) {
      setError(errorMessage(err, 'Failed to launch the cycle'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      title={firstLaunch ? `Launch ${cycle.name}?` : 'Create pending reviews?'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void launch()} disabled={saving}>
            {saving ? 'Working…' : firstLaunch ? 'Launch cycle' : `Create ${plural(creating, 'review')}`}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-secondary">
        {error ? (
          <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-error-700 dark:bg-error-950/30 dark:text-error-300">
            {error}
          </div>
        ) : null}
        <p>
          This creates {plural(creating, 'review')}. Each one lists the employee’s active and completed KPI goals next to
          the competencies, and the self-assessment opens straight away.
        </p>
        {firstLaunch ? (
          <p>
            After launch, the cycle period, measurement period and sign-off setting are fixed, and goal targets, windows
            and weights lock for everyone with a review.
          </p>
        ) : null}
        {lines.length > 0 ? (
          <div className="rounded-lg border border-warning-200 bg-warning-50/60 p-3 dark:border-warning-900 dark:bg-warning-950/20">
            <p className="flex items-center gap-1.5 font-medium text-primary">
              <AlertTriangle className="h-4 w-4 text-warning-600" /> Worth checking first
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
