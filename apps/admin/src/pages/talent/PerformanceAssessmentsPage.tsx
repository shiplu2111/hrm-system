import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  Check,
  ClipboardCheck,
  Info,
  Loader2,
  Lock,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  Search,
  Target,
  UserRoundCheck,
} from 'lucide-react';
import { useAuth, usePermissions } from '@hrm/portal-ui';
import {
  assessmentCompletion,
  assessmentScore,
  formatKpiDateRange,
  ratingLabelForScore,
  type EmployeePerformanceReviewRecord,
  type EmployeePerformanceReviewStatus,
  type PerformanceAssessmentPayload,
  type PerformanceAssessmentSide,
  type PerformanceCompetencyAssessment,
  type PerformanceKpiAssessmentItem,
  type PerformanceReviewCycleRecord,
} from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Label, Select, Textarea, Input } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { Avatar } from '@/components/ui/Toggle';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
import {
  approvePerformanceReview,
  formatKpiValue,
  listPerformanceReviews,
  listReviewCycles,
  OVERALL_RATING_LABELS,
  rejectPerformanceReview,
  REVIEW_CYCLE_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  saveManagerAssessment,
  saveSelfAssessment,
  submitManagerAssessment,
  submitSelfAssessment,
} from '@/lib/performance-api';
import {
  Banner,
  COMPETENCY_DETAILS,
  errorMessage,
  formatDay,
  RatingScale,
  ratingText,
  REVIEW_TONE,
} from '@/components/performance/performance-ui';

type FormTab = PerformanceAssessmentSide;
type StageFilter = 'all' | 'self' | 'manager' | 'approval' | 'approved';

const SELF_STAGE: EmployeePerformanceReviewStatus[] = ['not_started', 'self_assessment_draft'];
const MANAGER_STAGE: EmployeePerformanceReviewStatus[] = ['self_submitted', 'manager_review', 'returned'];

const STAGE_FILTERS: Record<Exclude<StageFilter, 'all'>, EmployeePerformanceReviewStatus[]> = {
  self: SELF_STAGE,
  manager: MANAGER_STAGE,
  approval: ['pending_approval'],
  approved: ['approved'],
};

function isOverdue(review: EmployeePerformanceReviewRecord): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return review.reviewDueDate < today && review.status !== 'approved' && review.status !== 'cancelled';
}

