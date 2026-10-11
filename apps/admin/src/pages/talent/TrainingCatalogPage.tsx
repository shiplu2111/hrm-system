import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  BookOpen,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Rocket,
  Search,
  Undo2,
  Users,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import type {
  TrainingCourseDeliveryMode,
  TrainingCourseRecord,
  TrainingCourseStatus,
  TrainingSessionRecord,
  TrainingSummary,
} from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Select } from '@/components/ui/Form';
import { SidePanel } from '@/components/ui/SidePanel';
import { StatusPill } from '@/components/ui/StatusPill';
import { SummaryTile } from '@/components/ui/SummaryTile';
import { Banner, errorMessage } from '@/components/performance/performance-ui';
import { CourseFormModal } from '@/components/training/CourseFormModal';
import { SessionFormModal } from '@/components/training/SessionFormModal';
import {
  COURSE_STATUS_TONE,
  formatDateTime,
  SESSION_STATUS_TONE,
} from '@/components/training/training-ui';
import { pathForPage } from '@/config/routes';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
import { formatCurrencyAmount } from '@/lib/offboarding-display';
import {
  COURSE_STATUS_LABELS,
  DELIVERY_MODE_LABELS,
  formatDurationMinutes,
  getTrainingSummary,
  listTrainingCourses,
  listTrainingSessions,
  SESSION_STATUS_LABELS,
  updateTrainingCourse,
} from '@/lib/training-api';

type StatusFilter = 'current' | 'all' | TrainingCourseStatus;

interface StatusChange {
  course: TrainingCourseRecord;
  to: TrainingCourseStatus;
}

const STATUS_CHANGE_COPY: Record<TrainingCourseStatus, { title: string; confirm: string; notice: string }> = {
  active: { title: 'Activate course?', confirm: 'Activate', notice: 'is active and ready to schedule.' },
  draft: { title: 'Move course back to draft?', confirm: 'Move to draft', notice: 'is back in draft.' },
  archived: { title: 'Archive course?', confirm: 'Archive', notice: 'was archived.' },
};

function statusChangeDescription({ course, to }: StatusChange): string {
  if (to === 'archived') {
    return `${course.title} will be hidden from scheduling. Past sessions, attendance and costs are kept, and you can restore it later.`;
  }
  if (to === 'draft') return `${course.title} will be hidden from scheduling until you activate it again.`;
  return course.status === 'archived'
    ? `${course.title} will be back in the catalog and available for new sessions.`
    : `${course.title} will be available for scheduling sessions.`;
}

