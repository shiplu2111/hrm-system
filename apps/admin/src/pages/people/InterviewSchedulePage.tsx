import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  ExternalLink,
  KanbanSquare,
  List,
  Loader2,
  MapPin,
  Search,
  User,
  UserRound,
} from 'lucide-react';
import type {
  CompleteInterviewRoundInput,
  InterviewRoundRecord,
  InterviewRoundStatus,
  InterviewScheduleItem,
  JobRequisitionRecord,
  RecruitmentLookups,
} from '@hrm/shared-types';
import { usePermissions } from '@hrm/portal-ui';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/Form';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { CandidateAvatar } from '@/components/recruitment/CandidateAvatar';
import { InterviewScorecardModal } from '@/components/recruitment/InterviewScorecardModal';
import { InterviewScorecardView } from '@/components/recruitment/InterviewScorecardView';
import {
  ScheduleInterviewModal,
  type InterviewerOption,
} from '@/components/recruitment/ScheduleInterviewModal';
import {
  ROUND_STATUS_TONE,
  ROUND_TYPE_ACCENT,
  addDays,
  formatInterviewWhen,
  formatTime,
  formatWeekRange,
  isSafeMeetingUrl,
  isSameDay,
  startOfWeek,
} from '@/components/recruitment/interview-ui';
import { STAGE_META, formatRelativeDays } from '@/components/recruitment/recruitment-ui';
import { pathForPage } from '@/config/routes';
import { useNav } from '@/context/NavContext';
import {
  cancelInterviewRound,
  completeInterviewRound,
  completeMyInterview,
  getApplicationResumeFileUrl,
  getMyInterviewResumeFileUrl,
  getRecruitmentLookups,
  listInterviewSchedule,
  listJobRequisitions,
  listMyInterviews,
} from '@/lib/recruitment-api';
import { ApiError } from '@/lib/tenant-api-client';

type Scope = 'all' | 'mine';
type View = 'week' | 'list' | 'queue';
type ListRange = 'upcoming' | 'past';
type GroupBy = 'day' | 'candidate';

const LIST_WINDOW_DAYS = 60;

const STATUS_OPTIONS: { value: '' | InterviewRoundStatus; label: string }[] = [
  { value: '', label: 'Scheduled & completed' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
];

function isScorecardDue(item: InterviewScheduleItem, now: Date): boolean {
  if (item.status !== 'scheduled' || !item.scheduledStartAt) return false;
  const end = item.scheduledEndAt ?? item.scheduledStartAt;
  return new Date(end) < now;
}

function mergeRound(item: InterviewScheduleItem, record: InterviewRoundRecord): InterviewScheduleItem {
  return { ...item, ...record };
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; icon?: React.ReactNode; badge?: number }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-lg border border-base p-0.5 surface">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? 'bg-accent-600 text-white' : 'text-secondary hover:text-primary'
            }`}
          >
            {option.icon}
            {option.label}
            {option.badge != null && option.badge > 0 && (
              <span
                className={`rounded-full px-1.5 text-xs ${
                  active ? 'bg-white/20' : 'bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-200'
                }`}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone?: 'warning';
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={`surface rounded-xl border p-4 text-left ${
        onClick ? 'transition-colors hover:border-accent-300' : ''
      }`}
    >
      <div className="text-xs font-medium text-secondary uppercase tracking-wide">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold ${
          tone === 'warning' && value > 0 ? 'text-warning-600' : 'text-primary'
        }`}
      >
        {value}
      </div>
    </Wrapper>
  );
}

