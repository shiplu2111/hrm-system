import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarRange,
  Gauge,
  History,
  Loader2,
  Lock,
  MessageSquareText,
  RefreshCw,
  Scale,
  Search,
  Trophy,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { useAuth, usePermissions } from '@hrm/portal-ui';
import {
  assessmentScore,
  combineOverallRating,
  COMPETENCY_SCORE_SHARE,
  kpiRatingAverage,
  MANAGER_RATING_SHARE,
  ratingLabelForScore,
  type CreateLifecycleEventInput,
  type DesignationRecord,
  type EmployeePerformanceReviewRecord,
  type EmployeeRecord,
  type Performance360Summary,
  type PerformanceHistoryPoint,
  type PerformanceReviewCycleRecord,
} from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { StatusPill } from '@/components/ui/StatusPill';
import { Avatar } from '@/components/ui/Toggle';
import { LifecycleActionPanel } from '@/components/people/LifecycleActionPanel';
import {
  anonymityNote,
  Banner,
  CompetencyRadar,
  errorMessage,
  formatDay,
  formatScore,
  PROMOTION_TONE,
  REVIEW_TONE,
} from '@/components/performance/performance-ui';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
import { getEmployee } from '@/lib/employees-api';
import { listDesignations } from '@/lib/organization-api';
import {
  approvePromotionRecommendation,
  calibrateReviewRating,
  executePromotionFromReview,
  formatKpiValue,
  get360Summary,
  listPerformanceHistory,
  listPerformanceReviews,
  listReviewCycles,
  OVERALL_RATING_LABELS,
  PROMOTION_STATUS_LABELS,
  rejectPromotionRecommendation,
  REVIEW_CYCLE_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  savePromotionRecommendation,
  submitPromotionRecommendation,
} from '@/lib/performance-api';

const SERIES = {
  self: { name: 'Self', color: '#94a3b8' },
  manager: { name: 'Manager', color: '#4f46e5' },
  feedback: { name: '360°', color: '#0d9488' },
};

const RECOMMENDABLE = ['manager_review', 'returned', 'pending_approval', 'approved'];