export function TrainingCatalogPage() {
  const { companyId } = useCompany();
  const { navigate } = useNav();
  const routerNavigate = useNavigate();
  const { can } = usePermissions();
  const canCreate = can('training', 'create');
  const canEdit = can('training', 'edit');

  const [courses, setCourses] = useState<TrainingCourseRecord[]>([]);
  const [summary, setSummary] = useState<TrainingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('current');
  const [deliveryFilter, setDeliveryFilter] = useState<'' | TrainingCourseDeliveryMode>('');
  const [mandatoryOnly, setMandatoryOnly] = useState(false);

  const [formCourse, setFormCourse] = useState<TrainingCourseRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailSessions, setDetailSessions] = useState<TrainingSessionRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<TrainingCourseRecord | null>(null);
  const [statusChange, setStatusChange] = useState<StatusChange | null>(null);

  const detail = courses.find((row) => row.id === detailId) ?? null;

  const load = useCallback(async () => {
    if (!companyId) return;
    const [courseRows, summaryRow] = await Promise.all([
      listTrainingCourses(companyId),
      getTrainingSummary(companyId),
    ]);
    setCourses(courseRows);
    setSummary(summaryRow);
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    load()
      .catch((err) => setError(errorMessage(err, 'Couldn’t load the course catalog')))
      .finally(() => setLoading(false));
  }, [companyId, load]);

  const loadDetailSessions = useCallback(async () => {
    if (!companyId || !detailId) {
      setDetailSessions([]);
      return;
    }
    setDetailLoading(true);
    try {
      const rows = await listTrainingSessions(companyId, { courseId: detailId });
      setDetailSessions(
        rows.sort((a, b) => new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime()),
      );
    } catch (err) {
      setDetailSessions([]);
      setError(errorMessage(err, 'Couldn’t load the course’s sessions'));
    } finally {
      setDetailLoading(false);
    }
  }, [companyId, detailId]);

  useEffect(() => {
    void loadDetailSessions();
  }, [loadDetailSessions]);

  const categories = useMemo(
    () => [...new Set(courses.map((row) => row.category).filter((value): value is string => !!value))].sort(),
    [courses],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return courses
      .filter(
        (row) =>
          (statusFilter === 'all' ||
            (statusFilter === 'current' ? row.status !== 'archived' : row.status === statusFilter)) &&
          (!category || row.category === category) &&
          (!deliveryFilter || row.deliveryMode === deliveryFilter) &&
          (!mandatoryOnly || row.isMandatory) &&
          (!term || `${row.title} ${row.category ?? ''} ${row.description ?? ''}`.toLowerCase().includes(term)),
      )
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [courses, search, statusFilter, category, deliveryFilter, mandatoryOnly]);

  const replaceCourse = (row: TrainingCourseRecord) =>
    setCourses((current) =>
      current.some((item) => item.id === row.id)
        ? current.map((item) => (item.id === row.id ? row : item))
        : [...current, row],
    );

  const refreshAfterChange = async () => {
    try {
      await load();
      await loadDetailSessions();
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t refresh the catalog'));
    }
  };

  const openTracker = (sessionId?: string) => {
    const path = pathForPage('training-sessions');
    routerNavigate(sessionId ? `${path}?session=${encodeURIComponent(sessionId)}` : path);
  };

  if (!companyId) {
    return <div className="p-6 text-sm text-secondary">Select a company to manage the course catalog.</div>;
  }

  const activeCount = courses.filter((row) => row.status === 'active').length;
  const draftCount = courses.filter((row) => row.status === 'draft').length;
  const filtersActive = !!(search || category || deliveryFilter || mandatoryOnly || statusFilter !== 'current');

  const statusActions = (course: TrainingCourseRecord) => {
    if (!canEdit) return null;
    if (course.status === 'draft') {
      return (
        <>
          <Button size="sm" onClick={() => setStatusChange({ course, to: 'active' })}>
            <Rocket className="h-3.5 w-3.5" /> Activate
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStatusChange({ course, to: 'archived' })}>
            <Archive className="h-3.5 w-3.5" /> Archive
          </Button>
        </>
      );
    }
    if (course.status === 'active') {
      return (
        <>
          {course.sessionCount === 0 ? (
            <Button size="sm" variant="ghost" onClick={() => setStatusChange({ course, to: 'draft' })}>
              <Undo2 className="h-3.5 w-3.5" /> Move to draft
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            disabled={course.upcomingSessionCount > 0}
            title={
              course.upcomingSessionCount > 0
                ? `Complete or cancel its ${course.upcomingSessionCount} open ${course.upcomingSessionCount === 1 ? 'session' : 'sessions'} first`
                : undefined
            }
            onClick={() => setStatusChange({ course, to: 'archived' })}
          >
            <Archive className="h-3.5 w-3.5" /> Archive
          </Button>
        </>
      );
    }
    return (
      <Button size="sm" variant="secondary" onClick={() => setStatusChange({ course, to: 'active' })}>
        <ArchiveRestore className="h-3.5 w-3.5" /> Restore
      </Button>
    );
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl font-bold text-primary">Course catalog</h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary">
            The courses your company offers. Activate a course to schedule sessions, then track enrolment, attendance
            and cost per session.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => openTracker()}>
            <ClipboardList className="h-4 w-4" /> Attendance &amp; costs
          </Button>
          {canCreate ? (
            <Button
              onClick={() => {
                setFormCourse(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add course
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          icon={<BookOpen className="h-5 w-5" />}
          tone="accent"
          value={String(activeCount)}
          label="Active courses"
          hint={draftCount > 0 ? `${draftCount} in draft` : `${courses.length} in the catalog`}
          onClick={() => setStatusFilter('active')}
        />
        <SummaryTile
          icon={<CalendarClock className="h-5 w-5" />}
          tone="warning"
          value={String(summary?.upcomingSessionCount ?? 0)}
          label="Upcoming sessions"
          hint="Scheduled from now on"
          onClick={() => openTracker()}
        />
        <SummaryTile
          icon={<GraduationCap className="h-5 w-5" />}
          tone="success"
          value={summary?.completionRatePercent == null ? '—' : `${summary.completionRatePercent}%`}
          label="Completion rate"
          hint={`${summary?.totalAttendees ?? 0} enrolments in total`}
        />
        <SummaryTile
          icon={<CircleDollarSign className="h-5 w-5" />}
          tone="neutral"
          value={summary ? formatCurrencyAmount(summary.totalTrainingCost, summary.currency) : '—'}
          label="Training spend"
          hint="All sessions, company currency"
        />
      </div>

      <section className="surface rounded-xl border border-base shadow-card">
        <div className="flex flex-col gap-2 border-b border-base p-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              className="pl-9"
              placeholder="Search courses"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search courses"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
            <Select className="lg:w-40" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <Select
              className="lg:w-40"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Status"
            >
              <option value="current">Active &amp; draft</option>
              <option value="all">All statuses</option>
              {(Object.keys(COURSE_STATUS_LABELS) as TrainingCourseStatus[]).map((status) => (
                <option key={status} value={status}>
                  {COURSE_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
            <Select
              className="lg:w-40"
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value as '' | TrainingCourseDeliveryMode)}
              aria-label="Delivery mode"
            >
              <option value="">Any delivery</option>
              {Object.entries(DELIVERY_MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 whitespace-nowrap px-1 text-sm text-secondary">
              <input type="checkbox" checked={mandatoryOnly} onChange={(e) => setMandatoryOnly(e.target.checked)} />
              Mandatory only
            </label>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-secondary">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading courses…
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <BookOpen className="h-8 w-8 text-muted" />
            <p className="text-sm text-secondary">
              {courses.length === 0 ? 'The catalog is empty. Add your first course.' : 'No courses match the filters.'}
            </p>
            {courses.length === 0 && canCreate ? (
              <Button
                onClick={() => {
                  setFormCourse(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add course
              </Button>
            ) : filtersActive ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  setCategory('');
                  setDeliveryFilter('');
                  setMandatoryOnly(false);
                  setStatusFilter('current');
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                <tr>
                  <th className="px-5 py-3">Course</th>
                  <th className="px-3 py-3">Delivery</th>
                  <th className="px-3 py-3">Duration</th>
                  <th className="px-3 py-3 text-right">Sessions</th>
                  <th className="px-3 py-3">Next session</th>
                  <th className="px-3 py-3 text-right">Enrolled</th>
                  <th className="px-3 py-3 text-right">Completed</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="w-10 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setDetailId(row.id)}
                    className="cursor-pointer hover:bg-[rgb(var(--bg-hover))]"
                  >
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        className="text-left font-medium text-primary hover:text-accent-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailId(row.id);
                        }}
                      >
                        {row.title}
                      </button>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        <span>{row.category ?? 'Uncategorised'}</span>
                        {row.isMandatory ? (
                          <span className="rounded-sm bg-warning-50 px-1.5 py-0.5 text-[11px] font-medium text-warning-700 dark:bg-warning-900/30 dark:text-warning-300">
                            Mandatory
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-secondary">{DELIVERY_MODE_LABELS[row.deliveryMode]}</td>
                    <td className="px-3 py-3 text-secondary">{formatDurationMinutes(row.durationMinutes)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-primary">{row.sessionCount}</span>
                      {row.upcomingSessionCount > 0 ? (
                        <span className="block text-xs text-muted">{row.upcomingSessionCount} open</span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-secondary">
                      {row.nextSessionStart ? formatDateTime(row.nextSessionStart) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right text-primary">{row.enrolledCount}</td>
                    <td className="px-3 py-3 text-right text-primary">{row.completedCount}</td>
                    <td className="px-3 py-3">
                      <StatusPill tone={COURSE_STATUS_TONE[row.status]}>{COURSE_STATUS_LABELS[row.status]}</StatusPill>
                    </td>
                    <td className="px-3 py-3 text-muted">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SidePanel
        open={detail != null}
        onClose={() => setDetailId(null)}
        title={detail?.title}
        description={
          detail
            ? `${detail.category ?? 'Uncategorised'} · ${DELIVERY_MODE_LABELS[detail.deliveryMode]}`
            : undefined
        }
        size="lg"
        footer={
          detail ? (
            <>
              {statusActions(detail)}
              {canEdit ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setFormCourse(detail);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      >
        {detail ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={COURSE_STATUS_TONE[detail.status]}>{COURSE_STATUS_LABELS[detail.status]}</StatusPill>
              {detail.isMandatory ? <StatusPill tone="warning">Mandatory</StatusPill> : null}
              <span className="flex items-center gap-1 text-xs text-secondary">
                <Clock3 className="h-3.5 w-3.5" /> {formatDurationMinutes(detail.durationMinutes)}
              </span>
            </div>
            <p className="whitespace-pre-line text-sm text-secondary">{detail.description ?? 'No description yet.'}</p>

            <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-base bg-[rgb(var(--border-base))]">
              {[
                ['Sessions', detail.sessionCount],
                ['Enrolled', detail.enrolledCount],
                ['Completed', detail.completedCount],
              ].map(([label, value]) => (
                <div key={label} className="surface px-3 py-2">
                  <dt className="text-xs text-secondary">{label}</dt>
                  <dd className="text-lg font-semibold text-primary">{value}</dd>
                </div>
              ))}
            </dl>

            {detail.status === 'draft' ? (
              <Banner icon={AlertCircle} tone="neutral">
                Draft courses can’t be scheduled. Activate it when it’s ready.
              </Banner>
            ) : detail.status === 'archived' ? (
              <Banner icon={AlertCircle} tone="neutral">
                Archived. Restore it to schedule new sessions; its history stays below.
              </Banner>
            ) : null}

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">Sessions</h3>
                {canCreate && detail.status === 'active' ? (
                  <Button size="sm" variant="secondary" onClick={() => setScheduleFor(detail)}>
                    <CalendarPlus className="h-3.5 w-3.5" /> Schedule session
                  </Button>
                ) : null}
              </div>
              {detailLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-secondary">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading sessions…
                </div>
              ) : detailSessions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-base px-4 py-6 text-center text-sm text-secondary">
                  No sessions scheduled yet.
                </p>
              ) : (
                <ul className="divide-y divide-[rgb(var(--border-base))] rounded-lg border border-base">
                  {detailSessions.map((session) => (
                    <li key={session.id}>
                      <button
                        type="button"
                        onClick={() => openTracker(session.id)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[rgb(var(--bg-hover))]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-primary">{session.displayTitle}</span>
                          <span className="block truncate text-xs text-muted">
                            {formatDateTime(session.scheduledStart)}
                            {session.location ? ` · ${session.location}` : ''}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-3 text-xs text-secondary">
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" /> {session.enrolledCount} enrolled · {session.attendedCount}{' '}
                              attended
                            </span>
                            <span className="flex items-center gap-1">
                              <CircleDollarSign className="h-3.5 w-3.5" />
                              {formatCurrencyAmount(session.totalCost, session.currency)}
                              {session.costPerAttendee != null
                                ? ` · ${formatCurrencyAmount(session.costPerAttendee, session.currency)} per attendee`
                                : ''}
                              {session.otherCurrencyCosts.length > 0 ? ' · plus other-currency costs' : ''}
                            </span>
                          </span>
                        </span>
                        <StatusPill tone={SESSION_STATUS_TONE[session.status]}>
                          {SESSION_STATUS_LABELS[session.status]}
                        </StatusPill>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </SidePanel>

      <CourseFormModal
        open={formOpen}
        companyId={companyId}
        course={formCourse}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSaved={(row, created) => {
          setFormOpen(false);
          replaceCourse(row);
          setNotice(created ? `${row.title} added to the catalog.` : `${row.title} updated.`);
          void refreshAfterChange();
        }}
      />

      <SessionFormModal
        open={scheduleFor != null}
        companyId={companyId}
        courses={scheduleFor ? [scheduleFor] : []}
        defaultCourseId={scheduleFor?.id}
        session={null}
        onClose={() => setScheduleFor(null)}
        onSaved={(row) => {
          setScheduleFor(null);
          setNotice(`Session scheduled for ${formatDateTime(row.scheduledStart)}. Open it to enrol employees.`);
          void refreshAfterChange();
        }}
      />

      <ConfirmDialog
        open={statusChange != null}
        title={statusChange ? STATUS_CHANGE_COPY[statusChange.to].title : ''}
        description={statusChange ? statusChangeDescription(statusChange) : undefined}
        confirmLabel={statusChange ? STATUS_CHANGE_COPY[statusChange.to].confirm : 'Confirm'}
        tone={statusChange?.to === 'archived' ? 'danger' : 'primary'}
        onConfirm={async () => {
          if (!statusChange) return;
          const row = await updateTrainingCourse(statusChange.course.id, { status: statusChange.to });
          replaceCourse(row);
          setNotice(`${row.title} ${STATUS_CHANGE_COPY[statusChange.to].notice}`);
          void refreshAfterChange();
        }}
        onClose={() => setStatusChange(null)}
      />
    </div>
  );
}