export function PerformanceAssessmentsPage() {
  const { companyId } = useCompany();
  const { navigate } = useNav();
  const { user } = useAuth();
  const { can } = usePermissions();
  const canEdit = can('performance', 'edit');
  const canApprove = can('performance', 'approve');

  const [cycles, setCycles] = useState<PerformanceReviewCycleRecord[]>([]);
  const [cycleId, setCycleId] = useState('');
  const [reviews, setReviews] = useState<EmployeePerformanceReviewRecord[]>([]);
  const [reviewId, setReviewId] = useState('');
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<StageFilter>('all');

  const [tab, setTab] = useState<FormTab>('self');
  const [draft, setDraft] = useState<PerformanceAssessmentPayload | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<(() => void) | null>(null);
  const [signOffComment, setSignOffComment] = useState('');

  const launchedCycles = useMemo(() => cycles.filter((row) => row.launchedAt), [cycles]);
  const cycle = cycles.find((row) => row.id === cycleId) ?? null;
  const review = reviews.find((row) => row.id === reviewId) ?? null;

  const loadCycles = useCallback(async () => {
    if (!companyId) return;
    const rows = await listReviewCycles(companyId);
    setCycles(rows);
    const launched = rows.filter((row) => row.launchedAt);
    setCycleId((current) =>
      current && launched.some((row) => row.id === current)
        ? current
        : ((launched.find((row) => row.status === 'active') ?? launched[0])?.id ?? ''),
    );
  }, [companyId]);

  const loadReviews = useCallback(async () => {
    if (!companyId || !cycleId) {
      setReviews([]);
      return;
    }
    setReviewsLoading(true);
    try {
      const rows = (await listPerformanceReviews(companyId, { reviewCycleId: cycleId })).sort((a, b) =>
        a.employeeName.localeCompare(b.employeeName),
      );
      setReviews(rows);
      setReviewId((current) => (current && rows.some((row) => row.id === current) ? current : (rows[0]?.id ?? '')));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load reviews'));
    } finally {
      setReviewsLoading(false);
    }
  }, [companyId, cycleId]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    loadCycles()
      .catch((err) => setError(errorMessage(err, 'Failed to load review cycles')))
      .finally(() => setLoading(false));
  }, [companyId, loadCycles]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const selfEditable =
    canEdit && review?.reviewCycleStatus === 'active' && Boolean(review && SELF_STAGE.includes(review.status));
  const isOwnReview = Boolean(user?.employeeId && review && user.employeeId === review.employeeId);
  const managerEditable =
    canEdit &&
    !isOwnReview &&
    review?.reviewCycleStatus === 'active' &&
    Boolean(review && MANAGER_STAGE.includes(review.status));
  const editable = tab === 'self' ? selfEditable : managerEditable;

  useLayoutEffect(() => {
    if (!review) {
      setDraft(null);
      return;
    }
    setDraft(tab === 'self' ? review.selfAssessment : review.managerAssessment);
    setDirty(false);
    setFormError(null);
  }, [review, tab]);

  const guardSwitch = (action: () => void) => {
    if (dirty) setPendingSwitch(() => action);
    else action();
  };

  const selectReview = (next: EmployeePerformanceReviewRecord) => {
    guardSwitch(() => {
      setReviewId(next.id);
      setNotice(null);
      setTab(SELF_STAGE.includes(next.status) ? 'self' : 'manager');
    });
  };

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await Promise.all([loadCycles(), loadReviews()]);
    } catch (err) {
      setError(errorMessage(err, 'Failed to refresh'));
    } finally {
      setRefreshing(false);
    }
  };

  const replaceReview = (updated: EmployeePerformanceReviewRecord) => {
    setReviews((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
  };

  const saveDraft = async () => {
    if (!review || !draft) return;
    setSaving(true);
    setFormError(null);
    try {
      const updated =
        tab === 'self' ? await saveSelfAssessment(review.id, draft) : await saveManagerAssessment(review.id, draft);
      replaceReview(updated);
      setNotice(`${tab === 'self' ? 'Self-assessment' : 'Manager assessment'} draft saved for ${review.employeeName}.`);
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to save the draft'));
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!review || !draft) return;
    if (tab === 'self') {
      await saveSelfAssessment(review.id, draft);
      const updated = await submitSelfAssessment(review.id);
      replaceReview(updated);
      setTab('manager');
      setNotice(`${review.employeeName}’s self-assessment was submitted. The manager assessment is now open.`);
    } else {
      await saveManagerAssessment(review.id, draft);
      const updated = await submitManagerAssessment(review.id);
      replaceReview(updated);
      setNotice(
        updated.status === 'approved'
          ? `${review.employeeName}’s review is approved with an overall rating of ${updated.overallRating?.toFixed(2) ?? '—'}.`
          : `${review.employeeName}’s manager assessment was submitted for approval.`,
      );
    }
    void loadCycles();
  };

  const signOff = async (approve: boolean) => {
    if (!review) return;
    setSaving(true);
    setFormError(null);
    try {
      const updated = approve
        ? await approvePerformanceReview(review.id, signOffComment.trim() || undefined)
        : await rejectPerformanceReview(review.id, signOffComment.trim() || undefined);
      replaceReview(updated);
      setSignOffComment('');
      setNotice(
        approve
          ? updated.status === 'approved'
            ? `${review.employeeName}’s review is fully approved.`
            : 'Your approval step is recorded; the review moves to the next approver.'
          : `${review.employeeName}’s review was returned to the manager.`,
      );
    } catch (err) {
      setFormError(errorMessage(err, approve ? 'Failed to approve' : 'Failed to return the review'));
    } finally {
      setSaving(false);
    }
  };

  const visibleReviews = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reviews.filter((row) => {
      if (stage !== 'all' && !STAGE_FILTERS[stage].includes(row.status)) return false;
      return (
        !query ||
        row.employeeName.toLowerCase().includes(query) ||
        row.employeeNumber.toLowerCase().includes(query) ||
        (row.managerName ?? '').toLowerCase().includes(query)
      );
    });
  }, [reviews, search, stage]);

  const updateItem = (
    kind: 'competency' | 'kpi',
    key: string,
    patch: { rating?: number; comment?: string },
  ) => {
    const side = tab;
    const apply = <T extends PerformanceCompetencyAssessment | PerformanceKpiAssessmentItem>(item: T): T => ({
      ...item,
      ...(patch.rating !== undefined ? { [side === 'self' ? 'selfRating' : 'managerRating']: patch.rating } : {}),
      ...(patch.comment !== undefined ? { [side === 'self' ? 'selfComment' : 'managerComment']: patch.comment } : {}),
    });
    setDraft((current) =>
      current
        ? {
            ...current,
            competencies:
              kind === 'competency'
                ? current.competencies.map((item) => (item.key === key ? apply(item) : item))
                : current.competencies,
            kpiAssessments:
              kind === 'kpi'
                ? current.kpiAssessments.map((item) => (item.kpiAssignmentId === key ? apply(item) : item))
                : current.kpiAssessments,
          }
        : current,
    );
    setDirty(true);
  };

  const setOverall = (value: string) => {
    setDraft((current) =>
      current
        ? tab === 'self'
          ? { ...current, overallSelfComment: value }
          : { ...current, overallManagerComment: value }
        : current,
    );
    setDirty(true);
  };

  if (!companyId) {
    return <div className="p-6 text-sm text-secondary">Select a company to see performance assessments.</div>;
  }

  const completion = draft ? assessmentCompletion(draft, tab) : null;
  const score = draft ? assessmentScore(draft, tab) : null;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-primary">Performance Assessments</h1>
          <p className="mt-0.5 text-sm text-secondary">
            The self-assessment and the manager assessment rate the same competencies and the employee’s KPI goals for
            the cycle.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:shrink-0 xl:flex-nowrap">
          <Button variant="secondary" onClick={() => void refresh()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="secondary" onClick={() => navigate('performance-cycles')}>
            <CalendarRange className="h-4 w-4" /> Review cycles
          </Button>
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
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading assessments…
        </div>
      ) : launchedCycles.length === 0 ? (
        <section className="surface flex flex-col items-center gap-3 rounded-xl border border-base p-10 text-center shadow-card">
          <ClipboardCheck className="h-8 w-8 text-muted" />
          <div>
            <p className="text-sm font-medium text-primary">No launched review cycles</p>
            <p className="mt-1 text-sm text-secondary">
              Assessments appear here once a review cycle with participants is launched.
            </p>
          </div>
          <Button variant="secondary" onClick={() => navigate('performance-cycles')}>
            <CalendarRange className="h-4 w-4" /> Go to review cycles
          </Button>
        </section>
      ) : (
        <>
          <section className="surface flex flex-col gap-3 rounded-xl border border-base p-4 shadow-card lg:flex-row lg:items-end lg:justify-between">
            <div className="grid w-full gap-3 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-end">
              <div>
                <Label htmlFor="assessment-cycle">Review cycle</Label>
                <Select
                  id="assessment-cycle"
                  value={cycleId}
                  onChange={(e) => {
                    const next = e.target.value;
                    guardSwitch(() => {
                      setCycleId(next);
                      setReviewId('');
                      setNotice(null);
                    });
                  }}
                >
                  {launchedCycles.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} · {REVIEW_CYCLE_STATUS_LABELS[row.status]}
                    </option>
                  ))}
                </Select>
              </div>
              {cycle ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2 text-sm text-secondary">
                  <span>{formatKpiDateRange(cycle.periodStart, cycle.periodEnd)}</span>
                  <span className="text-muted">·</span>
                  <span>Reviews due {formatDay(cycle.reviewDueDate)}</span>
                  <span className="text-muted">·</span>
                  <span>
                    {cycle.completedReviewCount}/{cycle.reviewCount} approved
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="surface flex max-h-[calc(100vh-14rem)] flex-col rounded-xl border border-base shadow-card lg:sticky lg:top-4">
              <div className="space-y-2 border-b border-base p-3">
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
                <Select value={stage} onChange={(e) => setStage(e.target.value as StageFilter)} aria-label="Filter by stage">
                  <option value="all">All stages</option>
                  <option value="self">Self-assessment</option>
                  <option value="manager">Manager assessment</option>
                  <option value="approval">Pending approval</option>
                  <option value="approved">Approved</option>
                </Select>
              </div>
              <div className="min-h-0 flex-1 divide-y divide-[rgb(var(--border-base))] overflow-y-auto">
                {reviewsLoading ? (
                  <div className="flex items-center justify-center py-10 text-sm text-secondary">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : visibleReviews.length === 0 ? (
                  <p className="p-6 text-center text-sm text-secondary">
                    {reviews.length === 0 ? 'This cycle has no reviews yet.' : 'No reviews match the filters.'}
                  </p>
                ) : (
                  visibleReviews.map((row) => {
                    const self = assessmentCompletion(row.selfAssessment, 'self');
                    const manager = assessmentCompletion(row.managerAssessment, 'manager');
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => selectReview(row)}
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
                          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <StatusPill tone={REVIEW_TONE[row.status]}>{REVIEW_STATUS_LABELS[row.status]}</StatusPill>
                            {isOverdue(row) ? (
                              <span className="text-xs font-medium text-error-600">Overdue</span>
                            ) : null}
                          </span>
                          <span className="mt-1 block text-xs text-muted">
                            Self {self.rated}/{self.total} · Manager {manager.rated}/{manager.total}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {review && draft ? (
              <div className="min-w-0 space-y-4">
                <ReviewHeader review={review} />

                {review.reviewCycleStatus !== 'active' ? (
                  <Banner icon={Lock}>
                    {review.reviewCycleName} is {REVIEW_CYCLE_STATUS_LABELS[review.reviewCycleStatus].toLowerCase()}, so
                    this review is read-only.
                  </Banner>
                ) : null}
                {review.status === 'returned' && review.returnReason ? (
                  <Banner icon={RotateCcw} tone="warning">
                    Returned to the manager: {review.returnReason}
                  </Banner>
                ) : null}

                <nav className="surface flex gap-1 rounded-xl border border-base p-1.5 shadow-card" aria-label="Assessment forms">
                  {(
                    [
                      ['self', 'Self-assessment', review.selfAssessment],
                      ['manager', 'Manager assessment', review.managerAssessment],
                    ] as const
                  ).map(([id, label, payload]) => {
                    const done = assessmentCompletion(payload, id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => guardSwitch(() => setTab(id))}
                        className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                          tab === id
                            ? 'bg-accent-600 text-white shadow-sm'
                            : 'text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'
                        }`}
                      >
                        {id === 'self' ? <UserRoundCheck className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}
                        {label}
                        <span className={`text-xs ${tab === id ? 'text-white/80' : 'text-muted'}`}>
                          {done.rated}/{done.total}
                        </span>
                      </button>
                    );
                  })}
                </nav>

                {tab === 'manager' && SELF_STAGE.includes(review.status) ? (
                  <Banner icon={Info}>
                    The manager assessment opens once {review.employeeName} submits the self-assessment.
                  </Banner>
                ) : (
                  <>
                    <FormNotes review={review} tab={tab} editable={editable} isOwnReview={isOwnReview} userEmployeeId={user?.employeeId ?? null} />

                    <AssessmentForm
                      review={review}
                      draft={draft}
                      side={tab}
                      editable={editable}
                      onItemChange={updateItem}
                      onOverallChange={setOverall}
                      onOpenGoals={() => navigate('performance-goals')}
                    />

                    {completion ? (
                      <div className="surface sticky bottom-3 z-10 flex flex-col gap-3 rounded-xl border border-base p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm">
                          <p className="font-medium text-primary">
                            {completion.rated} of {completion.total} rated
                            {score != null ? (
                              <span className="font-normal text-secondary">
                                {' '}
                                · {tab === 'self' ? 'Self' : 'Manager'} score {score.toFixed(2)} (
                                {OVERALL_RATING_LABELS[ratingLabelForScore(score)]})
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted">
                            Score = competencies 60% + KPI goals 40% (weighted by goal weight).
                            {dirty ? ' Unsaved changes.' : ''}
                          </p>
                          {formError ? <p className="mt-1 text-xs text-error-600">{formError}</p> : null}
                        </div>
                        {editable ? (
                          <div className="flex shrink-0 gap-2">
                            <Button variant="secondary" onClick={() => void saveDraft()} disabled={saving || !dirty}>
                              {saving ? 'Saving…' : 'Save draft'}
                            </Button>
                            <Button
                              onClick={() => setConfirmSubmit(true)}
                              disabled={saving || completion.missing.length > 0}
                              title={
                                completion.missing.length > 0
                                  ? `Still unrated: ${completion.missing.join(', ')}`
                                  : undefined
                              }
                            >
                              <Check className="h-4 w-4" /> Submit
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}

                {review.status === 'pending_approval' && canApprove && !isOwnReview ? (
                  <section className="surface rounded-xl border border-base p-5 shadow-card">
                    <h3 className="text-sm font-semibold text-primary">Approval sign-off</h3>
                    <p className="mt-1 text-xs text-secondary">
                      Approving moves the review to the next approver in the workflow; the last approval finalises the
                      overall rating. Returning sends it back to the manager.
                    </p>
                    <div className="mt-3">
                      <Label htmlFor="sign-off-comment">Comment (optional)</Label>
                      <Textarea
                        id="sign-off-comment"
                        rows={2}
                        value={signOffComment}
                        onChange={(e) => setSignOffComment(e.target.value)}
                        placeholder="Shown to the manager if you return the review"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <Button variant="secondary" onClick={() => void signOff(false)} disabled={saving}>
                        <RotateCcw className="h-4 w-4" /> Return to manager
                      </Button>
                      <Button onClick={() => void signOff(true)} disabled={saving}>
                        <Check className="h-4 w-4" /> Approve
                      </Button>
                    </div>
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="surface flex items-center justify-center rounded-xl border border-base p-10 text-sm text-secondary shadow-card">
                {reviewsLoading ? 'Loading…' : 'Choose a review to open its assessments.'}
              </div>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmSubmit}
        tone="primary"
        title={tab === 'self' ? 'Submit the self-assessment?' : 'Submit the manager assessment?'}
        description={
          review ? (
            <p>
              {tab === 'self'
                ? `${review.employeeName}’s ratings and comments are sent to ${review.managerName ?? 'HR'} and can no longer be edited.`
                : cycle?.requiresWorkflowApproval
                  ? 'The review goes to the approval workflow and the KPI figures are fixed as they are now.'
                  : 'The review is approved straight away, the overall rating is calculated and the KPI figures are fixed as they are now.'}
            </p>
          ) : null
        }
        confirmLabel="Submit"
        onConfirm={submit}
        onClose={() => setConfirmSubmit(false)}
      />

      <ConfirmDialog
        open={pendingSwitch !== null}
        title="Discard unsaved changes?"
        description={<p>The ratings and comments you changed on this form haven’t been saved.</p>}
        confirmLabel="Discard"
        onConfirm={async () => {
          pendingSwitch?.();
          setDirty(false);
        }}
        onClose={() => setPendingSwitch(null)}
      />
    </div>
  );
}

function ReviewHeader({ review }: { review: EmployeePerformanceReviewRecord }) {
  const steps = [
    { label: 'Self-assessment', date: review.selfSubmittedAt, active: SELF_STAGE.includes(review.status) },
    { label: 'Manager assessment', date: review.managerSubmittedAt, active: MANAGER_STAGE.includes(review.status) },
    { label: 'Approval', date: review.approvedAt, active: review.status === 'pending_approval' },
  ];
  return (
    <section className="surface rounded-xl border border-base p-5 shadow-card">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex items-center gap-3">
          <Avatar name={review.employeeName} size="lg" />
          <div>
            <h2 className="text-base font-semibold text-primary">{review.employeeName}</h2>
            <p className="text-xs text-secondary">
              {review.employeeNumber} · Manager: {review.managerName ?? 'none (HR completes the manager assessment)'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={REVIEW_TONE[review.status]}>{REVIEW_STATUS_LABELS[review.status]}</StatusPill>
          {review.overallRating != null && review.status === 'approved' ? (
            <span className="text-sm font-semibold text-primary">
              {review.overallRating.toFixed(2)}
              {review.overallRatingLabel ? (
                <span className="font-normal text-secondary"> · {OVERALL_RATING_LABELS[review.overallRatingLabel]}</span>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>
      <ol className="mt-4 grid gap-2 border-t border-base pt-4 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.label} className="flex items-center gap-2 text-sm">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step.date
                  ? 'bg-success-600 text-white'
                  : step.active
                    ? 'bg-accent-600 text-white'
                    : 'bg-[rgb(var(--bg-muted))] text-muted'
              }`}
            >
              {step.date ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span>
              <span className={step.date || step.active ? 'font-medium text-primary' : 'text-secondary'}>{step.label}</span>
              <span className="block text-xs text-muted">
                {step.date ? formatDay(step.date) : step.active ? 'In progress' : 'Not yet'}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FormNotes({
  review,
  tab,
  editable,
  isOwnReview,
  userEmployeeId,
}: {
  review: EmployeePerformanceReviewRecord;
  tab: FormTab;
  editable: boolean;
  isOwnReview: boolean;
  userEmployeeId: string | null;
}) {
  const notes: string[] = [];
  if (editable && tab === 'self' && !isOwnReview) {
    notes.push(`You’re completing this on behalf of ${review.employeeName}; it’s recorded under your account.`);
  }
  if (editable && tab === 'manager' && userEmployeeId !== review.managerEmployeeId) {
    notes.push(
      review.managerName
        ? `You’re completing this as HR on behalf of ${review.managerName}.`
        : `${review.employeeName} has no manager, so HR completes this assessment.`,
    );
  }
  if (tab === 'manager' && isOwnReview && MANAGER_STAGE.includes(review.status)) {
    notes.push('This is your own review, so someone else must complete the manager assessment.');
  }
  notes.push(
    review.kpiItemsLive
      ? 'KPI progress comes live from the goals and is fixed when the manager submits.'
      : review.managerSubmittedAt
        ? `KPI figures are as of the manager’s submission on ${formatDay(review.managerSubmittedAt)}.`
        : 'KPI figures are as of when the cycle stopped being in progress.',
  );
  return (
    <div className="flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-50/60 px-4 py-3 text-sm text-secondary dark:border-accent-900 dark:bg-accent-950/20">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-600 dark:text-accent-400" />
      <div className="space-y-0.5">
        {notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </div>
  );
}

function AssessmentForm({
  review,
  draft,
  side,
  editable,
  onItemChange,
  onOverallChange,
  onOpenGoals,
}: {
  review: EmployeePerformanceReviewRecord;
  draft: PerformanceAssessmentPayload;
  side: PerformanceAssessmentSide;
  editable: boolean;
  onItemChange: (kind: 'competency' | 'kpi', key: string, patch: { rating?: number; comment?: string }) => void;
  onOverallChange: (value: string) => void;
  onOpenGoals: () => void;
}) {
  const own = (item: PerformanceCompetencyAssessment | PerformanceKpiAssessmentItem) =>
    side === 'self'
      ? { rating: item.selfRating ?? null, comment: item.selfComment ?? '' }
      : { rating: item.managerRating ?? null, comment: item.managerComment ?? '' };

  return (
    <div className="space-y-4">
      <section className="surface rounded-xl border border-base shadow-card">
        <div className="flex items-center justify-between gap-3 border-b border-base px-5 py-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Target className="h-4 w-4 text-accent-600" /> KPI goals
            </h3>
            <p className="mt-0.5 text-xs text-secondary">
              From the KPIs &amp; Goals screen: target, measurement window, weight and progress for this cycle.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onOpenGoals}>
            Open goals
          </Button>
        </div>
        {draft.kpiAssessments.length === 0 ? (
          <div className="flex items-start gap-2 p-5 text-sm text-secondary">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
            <p>
              {review.employeeName} has no active KPI goals in this cycle, so only competencies are rated.
              {review.kpiItemsLive ? ' Goals activated before the manager submits will appear here.' : ''}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[rgb(var(--border-base))]">
            {draft.kpiAssessments.map((kpi) => {
              const mine = own(kpi);
              const progress = kpi.progressPercent;
              return (
                <div key={kpi.kpiAssignmentId} className="space-y-3 p-5">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-primary">{kpi.title}</span>
                        {kpi.goalStatus === 'completed' ? <StatusPill tone="success">Completed</StatusPill> : null}
                        {kpi.weightPercent != null ? (
                          <span className="text-xs text-muted">Weight {kpi.weightPercent}%</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-secondary">
                        {kpi.measurementPeriodStart && kpi.measurementPeriodEnd
                          ? `${formatKpiDateRange(kpi.measurementPeriodStart, kpi.measurementPeriodEnd)} · `
                          : ''}
                        Target {formatKpiValue(kpi.targetValue, kpi.unit)}
                        {kpi.direction === 'lower_is_better' ? ' or lower' : ''} · Actual{' '}
                        {formatKpiValue(kpi.currentValue, kpi.unit)}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 w-40 rounded-full bg-[rgb(var(--bg-muted))]">
                          <div
                            className="h-1.5 rounded-full bg-accent-600"
                            style={{ width: `${Math.min(100, progress ?? 0)}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-secondary">
                          {progress != null ? `${progress}% of target` : 'Not measured yet'}
                        </span>
                      </div>
                    </div>
                    <RatingScale
                      label={`Rating for ${kpi.title}`}
                      value={mine.rating}
                      disabled={!editable}
                      onChange={(rating) => onItemChange('kpi', kpi.kpiAssignmentId, { rating })}
                    />
                  </div>
                  {side === 'manager' ? <SelfView rating={kpi.selfRating} comment={kpi.selfComment} /> : null}
                  <CommentField
                    value={mine.comment}
                    disabled={!editable}
                    placeholder={side === 'self' ? 'What did you achieve against this goal?' : 'Evidence behind your rating'}
                    label={`Comment on ${kpi.title}`}
                    onChange={(comment) => onItemChange('kpi', kpi.kpiAssignmentId, { comment })}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="surface rounded-xl border border-base shadow-card">
        <div className="border-b border-base px-5 py-3">
          <h3 className="text-sm font-semibold text-primary">Competencies</h3>
          <p className="mt-0.5 text-xs text-secondary">How the work was done, rated on the same 1–5 scale.</p>
        </div>
        <div className="divide-y divide-[rgb(var(--border-base))]">
          {draft.competencies.map((competency) => {
            const mine = own(competency);
            return (
              <div key={competency.key} className="space-y-3 p-5">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div className="max-w-md">
                    <div className="text-sm font-medium text-primary">{competency.label}</div>
                    <p className="mt-1 text-xs leading-5 text-secondary">{COMPETENCY_DETAILS[competency.key] ?? ''}</p>
                  </div>
                  <RatingScale
                    label={`Rating for ${competency.label}`}
                    value={mine.rating}
                    disabled={!editable}
                    onChange={(rating) => onItemChange('competency', competency.key, { rating })}
                  />
                </div>
                {side === 'manager' ? <SelfView rating={competency.selfRating} comment={competency.selfComment} /> : null}
                <CommentField
                  value={mine.comment}
                  disabled={!editable}
                  placeholder={side === 'self' ? 'An example that shows this' : 'Evidence behind your rating'}
                  label={`Comment on ${competency.label}`}
                  onChange={(comment) => onItemChange('competency', competency.key, { comment })}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="surface rounded-xl border border-base p-5 shadow-card">
        {side === 'manager' && draft.overallSelfComment ? (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted">{review.employeeName}’s overall comment</p>
            <blockquote className="mt-1 flex gap-2 rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2 text-sm text-secondary">
              <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" />
              {draft.overallSelfComment}
            </blockquote>
          </div>
        ) : null}
        <Label htmlFor="overall-comment">{side === 'self' ? 'Overall self-reflection' : 'Overall manager summary'}</Label>
        <Textarea
          id="overall-comment"
          rows={3}
          maxLength={4000}
          disabled={!editable}
          value={(side === 'self' ? draft.overallSelfComment : draft.overallManagerComment) ?? ''}
          onChange={(e) => onOverallChange(e.target.value)}
          placeholder={
            side === 'self'
              ? 'Highlights of the period, what was hard, and what you want to grow next'
              : 'Overall performance, strengths and the focus for the next cycle'
          }
        />
      </section>
    </div>
  );
}

function SelfView({ rating, comment }: { rating?: number | null; comment?: string | null }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs text-secondary">
      <UserRoundCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        <span className="font-medium text-primary">
          Employee: {rating ? `${rating} · ${ratingText(rating)}` : 'not rated'}
        </span>
        {comment ? <span className="block whitespace-pre-line">{comment}</span> : null}
      </span>
    </div>
  );
}

function CommentField({
  value,
  disabled,
  placeholder,
  label,
  onChange,
}: {
  value: string;
  disabled: boolean;
  placeholder: string;
  label: string;
  onChange: (value: string) => void;
}) {
  if (disabled && !value) return null;
  return (
    <Textarea
      rows={2}
      maxLength={2000}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}