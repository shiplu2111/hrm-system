import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  MapPin,
  Pencil,
  Play,
  RefreshCw,
  Search,
  UserCheck,
  Users,
  UserX,
  XCircle,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import type {
  TrainingAttendanceRecord,
  TrainingCourseRecord,
  TrainingSessionRecord,
  TrainingSessionStatus,
} from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Select } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { SummaryTile } from '@/components/ui/SummaryTile';
import { Banner, errorMessage } from '@/components/performance/performance-ui';
import { AttendanceRoster } from '@/components/training/AttendanceRoster';
import { EnrolEmployeesModal } from '@/components/training/EnrolEmployeesModal';
import { SessionCostsCard } from '@/components/training/SessionCostsCard';
import { SessionFormModal } from '@/components/training/SessionFormModal';
import {
  formatDateTime,
  formatSessionWindow,
  hasStarted,
  isSessionOpen,
  percent,
  SESSION_STATUS_TONE,
} from '@/components/training/training-ui';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
import { formatCurrencyAmount } from '@/lib/offboarding-display';
import {
  getTrainingSession,
  listTrainingAttendance,
  listTrainingCourses,
  listTrainingSessions,
  SESSION_STATUS_LABELS,
  updateTrainingSession,
} from '@/lib/training-api';

type StatusFilter = 'all' | 'open' | TrainingSessionStatus;
type SessionAction = 'in_progress' | 'completed' | 'cancelled';

const ACTION_COPY: Record<SessionAction, { title: string; confirm: string; notice: string }> = {
  in_progress: { title: 'Start session?', confirm: 'Start session', notice: 'Session started.' },
  completed: { title: 'Complete session?', confirm: 'Complete session', notice: 'Session completed.' },
  cancelled: { title: 'Cancel session?', confirm: 'Cancel session', notice: 'Session cancelled.' },
};

function sortSessions(rows: TrainingSessionRecord[]): TrainingSessionRecord[] {
  const time = (row: TrainingSessionRecord) => new Date(row.scheduledStart).getTime();
  const open = rows.filter((row) => isSessionOpen(row.status)).sort((a, b) => time(a) - time(b));
  const closed = rows.filter((row) => !isSessionOpen(row.status)).sort((a, b) => time(b) - time(a));
  return [...open, ...closed];
}