function ratingName(value: number | null | undefined): string {
  return value == null ? 'Not rated yet' : OVERALL_RATING_LABELS[ratingLabelForScore(value)];
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

interface RatingBreakdown {
  managerScore: number | null;
  competencyAverage: number | null;
  kpiAverage: number | null;
  feedbackAverage: number | null;
  calculated: number | null;
  stored: number | null;
  calibrated: boolean;
  final: boolean;
}

function breakdownFor(review: EmployeePerformanceReviewRecord, liveSummary: Performance360Summary | null): RatingBreakdown {
  const final = review.status === 'approved';
  const competencyRatings = review.managerAssessment.competencies
    .map((item) => item.managerRating)
    .filter((value): value is number => value != null);
  const summary = final ? review.performance360Summary : liveSummary;
  const managerScore = assessmentScore(review.managerAssessment, 'manager');
  const feedbackAverage = summary?.visible ? summary.averageRating : null;
  const calculated = combineOverallRating(managerScore, feedbackAverage);
  const stored = review.overallRating;
  return {
    managerScore,
    competencyAverage: competencyRatings.length
      ? competencyRatings.reduce((sum, value) => sum + value, 0) / competencyRatings.length
      : null,
    kpiAverage: kpiRatingAverage(review.managerAssessment.kpiAssessments, 'manager'),
    feedbackAverage,
    calculated,
    stored,
    calibrated: final
      ? stored != null && calculated != null && Math.abs(stored - calculated) >= 0.005
      : stored != null,
    final,
  };
}

export function ReviewResultsPage() {
  const { companyId } = useCompany();
  const { navigate, openLifecycle } = useNav();
  const { user } = useAuth();
  const { can } = usePermissions();

  const [cycles, setCycles] = useState<PerformanceReviewCycleRecord[]>([]);
  const [cycleId, setCycleId] = useState('');
  const [reviews, setReviews] = useState<EmployeePerformanceReviewRecord[]>([]);
  const [reviewId, setReviewId] = useState('');
  const [designations, setDesignations] = useState<DesignationRecord[]>([]);
  const [liveSummary, setLiveSummary] = useState<Performance360Summary | null>(null);
  const [history, setHistory] = useState<PerformanceHistoryPoint[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; employeeId?: string } | null>(null);

  const [calibrating, setCalibrating] = useState(false);
  const [promoDraft, setPromoDraft] = useState({ designationId: '', note: '' });
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'submit' | 'approve' | 'withdraw' | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [convertEmployee, setConvertEmployee] = useState<EmployeeRecord | null>(null);
  const [convertLoading, setConvertLoading] = useState(false);

  const launchedCycles = useMemo(() => cycles.filter((row) => row.status !== 'draft'), [cycles]);
  const review = reviews.find((row) => row.id === reviewId) ?? null;

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    Promise.all([listReviewCycles(companyId), listDesignations(companyId).catch(() => [])])
      .then(([cycleRows, designationRows]) => {
        setCycles(cycleRows);
        setDesignations(designationRows);
        const launched = cycleRows.filter((row) => row.status !== 'draft');
        setCycleId((current) => current || (launched.find((row) => row.status === 'active') ?? launched[0])?.id || '');
      })
      .catch((err) => setError(errorMessage(err, 'Failed to load review results')))
      .finally(() => setLoading(false));
  }, [companyId]);

  const loadReviews = useCallback(async () => {
    if (!companyId || !cycleId) {
      setReviews([]);
      return;
    }
    const rows = (await listPerformanceReviews(companyId, { reviewCycleId: cycleId }))
      .filter((row) => row.status !== 'cancelled')
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    setReviews(rows);
    setReviewId((current) => (rows.some((row) => row.id === current) ? current : rows[0]?.id ?? ''));
  }, [companyId, cycleId]);

  useEffect(() => {
    void loadReviews().catch((err) => setError(errorMessage(err, 'Failed to load reviews')));
  }, [loadReviews]);

  const reviewKey = review ? `${review.id}:${review.updatedAt}` : '';
  useEffect(() => {
    if (!review || !companyId) {
      setLiveSummary(null);
      setHistory([]);
      return;
    }
    let cancelled = false;
    setPromoDraft({ designationId: review.recommendedDesignationId ?? '', note: review.promotionRecommendationNote ?? '' });
    setPromoError(null);
    Promise.all([
      review.status === 'approved' ? Promise.resolve(null) : get360Summary(review.id).catch(() => null),
      listPerformanceHistory(companyId, review.employeeId).catch(() => []),
    ]).then(([summary, points]) => {
      if (cancelled) return;
      setLiveSummary(summary);
      setHistory(points);
    });
    return () => {
      cancelled = true;
    };
    // Reload when the selected review changes or is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewKey, companyId]);

  const replaceReview = (updated: EmployeePerformanceReviewRecord) =>
    setReviews((current) => current.map((row) => (row.id === updated.id ? updated : row)));

  const visibleReviews = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? reviews.filter((row) => `${row.employeeName} ${row.managerName ?? ''}`.toLowerCase().includes(term))
      : reviews;
  }, [reviews, search]);

  if (!companyId) {
    return <div className="p-6 text-sm text-secondary">Select a company to see review results.</div>;
  }

  const awaitingHr = reviews.filter((row) => row.promotionRecommendationStatus === 'submitted').length;
  const ownReview = Boolean(review && user?.employeeId === review.employeeId);
  const breakdown = review ? breakdownFor(review, liveSummary) : null;
  const shownSummary = review ? (review.status === 'approved' ? review.performance360Summary : liveSummary) : null;

  const calibrationBlock = !review
    ? null
    : ownReview
      ? 'You can’t calibrate your own rating.'
      : review.status !== 'pending_approval' && review.status !== 'approved'
        ? 'Calibration opens once the manager has submitted their assessment.'
        : review.reviewCycleStatus !== 'active'
          ? 'Ratings are final because the review cycle is closed.'
          : review.promotionRecommendationStatus === 'executed'
            ? 'Ratings are final because a promotion was recorded from this review.'
            : null;
  const canCalibrate = can('performance', 'approve') && !calibrationBlock;

  const isManager = Boolean(review && user?.employeeId && user.employeeId === review.managerEmployeeId);
  const canEditPromotion = Boolean(
    review &&
      !ownReview &&
      (isManager || can('performance', 'edit')) &&
      review.reviewCycleStatus !== 'archived' &&
      RECOMMENDABLE.includes(review.status) &&
      ['none', 'draft', 'rejected'].includes(review.promotionRecommendationStatus),
  );
  const canDecidePromotion = Boolean(
    review &&
      !ownReview &&
      can('performance', 'approve') &&
      can('employee', 'approve') &&
      review.promotionRecommendationStatus === 'submitted',
  );
  const canConvert = Boolean(
    review &&
      !ownReview &&
      can('performance', 'approve') &&
      can('employee', 'edit') &&
      review.status === 'approved' &&
      review.promotionRecommendationStatus === 'approved',
  );

  const designationOptions = designations.filter((row) => row.id !== review?.employeeDesignationId);
  const promoDirty = Boolean(
    review &&
      (promoDraft.designationId !== (review.recommendedDesignationId ?? '') ||
        promoDraft.note !== (review.promotionRecommendationNote ?? '')),
  );

  const runPromotion = async (action: () => Promise<EmployeePerformanceReviewRecord>, done: string) => {
    setPromoBusy(true);
    setPromoError(null);
    try {
      const updated = await action();
      replaceReview(updated);
      setNotice({ text: done });
    } catch (err) {
      setPromoError(errorMessage(err, 'The recommendation could not be updated'));
    } finally {
      setPromoBusy(false);
    }
  };

  const saveDraft = () =>
    review &&
    runPromotion(
      () =>
        savePromotionRecommendation(review.id, {
          promotionRecommended: true,
          recommendedDesignationId: promoDraft.designationId || null,
          promotionRecommendationNote: promoDraft.note.trim() || null,
        }),
      'Promotion recommendation saved as a draft.',
    );

  const openConvert = async () => {
    if (!review) return;
    setConvertLoading(true);
    setPromoError(null);
    try {
      setConvertEmployee(await getEmployee(review.employeeId));
    } catch (err) {
      setPromoError(errorMessage(err, 'Failed to load the employee'));
    } finally {
      setConvertLoading(false);
    }
  };

  const recordPromotion = async (request: CreateLifecycleEventInput) => {
    if (!review) return;
    const details = (request.details ?? {}) as Record<string, unknown>;
    const pick = (key: string) => (typeof details[key] === 'string' && details[key] ? (details[key] as string) : undefined);
    const updated = await executePromotionFromReview(review.id, {
      effectiveDate: request.effectiveDate,
      newDesignationId: pick('newDesignationId'),
      newDepartmentId: pick('newDepartmentId'),
      newManagerId: pick('newManagerId'),
      notes: pick('notes'),
    });
    replaceReview(updated);
    setNotice({ text: `Promotion recorded for ${review.employeeName}.`, employeeId: review.employeeId });
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl font-bold text-primary">Review results</h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary">
            The overall rating combines the manager assessment ({percent(MANAGER_RATING_SHARE)}) with the anonymous 360°
            average ({percent(1 - MANAGER_RATING_SHARE)}). Calibrate it here, then take promotion recommendations through
            to a recorded promotion.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void loadReviews().catch((err) => setError(errorMessage(err, 'Failed to refresh')))}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="secondary" onClick={() => navigate('performance-feedback')}>
            <Users className="h-4 w-4" /> 360° feedback
          </Button>
        </div>
      </header>

      {error ? <Banner icon={Lock} tone="error">{error}</Banner> : null}
      {notice ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:bg-success-950/30 dark:text-success-300"
        >
          <span>{notice.text}</span>
          {notice.employeeId ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
              onClick={() => openLifecycle(notice.employeeId!)}
            >
              View lifecycle history <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-secondary">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading review results…
        </div>
      ) : launchedCycles.length === 0 ? (
        <section className="surface flex flex-col items-center gap-3 rounded-xl border border-base p-10 text-center shadow-card">
          <Gauge className="h-8 w-8 text-muted" />
          <p className="text-sm text-secondary">Results appear once a review cycle has been launched.</p>
          <Button variant="secondary" onClick={() => navigate('performance-cycles')}>
            <CalendarRange className="h-4 w-4" /> Go to review cycles
          </Button>
        </section>
      ) : (
        <>
          <section className="surface flex flex-col gap-3 rounded-xl border border-base p-4 shadow-card sm:flex-row sm:items-end">
            <div className="sm:w-80">
              <Label htmlFor="results-cycle">Review cycle</Label>
              <Select
                id="results-cycle"
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
            <div className="flex flex-wrap gap-4 text-xs text-secondary sm:ml-auto">
              <span>
                <strong className="text-primary">{reviews.filter((row) => row.status === 'approved').length}</strong> of{' '}
                {reviews.length} approved
              </span>
              <span>
                <strong className="text-primary">{awaitingHr}</strong>{' '}
                {awaitingHr === 1 ? 'promotion' : 'promotions'} awaiting HR
              </span>
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
                  visibleReviews.map((row) => (
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
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-primary">{row.employeeName}</span>
                          <span className="text-sm font-semibold tabular-nums text-primary">
                            {formatScore(row.overallRating)}
                          </span>
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {row.overallRating != null ? ratingName(row.overallRating) : REVIEW_STATUS_LABELS[row.status]}
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-1.5">
                          <StatusPill tone={REVIEW_TONE[row.status]}>{REVIEW_STATUS_LABELS[row.status]}</StatusPill>
                          {row.promotionRecommendationStatus !== 'none' ? (
                            <StatusPill tone={PROMOTION_TONE[row.promotionRecommendationStatus]}>
                              <Trophy className="h-3 w-3" /> {PROMOTION_STATUS_LABELS[row.promotionRecommendationStatus]}
                            </StatusPill>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </aside>

            {review && breakdown ? (
              <div className="min-w-0 space-y-4">
                <section className="surface rounded-xl border border-base p-5 shadow-card">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div className="flex items-center gap-3">
                      <Avatar name={review.employeeName} />
                      <div>
                        <h2 className="text-base font-semibold text-primary">{review.employeeName}</h2>
                        <p className="text-xs text-secondary">
                          {review.employeeDesignationName ?? review.employeeNumber} ·{' '}
                          {review.managerName ? `Manager: ${review.managerName}` : 'No manager'}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <StatusPill tone={REVIEW_TONE[review.status]}>{REVIEW_STATUS_LABELS[review.status]}</StatusPill>
                          {review.approvedAt ? (
                            <span className="text-xs text-muted">Approved {formatDay(review.approvedAt)}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="text-left md:text-right">
                      <div className="flex items-baseline gap-2 md:justify-end">
                        <span className="text-3xl font-bold tabular-nums text-primary">
                          {formatScore(breakdown.stored ?? breakdown.calculated)}
                        </span>
                        <span className="text-sm text-muted">/ 5</span>
                      </div>
                      <div className="text-sm font-medium text-secondary">
                        {ratingName(breakdown.stored ?? breakdown.calculated)}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5 md:justify-end">
                        {breakdown.calibrated ? <StatusPill tone="warning">Calibrated</StatusPill> : null}
                        {!breakdown.final && (breakdown.stored ?? breakdown.calculated) != null ? (
                          <StatusPill tone="neutral">Provisional until approved</StatusPill>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="surface rounded-xl border border-base shadow-card">
                  <div className="flex items-center justify-between gap-3 border-b border-base px-5 py-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <Scale className="h-4 w-4 text-accent-600" /> How the rating was reached
                    </h3>
                    {can('performance', 'approve') ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="whitespace-nowrap"
                        disabled={!canCalibrate}
                        title={calibrationBlock ?? undefined}
                        onClick={() => setCalibrating(true)}
                      >
                        <Gauge className="h-3.5 w-3.5" /> Calibrate
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 p-5 sm:grid-cols-3">
                    <ScoreTile
                      label="Manager assessment"
                      value={breakdown.managerScore}
                      share={MANAGER_RATING_SHARE}
                      detail={`Competencies ${formatScore(breakdown.competencyAverage)} × ${percent(COMPETENCY_SCORE_SHARE)} + KPIs ${formatScore(
                        breakdown.kpiAverage,
                      )} × ${percent(1 - COMPETENCY_SCORE_SHARE)}`}
                    />
                    <ScoreTile
                      label="360° feedback"
                      value={breakdown.feedbackAverage}
                      share={1 - MANAGER_RATING_SHARE}
                      detail={
                        shownSummary
                          ? (anonymityNote(shownSummary) ?? `${shownSummary.responseCount} anonymous responses`)
                          : 'Nobody was asked for feedback.'
                      }
                    />
                    <ScoreTile
                      label="Calculated rating"
                      value={breakdown.calculated}
                      detail={
                        breakdown.managerScore != null && breakdown.feedbackAverage != null
                          ? `${formatScore(breakdown.managerScore)} × ${percent(MANAGER_RATING_SHARE)} + ${formatScore(
                              breakdown.feedbackAverage,
                            )} × ${percent(1 - MANAGER_RATING_SHARE)}`
                          : breakdown.managerScore != null
                            ? 'Manager assessment only, as there are no 360° results'
                            : 'Waiting for the manager assessment'
                      }
                    />
                  </div>
                  {breakdown.calibrated ? (
                    <div className="px-5 pb-4">
                      <Banner icon={Gauge} tone="warning">
                        Calibrated to {formatScore(breakdown.stored)} ({ratingName(breakdown.stored)})
                        {breakdown.calculated != null ? `; the calculated rating is ${formatScore(breakdown.calculated)}` : ''}.
                      </Banner>
                    </div>
                  ) : null}
                  {calibrationBlock && can('performance', 'approve') ? (
                    <p className="px-5 pb-4 text-xs text-muted">{calibrationBlock}</p>
                  ) : null}
                </section>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
                    <div className="border-b border-base px-5 py-3">
                      <h3 className="text-sm font-semibold text-primary">Competencies</h3>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-[rgb(var(--bg-muted))] text-left text-xs font-medium text-secondary">
                        <tr>
                          <th className="px-4 py-2.5">Competency</th>
                          <th className="px-4 py-2.5 text-right">Self</th>
                          <th className="px-4 py-2.5 text-right">Manager</th>
                          <th className="px-4 py-2.5 text-right">360°</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgb(var(--border-base))]">
                        {review.managerAssessment.competencies.map((item) => {
                          const self = review.selfAssessment.competencies.find((row) => row.key === item.key);
                          const peer = shownSummary?.visible
                            ? shownSummary.competencyAverages.find((row) => row.key === item.key)
                            : undefined;
                          return (
                            <tr key={item.key}>
                              <td className="px-4 py-2.5 text-primary">{item.label}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-secondary">
                                {self?.selfRating ?? '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-primary">
                                {item.managerRating ?? '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-secondary">
                                {formatScore(peer?.averageRating)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </section>
                  <section className="surface rounded-xl border border-base p-4 shadow-card">
                    <CompetencyRadar
                      axes={review.managerAssessment.competencies.map((item) => ({ key: item.key, label: item.label }))}
                      series={[
                        {
                          ...SERIES.self,
                          values: review.managerAssessment.competencies.map(
                            (item) => review.selfAssessment.competencies.find((row) => row.key === item.key)?.selfRating ?? null,
                          ),
                        },
                        {
                          ...SERIES.manager,
                          values: review.managerAssessment.competencies.map((item) => item.managerRating ?? null),
                        },
                        {
                          ...SERIES.feedback,
                          values: review.managerAssessment.competencies.map((item) =>
                            shownSummary?.visible
                              ? (shownSummary.competencyAverages.find((row) => row.key === item.key)?.averageRating ?? null)
                              : null,
                          ),
                        },
                      ]}
                    />
                    <div className="flex justify-center gap-4 text-xs text-secondary">
                      {Object.values(SERIES).map((item) => (
                        <span key={item.name} className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.name}
                        </span>
                      ))}
                    </div>
                  </section>
                </div>

                <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
                  <div className="border-b border-base px-5 py-3">
                    <h3 className="text-sm font-semibold text-primary">KPI results</h3>
                  </div>
                  {review.managerAssessment.kpiAssessments.length === 0 ? (
                    <p className="p-5 text-sm text-secondary">No KPI goals were part of this review.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-[rgb(var(--bg-muted))] text-left text-xs font-medium text-secondary">
                          <tr>
                            <th className="px-4 py-2.5">Goal</th>
                            <th className="px-4 py-2.5 text-right">Actual / target</th>
                            <th className="px-4 py-2.5 text-right">Weight</th>
                            <th className="px-4 py-2.5 text-right">Self</th>
                            <th className="px-4 py-2.5 text-right">Manager</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[rgb(var(--border-base))]">
                          {review.managerAssessment.kpiAssessments.map((item) => {
                            const self = review.selfAssessment.kpiAssessments.find(
                              (row) => row.kpiAssignmentId === item.kpiAssignmentId,
                            );
                            return (
                              <tr key={item.kpiAssignmentId}>
                                <td className="px-4 py-2.5 text-primary">{item.title}</td>
                                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-secondary">
                                  {formatKpiValue(item.currentValue, item.unit)} / {formatKpiValue(item.targetValue, item.unit)}
                                  {item.progressPercent != null ? (
                                    <span className="ml-1.5 text-xs text-muted">({Math.round(item.progressPercent)}%)</span>
                                  ) : null}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums text-secondary">
                                  {item.weightPercent != null ? `${item.weightPercent}%` : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums text-secondary">{self?.selfRating ?? '—'}</td>
                                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-primary">
                                  {item.managerRating ?? '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <PromotionCard
                    review={review}
                    designationOptions={designationOptions}
                    draft={promoDraft}
                    onDraftChange={setPromoDraft}
                    dirty={promoDirty}
                    busy={promoBusy}
                    error={promoError}
                    canEdit={canEditPromotion}
                    canDecide={canDecidePromotion}
                    canConvert={canConvert}
                    convertLoading={convertLoading}
                    onSave={() => void saveDraft()}
                    onSubmit={() => setConfirm('submit')}
                    onWithdraw={() => setConfirm('withdraw')}
                    onApprove={() => setConfirm('approve')}
                    onReject={() => setRejecting(true)}
                    onConvert={() => void openConvert()}
                    onOpenLifecycle={() => openLifecycle(review.employeeId)}
                  />
                  <section className="surface rounded-xl border border-base shadow-card">
                    <div className="border-b border-base px-5 py-3">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <History className="h-4 w-4 text-accent-600" /> Rating history
                      </h3>
                    </div>
                    {history.length === 0 ? (
                      <p className="p-5 text-sm text-secondary">No approved reviews yet.</p>
                    ) : (
                      <ul className="space-y-3 p-5">
                        {history.map((point) => (
                          <li key={`${point.reviewCycleName}-${point.approvedAt}`}>
                            <div className="mb-1 flex justify-between text-xs">
                              <span className="truncate text-secondary">{point.reviewCycleName}</span>
                              <span className="font-semibold tabular-nums text-primary">{formatScore(point.overallRating)}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[rgb(var(--bg-muted))]">
                              <div
                                className="h-1.5 rounded-full bg-accent-600"
                                style={{ width: `${((point.overallRating ?? 0) / 5) * 100}%` }}
                              />
                            </div>
                            <div className="mt-0.5 text-[11px] text-muted">
                              {point.overallRatingLabel ? OVERALL_RATING_LABELS[point.overallRatingLabel] : ''}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              </div>
            ) : (
              <section className="surface flex items-center justify-center rounded-xl border border-base p-10 text-sm text-secondary shadow-card">
                Select a review to see its results.
              </section>
            )}
          </div>
        </>
      )}

      {review && breakdown ? (
        <CalibrateModal
          open={calibrating}
          review={review}
          breakdown={breakdown}
          onClose={() => setCalibrating(false)}
          onSaved={(updated, cleared) => {
            replaceReview(updated);
            setNotice({ text: cleared ? 'Calibration cleared.' : 'Rating calibrated.' });
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirm === 'submit'}
        title="Send the recommendation to HR?"
        description="HR will approve or reject it. It can’t change while HR is deciding."
        confirmLabel="Submit to HR"
        tone="primary"
        onConfirm={async () => {
          if (!review) return;
          replaceReview(await submitPromotionRecommendation(review.id));
          setNotice({ text: 'Promotion recommendation sent to HR.' });
        }}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'withdraw'}
        title="Withdraw the promotion recommendation?"
        description="The recommended designation and justification are cleared."
        confirmLabel="Withdraw"
        onConfirm={async () => {
          if (!review) return;
          replaceReview(await savePromotionRecommendation(review.id, { promotionRecommended: false }));
          setNotice({ text: 'Promotion recommendation withdrawn.' });
        }}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'approve'}
        title={review ? `Approve promoting ${review.employeeName}?` : 'Approve the promotion?'}
        description={
          review?.recommendedDesignationName
            ? `To ${review.recommendedDesignationName}. The promotion is recorded separately, with an effective date, using Convert to promotion.`
            : undefined
        }
        confirmLabel="Approve"
        tone="primary"
        onConfirm={async () => {
          if (!review) return;
          replaceReview(await approvePromotionRecommendation(review.id));
          setNotice({ text: 'Promotion recommendation approved.' });
        }}
        onClose={() => setConfirm(null)}
      />
      {review ? (
        <RejectModal
          open={rejecting}
          employeeName={review.employeeName}
          onClose={() => setRejecting(false)}
          onReject={async (reason) => {
            replaceReview(await rejectPromotionRecommendation(review.id, reason));
            setNotice({ text: 'Promotion recommendation rejected and returned to the manager.' });
          }}
        />
      ) : null}

      {review && convertEmployee ? (
        <LifecycleActionPanel
          open
          kind="promotion"
          employee={convertEmployee}
          companyId={companyId}
          onClose={() => setConvertEmployee(null)}
          initialValues={{
            newDesignationId: review.recommendedDesignationId ?? '',
            notes: `Promotion following the ${review.reviewCycleName} performance review.`,
          }}
          context={
            <Banner icon={Trophy}>
              <p className="font-medium text-primary">From the {review.reviewCycleName} performance review</p>
              <p className="mt-0.5">
                Rated {formatScore(review.overallRating)} ({ratingName(review.overallRating)}). Recommended for{' '}
                {review.recommendedDesignationName ?? 'promotion'}
                {review.managerName ? ` by ${review.managerName}` : ''}.
              </p>
              {convertEmployee.designationId === review.recommendedDesignationId ? (
                <p className="mt-1 text-warning-700 dark:text-warning-300">
                  {review.employeeName} already holds this designation, so choose the new one below.
                </p>
              ) : null}
            </Banner>
          }
          submitLabel="Record promotion"
          onSubmitRequest={recordPromotion}
        />
      ) : null}
    </div>
  );
}

function ScoreTile({
  label,
  value,
  share,
  detail,
}: {
  label: string;
  value: number | null;
  share?: number;
  detail: string;
}) {
  return (
    <div className="rounded-lg bg-[rgb(var(--bg-muted))] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-2 text-xs text-muted">
        <span>{label}</span>
        {share != null ? <span className="whitespace-nowrap">{percent(share)} weight</span> : null}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums text-primary">{formatScore(value)}</div>
      <p className="mt-0.5 text-xs leading-5 text-secondary">{detail}</p>
    </div>
  );
}

function PromotionCard({
  review,
  designationOptions,
  draft,
  onDraftChange,
  dirty,
  busy,
  error,
  canEdit,
  canDecide,
  canConvert,
  convertLoading,
  onSave,
  onSubmit,
  onWithdraw,
  onApprove,
  onReject,
  onConvert,
  onOpenLifecycle,
}: {
  review: EmployeePerformanceReviewRecord;
  designationOptions: DesignationRecord[];
  draft: { designationId: string; note: string };
  onDraftChange: (draft: { designationId: string; note: string }) => void;
  dirty: boolean;
  busy: boolean;
  error: string | null;
  canEdit: boolean;
  canDecide: boolean;
  canConvert: boolean;
  convertLoading: boolean;
  onSave: () => void;
  onSubmit: () => void;
  onWithdraw: () => void;
  onApprove: () => void;
  onReject: () => void;
  onConvert: () => void;
  onOpenLifecycle: () => void;
}) {
  const status = review.promotionRecommendationStatus;
  const steps: Array<{ key: string; label: string; done: boolean }> = [
    { key: 'draft', label: 'Recommended', done: status !== 'none' },
    { key: 'submitted', label: 'Sent to HR', done: ['submitted', 'approved', 'executed'].includes(status) },
    { key: 'approved', label: 'Approved', done: ['approved', 'executed'].includes(status) },
    { key: 'executed', label: 'Promoted', done: status === 'executed' },
  ];
  const canSubmit = status === 'draft' && !dirty && Boolean(review.recommendedDesignationId && review.promotionRecommendationNote?.trim());

  return (
    <section className="surface rounded-xl border border-base shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-base px-5 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Trophy className="h-4 w-4 text-accent-600" /> Promotion recommendation
        </h3>
        <StatusPill tone={PROMOTION_TONE[status]}>{PROMOTION_STATUS_LABELS[status]}</StatusPill>
      </div>
      <div className="space-y-4 p-5">
        {error ? <Banner icon={Lock} tone="error">{error}</Banner> : null}

        {status !== 'none' ? (
          <ol className="flex items-center gap-2 text-xs">
            {steps.map((step, index) => (
              <li key={step.key} className="flex items-center gap-2">
                {index > 0 ? <span className={`h-px w-6 ${step.done ? 'bg-accent-600' : 'bg-[rgb(var(--border-strong))]'}`} /> : null}
                <span className={`flex items-center gap-1 ${step.done ? 'font-medium text-primary' : 'text-muted'}`}>
                  {step.done ? <BadgeCheck className="h-3.5 w-3.5 text-accent-600" /> : null}
                  {step.label}
                </span>
              </li>
            ))}
            {status === 'rejected' ? <StatusPill tone="error">Rejected by HR</StatusPill> : null}
          </ol>
        ) : null}

        {canEdit ? (
          <div className="space-y-3">
            {status === 'rejected' ? (
              <Banner icon={MessageSquareText} tone="warning">
                HR rejected this recommendation. The reason is added to the justification below; revise it and submit again.
              </Banner>
            ) : null}
            <div>
              <Label htmlFor="promo-designation">Recommended designation</Label>
              <Select
                id="promo-designation"
                value={draft.designationId}
                onChange={(e) => onDraftChange({ ...draft, designationId: e.target.value })}
              >
                <option value="">Choose a designation</option>
                {designationOptions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </Select>
              {review.employeeDesignationName ? (
                <p className="mt-1 text-xs text-muted">Currently {review.employeeDesignationName}.</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="promo-note">Justification</Label>
              <Textarea
                id="promo-note"
                rows={4}
                maxLength={2000}
                value={draft.note}
                placeholder="What evidence from this review supports the promotion?"
                onChange={(e) => onDraftChange({ ...draft, note: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {status !== 'none' ? (
                <Button variant="ghost" onClick={onWithdraw} disabled={busy}>
                  Withdraw
                </Button>
              ) : null}
              <Button variant="secondary" onClick={onSave} disabled={busy || !dirty || !draft.designationId}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save draft
              </Button>
              <Button
                onClick={onSubmit}
                disabled={busy || !canSubmit}
                title={
                  dirty
                    ? 'Save the draft first'
                    : !review.promotionRecommendationNote?.trim()
                      ? 'Add a justification before submitting'
                      : undefined
                }
              >
                Submit to HR
              </Button>
            </div>
          </div>
        ) : status === 'none' ? (
          <p className="text-sm text-secondary">
            {RECOMMENDABLE.includes(review.status)
              ? 'The manager hasn’t recommended a promotion.'
              : 'The manager can recommend a promotion once the self-assessment is in.'}
          </p>
        ) : (
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-muted">Designation</dt>
              <dd className="text-primary">
                {review.employeeDesignationName ?? '—'} <ArrowUpRight className="inline h-3.5 w-3.5 text-muted" />{' '}
                <strong>{review.recommendedDesignationName ?? '—'}</strong>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-muted">Justification</dt>
              <dd className="whitespace-pre-line text-secondary">{review.promotionRecommendationNote || '—'}</dd>
            </div>
          </dl>
        )}

        {!canEdit &&
        status !== 'executed' &&
        review.recommendedDesignationId &&
        review.recommendedDesignationId === review.employeeDesignationId ? (
          <Banner icon={MessageSquareText} tone="warning">
            {review.employeeName} already holds this designation; a different one is needed when recording the promotion.
          </Banner>
        ) : null}

        {canDecide ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-base pt-4">
            <Button variant="secondary" onClick={onReject}>
              Reject
            </Button>
            <Button onClick={onApprove}>
              <UserRoundCheck className="h-4 w-4" /> Approve
            </Button>
          </div>
        ) : null}

        {status === 'approved' ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base pt-4">
            <p className="text-xs text-secondary">
              {review.status !== 'approved'
                ? 'The review itself must be approved before the promotion can be recorded.'
                : 'Approved. Record it as a promotion with an effective date.'}
            </p>
            {canConvert ? (
              <Button onClick={onConvert} disabled={convertLoading}>
                {convertLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />} Convert to
                promotion
              </Button>
            ) : null}
          </div>
        ) : null}

        {status === 'executed' ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base pt-4">
            <p className="text-sm text-secondary">The promotion is on the employee’s lifecycle history.</p>
            <Button variant="secondary" size="sm" onClick={onOpenLifecycle}>
              View lifecycle history <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CalibrateModal({
  open,
  review,
  breakdown,
  onClose,
  onSaved,
}: {
  open: boolean;
  review: EmployeePerformanceReviewRecord;
  breakdown: RatingBreakdown;
  onClose: () => void;
  onSaved: (review: EmployeePerformanceReviewRecord, cleared: boolean) => void;
}) {
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue(breakdown.calibrated && breakdown.stored != null ? breakdown.stored.toFixed(2) : '');
    setReason('');
    setError(null);
  }, [open, breakdown.calibrated, breakdown.stored]);

  const parsed = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed >= 1 && parsed <= 5 && /^\d(\.\d{1,2})?$/.test(value.trim());

  const save = async (rating: number | null) => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await calibrateReviewRating(review.id, rating, reason), rating == null);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'The rating could not be calibrated'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Calibrate ${review.employeeName}’s rating`}
      description={`Calculated rating: ${formatScore(breakdown.calculated)} (${ratingName(breakdown.calculated)}). The label always follows the rating.`}
      footer={
        <div className="flex w-full flex-wrap justify-between gap-2">
          {breakdown.calibrated ? (
            <Button variant="ghost" onClick={() => void save(null)} disabled={saving || !reason.trim()} title={!reason.trim() ? 'Give a reason' : undefined}>
              Use calculated rating
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save(parsed)} disabled={saving || !valid || !reason.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save rating
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? <Banner icon={Lock} tone="error">{error}</Banner> : null}
        <div>
          <Label htmlFor="calibrated-rating">Calibrated rating (1.00–5.00)</Label>
          <Input
            id="calibrated-rating"
            type="number"
            min={1}
            max={5}
            step={0.01}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">{valid ? ratingName(parsed) : 'Up to two decimal places.'}</p>
        </div>
        <div>
          <Label htmlFor="calibration-reason">Reason</Label>
          <Textarea
            id="calibration-reason"
            rows={3}
            maxLength={500}
            value={reason}
            placeholder="e.g. Adjusted at the calibration meeting to align with peers in the same role"
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">Kept in the audit log.</p>
        </div>
      </div>
    </Modal>
  );
}

function RejectModal({
  open,
  employeeName,
  onClose,
  onReject,
}: {
  open: boolean;
  employeeName: string;
  onClose: () => void;
  onReject: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const reject = async () => {
    setSaving(true);
    setError(null);
    try {
      await onReject(reason.trim());
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'The recommendation could not be rejected'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reject promoting ${employeeName}?`}
      description="The manager sees your reason and can revise the recommendation."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void reject()} disabled={saving || !reason.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Reject
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Banner icon={Lock} tone="error">{error}</Banner> : null}
        <Label htmlFor="reject-reason">Reason</Label>
        <Textarea
          id="reject-reason"
          rows={4}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Not enough evidence of leading cross-team work yet"
        />
      </div>
    </Modal>
  );
}
