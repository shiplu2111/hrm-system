import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarRange,
  EyeOff,
  Inbox,
  Loader2,
  Lock,
  MessageSquareText,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  UserRoundPen,
  Users,
} from 'lucide-react';
import { useAuth, usePermissions } from '@hrm/portal-ui';
import type {
  EmployeePerformanceReviewRecord,
  EmployeePerformanceReviewStatus,
  EmployeeRecord,
  Performance360FeedbackRecord,
  Performance360Relationship,
  Performance360RequestRecord,
  Performance360Summary,
  PerformanceReviewCycleRecord,
} from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Label, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { StatusPill } from '@/components/ui/StatusPill';
import { Avatar } from '@/components/ui/Toggle';
import { FeedbackFormPanel } from '@/components/performance/FeedbackFormPanel';
import {
  anonymityNote,
  Banner,
  errorMessage,
  formatDay,
  formatScore,
  ratingText,
} from '@/components/performance/performance-ui';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
import { listEmployees } from '@/lib/employees-api';
import {
  FEEDBACK_360_RELATIONSHIP_HINTS,
  FEEDBACK_360_RELATIONSHIP_LABELS,
  get360Summary,
  invite360Reviewers,
  list360Requests,
  listMy360Feedback,
  listPerformanceReviews,
  listReviewCycles,
  remove360Request,
  REVIEW_CYCLE_STATUS_LABELS,
} from '@/lib/performance-api';

const MAX_REVIEWERS = 20;

const OPEN_STATUSES: EmployeePerformanceReviewStatus[] = [
  'not_started',
  'self_assessment_draft',
  'self_submitted',
  'manager_review',
  'returned',
];

const RELATIONSHIPS = Object.keys(FEEDBACK_360_RELATIONSHIP_LABELS) as Performance360Relationship[];

function collectionClosedReason(review: EmployeePerformanceReviewRecord): string | null {
  if (review.reviewCycleStatus !== 'active') {
    return `${review.reviewCycleName} is ${REVIEW_CYCLE_STATUS_LABELS[review.reviewCycleStatus].toLowerCase()}, so feedback has closed.`;
  }
  if (!OPEN_STATUSES.includes(review.status)) {
    return 'Feedback closed when the manager submitted their assessment.';
  }
  return null;
}