export function TrainingAttendancePage() {
  const { companyId } = useCompany();
  const { navigate } = useNav();
  const { can } = usePermissions();
  const canCreate = can('training', 'create');
  const canEdit = can('training', 'edit');
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionParam = searchParams.get('session');

  const [sessions, setSessions] = useState<TrainingSessionRecord[]>([]);
  const [courses, setCourses] = useState<TrainingCourseRecord[]>([]);
  const [attendance, setAttendance] = useState<TrainingAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [scheduling, setScheduling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [action, setAction] = useState<SessionAction | null>(null);

  const selected = useMemo(
    () => sessions.find((row) => row.id === sessionParam) ?? null,
    [sessions, sessionParam],
  );

  const selectSession = useCallback(
    (id: string | null, replace = false) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (id) next.set('session', id);
          else next.delete('session');
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  const loadAll = useCallback(async () => {
    if (!companyId) return;
    const [sessionRows, courseRows] = await Promise.all([
      listTrainingSessions(companyId),
      listTrainingCourses(companyId),
    ]);
    setSessions(sortSessions(sessionRows));
    setCourses(courseRows);
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    loadAll()
      .catch((err) => setError(errorMessage(err, 'Couldn’t load training sessions')))
      .finally(() => setLoading(false));
  }, [companyId, loadAll]);

  useEffect(() => {
    if (loading) return;
    if (!selected && sessions.length > 0) selectSession(sessions[0].id, true);
  }, [loading, selected, sessions, selectSession]);

  const selectedId = selected?.id ?? null;

  const loadAttendance = useCallback(async () => {
    if (!companyId || !selectedId) {
      setAttendance([]);
      return;
    }
    setDetailLoading(true);
    try {
      setAttendance(await listTrainingAttendance(companyId, { sessionId: selectedId }));
    } catch (err) {
      setAttendance([]);
      setError(errorMessage(err, 'Couldn’t load attendance'));
    } finally {
      setDetailLoading(false);
    }
  }, [companyId, selectedId]);

  useEffect(() => {
    setAttendance([]);
    void loadAttendance();
  }, [loadAttendance]);

  const replaceSession = (row: TrainingSessionRecord) =>
    setSessions((current) => sortSessions(current.map((item) => (item.id === row.id ? row : item))));

  const refreshSelected = async (message: string) => {
    if (!companyId || !selected) return;
    setError(null);
    try {
      const [row, rows] = await Promise.all([
        getTrainingSession(selected.id),
        listTrainingAttendance(companyId, { sessionId: selected.id }),
      ]);
      replaceSession(row);
      setAttendance(rows);
      if (message) setNotice(message);
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t refresh the session'));
    }
  };

  const refreshAll = async () => {
    setError(null);
    setNotice(null);
    try {
      await loadAll();
      await loadAttendance();
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t refresh'));
    }
  };

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sessions.filter(
      (row) =>
        (!courseFilter || row.courseId === courseFilter) &&
        (statusFilter === 'all' ||
          (statusFilter === 'open' ? isSessionOpen(row.status) : row.status === statusFilter)) &&
        (!term ||
          `${row.displayTitle} ${row.courseTitle} ${row.instructor ?? ''} ${row.location ?? ''}`
            .toLowerCase()
            .includes(term)),
    );
  }, [sessions, search, courseFilter, statusFilter]);

  const activeCourses = useMemo(() => courses.filter((row) => row.status === 'active'), [courses]);
  const enrolledIds = useMemo(
    () => new Set(attendance.filter((row) => row.status !== 'cancelled').map((row) => row.employeeId)),
    [attendance],
  );
  const withdrawnIds = useMemo(
    () => new Set(attendance.filter((row) => row.status === 'cancelled').map((row) => row.employeeId)),
    [attendance],
  );

  if (!companyId) {
    return <div className="p-6 text-sm text-secondary">Select a company to track training attendance.</div>;
  }

  const started = selected ? hasStarted(selected) : false;
  const money = (value: number | null) =>
    selected && value != null ? formatCurrencyAmount(value, selected.currency) : '—';

  const actionDescription = (kind: SessionAction, row: TrainingSessionRecord) => {
    if (kind === 'in_progress') return `Attendance can be marked as people arrive. ${row.enrolledCount} enrolled.`;
    if (kind === 'completed') {
      return `${row.attendedCount} of ${row.enrolledCount} attended. Attendance and costs stay editable, but no one else can be enrolled.`;
    }
    return row.unmarkedCount > 0
      ? `${row.unmarkedCount} ${row.unmarkedCount === 1 ? 'enrolment' : 'enrolments'} will be withdrawn. This can’t be undone.`
      : 'This can’t be undone.';
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl font-bold text-primary">Training attendance &amp; costs</h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary">
            Enrol employees in scheduled sessions, mark who attended, and track what each session cost per attendee.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void refreshAll()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="secondary" onClick={() => navigate('training-catalog')}>
            <BookOpen className="h-4 w-4" /> Course catalog
          </Button>
          {canCreate ? (
            <Button onClick={() => setScheduling(true)} disabled={activeCourses.length === 0}>
              <CalendarPlus className="h-4 w-4" /> Schedule session
            </Button>
          ) : null}
        </div>
      </header>

      {error ? (
        <Banner icon={AlertCircle} tone="error">
          {error}
        </Banner>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-900 dark:bg-success-950/30 dark:text-success-300"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> {notice}
          </span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-secondary">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading sessions…
        </div>
      ) : sessions.length === 0 ? (
        <section className="surface flex flex-col items-center gap-3 rounded-xl border border-base p-10 text-center shadow-card">
          <CalendarClock className="h-8 w-8 text-muted" />
          <p className="text-sm text-secondary">
            {activeCourses.length === 0
              ? 'Add and activate a course in the catalog, then schedule its first session.'
              : 'No sessions yet. Schedule one to start enrolling employees.'}
          </p>
          {activeCourses.length === 0 ? (
            <Button variant="secondary" onClick={() => navigate('training-catalog')}>
              <BookOpen className="h-4 w-4" /> Go to the course catalog
            </Button>
          ) : canCreate ? (
            <Button onClick={() => setScheduling(true)}>
              <CalendarPlus className="h-4 w-4" /> Schedule session
            </Button>
          ) : null}
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="surface flex max-h-[calc(100vh-12rem)] flex-col rounded-xl border border-base shadow-card lg:sticky lg:top-4">
            <div className="space-y-2 border-b border-base p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  className="pl-9"
                  placeholder="Search sessions"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search sessions"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} aria-label="Course">
                  <option value="">All courses</option>
                  {courses.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.title}
                    </option>
                  ))}
                </Select>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  aria-label="Status"
                >
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  {(Object.keys(SESSION_STATUS_LABELS) as TrainingSessionStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {SESSION_STATUS_LABELS[status]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="min-h-0 flex-1 divide-y divide-[rgb(var(--border-base))] overflow-y-auto">
              {visible.length === 0 ? (
                <p className="p-6 text-center text-sm text-secondary">No sessions match the filters.</p>
              ) : (
                visible.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      selectSession(row.id);
                      setNotice(null);
                    }}
                    className={`block w-full px-4 py-3 text-left transition-colors ${
                      row.id === selected?.id ? 'bg-accent-50 dark:bg-accent-950/30' : 'hover:bg-[rgb(var(--bg-hover))]'
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-primary">{row.displayTitle}</span>
                        <span className="block truncate text-xs text-muted">{formatDateTime(row.scheduledStart)}</span>
                      </span>
                      <StatusPill tone={SESSION_STATUS_TONE[row.status]}>{SESSION_STATUS_LABELS[row.status]}</StatusPill>
                    </span>
                    <span className="mt-1.5 flex items-center gap-3 text-xs text-secondary">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {row.enrolledCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5" /> {row.attendedCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <CircleDollarSign className="h-3.5 w-3.5" /> {formatCurrencyAmount(row.totalCost, row.currency)}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          {selected ? (
            <div className="min-w-0 space-y-4">
              <section className="surface rounded-xl border border-base p-5 shadow-card">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-primary">{selected.displayTitle}</h2>
                      <StatusPill tone={SESSION_STATUS_TONE[selected.status]}>
                        {SESSION_STATUS_LABELS[selected.status]}
                      </StatusPill>
                    </div>
                    {selected.title ? <p className="text-sm text-secondary">{selected.courseTitle}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary">
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {formatSessionWindow(selected.scheduledStart, selected.scheduledEnd)}
                      </span>
                      {selected.location ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {selected.location}
                        </span>
                      ) : null}
                      {selected.instructor ? <span>Instructor: {selected.instructor}</span> : null}
                    </div>
                    {selected.notes ? <p className="mt-2 text-xs text-muted">{selected.notes}</p> : null}
                  </div>
                  {canEdit ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {selected.status !== 'cancelled' ? (
                        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      ) : null}
                      {selected.status === 'scheduled' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!started}
                          title={started ? undefined : 'Available once the start time has passed'}
                          onClick={() => setAction('in_progress')}
                        >
                          <Play className="h-3.5 w-3.5" /> Start
                        </Button>
                      ) : null}
                      {isSessionOpen(selected.status) ? (
                        <>
                          <Button
                            size="sm"
                            disabled={!started || selected.unmarkedCount > 0}
                            title={
                              !started
                                ? 'Available once the start time has passed'
                                : selected.unmarkedCount > 0
                                  ? `Mark attendance for ${selected.unmarkedCount} more first`
                                  : undefined
                            }
                            onClick={() => setAction('completed')}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={selected.attendedCount > 0}
                            title={
                              selected.attendedCount > 0
                                ? 'People have attended; complete the session instead'
                                : undefined
                            }
                            onClick={() => setAction('cancelled')}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Cancel
                          </Button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {selected.courseStatus !== 'active' && isSessionOpen(selected.status) ? (
                  <div className="mt-3">
                    <Banner icon={AlertCircle} tone="warning">
                      The course is {selected.courseStatus}, so new enrolments are closed for this session.
                    </Banner>
                  </div>
                ) : null}
              </section>

              <div className="grid gap-3 sm:grid-cols-3 2xl:grid-cols-6">
                <SummaryTile
                  icon={<Users className="h-5 w-5" />}
                  tone="accent"
                  value={String(selected.enrolledCount)}
                  label="Enrolled"
                  hint={`${selected.unmarkedCount} not marked`}
                />
                <SummaryTile
                  icon={<UserCheck className="h-5 w-5" />}
                  tone="success"
                  value={String(selected.attendedCount)}
                  label="Attended"
                  hint={`${percent(selected.attendedCount, selected.enrolledCount)} of enrolled`}
                />
                <SummaryTile
                  icon={<UserX className="h-5 w-5" />}
                  tone={selected.noShowCount > 0 ? 'error' : 'neutral'}
                  value={String(selected.noShowCount)}
                  label="No-shows"
                  hint={`${percent(selected.noShowCount, selected.enrolledCount)} of enrolled`}
                />
                <SummaryTile
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  tone="success"
                  value={percent(selected.completedCount, selected.enrolledCount)}
                  label="Completion"
                  hint={`${selected.completedCount} completed`}
                />
                <SummaryTile
                  icon={<CircleDollarSign className="h-5 w-5" />}
                  tone="warning"
                  value={money(selected.totalCost)}
                  label="Total cost"
                  hint={
                    selected.otherCurrencyCosts.length > 0
                      ? 'Excludes other currencies'
                      : `${selected.costs.length} cost ${selected.costs.length === 1 ? 'line' : 'lines'}`
                  }
                />
                <SummaryTile
                  icon={<CircleDollarSign className="h-5 w-5" />}
                  tone="accent"
                  value={money(selected.costPerAttendee)}
                  label="Cost per attendee"
                  hint={selected.attendedCount > 0 ? `${selected.attendedCount} attended` : 'No attendance yet'}
                />
              </div>

              <div className="space-y-4">
                {detailLoading && attendance.length === 0 ? (
                  <div className="surface flex items-center justify-center rounded-xl border border-base py-16 text-secondary shadow-card">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading attendance…
                  </div>
                ) : (
                  <AttendanceRoster
                    session={selected}
                    attendance={attendance}
                    canEdit={canEdit}
                    onEnrol={() => setEnrolling(true)}
                    onChanged={refreshSelected}
                    onError={setError}
                  />
                )}
                <SessionCostsCard
                  session={selected}
                  canEdit={canEdit}
                  onChanged={(row, message) => {
                    replaceSession(row);
                    setNotice(message);
                    setError(null);
                  }}
                />
              </div>
            </div>
          ) : (
            <section className="surface flex items-center justify-center rounded-xl border border-base p-10 text-sm text-secondary shadow-card">
              Select a session to see its attendance and costs.
            </section>
          )}
        </div>
      )}

      <SessionFormModal
        open={scheduling || editing}
        companyId={companyId}
        courses={activeCourses}
        session={editing ? selected : null}
        onClose={() => {
          setScheduling(false);
          setEditing(false);
        }}
        onSaved={(row, created) => {
          setScheduling(false);
          setEditing(false);
          if (created) {
            setSessions((current) => sortSessions([...current, row]));
            selectSession(row.id);
            setNotice('Session scheduled. Enrol employees next.');
          } else {
            replaceSession(row);
            setNotice('Session updated.');
          }
        }}
      />

      {selected ? (
        <EnrolEmployeesModal
          open={enrolling}
          companyId={companyId}
          session={selected}
          enrolledEmployeeIds={enrolledIds}
          withdrawnEmployeeIds={withdrawnIds}
          onClose={() => setEnrolling(false)}
          onEnrolled={(result) => {
            const restored = result.restoredCount > 0 ? `, ${result.restoredCount} re-enrolled` : '';
            void refreshSelected(
              result.enrolledCount > 0
                ? `${result.enrolledCount} ${result.enrolledCount === 1 ? 'employee' : 'employees'} enrolled${restored}.`
                : '',
            );
          }}
        />
      ) : null}

      <ConfirmDialog
        open={action != null && selected != null}
        title={action ? ACTION_COPY[action].title : ''}
        description={action && selected ? actionDescription(action, selected) : undefined}
        confirmLabel={action ? ACTION_COPY[action].confirm : 'Confirm'}
        tone={action === 'cancelled' ? 'danger' : 'primary'}
        onConfirm={async () => {
          if (!action || !selected) return;
          const row = await updateTrainingSession(selected.id, { status: action });
          replaceSession(row);
          setNotice(ACTION_COPY[action].notice);
          await refreshSelected('');
        }}
        onClose={() => setAction(null)}
      />
    </div>
  );
}