function InterviewCard({
  item,
  showInterviewer,
  now,
  onOpen,
}: {
  item: InterviewScheduleItem;
  showInterviewer: boolean;
  now: Date;
  onOpen: () => void;
}) {
  const due = isScorecardDue(item, now);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full text-left rounded-lg border border-base border-l-4 ${ROUND_TYPE_ACCENT[item.roundType]} surface px-2.5 py-2 hover:border-accent-300 transition-colors`}
    >
      <div className="text-xs font-medium text-secondary">
        {item.scheduledStartAt ? formatTime(item.scheduledStartAt) : '—'}
        {item.scheduledEndAt ? ` – ${formatTime(item.scheduledEndAt)}` : ''}
      </div>
      <div className="text-sm font-medium text-primary truncate">{item.candidateName}</div>
      <div className="text-xs text-muted truncate">
        {item.displayRound}
        {showInterviewer && item.interviewerName ? ` · ${item.interviewerName}` : ''}
      </div>
      {item.status === 'completed' && (
        <Badge tone="success" className="mt-1">
          {item.score != null ? `${item.score.toFixed(1)}/5` : 'Completed'}
        </Badge>
      )}
      {due && (
        <Badge tone="warning" className="mt-1">
          Scorecard due
        </Badge>
      )}
    </button>
  );
}

function InterviewsContent({ companyId }: { companyId: string }) {
  const routerNavigate = useNavigate();
  const { openApplication } = useNav();
  const { user, can } = usePermissions();
  const canViewAll = can('recruitment', 'view');
  const canEdit = can('recruitment', 'edit');
  const myEmployeeId = user?.employeeId ?? null;

  const [scope, setScope] = useState<Scope>(canViewAll ? 'all' : 'mine');
  const [view, setView] = useState<View>('week');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [listRange, setListRange] = useState<ListRange>('upcoming');
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [statusFilter, setStatusFilter] = useState<'' | InterviewRoundStatus>('');
  const [interviewerFilter, setInterviewerFilter] = useState('');
  const [requisitionFilter, setRequisitionFilter] = useState('');
  const [search, setSearch] = useState('');

  const [items, setItems] = useState<InterviewScheduleItem[]>([]);
  const [queue, setQueue] = useState<InterviewScheduleItem[]>([]);
  const [lookups, setLookups] = useState<RecruitmentLookups | null>(null);
  const [requisitions, setRequisitions] = useState<JobRequisitionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selected, setSelected] = useState<InterviewScheduleItem | null>(null);
  const [scheduling, setScheduling] = useState<InterviewScheduleItem | null>(null);
  const [scoring, setScoring] = useState<InterviewScheduleItem | null>(null);
  const [cancelling, setCancelling] = useState<InterviewScheduleItem | null>(null);
  const [downloading, setDownloading] = useState(false);

  const [now, setNow] = useState(() => new Date());

  const range = useMemo(() => {
    if (view === 'week') {
      return { from: weekStart, to: addDays(weekStart, 7) };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return listRange === 'upcoming'
      ? { from: today, to: addDays(today, LIST_WINDOW_DAYS) }
      : { from: addDays(today, -LIST_WINDOW_DAYS), to: addDays(today, 1) };
  }, [view, weekStart, listRange]);

  const load = useCallback(async () => {
    if (view === 'queue') return;
    setLoading(true);
    setError(null);
    try {
      const base = {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        status: statusFilter || undefined,
      };
      const rows =
        scope === 'all'
          ? await listInterviewSchedule(companyId, {
              ...base,
              interviewerEmployeeId: interviewerFilter || undefined,
              requisitionId: requisitionFilter || undefined,
            })
          : await listMyInterviews(base);
      setItems(listRange === 'past' && view === 'list' ? [...rows].reverse() : rows);
      setNow(new Date());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load interviews');
    } finally {
      setLoading(false);
    }
  }, [companyId, scope, view, range, statusFilter, interviewerFilter, requisitionFilter, listRange]);

  const loadQueue = useCallback(async () => {
    if (!canViewAll) return;
    try {
      setQueue(
        await listInterviewSchedule(companyId, {
          needsScheduling: true,
          requisitionId: requisitionFilter || undefined,
        }),
      );
    } catch {
      setQueue([]);
    }
  }, [companyId, canViewAll, requisitionFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (!canViewAll) return;
    getRecruitmentLookups(companyId).then(setLookups).catch(() => setLookups(null));
    listJobRequisitions(companyId)
      .then(setRequisitions)
      .catch(() => setRequisitions([]));
  }, [companyId, canViewAll]);

  const interviewers: InterviewerOption[] = useMemo(
    () =>
      (lookups?.employees ?? []).map((e) => ({
        id: e.id,
        name: `${e.name} · ${e.employeeNumber}`,
      })),
    [lookups],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.candidateName.toLowerCase().includes(q) ||
        i.requisitionTitle.toLowerCase().includes(q) ||
        i.requisitionReference.toLowerCase().includes(q) ||
        (i.interviewerName ?? '').toLowerCase().includes(q),
    );
  }, [items, search]);

  const visibleQueue = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return queue;
    return queue.filter(
      (i) =>
        i.candidateName.toLowerCase().includes(q) ||
        i.requisitionTitle.toLowerCase().includes(q),
    );
  }, [queue, search]);

  const stats = useMemo(
    () => ({
      scheduled: visible.filter((i) => i.status === 'scheduled').length,
      completed: visible.filter((i) => i.status === 'completed').length,
      due: visible.filter((i) => isScorecardDue(i, now)).length,
    }),
    [visible, now],
  );

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; title: string; subtitle?: string; items: InterviewScheduleItem[] }>();
    for (const item of visible) {
      if (groupBy === 'candidate') {
        const key = item.applicationId;
        if (!map.has(key)) {
          map.set(key, {
            key,
            title: item.candidateName,
            subtitle: `${item.requisitionReference} · ${item.requisitionTitle}`,
            items: [],
          });
        }
        map.get(key)!.items.push(item);
      } else {
        const date = item.scheduledStartAt ? new Date(item.scheduledStartAt) : null;
        const key = date ? date.toDateString() : 'unscheduled';
        if (!map.has(key)) {
          map.set(key, {
            key,
            title: date
              ? date.toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              : 'Unscheduled',
            items: [],
          });
        }
        map.get(key)!.items.push(item);
      }
    }
    if (groupBy === 'candidate') {
      for (const group of map.values()) {
        group.items.sort((a, b) => a.roundOrder - b.roundOrder);
      }
    }
    return [...map.values()];
  }, [visible, groupBy]);

  const isMine = (item: InterviewRoundRecord) =>
    !!myEmployeeId && item.interviewerEmployeeId === myEmployeeId;
  const inInterviewStage = (item: InterviewScheduleItem) => item.applicationStage === 'interview';
  const canScore = (item: InterviewScheduleItem) =>
    item.status === 'scheduled' && inInterviewStage(item) && (canEdit || isMine(item));
  const canManage = (item: InterviewScheduleItem) =>
    canEdit && item.status === 'scheduled' && inInterviewStage(item);

  const submitScorecard = (roundId: string, input: CompleteInterviewRoundInput) => {
    const target = scoring;
    return target && isMine(target) && (!canEdit || scope === 'mine')
      ? completeMyInterview(roundId, input)
      : completeInterviewRound(roundId, input);
  };

  const refreshAll = async () => {
    await Promise.all([load(), loadQueue()]);
  };

  const downloadResume = async (item: InterviewScheduleItem) => {
    setDownloading(true);
    try {
      const { url } =
        canViewAll && !(scope === 'mine' && isMine(item))
          ? await getApplicationResumeFileUrl(item.applicationId)
          : await getMyInterviewResumeFileUrl(item.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to open CV');
    } finally {
      setDownloading(false);
    }
  };

  const viewOptions: { value: View; label: string; icon: React.ReactNode; badge?: number }[] = [
    { value: 'week', label: 'Week', icon: <CalendarDays className="h-4 w-4" /> },
    { value: 'list', label: 'List', icon: <List className="h-4 w-4" /> },
    ...(scope === 'all' && canViewAll
      ? [{ value: 'queue' as const, label: 'Needs scheduling', icon: <CalendarX className="h-4 w-4" />, badge: queue.length }]
      : []),
  ];

  const renderEmpty = () => (
    <EmptyState
      icon={CalendarDays}
      title={scope === 'mine' ? 'No interviews assigned to you' : 'No interviews in this period'}
      description={
        scope === 'mine'
          ? 'When a recruiter books you as an interviewer, the round shows up here with the candidate’s CV and scorecard.'
          : 'Schedule rounds from a candidate’s profile or the Needs scheduling queue.'
      }
      compact
      action={
        scope === 'all' && queue.length > 0
          ? { label: `Schedule ${queue.length} waiting round${queue.length === 1 ? '' : 's'}`, onClick: () => setView('queue') }
          : undefined
      }
    />
  );

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Interviews</h1>
          <p className="text-sm text-secondary mt-0.5">
            {scope === 'mine'
              ? 'Interviews where you are the interviewer. Submit each scorecard after the conversation.'
              : 'Technical, HR, Management and Final Decision rounds across all open requisitions.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canViewAll && (
            <SegmentedControl
              label="Whose interviews"
              value={scope}
              onChange={(next) => {
                setScope(next);
                if (next === 'mine' && view === 'queue') setView('week');
              }}
              options={[
                { value: 'all', label: 'All interviews' },
                { value: 'mine', label: 'Mine' },
              ]}
            />
          )}
          {canViewAll && (
            <Button variant="secondary" onClick={() => routerNavigate(pathForPage('recruitment'))}>
              <KanbanSquare className="h-4 w-4" /> Pipeline
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Scheduled" value={stats.scheduled} />
        <StatCard label="Completed" value={stats.completed} />
        <StatCard label="Scorecards due" value={stats.due} tone="warning" />
        {scope === 'all' && canViewAll ? (
          <StatCard
            label="Needs scheduling"
            value={queue.length}
            tone="warning"
            onClick={() => setView('queue')}
          />
        ) : (
          <StatCard label="In this view" value={visible.length} />
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-success-200 bg-success-50 dark:bg-success-950/30 px-4 py-3 text-sm text-success-700 dark:text-success-300 flex justify-between gap-3">
          <span>{notice}</span>
          <button type="button" className="text-xs underline" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <SegmentedControl label="View" value={view} onChange={setView} options={viewOptions} />
            <div className="flex flex-wrap items-center gap-2">
              {view === 'week' && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Previous week"
                    onClick={() => setWeekStart((w) => addDays(w, -7))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
                    Today
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Next week"
                    onClick={() => setWeekStart((w) => addDays(w, 7))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium text-primary ml-1 whitespace-nowrap">
                    {formatWeekRange(weekStart)}
                  </span>
                </div>
              )}
              {view === 'list' && (
                <>
                  <Select
                    aria-label="Date range"
                    value={listRange}
                    onChange={(e) => setListRange(e.target.value as ListRange)}
                    className="w-auto"
                  >
                    <option value="upcoming">Next {LIST_WINDOW_DAYS} days</option>
                    <option value="past">Last {LIST_WINDOW_DAYS} days</option>
                  </Select>
                  <Select
                    aria-label="Group by"
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                    className="w-auto"
                  >
                    <option value="day">Group by day</option>
                    <option value="candidate">Group by candidate</option>
                  </Select>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                className="pl-9"
                placeholder="Search candidate, requisition or interviewer"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {view !== 'queue' && (
              <Select
                aria-label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as '' | InterviewRoundStatus)}
                className="md:w-56"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
            {scope === 'all' && canViewAll && view !== 'queue' && (
              <Select
                aria-label="Interviewer"
                value={interviewerFilter}
                onChange={(e) => setInterviewerFilter(e.target.value)}
                className="md:w-56"
              >
                <option value="">All interviewers</option>
                {interviewers.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            )}
            {scope === 'all' && canViewAll && (
              <Select
                aria-label="Requisition"
                value={requisitionFilter}
                onChange={(e) => setRequisitionFilter(e.target.value)}
                className="md:w-64"
              >
                <option value="">All requisitions</option>
                {requisitions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.referenceNumber} · {r.title}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </CardBody>
      </Card>

      {view === 'queue' ? (
        <Card>
          <CardBody className="p-0">
            {visibleQueue.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={CalendarDays}
                  title="Every round is booked"
                  description="Candidates at the Interview stage whose next round has no time yet appear here."
                  compact
                />
              </div>
            ) : (
              <ul className="divide-y divide-base">
                {visibleQueue.map((item) => (
                  <li key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <CandidateAvatar name={item.candidateName} />
                      <div className="min-w-0">
                        <button
                          type="button"
                          className="text-sm font-medium text-primary hover:underline truncate"
                          onClick={() => openApplication(item.applicationId)}
                        >
                          {item.candidateName}
                        </button>
                        <div className="text-xs text-secondary truncate">
                          {item.requisitionReference} · {item.requisitionTitle}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone="accent">
                        Round {item.roundOrder}: {item.displayRound}
                      </Badge>
                      <span className="text-xs text-muted whitespace-nowrap">
                        ready {formatRelativeDays(item.updatedAt)}
                      </span>
                      {canEdit && (
                        <Button variant="primary" size="sm" onClick={() => setScheduling(item)}>
                          <CalendarDays className="h-3.5 w-3.5" /> Schedule
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-secondary text-sm">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading interviews…
        </div>
      ) : view === 'week' ? (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-2 min-w-[900px]">
            {weekDays.map((day) => {
              const dayItems = visible.filter(
                (i) => i.scheduledStartAt && isSameDay(new Date(i.scheduledStartAt), day),
              );
              const today = isSameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  className={`rounded-xl border p-2 min-h-[220px] space-y-2 ${
                    today ? 'border-accent-400 bg-accent-50/40 dark:bg-accent-950/20' : 'border-base'
                  }`}
                >
                  <div className="flex items-baseline justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
                      {day.toLocaleDateString(undefined, { weekday: 'short' })}
                    </span>
                    <span className={`text-sm font-semibold ${today ? 'text-accent-600' : 'text-primary'}`}>
                      {day.getDate()}
                    </span>
                  </div>
                  {dayItems.length === 0 ? (
                    <div className="text-xs text-muted px-1">—</div>
                  ) : (
                    dayItems.map((item) => (
                      <InterviewCard
                        key={item.id}
                        item={item}
                        now={now}
                        showInterviewer={scope === 'all'}
                        onOpen={() => setSelected(item)}
                      />
                    ))
                  )}
                </div>
              );
            })}
          </div>
          {visible.length === 0 && <div className="mt-4">{renderEmpty()}</div>}
        </div>
      ) : groups.length === 0 ? (
        renderEmpty()
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.key}>
              <CardBody className="p-0">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-base">
                  {groupBy === 'candidate' && <CandidateAvatar name={group.title} />}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-primary">{group.title}</div>
                    {group.subtitle && <div className="text-xs text-secondary truncate">{group.subtitle}</div>}
                  </div>
                  <span className="ml-auto text-xs text-muted">
                    {group.items.length} interview{group.items.length === 1 ? '' : 's'}
                  </span>
                </div>
                <ul className="divide-y divide-base">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(item)}
                        className="w-full text-left flex flex-col md:flex-row md:items-center gap-2 md:gap-4 px-4 py-3 hover:bg-base/30 transition-colors"
                      >
                        <span className="text-sm text-secondary md:w-56 shrink-0">
                          {groupBy === 'day'
                            ? `${item.scheduledStartAt ? formatTime(item.scheduledStartAt) : '—'}${
                                item.scheduledEndAt ? ` – ${formatTime(item.scheduledEndAt)}` : ''
                              }`
                            : formatInterviewWhen(item.scheduledStartAt, item.scheduledEndAt)}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-primary truncate">
                            {groupBy === 'day' ? item.candidateName : item.displayRound}
                          </span>
                          <span className="block text-xs text-muted truncate">
                            {groupBy === 'day'
                              ? `${item.displayRound} · ${item.requisitionTitle}`
                              : item.requisitionTitle}
                            {scope === 'all' && item.interviewerName ? ` · ${item.interviewerName}` : ''}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          {isScorecardDue(item, now) && <Badge tone="warning">Scorecard due</Badge>}
                          {item.status === 'completed' && item.score != null && (
                            <span className="text-xs font-medium text-primary">{item.score.toFixed(1)}/5</span>
                          )}
                          <Badge tone={ROUND_STATUS_TONE[item.status]}>{item.displayStatus}</Badge>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={selected != null}
        onClose={() => setSelected(null)}
        size="lg"
        title={selected ? `${selected.displayRound} interview · ${selected.candidateName}` : ''}
        description={
          selected ? `${selected.requisitionReference} · ${selected.requisitionTitle}` : undefined
        }
        footer={
          selected ? (
            <div className="flex w-full flex-wrap justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {canViewAll && (
                  <Button variant="ghost" onClick={() => openApplication(selected.applicationId)}>
                    <UserRound className="h-4 w-4" /> Candidate profile
                  </Button>
                )}
                {selected.hasResume && (
                  <Button
                    variant="ghost"
                    disabled={downloading}
                    onClick={() => void downloadResume(selected)}
                  >
                    {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    CV
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {canManage(selected) && (
                  <>
                    <Button variant="ghost" onClick={() => setCancelling(selected)}>
                      <CalendarX className="h-4 w-4" /> Cancel interview
                    </Button>
                    <Button variant="secondary" onClick={() => setScheduling(selected)}>
                      <CalendarDays className="h-4 w-4" /> Reschedule
                    </Button>
                  </>
                )}
                {canScore(selected) && (
                  <Button variant="primary" onClick={() => setScoring(selected)}>
                    <ClipboardCheck className="h-4 w-4" /> Submit scorecard
                  </Button>
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={ROUND_STATUS_TONE[selected.status]}>{selected.displayStatus}</Badge>
              <Badge tone={STAGE_META[selected.applicationStage].tone}>
                {STAGE_META[selected.applicationStage].label}
              </Badge>
              <span className="text-xs text-muted">Round {selected.roundOrder} of 4</span>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-secondary">When</dt>
                <dd className="text-primary">
                  {formatInterviewWhen(selected.scheduledStartAt, selected.scheduledEndAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-secondary">Interviewer</dt>
                <dd className="text-primary flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted" />
                  {selected.interviewerName ?? 'Not assigned'}
                  {isMine(selected) && <Badge tone="accent">You</Badge>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-secondary">Location</dt>
                <dd className="text-primary flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted" />
                  {selected.location ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-secondary">Meeting link</dt>
                <dd>
                  {selected.meetingUrl && isSafeMeetingUrl(selected.meetingUrl) ? (
                    <a
                      href={selected.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-600 hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Join meeting
                    </a>
                  ) : (
                    <span className="text-primary">—</span>
                  )}
                </dd>
              </div>
            </dl>
            {selected.status === 'scheduled' && !inInterviewStage(selected) && (
              <p className="text-xs text-warning-700 dark:text-warning-300">
                The application has moved to {STAGE_META[selected.applicationStage].label}, so this
                round can no longer be changed.
              </p>
            )}
            {isScorecardDue(selected, now) && canScore(selected) && (
              <p className="text-xs text-warning-700 dark:text-warning-300">
                This interview has ended — submit the scorecard so the next round can be booked.
              </p>
            )}
            {selected.status === 'completed' && (
              <div className="rounded-lg border border-base p-3">
                <InterviewScorecardView round={selected} />
              </div>
            )}
          </div>
        )}
      </Modal>

      <ScheduleInterviewModal
        open={scheduling != null}
        round={scheduling}
        candidateName={scheduling?.candidateName}
        interviewers={interviewers}
        onClose={() => setScheduling(null)}
        onSaved={(record) => {
          const item = scheduling;
          setScheduling(null);
          setSelected((current) => (current && item && current.id === record.id ? mergeRound(current, record) : current));
          if (item) {
            setNotice(
              `${record.displayRound} interview with ${item.candidateName} booked for ${formatInterviewWhen(
                record.scheduledStartAt,
                record.scheduledEndAt,
              )}.`,
            );
          }
          void refreshAll();
        }}
      />

      <InterviewScorecardModal
        open={scoring != null}
        round={scoring}
        candidateName={scoring?.candidateName}
        submit={submitScorecard}
        onClose={() => setScoring(null)}
        onSaved={(record) => {
          const item = scoring;
          setScoring(null);
          setSelected((current) => (current && item && current.id === record.id ? mergeRound(current, record) : current));
          if (item) {
            setNotice(`Scorecard submitted for ${item.candidateName} (${record.displayRound}).`);
          }
          void refreshAll();
        }}
      />

      <ConfirmDialog
        open={cancelling != null}
        title="Cancel this interview?"
        description={
          cancelling
            ? `${cancelling.candidateName}'s ${cancelling.displayRound} interview on ${formatInterviewWhen(
                cancelling.scheduledStartAt,
                cancelling.scheduledEndAt,
              )} is removed and the round returns to the Needs scheduling queue.`
            : undefined
        }
        confirmLabel="Cancel interview"
        onConfirm={async () => {
          if (!cancelling) return;
          await cancelInterviewRound(cancelling.id);
          setSelected(null);
          setNotice(`Interview with ${cancelling.candidateName} cancelled.`);
          await refreshAll();
        }}
        onClose={() => setCancelling(null)}
      />
    </div>
  );
}

export function InterviewSchedulePage() {
  return (
    <OrgPageState>
      {(companyId) => (
        <>
          <div className="px-4 lg:px-6 pt-4">
            <CompanySelector />
          </div>
          <InterviewsContent key={companyId} companyId={companyId} />
        </>
      )}
    </OrgPageState>
  );
}