export function Feedback360Page() {
  const { companyId } = useCompany();
  const { navigate } = useNav();
  const { user } = useAuth();
  const { can } = usePermissions();
  const canEdit = can('performance', 'edit');

  const [cycles, setCycles] = useState<PerformanceReviewCycleRecord[]>([]);
  const [cycleId, setCycleId] = useState('');
  const [reviews, setReviews] = useState<EmployeePerformanceReviewRecord[]>([]);
  const [reviewId, setReviewId] = useState('');
  const [requests, setRequests] = useState<Performance360RequestRecord[]>([]);
  const [summary, setSummary] = useState<Performance360Summary | null>(null);
  const [mine, setMine] = useState<Performance360FeedbackRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openFeedbackId, setOpenFeedbackId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<Performance360RequestRecord | null>(null);

  const launchedCycles = useMemo(() => cycles.filter((row) => row.status !== 'draft'), [cycles]);
  const review = reviews.find((row) => row.id === reviewId) ?? null;
  const closedReason = review ? collectionClosedReason(review) : null;

  const loadMine = useCallback(async () => {
    setMine(await listMy360Feedback().catch(() => []));
  }, []);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    Promise.all([listReviewCycles(companyId), listEmployees(companyId), loadMine()])
      .then(([cycleRows, employeeRows]) => {
        setCycles(cycleRows);
        setEmployees(employeeRows);
        const launched = cycleRows.filter((row) => row.status !== 'draft');
        setCycleId((current) => current || (launched.find((row) => row.status === 'active') ?? launched[0])?.id || '');
      })
      .catch((err) => setError(errorMessage(err, 'Failed to load 360° feedback')))
      .finally(() => setLoading(false));
  }, [companyId, loadMine]);

  const loadReviews = useCallback(async () => {
    if (!companyId || !cycleId) {
      setReviews([]);
      return;
    }
    const rows = await listPerformanceReviews(companyId, { reviewCycleId: cycleId });
    const visible = rows
      .filter((row) => row.status !== 'cancelled')
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    setReviews(visible);
    setReviewId((current) => (visible.some((row) => row.id === current) ? current : visible[0]?.id ?? ''));
  }, [companyId, cycleId]);

  useEffect(() => {
    void loadReviews().catch((err) => setError(errorMessage(err, 'Failed to load reviews')));
  }, [loadReviews]);

  const loadDetail = useCallback(async () => {
    if (!reviewId) {
      setRequests([]);
      setSummary(null);
      return;
    }
    setDetailLoading(true);
    try {
      const [requestRows, summaryRow] = await Promise.all([list360Requests(reviewId), get360Summary(reviewId)]);
      setRequests(requestRows);
      setSummary(summaryRow);
    } catch (err) {
      setRequests([]);
      setSummary(null);
      setError(errorMessage(err, 'Failed to load reviewers'));
    } finally {
      setDetailLoading(false);
    }
  }, [reviewId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const refreshAll = async () => {
    setError(null);
    await Promise.all([loadReviews(), loadDetail(), loadMine()]).catch((err) =>
      setError(errorMessage(err, 'Failed to refresh')),
    );
  };

  const visibleReviews = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? reviews.filter((row) => `${row.employeeName} ${row.managerName ?? ''}`.toLowerCase().includes(term))
      : reviews;
  }, [reviews, search]);

  const pendingMine = mine.filter((row) => row.editable);

  const afterFeedbackChange = (row: Performance360FeedbackRecord) => {
    setMine((current) => current.map((item) => (item.id === row.id ? row : item)));
    if (row.status === 'submitted') {
      setNotice(`Feedback for ${row.subjectName} submitted.`);
      void refreshAll();
    }
  };

  if (!companyId) {
    return <div className="p-6 text-sm text-secondary">Select a company to manage 360° feedback.</div>;
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl font-bold text-primary">360° Feedback</h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary">
            Ask peers, direct reports and colleagues from other teams for anonymous input on the same competencies the
            manager rates. Collection closes when the manager submits their assessment.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void refreshAll()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="secondary" onClick={() => navigate('performance')}>
            <BarChart3 className="h-4 w-4" /> Review results
          </Button>
        </div>
      </header>

      {error ? <Banner icon={Lock} tone="error">{error}</Banner> : null}
      {notice ? (
        <div
          role="status"
          className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:bg-success-950/30 dark:text-success-300"
        >
          {notice}
        </div>
      ) : null}

      {mine.length > 0 ? (
        <section className="surface rounded-xl border border-base shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-base px-5 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Inbox className="h-4 w-4 text-accent-600" /> Your feedback requests
              </h2>
              <p className="mt-0.5 text-xs text-secondary">
                {pendingMine.length > 0
                  ? `${pendingMine.length} waiting for your input. Your answers are anonymous.`
                  : 'Nothing waiting for you right now.'}
              </p>
            </div>
          </div>
          <div className="grid gap-px bg-[rgb(var(--border-base))] sm:grid-cols-2 xl:grid-cols-3">
            {mine.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setOpenFeedbackId(row.id)}
                className="surface flex items-start gap-3 p-4 text-left transition-colors hover:bg-[rgb(var(--bg-hover))]"
              >
                <Avatar name={row.subjectName} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-primary">{row.subjectName}</span>
                  <span className="block truncate text-xs text-muted">
                    {row.subjectDesignationName ?? row.subjectNumber} · {FEEDBACK_360_RELATIONSHIP_LABELS[row.relationship]}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    {row.status === 'submitted' ? (
                      <StatusPill tone="success">Submitted</StatusPill>
                    ) : row.editable ? (
                      <StatusPill tone="warning">Waiting for you</StatusPill>
                    ) : (
                      <StatusPill tone="neutral">Closed</StatusPill>
                    )}
                    <span className="text-muted">
                      {row.reviewCycleName} · due {formatDay(row.reviewDueDate)}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-secondary">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading 360° feedback…
        </div>
      ) : launchedCycles.length === 0 ? (
        <section className="surface flex flex-col items-center gap-3 rounded-xl border border-base p-10 text-center shadow-card">
          <Users className="h-8 w-8 text-muted" />
          <p className="text-sm text-secondary">360° feedback is collected for reviews in a launched review cycle.</p>
          <Button variant="secondary" onClick={() => navigate('performance-cycles')}>
            <CalendarRange className="h-4 w-4" /> Go to review cycles
          </Button>
        </section>
      ) : (
        <>
          <section className="surface flex flex-col gap-3 rounded-xl border border-base p-4 shadow-card sm:flex-row sm:items-end">
            <div className="sm:w-80">
              <Label htmlFor="feedback-cycle">Review cycle</Label>
              <Select
                id="feedback-cycle"
                value={cycleId}
                onChange={(e) => {
                  setCycleId(e.target.value);
                  setReviewId('');
                  setNotice(null);
                }}
              >
                {launchedCycles.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} · {REVIEW_CYCLE_STATUS_LABELS[row.status]}
                  </option>
                ))}
              </Select>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="surface flex max-h-[calc(100vh-14rem)] flex-col rounded-xl border border-base shadow-card lg:sticky lg:top-4">
              <div className="border-b border-base p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input
                    className="pl-9"
                    placeholder="Search employee or manager"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search reviews"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 divide-y divide-[rgb(var(--border-base))] overflow-y-auto">
                {visibleReviews.length === 0 ? (
                  <p className="p-6 text-center text-sm text-secondary">
                    {reviews.length === 0 ? 'This cycle has no reviews yet.' : 'No reviews match the search.'}
                  </p>
                ) : (
                  visibleReviews.map((row) => {
                    const open = !collectionClosedReason(row);
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => {
                          setReviewId(row.id);
                          setNotice(null);
                        }}
                        className={`flex w-full items-start gap-3 px-3 py-3 text-left transition-colors ${
                          row.id === reviewId ? 'bg-accent-50 dark:bg-accent-950/30' : 'hover:bg-[rgb(var(--bg-hover))]'
                        }`}
                      >
                        <Avatar name={row.employeeName} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-primary">{row.employeeName}</span>
                          <span className="block truncate text-xs text-muted">
                            {row.managerName ? `Manager: ${row.managerName}` : 'No manager'}
                          </span>
                          <span className="mt-1.5 flex items-center gap-2 text-xs">
                            <StatusPill tone={open ? 'accent' : 'neutral'}>{open ? 'Collecting' : 'Closed'}</StatusPill>
                            <span className="text-muted">
                              {row.feedback360InvitedCount === 0
                                ? 'No reviewers yet'
                                : `${row.feedback360SubmittedCount}/${row.feedback360InvitedCount} responded`}
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {review ? (
              <div className="min-w-0 space-y-4">
                <section className="surface rounded-xl border border-base p-5 shadow-card">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="flex items-center gap-3">
                      <Avatar name={review.employeeName} />
                      <div>
                        <h2 className="text-base font-semibold text-primary">{review.employeeName}</h2>
                        <p className="text-xs text-secondary">
                          {review.employeeDesignationName ?? review.employeeNumber} ·{' '}
                          {review.managerName ? `Manager: ${review.managerName}` : 'No manager'}
                        </p>
                      </div>
                    </div>
                    {canEdit && !closedReason ? (
                      <Button
                        size="sm"
                        onClick={() => setInviting(true)}
                        disabled={requests.length >= MAX_REVIEWERS}
                        title={requests.length >= MAX_REVIEWERS ? `At most ${MAX_REVIEWERS} reviewers` : undefined}
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Add reviewers
                      </Button>
                    ) : null}
                  </div>
                  {closedReason ? (
                    <div className="mt-4">
                      <Banner icon={Lock}>{closedReason}</Banner>
                    </div>
                  ) : null}
                </section>

                <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
                  <div className="flex items-center justify-between gap-3 border-b border-base px-5 py-3">
                    <div>
                      <h3 className="text-sm font-semibold text-primary">Reviewers</h3>
                      <p className="mt-0.5 text-xs text-secondary">
                        Shows who was asked and who has responded. Individual answers are never shown.
                      </p>
                    </div>
                    <span className="text-xs text-muted">
                      {requests.filter((row) => row.status === 'submitted').length}/{requests.length} responded
                    </span>
                  </div>
                  {detailLoading ? (
                    <div className="flex items-center justify-center py-10 text-sm text-secondary">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                    </div>
                  ) : requests.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-secondary">
                      <Users className="h-6 w-6 text-muted" />
                      {closedReason
                        ? 'Nobody was asked for feedback on this review.'
                        : 'No reviewers yet. Add three to eight people who work closely with them.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-[rgb(var(--bg-muted))] text-left text-xs font-medium text-secondary">
                          <tr>
                            <th className="px-4 py-2.5">Reviewer</th>
                            <th className="px-4 py-2.5">Relationship</th>
                            <th className="px-4 py-2.5">Status</th>
                            <th className="px-4 py-2.5" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[rgb(var(--border-base))]">
                          {requests.map((row) => {
                            const pending = row.status === 'pending';
                            const isMe = row.reviewerEmployeeId === user?.employeeId;
                            return (
                              <tr key={row.id}>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-primary">
                                    {row.reviewerName}
                                    {isMe ? <span className="ml-1.5 text-xs font-normal text-muted">(you)</span> : null}
                                  </div>
                                  <div className="text-xs text-muted">
                                    {row.reviewerNumber}
                                    {row.reviewerDepartmentName ? ` · ${row.reviewerDepartmentName}` : ''}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-secondary">
                                  {FEEDBACK_360_RELATIONSHIP_LABELS[row.relationship]}
                                </td>
                                <td className="px-4 py-3">
                                  {pending ? (
                                    <StatusPill tone={closedReason ? 'neutral' : 'warning'}>
                                      {closedReason ? 'No response' : 'Waiting'}
                                    </StatusPill>
                                  ) : (
                                    <span className="flex flex-col">
                                      <StatusPill tone="success">Responded</StatusPill>
                                      {row.submittedAt ? (
                                        <span className="mt-0.5 text-xs text-muted">{formatDay(row.submittedAt)}</span>
                                      ) : null}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {pending && !closedReason ? (
                                    <div className="flex justify-end gap-1">
                                      {isMe || canEdit ? (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="whitespace-nowrap"
                                          onClick={() => setOpenFeedbackId(row.id)}
                                        >
                                          <UserRoundPen className="h-3.5 w-3.5" /> {isMe ? 'Give feedback' : 'Enter for them'}
                                        </Button>
                                      ) : null}
                                      {canEdit ? (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          aria-label={`Remove ${row.reviewerName}`}
                                          onClick={() => setRemoving(row)}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      ) : null}
                                    </div>
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

                {summary ? <SummaryCard summary={summary} /> : null}
              </div>
            ) : (
              <section className="surface flex items-center justify-center rounded-xl border border-base p-10 text-sm text-secondary shadow-card">
                Select a review to see its reviewers.
              </section>
            )}
          </div>
        </>
      )}

      {review ? (
        <InviteReviewersModal
          open={inviting}
          review={review}
          employees={employees}
          existing={requests}
          onClose={() => setInviting(false)}
          onInvited={async (rows, count) => {
            setRequests(rows);
            setNotice(`${count === 1 ? '1 reviewer' : `${count} reviewers`} added for ${review.employeeName}.`);
            await Promise.all([loadReviews(), loadMine(), get360Summary(review.id).then(setSummary)]);
          }}
        />
      ) : null}

      <FeedbackFormPanel
        feedbackId={openFeedbackId}
        onClose={() => setOpenFeedbackId(null)}
        onChanged={afterFeedbackChange}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        title={removing ? `Remove ${removing.reviewerName}?` : 'Remove reviewer?'}
        description="Their feedback request is withdrawn. You can invite them again while feedback is open."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!removing) return;
          await remove360Request(removing.id);
          setNotice(`${removing.reviewerName} removed.`);
          await Promise.all([loadDetail(), loadReviews(), loadMine()]);
        }}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}

function SummaryCard({ summary }: { summary: Performance360Summary }) {
  const note = anonymityNote(summary);
  return (
    <section className="surface rounded-xl border border-base shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-base px-5 py-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
            <EyeOff className="h-4 w-4 text-accent-600" /> Anonymous results
          </h3>
          <p className="mt-0.5 text-xs text-secondary">
            {summary.responseCount} of {summary.invitedCount} responded · shown as averages only
          </p>
        </div>
        {summary.averageRating != null ? (
          <div className="text-right">
            <div className="text-xl font-bold text-primary">{formatScore(summary.averageRating)}</div>
            <div className="text-xs text-secondary">{ratingText(Math.round(summary.averageRating))}</div>
          </div>
        ) : null}
      </div>
      {note ? (
        <p className="p-5 text-sm text-secondary">{note}</p>
      ) : (
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <div className="space-y-3">
            {summary.competencyAverages.map((item) => (
              <div key={item.key}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-secondary">{item.label}</span>
                  <span className="font-semibold tabular-nums text-primary">{formatScore(item.averageRating)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[rgb(var(--bg-muted))]">
                  <div
                    className="h-1.5 rounded-full bg-accent-600"
                    style={{ width: `${((item.averageRating ?? 0) / 5) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2 pt-2">
              {RELATIONSHIPS.map((relationship) => {
                const group = summary.byRelationship[relationship];
                return (
                  <div key={relationship} className="rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2">
                    <div className="text-xs text-muted">{summary.relationshipLabels[relationship]}</div>
                    <div className="mt-0.5 text-sm font-semibold text-primary">
                      {group.responseCount === 0 ? '—' : group.hidden ? 'Hidden' : formatScore(group.averageRating)}
                    </div>
                    <div className="text-[11px] text-muted">
                      {group.hidden
                        ? `Fewer than ${summary.minResponses}`
                        : `${group.responseCount} response${group.responseCount === 1 ? '' : 's'}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Comments</p>
            {summary.comments.length === 0 ? (
              <p className="text-sm text-secondary">No comments were left.</p>
            ) : (
              <ul className="space-y-2">
                {summary.comments.map((comment) => (
                  <li
                    key={comment}
                    className="flex gap-2 rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2 text-sm text-secondary"
                  >
                    <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="whitespace-pre-line">{comment}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

type Suggestion = { employee: EmployeeRecord; relationship: Performance360Relationship };

function InviteReviewersModal({
  open,
  review,
  employees,
  existing,
  onClose,
  onInvited,
}: {
  open: boolean;
  review: EmployeePerformanceReviewRecord;
  employees: EmployeeRecord[];
  existing: Performance360RequestRecord[];
  onClose: () => void;
  onInvited: (rows: Performance360RequestRecord[], count: number) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Map<string, Performance360Relationship>>(new Map());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(new Map());
    setSearch('');
    setError(null);
  }, [open, review.id]);

  const subject = employees.find((row) => row.id === review.employeeId) ?? null;
  const taken = useMemo(() => new Set(existing.map((row) => row.reviewerEmployeeId)), [existing]);

  const candidates = useMemo<Suggestion[]>(() => {
    return employees
      .filter(
        (row) =>
          row.id !== review.employeeId &&
          row.id !== review.managerEmployeeId &&
          !taken.has(row.id) &&
          row.employmentStatus !== 'terminated' &&
          row.employmentStatus !== 'inactive',
      )
      .map((row) => ({
        employee: row,
        relationship:
          row.managerId === review.employeeId
            ? 'direct_report'
            : subject?.departmentId && row.departmentId === subject.departmentId
              ? 'peer'
              : 'cross_functional',
      }));
  }, [employees, review.employeeId, review.managerEmployeeId, taken, subject?.departmentId]);

  const term = search.trim().toLowerCase();
  const shown = candidates.filter(
    (item) =>
      !term ||
      `${item.employee.fullName} ${item.employee.employeeNumber} ${item.employee.department?.name ?? ''}`
        .toLowerCase()
        .includes(term),
  );
  const groups = RELATIONSHIPS.map((relationship) => ({
    relationship,
    items: shown.filter((item) => item.relationship === relationship),
  })).filter((group) => group.items.length > 0);

  const remaining = MAX_REVIEWERS - existing.length;

  const toggle = (item: Suggestion) =>
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(item.employee.id)) next.delete(item.employee.id);
      else if (next.size < remaining) next.set(item.employee.id, item.relationship);
      return next;
    });

  const invite = async () => {
    setSaving(true);
    setError(null);
    try {
      const rows = await invite360Reviewers(
        review.id,
        [...selected].map(([employeeId, relationship]) => ({ employeeId, relationship })),
      );
      await onInvited(rows, selected.size);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Failed to add reviewers'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Add reviewers for ${review.employeeName}`}
      description="Suggestions are grouped by how they work with them. You can change the relationship before inviting."
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-xs text-secondary">
            {selected.size} selected · {Math.max(remaining - selected.size, 0)} more allowed
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void invite()} disabled={saving || selected.size === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Invite {selected.size || ''}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? <Banner icon={Lock} tone="error">{error}</Banner> : null}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            className="pl-9"
            placeholder="Search by name, number or department"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search employees"
          />
        </div>
        {review.managerName ? (
          <p className="text-xs text-muted">
            {review.managerName} isn’t listed because they rate this review in the manager assessment.
          </p>
        ) : null}
        {groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-secondary">No more employees to invite.</p>
        ) : (
          groups.map((group) => (
            <div key={group.relationship}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                {FEEDBACK_360_RELATIONSHIP_LABELS[group.relationship]}s · {FEEDBACK_360_RELATIONSHIP_HINTS[group.relationship]}
              </p>
              <div className="divide-y divide-[rgb(var(--border-base))] rounded-lg border border-base">
                {group.items.map((item) => {
                  const checked = selected.has(item.employee.id);
                  return (
                    <div key={item.employee.id} className="flex items-center gap-3 px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-base"
                        checked={checked}
                        disabled={!checked && selected.size >= remaining}
                        onChange={() => toggle(item)}
                        aria-label={`Invite ${item.employee.fullName}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-primary">{item.employee.fullName}</div>
                        <div className="truncate text-xs text-muted">
                          {item.employee.designation?.name ?? item.employee.employeeNumber}
                          {item.employee.department?.name ? ` · ${item.employee.department.name}` : ''}
                        </div>
                      </div>
                      {checked ? (
                        <Select
                          className="h-8 w-40 text-xs"
                          value={selected.get(item.employee.id)}
                          aria-label={`Relationship of ${item.employee.fullName}`}
                          onChange={(e) =>
                            setSelected((current) =>
                              new Map(current).set(item.employee.id, e.target.value as Performance360Relationship),
                            )
                          }
                        >
                          {RELATIONSHIPS.map((relationship) => (
                            <option key={relationship} value={relationship}>
                              {FEEDBACK_360_RELATIONSHIP_LABELS[relationship]}
                            </option>
                          ))}
                        </Select>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
