import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock3,
  Loader2,
  MessageSquareText,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Toggle';
import { useCompany } from '@/context/CompanyContext';
import { listEmployees } from '@/lib/employees-api';
import {
  bulkAssignKpi,
  createKpiDefinition,
  createReviewCycle,
  formatKpiMetric,
  getPerformanceSummary,
  KPI_DIRECTION_LABELS,
  KPI_UNIT_LABELS,
  listKpiAssignments,
  listKpiDefinitions,
  listPerformanceReviews,
  listReviewCycles,
  listReviewParticipants,
  getPerformanceReview,
  launchReviewCycle,
  MEASUREMENT_PERIOD_LABELS,
  REVIEW_CYCLE_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  saveManagerAssessment,
  saveSelfAssessment,
  setReviewParticipants,
  submitManagerAssessment,
  submitSelfAssessment,
  approvePerformanceReview,
  rejectPerformanceReview,
  updateKpiAssignment,
  list360Feedback,
  get360Summary,
  invite360Reviewers,
  saveReviewOutcome,
  submitPromotionRecommendation,
  approvePromotionRecommendation,
  rejectPromotionRecommendation,
  executePromotionFromReview,
  listPerformanceHistory,
  OVERALL_RATING_LABELS,
  PROMOTION_STATUS_LABELS,
  FEEDBACK_360_RELATIONSHIP_LABELS,
} from '@/lib/performance-api';
import { listDesignations } from '@/lib/organization-api';
import { ApiError } from '@/lib/tenant-api-client';
import type {
  DesignationRecord,
  EmployeeKpiAssignmentRecord,
  EmployeePerformanceReviewRecord,
  EmployeeRecord,
  KpiDefinitionRecord,
  KpiDirection,
  KpiMeasurementPeriod,
  KpiUnit,
  Performance360FeedbackRecord,
  Performance360Summary,
  PerformanceAssessmentPayload,
  PerformanceGoalsSummary,
  PerformanceHistoryPoint,
  PerformanceReviewCycleRecord,
} from '@hrm/shared-types';

type View = 'goals' | 'cycles' | 'review' | 'feedback' | 'promotion';

const competencyDetails: Record<string, string> = {
  impact: 'Prioritizes work that creates measurable customer and company value.',
  ownership: 'Takes accountability and resolves ambiguity proactively.',
  collaboration: 'Builds trust across functions and shares context effectively.',
  craft: 'Demonstrates deep expertise and raises the quality bar.',
};

const tabs: { id: View; label: string; icon: typeof Target }[] = [
  { id: 'goals', label: 'Goals & KPIs', icon: Target },
  { id: 'cycles', label: 'Review cycles', icon: CalendarDays },
  { id: 'review', label: 'Review form', icon: ClipboardCheck },
  { id: 'feedback', label: '360° feedback', icon: Users },
  { id: 'promotion', label: 'Promotion', icon: Trophy },
];

function Rating({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          role="radio"
          aria-checked={value === rating}
          disabled={disabled}
          onClick={() => onChange(rating)}
          className={`h-7 w-7 rounded-md border text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            rating <= value
              ? 'border-accent-500 bg-accent-600 text-white'
              : 'border-base surface text-secondary hover:border-accent-400 hover:text-accent-600'
          }`}
        >
          {rating}
        </button>
      ))}
    </div>
  );
}

function RadarChart({ summary }: { summary: Performance360Summary | null }) {
  const labels =
    summary?.competencyAverages.map((item) =>
      item.label.replace('Business impact', 'Impact').replace('Functional excellence', 'Craft'),
    ) ?? ['Impact', 'Ownership', 'Collaboration', 'Craft'];
  const values =
    summary?.competencyAverages.map((item) => item.averageRating ?? 0) ??
    [0, 0, 0, 0];
  const center = 130;
  const radius = 88;
  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / labels.length;
    const distance = (radius * value) / 5;
    return `${center + Math.cos(angle) * distance},${center + Math.sin(angle) * distance}`;
  };
  return (
    <svg viewBox="0 0 260 260" className="mx-auto h-64 w-full max-w-[300px]" aria-label="360 feedback competency radar chart">
      {[1, 2, 3, 4, 5].map((level) => (
        <polygon
          key={level}
          points={labels.map((_, index) => point(index, level)).join(' ')}
          fill={level % 2 ? 'rgb(var(--bg-muted))' : 'none'}
          fillOpacity=".35"
          stroke="rgb(var(--border-strong))"
          strokeWidth="1"
        />
      ))}
      {labels.map((label, index) => {
        const [x, y] = point(index, 5);
        const [lx, ly] = point(index, 6.15);
        return (
          <g key={label}>
            <line x1={center} y1={center} x2={x} y2={y} stroke="rgb(var(--border-base))" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="fill-[rgb(var(--text-secondary))] text-[10px] font-medium">{label}</text>
          </g>
        );
      })}
      {values.some((value) => value > 0) && (
        <>
          <polygon points={values.map((value, index) => point(index, value)).join(' ')} fill="rgb(37 99 235 / .2)" stroke="rgb(37 99 235)" strokeWidth="2" />
          {values.map((value, index) => {
            const [x, y] = point(index, value);
            return <circle key={labels[index]} cx={x} cy={y} r="3.5" fill="rgb(37 99 235)" />;
          })}
        </>
      )}
    </svg>
  );
}

function reviewStatusTone(status: EmployeePerformanceReviewRecord['status']) {
  switch (status) {
    case 'approved':
      return 'success' as const;
    case 'pending_approval':
      return 'warning' as const;
    case 'returned':
      return 'error' as const;
    case 'cancelled':
      return 'neutral' as const;
    default:
      return 'accent' as const;
  }
}

function cycleStatusTone(status: PerformanceReviewCycleRecord['status']) {
  switch (status) {
    case 'closed':
      return 'success' as const;
    case 'archived':
      return 'neutral' as const;
    case 'active':
      return 'accent' as const;
    default:
      return 'warning' as const;
  }
}

function formatDisplayDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function PerformanceManagementPage() {
  const { companyId } = useCompany();
  const [view, setView] = useState<View>('goals');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PerformanceGoalsSummary | null>(null);
  const [cycles, setCycles] = useState<PerformanceReviewCycleRecord[]>([]);
  const [definitions, setDefinitions] = useState<KpiDefinitionRecord[]>([]);
  const [assignments, setAssignments] = useState<EmployeeKpiAssignmentRecord[]>([]);
  const [reviews, setReviews] = useState<EmployeePerformanceReviewRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [designations, setDesignations] = useState<DesignationRecord[]>([]);
  const [feedback360, setFeedback360] = useState<Performance360FeedbackRecord[]>([]);
  const [summary360, setSummary360] = useState<Performance360Summary | null>(null);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceHistoryPoint[]>([]);

  const [kpiModal, setKpiModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [cycleModal, setCycleModal] = useState(false);
  const [participantsModalCycleId, setParticipantsModalCycleId] = useState<string | null>(null);
  const [invite360Modal, setInvite360Modal] = useState(false);
  const [invite360EmployeeId, setInvite360EmployeeId] = useState('');
  const [invite360Relationship, setInvite360Relationship] = useState<'peer' | 'direct_report' | 'cross_functional'>('peer');
  const [participantSelection, setParticipantSelection] = useState<string[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [kpiName, setKpiName] = useState('');
  const [kpiDescription, setKpiDescription] = useState('');
  const [kpiCategory, setKpiCategory] = useState('');
  const [kpiUnit, setKpiUnit] = useState<KpiUnit>('percentage');
  const [kpiDirection, setKpiDirection] = useState<KpiDirection>('higher_is_better');
  const [kpiDefaultTarget, setKpiDefaultTarget] = useState('');

  const [assignCycleId, setAssignCycleId] = useState('');
  const [assignDefinitionId, setAssignDefinitionId] = useState('');
  const [assignEmployeeIds, setAssignEmployeeIds] = useState<string[]>([]);
  const [assignTarget, setAssignTarget] = useState('');

  const [cycleName, setCycleName] = useState('');
  const [cyclePeriodStart, setCyclePeriodStart] = useState('2026-07-01');
  const [cyclePeriodEnd, setCyclePeriodEnd] = useState('2026-12-31');
  const [cycleMeasurementPeriod, setCycleMeasurementPeriod] = useState<KpiMeasurementPeriod>('semi_annual');
  const [cycleReviewDue, setCycleReviewDue] = useState('2026-12-18');
  const [cycleRequiresWorkflow, setCycleRequiresWorkflow] = useState(true);


  const [promotionNote, setPromotionNote] = useState('');
  const [promotionDesignationId, setPromotionDesignationId] = useState('');
  const [promotionRecommended, setPromotionRecommended] = useState(false);
  const [overallRatingOverride, setOverallRatingOverride] = useState('');
  const [promotionEffectiveDate, setPromotionEffectiveDate] = useState('2026-12-31');

  const [selfDraft, setSelfDraft] = useState<PerformanceAssessmentPayload | null>(null);
  const [managerDraft, setManagerDraft] = useState<PerformanceAssessmentPayload | null>(null);
  const [workflowComment, setWorkflowComment] = useState('');
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  const activeCycle = summary?.activeCycle ?? cycles.find((cycle) => cycle.status === 'active') ?? null;
  const selectedReview = reviews.find((review) => review.id === selectedReviewId) ?? reviews[0] ?? null;

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryRow, cycleRows, definitionRows, assignmentRows, employeeRows, reviewRows, designationRows] =
        await Promise.all([
          getPerformanceSummary(companyId),
          listReviewCycles(companyId),
          listKpiDefinitions(companyId),
          listKpiAssignments(companyId, { status: 'active' }),
          listEmployees(companyId),
          listPerformanceReviews(companyId),
          listDesignations(companyId),
        ]);
      setSummary(summaryRow);
      setCycles(cycleRows);
      setDefinitions(definitionRows);
      setAssignments(assignmentRows);
      setEmployees(employeeRows);
      setReviews(reviewRows);
      setDesignations(designationRows);
      setSelectedReviewId((current) => current ?? reviewRows[0]?.id ?? null);
      if (cycleRows.length > 0) {
        setAssignCycleId((current) => {
          if (current) return current;
          const preferred = cycleRows.find((cycle) => cycle.status === 'active') ?? cycleRows[0];
          return preferred.id;
        });
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load performance data',
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedReview) {
      setSelfDraft(selectedReview.selfAssessment);
      setManagerDraft(selectedReview.managerAssessment);
      setReviewMessage(null);
      setPromotionNote(selectedReview.promotionRecommendationNote ?? '');
      setPromotionRecommended(selectedReview.promotionRecommended);
      setPromotionDesignationId(selectedReview.recommendedDesignationId ?? '');
      setOverallRatingOverride(
        selectedReview.overallRating != null ? String(selectedReview.overallRating) : '',
      );
    }
  }, [selectedReview?.id, selectedReview?.updatedAt]);

  const loadReviewExtras = useCallback(async () => {
    if (!companyId || !selectedReview) return;
    try {
      const [summary, feedback, history] = await Promise.all([
        get360Summary(selectedReview.id),
        list360Feedback(selectedReview.id),
        listPerformanceHistory(companyId, selectedReview.employeeId),
      ]);
      setSummary360(summary);
      setFeedback360(feedback);
      setPerformanceHistory(history);
    } catch {
      setSummary360(null);
      setFeedback360([]);
      setPerformanceHistory([]);
    }
  }, [companyId, selectedReview]);

  useEffect(() => {
    if ((view === 'feedback' || view === 'promotion') && selectedReview) {
      void loadReviewExtras();
    }
  }, [view, selectedReview?.id, loadReviewExtras]);

  const overall = useMemo(() => {
    if (summary?.averageProgressPercent != null) {
      return summary.averageProgressPercent;
    }
    const values = assignments
      .map((assignment) => assignment.progressPercent)
      .filter((value): value is number => value != null);
    if (values.length === 0) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [assignments, summary]);

  const onTrackCount = summary?.onTrackCount ?? assignments.filter((a) => (a.progressPercent ?? 0) >= 65).length;
  const atRiskCount = summary?.atRiskCount ?? assignments.length - onTrackCount;

  const handleCreateKpi = async () => {
    if (!companyId || !kpiName.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await createKpiDefinition(companyId, {
        name: kpiName.trim(),
        description: kpiDescription.trim() || undefined,
        category: kpiCategory.trim() || undefined,
        unit: kpiUnit,
        direction: kpiDirection,
        defaultTargetValue: kpiDefaultTarget ? Number(kpiDefaultTarget) : undefined,
      });
      setKpiModal(false);
      setKpiName('');
      setKpiDescription('');
      setKpiCategory('');
      setKpiDefaultTarget('');
      await loadData();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create KPI');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignKpi = async () => {
    if (!companyId || !assignCycleId || !assignDefinitionId || assignEmployeeIds.length === 0) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await bulkAssignKpi(companyId, {
        reviewCycleId: assignCycleId,
        kpiDefinitionId: assignDefinitionId,
        employeeIds: assignEmployeeIds,
        targetValue: assignTarget ? Number(assignTarget) : undefined,
      });
      setAssignModal(false);
      setAssignEmployeeIds([]);
      setAssignTarget('');
      await loadData();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to assign KPI');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCycle = async () => {
    if (!companyId || !cycleName.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await createReviewCycle(companyId, {
        name: cycleName.trim(),
        periodStart: cyclePeriodStart,
        periodEnd: cyclePeriodEnd,
        measurementPeriod: cycleMeasurementPeriod,
        reviewDueDate: cycleReviewDue,
        status: 'draft',
        requiresWorkflowApproval: cycleRequiresWorkflow,
      });
      setCycleModal(false);
      setCycleName('');
      await loadData();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create review cycle');
    } finally {
      setSubmitting(false);
    }
  };

  const refreshSelectedReview = async (reviewId: string) => {
    const updated = await getPerformanceReview(reviewId);
    setReviews((current) => current.map((review) => (review.id === updated.id ? updated : review)));
    return updated;
  };

  const openParticipantsModal = async (cycleId: string) => {
    if (!companyId) return;
    setParticipantsModalCycleId(cycleId);
    setFormError(null);
    try {
      const participants = await listReviewParticipants(companyId, cycleId);
      setParticipantSelection(participants.map((participant) => participant.employeeId));
    } catch {
      setParticipantSelection([]);
    }
  };

  const handleSaveParticipants = async () => {
    if (!companyId || !participantsModalCycleId || participantSelection.length === 0) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await setReviewParticipants(companyId, participantsModalCycleId, participantSelection);
      setParticipantsModalCycleId(null);
      await loadData();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save participants');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLaunchCycle = async (cycleId: string) => {
    if (!companyId) return;
    setSubmitting(true);
    setError(null);
    try {
      await launchReviewCycle(companyId, cycleId);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to launch review cycle');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSelf = async () => {
    if (!selectedReview || !selfDraft) return;
    setSubmitting(true);
    setReviewMessage(null);
    try {
      await saveSelfAssessment(selectedReview.id, selfDraft);
      await refreshSelectedReview(selectedReview.id);
      setReviewMessage('Self assessment saved.');
    } catch (err) {
      setReviewMessage(err instanceof ApiError ? err.message : 'Failed to save self assessment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitSelf = async () => {
    if (!selectedReview) return;
    setSubmitting(true);
    setReviewMessage(null);
    try {
      if (selfDraft) await saveSelfAssessment(selectedReview.id, selfDraft);
      await submitSelfAssessment(selectedReview.id);
      await refreshSelectedReview(selectedReview.id);
      await loadData();
      setReviewMessage('Self assessment submitted to manager.');
    } catch (err) {
      setReviewMessage(err instanceof ApiError ? err.message : 'Failed to submit self assessment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveManager = async () => {
    if (!selectedReview || !managerDraft) return;
    setSubmitting(true);
    setReviewMessage(null);
    try {
      await saveManagerAssessment(selectedReview.id, managerDraft);
      await refreshSelectedReview(selectedReview.id);
      setReviewMessage('Manager assessment saved.');
    } catch (err) {
      setReviewMessage(err instanceof ApiError ? err.message : 'Failed to save manager assessment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitManager = async () => {
    if (!selectedReview) return;
    setSubmitting(true);
    setReviewMessage(null);
    try {
      if (managerDraft) await saveManagerAssessment(selectedReview.id, managerDraft);
      await submitManagerAssessment(selectedReview.id);
      await refreshSelectedReview(selectedReview.id);
      await loadData();
      setReviewMessage('Manager assessment submitted for approval.');
    } catch (err) {
      setReviewMessage(err instanceof ApiError ? err.message : 'Failed to submit manager assessment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveReview = async () => {
    if (!selectedReview) return;
    setSubmitting(true);
    setReviewMessage(null);
    try {
      await approvePerformanceReview(selectedReview.id, workflowComment.trim() || undefined);
      await refreshSelectedReview(selectedReview.id);
      await loadData();
      setWorkflowComment('');
      setReviewMessage('Review approved.');
    } catch (err) {
      setReviewMessage(err instanceof ApiError ? err.message : 'Failed to approve review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectReview = async () => {
    if (!selectedReview) return;
    setSubmitting(true);
    setReviewMessage(null);
    try {
      await rejectPerformanceReview(selectedReview.id, workflowComment.trim() || undefined);
      await refreshSelectedReview(selectedReview.id);
      await loadData();
      setWorkflowComment('');
      setReviewMessage('Review returned to manager.');
    } catch (err) {
      setReviewMessage(err instanceof ApiError ? err.message : 'Failed to return review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvite360 = async () => {
    if (!selectedReview || !invite360EmployeeId) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await invite360Reviewers(selectedReview.id, [
        { employeeId: invite360EmployeeId, relationship: invite360Relationship },
      ]);
      setInvite360Modal(false);
      setInvite360EmployeeId('');
      await loadReviewExtras();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to invite reviewer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveOutcome = async () => {
    if (!selectedReview) return;
    setSubmitting(true);
    setReviewMessage(null);
    try {
      const updated = await saveReviewOutcome(selectedReview.id, {
        overallRating: overallRatingOverride ? Number(overallRatingOverride) : undefined,
        promotionRecommended,
        recommendedDesignationId: promotionRecommended ? promotionDesignationId : null,
        promotionRecommendationNote: promotionNote.trim() || null,
      });
      setReviews((current) => current.map((review) => (review.id === updated.id ? updated : review)));
      setReviewMessage('Review outcome saved.');
    } catch (err) {
      setReviewMessage(err instanceof ApiError ? err.message : 'Failed to save outcome');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitPromotion = async () => {
    if (!selectedReview) return;
    setSubmitting(true);
    setReviewMessage(null);
    try {
      await saveReviewOutcome(selectedReview.id, {
        overallRating: overallRatingOverride ? Number(overallRatingOverride) : undefined,
        promotionRecommended,
        recommendedDesignationId: promotionRecommended ? promotionDesignationId : null,
        promotionRecommendationNote: promotionNote.trim() || null,
      });
      const updated = await submitPromotionRecommendation(selectedReview.id);
      setReviews((current) => current.map((review) => (review.id === updated.id ? updated : review)));
      setReviewMessage('Promotion recommendation submitted to HR.');
    } catch (err) {
      setReviewMessage(err instanceof ApiError ? err.message : 'Failed to submit promotion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprovePromotion = async () => {
    if (!selectedReview) return;
    setSubmitting(true);
    try {
      const updated = await approvePromotionRecommendation(selectedReview.id);
      setReviews((current) => current.map((review) => (review.id === updated.id ? updated : review)));
      setReviewMessage('Promotion recommendation approved.');
    } catch (err) {
      setReviewMessage(err instanceof ApiError ? err.message : 'Failed to approve promotion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecutePromotion = async () => {
    if (!selectedReview) return;
    setSubmitting(true);
    try {
      const updated = await executePromotionFromReview(selectedReview.id, {
        effectiveDate: promotionEffectiveDate,
      });
      setReviews((current) => current.map((review) => (review.id === updated.id ? updated : review)));
      setReviewMessage('Promotion recorded as employee lifecycle event.');
      await loadData();
    } catch (err) {
      setReviewMessage(err instanceof ApiError ? err.message : 'Failed to execute promotion');
    } finally {
      setSubmitting(false);
    }
  };

  const updateSelfCompetency = (key: string, rating: number) => {
    setSelfDraft((current) =>
      current
        ? {
            ...current,
            competencies: current.competencies.map((item) =>
              item.key === key ? { ...item, selfRating: rating } : item,
            ),
          }
        : current,
    );
  };

  const updateManagerCompetency = (key: string, rating: number) => {
    setManagerDraft((current) =>
      current
        ? {
            ...current,
            competencies: current.competencies.map((item) =>
              item.key === key ? { ...item, managerRating: rating } : item,
            ),
          }
        : current,
    );
  };

  const updateSelfKpi = (kpiAssignmentId: string, rating: number) => {
    setSelfDraft((current) =>
      current
        ? {
            ...current,
            kpiAssessments: current.kpiAssessments.map((item) =>
              item.kpiAssignmentId === kpiAssignmentId ? { ...item, selfRating: rating } : item,
            ),
          }
        : current,
    );
  };

  const updateManagerKpi = (kpiAssignmentId: string, rating: number) => {
    setManagerDraft((current) =>
      current
        ? {
            ...current,
            kpiAssessments: current.kpiAssessments.map((item) =>
              item.kpiAssignmentId === kpiAssignmentId ? { ...item, managerRating: rating } : item,
            ),
          }
        : current,
    );
  };

  const canEditSelf =
    selectedReview &&
    ['not_started', 'self_assessment_draft', 'returned'].includes(selectedReview.status);
  const canEditManager =
    selectedReview &&
    ['self_submitted', 'manager_review', 'returned'].includes(selectedReview.status);
  const canWorkflowAction = selectedReview?.status === 'pending_approval';

  const handleProgressUpdate = async (assignment: EmployeeKpiAssignmentRecord, value: string) => {
    const currentValue = Number(value);
    if (Number.isNaN(currentValue)) return;
    try {
      await updateKpiAssignment(assignment.id, { currentValue });
      await loadData();
    } catch {
      // silent — inline edit
    }
  };

  if (!companyId) {
    return (
      <div className="p-6 text-sm text-secondary">Select a company to manage performance.</div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-accent-600"><Sparkles className="h-3.5 w-3.5" /> Talent intelligence</div>
          <h1 className="text-xl font-bold text-primary">Performance Management</h1>
          <p className="mt-1 text-sm text-secondary">Define KPIs, assign goals to employees, and align measurement to review cycles.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setKpiModal(true)}><Plus className="h-4 w-4" /> Define KPI</Button>
          <Button variant="secondary" onClick={() => setAssignModal(true)}><Users className="h-4 w-4" /> Assign KPI</Button>
          <Button onClick={() => setCycleModal(true)}><Plus className="h-4 w-4" /> Review cycle</Button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-950/40 dark:text-danger-300">{error}</div>
      )}

      <nav className="surface flex gap-1 overflow-x-auto rounded-xl border border-base p-1.5 shadow-card scrollbar-thin" aria-label="Performance sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                view === tab.id ? 'bg-accent-600 text-white shadow-sm' : 'text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'
              }`}
            >
              <Icon className="h-4 w-4" /> {tab.label}
            </button>
          );
        })}
      </nav>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-secondary">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading performance data…
        </div>
      ) : view === 'goals' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Overall progress', `${overall}%`, TrendingUp, activeCycle ? `${activeCycle.name}` : 'No active cycle'],
              ['Goals on track', `${onTrackCount} / ${assignments.length}`, Target, atRiskCount > 0 ? `${atRiskCount} need attention` : 'All goals on track'],
              ['KPI library', `${definitions.filter((d) => d.isActive).length}`, Clock3, `${summary?.kpiDefinitionCount ?? definitions.length} definitions`],
            ].map(([label, value, Icon, detail]) => (
              <section key={String(label)} className="surface rounded-xl border border-base p-4 shadow-card">
                <div className="flex items-start justify-between">
                  <div><p className="text-xs font-medium text-secondary">{String(label)}</p><p className="mt-2 text-2xl font-bold text-primary">{String(value)}</p></div>
                  <div className="rounded-lg bg-accent-50 p-2 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400"><Icon className="h-5 w-5" /></div>
                </div>
                <p className="mt-2 text-xs text-muted">{String(detail)}</p>
              </section>
            ))}
          </div>

          <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
            <div className="flex items-center justify-between border-b border-base px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-primary">Employee KPI assignments</h2>
                <p className="mt-0.5 text-xs text-secondary">
                  {activeCycle
                    ? `Tied to ${activeCycle.name} · ${MEASUREMENT_PERIOD_LABELS[activeCycle.measurementPeriod]} measurement`
                    : 'Assign KPIs to an active review cycle'}
                </p>
              </div>
              <Badge tone="accent">{assignments.length} active</Badge>
            </div>
            {assignments.length === 0 ? (
              <div className="p-8 text-center text-sm text-secondary">
                No KPI assignments yet. Define a KPI, create a review cycle, then assign goals to employees.
              </div>
            ) : (
              <div className="grid gap-px bg-[rgb(var(--border-base))] lg:grid-cols-2">
                {assignments.map((assignment) => {
                  const progress = assignment.progressPercent ?? 0;
                  return (
                    <article key={assignment.id} className="surface p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-primary">{assignment.title}</h3>
                          <p className="mt-1 text-xs text-secondary">
                            {assignment.employeeName} · {formatKpiMetric(assignment)}
                          </p>
                        </div>
                        <Badge tone={progress >= 65 ? 'success' : 'warning'}>{progress >= 65 ? 'On track' : 'At risk'}</Badge>
                      </div>
                      <div className="mt-4">
                        <div className="mb-1.5 flex justify-between text-xs"><span className="text-secondary">Progress</span><span className="font-semibold text-primary">{progress}%</span></div>
                        <div className="h-2 rounded-full bg-[rgb(var(--bg-muted))]"><div className="h-2 rounded-full bg-accent-600 transition-all" style={{ width: `${progress}%` }} /></div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-base pt-3 text-xs text-secondary">
                        <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Due {formatDisplayDate(assignment.measurementPeriodEnd)}</span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            className="h-8 w-24 text-xs"
                            defaultValue={assignment.currentValue ?? ''}
                            onBlur={(event) => void handleProgressUpdate(assignment, event.target.value)}
                            aria-label={`Update current value for ${assignment.title}`}
                          />
                          <span className="font-medium text-accent-600">{assignment.reviewCycleName}<ArrowUpRight className="ml-0.5 inline h-3 w-3" /></span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
            <div className="border-b border-base px-5 py-4">
              <h2 className="text-sm font-semibold text-primary">KPI library</h2>
              <p className="mt-0.5 text-xs text-secondary">Admin and manager-defined KPI templates assignable to employees.</p>
            </div>
            <div className="divide-y divide-[rgb(var(--border-base))]">
              {definitions.length === 0 ? (
                <div className="p-6 text-sm text-secondary">No KPI definitions yet.</div>
              ) : (
                definitions.map((definition) => (
                  <div key={definition.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium text-primary">{definition.name}</div>
                      <div className="mt-1 text-xs text-secondary">
                        {definition.category ?? 'General'} · {KPI_UNIT_LABELS[definition.unit]} · {KPI_DIRECTION_LABELS[definition.direction]}
                        {definition.defaultTargetValue != null ? ` · Target ${definition.defaultTargetValue}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={definition.isActive ? 'success' : 'neutral'}>{definition.isActive ? 'Active' : 'Inactive'}</Badge>
                      <span className="text-xs text-muted">{definition.assignmentCount} assigned</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {!loading && view === 'cycles' && (
        <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
          <div className="border-b border-base px-5 py-4">
            <h2 className="text-sm font-semibold text-primary">Review cycles</h2>
            <p className="mt-0.5 text-xs text-secondary">
              Define evaluation periods, add participating employees, then launch to create review forms with KPI snapshots.
            </p>
          </div>
          {cycles.length === 0 ? (
            <div className="p-8 text-center text-sm text-secondary">No review cycles yet. Create one to start assigning KPIs and reviews.</div>
          ) : (
            <div className="divide-y divide-[rgb(var(--border-base))]">
              {cycles.map((cycle) => {
                const kpiPercent = cycle.assignmentCount > 0
                  ? Math.round((cycle.completedAssignmentCount / cycle.assignmentCount) * 100)
                  : 0;
                const reviewPercent = cycle.reviewCount > 0
                  ? Math.round((cycle.completedReviewCount / cycle.reviewCount) * 100)
                  : 0;
                const launched = Boolean(cycle.launchedAt);
                return (
                  <div
                    key={cycle.id}
                    className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_140px_180px_180px_auto] md:items-center"
                  >
                    <div>
                      <div className="font-medium text-primary">{cycle.name}</div>
                      <div className="mt-1 text-xs text-secondary">
                        {formatDisplayDate(cycle.periodStart)} – {formatDisplayDate(cycle.periodEnd)} · {MEASUREMENT_PERIOD_LABELS[cycle.measurementPeriod]}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone={cycleStatusTone(cycle.status)} dot>{REVIEW_CYCLE_STATUS_LABELS[cycle.status]}</Badge>
                        {cycle.requiresWorkflowApproval && <Badge tone="info">Workflow sign-off</Badge>}
                        {launched && <Badge tone="success">Launched {formatDisplayDate(cycle.launchedAt!.slice(0, 10))}</Badge>}
                      </div>
                    </div>
                    <div className="text-xs text-secondary">
                      <div className="font-medium text-primary">{cycle.participantCount} participants</div>
                      <div className="mt-1">{cycle.reviewCount} reviews</div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-secondary"><span>KPI progress</span><span>{kpiPercent}%</span></div>
                      <div className="h-1.5 rounded-full bg-[rgb(var(--bg-muted))]"><div className="h-1.5 rounded-full bg-accent-600" style={{ width: `${kpiPercent}%` }} /></div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-secondary"><span>Reviews complete</span><span>{reviewPercent}%</span></div>
                      <div className="h-1.5 rounded-full bg-[rgb(var(--bg-muted))]"><div className="h-1.5 rounded-full bg-success-600" style={{ width: `${reviewPercent}%` }} /></div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={() => void openParticipantsModal(cycle.id)} disabled={launched}>
                        <Users className="h-3.5 w-3.5" /> Participants
                      </Button>
                      <Button size="sm" onClick={() => void handleLaunchCycle(cycle.id)} disabled={submitting || launched || cycle.participantCount === 0}>
                        <ClipboardCheck className="h-3.5 w-3.5" /> Launch
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {!loading && view === 'review' && (
        <div className="space-y-5">
          {reviews.length === 0 ? (
            <div className="surface rounded-xl border border-base p-8 text-center text-sm text-secondary">
              No performance reviews yet. Add participants to a cycle and launch it to create review forms.
            </div>
          ) : (
            <>
              <section className="surface flex flex-col gap-4 rounded-xl border border-base p-5 shadow-card lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-[220px]">
                    <Label>Select review</Label>
                    <Select
                      value={selectedReview?.id ?? ''}
                      onChange={(event) => setSelectedReviewId(event.target.value)}
                    >
                      {reviews.map((review) => (
                        <option key={review.id} value={review.id}>
                          {review.employeeName} · {review.reviewCycleName}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {selectedReview && (
                    <div className="flex items-center gap-3">
                      <Avatar name={selectedReview.employeeName} size="lg" />
                      <div>
                        <h2 className="text-sm font-semibold text-primary">
                          {selectedReview.employeeName} · {selectedReview.reviewCycleName}
                        </h2>
                        <p className="mt-0.5 text-xs text-secondary">
                          {selectedReview.employeeNumber}
                          {selectedReview.managerName ? ` · Manager: ${selectedReview.managerName}` : ''}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                {selectedReview && (
                  <div className="flex items-center gap-2">
                    <Badge tone={reviewStatusTone(selectedReview.status)} dot>
                      {REVIEW_STATUS_LABELS[selectedReview.status]}
                    </Badge>
                    {selectedReview.workflowInstanceId && (
                      <Badge tone="info">Workflow active</Badge>
                    )}
                  </div>
                )}
              </section>

              {selectedReview && selfDraft && managerDraft && (
                <>
                  <div className="grid gap-5 xl:grid-cols-2">
                    <section className="surface rounded-xl border border-base shadow-card">
                      <div className="border-b border-base px-5 py-4">
                        <h3 className="text-sm font-semibold text-primary">Self assessment</h3>
                        <p className="mt-0.5 text-xs text-secondary">
                          {selectedReview.selfSubmittedAt
                            ? `Submitted ${formatDisplayDate(selectedReview.selfSubmittedAt.slice(0, 10))}`
                            : canEditSelf
                              ? 'Draft · Employee completes competencies and KPI ratings'
                              : 'Read-only'}
                        </p>
                      </div>
                      <div className="divide-y divide-[rgb(var(--border-base))]">
                        {selfDraft.competencies.map((competency) => (
                          <div key={competency.key} className="p-5">
                            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                              <div className="max-w-sm">
                                <div className="text-sm font-medium text-primary">{competency.label}</div>
                                <p className="mt-1 text-xs leading-5 text-secondary">
                                  {competencyDetails[competency.key] ?? ''}
                                </p>
                              </div>
                              <Rating
                                label={`Self: ${competency.label}`}
                                value={competency.selfRating ?? 0}
                                disabled={!canEditSelf}
                                onChange={(rating) => updateSelfCompetency(competency.key, rating)}
                              />
                            </div>
                          </div>
                        ))}
                        {selfDraft.kpiAssessments.length > 0 && (
                          <div className="border-t border-base bg-[rgb(var(--bg-muted))]/30 p-5">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-secondary">KPI goals (§25.1)</h4>
                            <div className="mt-3 space-y-4">
                              {selfDraft.kpiAssessments.map((kpi) => (
                                <div key={kpi.kpiAssignmentId} className="rounded-lg border border-base p-4">
                                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                                    <div>
                                      <div className="text-sm font-medium text-primary">{kpi.title}</div>
                                      <p className="mt-1 text-xs text-secondary">
                                        {kpi.currentValue ?? 0} / {kpi.targetValue} · {kpi.progressPercent ?? 0}% progress
                                      </p>
                                    </div>
                                    <Rating
                                      label={`Self KPI: ${kpi.title}`}
                                      value={kpi.selfRating ?? 0}
                                      disabled={!canEditSelf}
                                      onChange={(rating) => updateSelfKpi(kpi.kpiAssignmentId, rating)}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="border-t border-base p-5">
                        <Label>Overall comments</Label>
                        <Textarea
                          rows={3}
                          value={selfDraft.overallSelfComment ?? ''}
                          disabled={!canEditSelf}
                          onChange={(event) =>
                            setSelfDraft((current) =>
                              current ? { ...current, overallSelfComment: event.target.value } : current,
                            )
                          }
                        />
                      </div>
                    </section>

                    <section className="surface rounded-xl border border-base shadow-card">
                      <div className="border-b border-base px-5 py-4">
                        <h3 className="text-sm font-semibold text-primary">Manager assessment</h3>
                        <p className="mt-0.5 text-xs text-secondary">
                          {selectedReview.managerSubmittedAt
                            ? `Submitted ${formatDisplayDate(selectedReview.managerSubmittedAt.slice(0, 10))}`
                            : canEditManager
                              ? 'Draft · Manager rates competencies and KPI achievement'
                              : 'Awaiting self assessment or read-only'}
                        </p>
                      </div>
                      <div className="divide-y divide-[rgb(var(--border-base))]">
                        {managerDraft.competencies.map((competency) => (
                          <div key={competency.key} className="p-5">
                            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                              <div className="max-w-sm">
                                <div className="text-sm font-medium text-primary">{competency.label}</div>
                                <p className="mt-1 text-xs leading-5 text-secondary">
                                  {competencyDetails[competency.key] ?? ''}
                                </p>
                              </div>
                              <Rating
                                label={`Manager: ${competency.label}`}
                                value={competency.managerRating ?? 0}
                                disabled={!canEditManager}
                                onChange={(rating) => updateManagerCompetency(competency.key, rating)}
                              />
                            </div>
                          </div>
                        ))}
                        {managerDraft.kpiAssessments.length > 0 && (
                          <div className="border-t border-base bg-[rgb(var(--bg-muted))]/30 p-5">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-secondary">KPI goals (§25.1)</h4>
                            <div className="mt-3 space-y-4">
                              {managerDraft.kpiAssessments.map((kpi) => (
                                <div key={kpi.kpiAssignmentId} className="rounded-lg border border-base p-4">
                                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                                    <div>
                                      <div className="text-sm font-medium text-primary">{kpi.title}</div>
                                      <p className="mt-1 text-xs text-secondary">
                                        {kpi.currentValue ?? 0} / {kpi.targetValue} · {kpi.progressPercent ?? 0}% progress
                                      </p>
                                    </div>
                                    <Rating
                                      label={`Manager KPI: ${kpi.title}`}
                                      value={kpi.managerRating ?? 0}
                                      disabled={!canEditManager}
                                      onChange={(rating) => updateManagerKpi(kpi.kpiAssignmentId, rating)}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="border-t border-base p-5">
                        <Label>Overall comments</Label>
                        <Textarea
                          rows={3}
                          value={managerDraft.overallManagerComment ?? ''}
                          disabled={!canEditManager}
                          onChange={(event) =>
                            setManagerDraft((current) =>
                              current ? { ...current, overallManagerComment: event.target.value } : current,
                            )
                          }
                        />
                      </div>
                    </section>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    {canEditSelf && (
                      <>
                        <Button variant="secondary" onClick={() => void handleSaveSelf()} disabled={submitting}>
                          Save self draft
                        </Button>
                        <Button onClick={() => void handleSubmitSelf()} disabled={submitting}>
                          <Check className="h-4 w-4" /> Submit self assessment
                        </Button>
                      </>
                    )}
                    {canEditManager && (
                      <>
                        <Button variant="secondary" onClick={() => void handleSaveManager()} disabled={submitting}>
                          Save manager draft
                        </Button>
                        <Button onClick={() => void handleSubmitManager()} disabled={submitting}>
                          <Check className="h-4 w-4" /> Submit manager review
                        </Button>
                      </>
                    )}
                  </div>

                  {canWorkflowAction && (
                    <section className="surface rounded-xl border border-base p-5 shadow-card">
                      <h3 className="text-sm font-semibold text-primary">Approval sign-off chain</h3>
                      <p className="mt-1 text-xs text-secondary">
                        Manager → Skip-level manager → HR Admin (via Approval Workflow Engine when enabled on the cycle).
                      </p>
                      <div className="mt-4">
                        <Label>Sign-off comment</Label>
                        <Textarea
                          rows={2}
                          value={workflowComment}
                          onChange={(event) => setWorkflowComment(event.target.value)}
                          placeholder="Optional comment for this approval step"
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => void handleRejectReview()} disabled={submitting}>
                          <RotateCcw className="h-4 w-4" /> Return
                        </Button>
                        <Button onClick={() => void handleApproveReview()} disabled={submitting}>
                          <Check className="h-4 w-4" /> Approve
                        </Button>
                      </div>
                    </section>
                  )}

                  {selectedReview.returnReason && (
                    <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800 dark:border-warning-800 dark:bg-warning-950/40 dark:text-warning-200">
                      Returned: {selectedReview.returnReason}
                    </div>
                  )}

                  {reviewMessage && (
                    <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-800 dark:bg-success-950/40 dark:text-success-300">
                      {reviewMessage}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {!loading && view === 'feedback' && (
        <div className="space-y-5">
          {reviews.length === 0 ? (
            <div className="surface rounded-xl border border-base p-8 text-center text-sm text-secondary">
              Launch a review cycle to collect 360° feedback alongside manager assessments.
            </div>
          ) : (
            <>
              <section className="surface flex flex-col gap-4 rounded-xl border border-base p-5 shadow-card lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-[220px]">
                  <Label>Select review</Label>
                  <Select value={selectedReview?.id ?? ''} onChange={(event) => setSelectedReviewId(event.target.value)}>
                    {reviews.map((review) => (
                      <option key={review.id} value={review.id}>
                        {review.employeeName} · {review.reviewCycleName}
                      </option>
                    ))}
                  </Select>
                </div>
                {selectedReview && (
                  <Button variant="secondary" onClick={() => setInvite360Modal(true)}>
                    <Users className="h-4 w-4" /> Invite reviewers
                  </Button>
                )}
              </section>

              {selectedReview && (
                <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
                  <section className="surface rounded-xl border border-base p-5 shadow-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-primary">Competency signal</h2>
                        <p className="mt-1 text-xs text-secondary">
                          {summary360?.responseCount ?? 0} responses · {summary360?.invitedCount ?? 0} invited
                        </p>
                      </div>
                      {summary360?.averageRating != null && (
                        <Badge tone="accent">{summary360.averageRating.toFixed(1)} avg</Badge>
                      )}
                    </div>
                    <RadarChart summary={summary360} />
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {summary360?.competencyAverages
                        .filter((item) => item.averageRating != null)
                        .sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0))
                        .slice(0, 2)
                        .map((item, index) => (
                          <div key={item.key} className="surface-muted rounded-lg p-3">
                            <span className="text-secondary">{index === 0 ? 'Highest' : 'Opportunity'}</span>
                            <div className="mt-1 font-semibold text-primary">
                              {item.label} · {(item.averageRating ?? 0).toFixed(1)}
                            </div>
                          </div>
                        ))}
                    </div>
                  </section>

                  <section className="surface rounded-xl border border-base shadow-card">
                    <div className="border-b border-base px-5 py-4">
                      <h2 className="text-sm font-semibold text-primary">Feedback themes</h2>
                      <p className="mt-0.5 text-xs text-secondary">Comments are anonymized and grouped by relationship.</p>
                    </div>
                    <div className="space-y-5 p-5">
                      {(['peer', 'direct_report', 'cross_functional'] as const).map((relationship) => {
                        const bucket = summary360?.byRelationship[relationship];
                        if (!bucket || bucket.responseCount === 0) return null;
                        const tone =
                          relationship === 'peer' ? 'accent' : relationship === 'direct_report' ? 'success' : 'info';
                        return (
                          <div key={relationship}>
                            <Badge tone={tone}>
                              {FEEDBACK_360_RELATIONSHIP_LABELS[relationship]} · {bucket.responseCount} responses
                              {bucket.averageRating != null ? ` · ${bucket.averageRating.toFixed(1)} avg` : ''}
                            </Badge>
                            <div className="mt-2 space-y-2">
                              {bucket.comments.length === 0 ? (
                                <p className="text-xs text-muted">Ratings submitted without written comments.</p>
                              ) : (
                                bucket.comments.map((comment) => (
                                  <blockquote key={comment} className="flex gap-3 rounded-lg border border-base p-3 text-sm leading-6 text-secondary">
                                    <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
                                    {comment}
                                  </blockquote>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {feedback360.length === 0 && (
                        <p className="text-sm text-secondary">No 360° reviewers invited yet.</p>
                      )}
                      {feedback360.length > 0 && (summary360?.responseCount ?? 0) === 0 && (
                        <p className="text-sm text-secondary">Awaiting submitted feedback from invited reviewers.</p>
                      )}
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!loading && view === 'promotion' && (
        <div className="space-y-5">
          {reviews.length === 0 ? (
            <div className="surface rounded-xl border border-base p-8 text-center text-sm text-secondary">
              Complete a performance review to set overall ratings and promotion recommendations.
            </div>
          ) : (
            <>
              <section className="surface rounded-xl border border-base p-5 shadow-card">
                <Label>Select review</Label>
                <Select value={selectedReview?.id ?? ''} onChange={(event) => setSelectedReviewId(event.target.value)} className="mt-1 max-w-md">
                  {reviews.map((review) => (
                    <option key={review.id} value={review.id}>
                      {review.employeeName} · {review.reviewCycleName}
                    </option>
                  ))}
                </Select>
              </section>

              {selectedReview && (
                <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
                  <section className="surface rounded-xl border border-base shadow-card">
                    <div className="flex flex-col gap-4 border-b border-base p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar name={selectedReview.employeeName} size="lg" />
                        <div>
                          <h2 className="text-base font-semibold text-primary">{selectedReview.employeeName}</h2>
                          <p className="text-sm text-secondary">
                            {selectedReview.recommendedDesignationName
                              ? `Recommend → ${selectedReview.recommendedDesignationName}`
                              : selectedReview.reviewCycleName}
                          </p>
                        </div>
                      </div>
                      <Badge tone="warning" dot>
                        {PROMOTION_STATUS_LABELS[selectedReview.promotionRecommendationStatus]}
                      </Badge>
                    </div>
                    <div className="grid gap-4 p-5 sm:grid-cols-4">
                      {[
                        ['Overall rating', selectedReview.overallRating?.toFixed(1) ?? '—'],
                        ['Rating band', selectedReview.overallRatingLabel ? OVERALL_RATING_LABELS[selectedReview.overallRatingLabel] : '—'],
                        ['360 avg', summary360?.averageRating?.toFixed(1) ?? '—'],
                        ['Review status', REVIEW_STATUS_LABELS[selectedReview.status]],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="surface-muted rounded-lg p-3">
                          <div className="text-[11px] uppercase tracking-wide text-muted">{String(label)}</div>
                          <div className="mt-1 text-sm font-semibold text-primary">{String(value)}</div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-base p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-primary">Performance history</h3>
                          <p className="text-xs text-secondary">Ratings from completed cycles (lifecycle-linked)</p>
                        </div>
                        <TrendingUp className="h-4 w-4 text-success-600" />
                      </div>
                      {performanceHistory.length === 0 ? (
                        <p className="text-sm text-secondary">No approved ratings recorded yet.</p>
                      ) : (
                        <svg viewBox="0 0 620 150" className="h-40 w-full" aria-label="Performance rating history chart">
                          {[30, 65, 100, 135].map((y) => (
                            <line key={y} x1="30" y1={y} x2="600" y2={y} stroke="rgb(var(--border-base))" />
                          ))}
                          <polyline
                            points={performanceHistory
                              .map((point, index) => {
                                const x = 55 + index * (545 / Math.max(performanceHistory.length - 1, 1));
                                const y = 130 - ((point.overallRating ?? 0) / 5) * 100;
                                return `${x},${y}`;
                              })
                              .join(' ')}
                            fill="none"
                            stroke="rgb(37 99 235)"
                            strokeWidth="3"
                          />
                          {performanceHistory.map((point, index) => {
                            const x = 55 + index * (545 / Math.max(performanceHistory.length - 1, 1));
                            const y = 130 - ((point.overallRating ?? 0) / 5) * 100;
                            return (
                              <g key={point.reviewCycleName}>
                                <circle cx={x} cy={y} r="5" fill="rgb(37 99 235)" />
                                <text x={x} y="148" textAnchor="middle" className="fill-[rgb(var(--text-secondary))] text-[10px]">
                                  {point.reviewCycleName.replace(' Performance Review', '').replace(' Review', '')}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      )}
                      {selectedReview.performanceLifecycleEventId && (
                        <p className="mt-3 text-xs text-success-600">
                          Linked to employee lifecycle event {selectedReview.performanceLifecycleEventId.slice(0, 8)}…
                        </p>
                      )}
                    </div>
                  </section>

                  <aside className="surface rounded-xl border border-base p-5 shadow-card">
                    <div className="flex items-center gap-2">
                      <UserRoundCheck className="h-5 w-5 text-accent-600" />
                      <h2 className="text-sm font-semibold text-primary">Promotion recommendation</h2>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-secondary">
                      Manager outcome feeds HR review; approved recommendations can become promotion lifecycle events.
                    </p>

                    <div className="mt-4 space-y-3">
                      <div>
                        <Label>Overall rating override (1–5)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          step={0.1}
                          value={overallRatingOverride}
                          onChange={(event) => setOverallRatingOverride(event.target.value)}
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={promotionRecommended}
                          onChange={(event) => setPromotionRecommended(event.target.checked)}
                        />
                        Recommend for promotion
                      </label>
                      {promotionRecommended && (
                        <div>
                          <Label>Target designation</Label>
                          <Select
                            value={promotionDesignationId}
                            onChange={(event) => setPromotionDesignationId(event.target.value)}
                          >
                            <option value="">Select designation…</option>
                            {designations.map((designation) => (
                              <option key={designation.id} value={designation.id}>
                                {designation.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                      )}
                      <div>
                        <Label>Committee note</Label>
                        <Textarea rows={5} value={promotionNote} onChange={(event) => setPromotionNote(event.target.value)} />
                      </div>
                      {selectedReview.promotionRecommendationStatus === 'approved' && (
                        <div>
                          <Label>Promotion effective date</Label>
                          <Input type="date" value={promotionEffectiveDate} onChange={(event) => setPromotionEffectiveDate(event.target.value)} />
                        </div>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button variant="secondary" onClick={() => void handleSaveOutcome()} disabled={submitting}>
                        Save outcome
                      </Button>
                      <Button onClick={() => void handleSubmitPromotion()} disabled={submitting || !promotionRecommended}>
                        Submit
                      </Button>
                      <Button variant="secondary" onClick={() => void handleApprovePromotion()} disabled={submitting}>
                        HR approve
                      </Button>
                      <Button onClick={() => void handleExecutePromotion()} disabled={submitting || selectedReview.promotionRecommendationStatus !== 'approved'}>
                        Execute promotion
                      </Button>
                    </div>

                    {reviewMessage && (
                      <p className="mt-3 text-center text-xs font-medium text-secondary">{reviewMessage}</p>
                    )}
                  </aside>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <Modal open={kpiModal} onClose={() => setKpiModal(false)} title="Define KPI" description="Create a reusable KPI template for employee goal assignment." size="lg" footer={<><Button variant="secondary" onClick={() => setKpiModal(false)}>Cancel</Button><Button onClick={() => void handleCreateKpi()} disabled={submitting}>{submitting ? 'Saving…' : 'Create KPI'}</Button></>}>
        {formError && <p className="mb-3 text-sm text-danger-600">{formError}</p>}
        <div className="space-y-4">
          <div><Label htmlFor="kpi-name">KPI name</Label><Input id="kpi-name" value={kpiName} onChange={(e) => setKpiName(e.target.value)} placeholder="e.g. Enterprise activation rate" /></div>
          <div><Label htmlFor="kpi-desc">Description</Label><Textarea id="kpi-desc" rows={2} value={kpiDescription} onChange={(e) => setKpiDescription(e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Category</Label><Input value={kpiCategory} onChange={(e) => setKpiCategory(e.target.value)} placeholder="Growth" /></div>
            <div><Label>Default target</Label><Input type="number" value={kpiDefaultTarget} onChange={(e) => setKpiDefaultTarget(e.target.value)} placeholder="80" /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Unit</Label><Select value={kpiUnit} onChange={(e) => setKpiUnit(e.target.value as KpiUnit)}>{Object.entries(KPI_UNIT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
            <div><Label>Direction</Label><Select value={kpiDirection} onChange={(e) => setKpiDirection(e.target.value as KpiDirection)}>{Object.entries(KPI_DIRECTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
          </div>
        </div>
      </Modal>

      <Modal open={assignModal} onClose={() => setAssignModal(false)} title="Assign KPI to employees" description="Link a KPI definition to employees for the selected review cycle." size="lg" footer={<><Button variant="secondary" onClick={() => setAssignModal(false)}>Cancel</Button><Button onClick={() => void handleAssignKpi()} disabled={submitting}>{submitting ? 'Assigning…' : 'Assign KPI'}</Button></>}>
        {formError && <p className="mb-3 text-sm text-danger-600">{formError}</p>}
        <div className="space-y-4">
          <div><Label>Review cycle</Label><Select value={assignCycleId} onChange={(e) => setAssignCycleId(e.target.value)}>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</Select></div>
          <div><Label>KPI definition</Label><Select value={assignDefinitionId} onChange={(e) => setAssignDefinitionId(e.target.value)}><option value="">Select KPI…</option>{definitions.filter((d) => d.isActive).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></div>
          <div><Label>Target value (optional override)</Label><Input type="number" value={assignTarget} onChange={(e) => setAssignTarget(e.target.value)} placeholder="Uses KPI default if blank" /></div>
          <div>
            <Label>Employees</Label>
            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-base p-3">
              {employees.map((employee) => (
                <label key={employee.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={assignEmployeeIds.includes(employee.id)}
                    onChange={(event) => {
                      setAssignEmployeeIds((current) =>
                        event.target.checked
                          ? [...current, employee.id]
                          : current.filter((id) => id !== employee.id),
                      );
                    }}
                  />
                  {employee.firstName} {employee.lastName} ({employee.employeeNumber})
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={cycleModal} onClose={() => setCycleModal(false)} title="Create review cycle" description="Define a company review period that KPI measurement windows align to." size="lg" footer={<><Button variant="secondary" onClick={() => setCycleModal(false)}>Cancel</Button><Button onClick={() => void handleCreateCycle()} disabled={submitting}>{submitting ? 'Creating…' : 'Create cycle'}</Button></>}>
        {formError && <p className="mb-3 text-sm text-danger-600">{formError}</p>}
        <div className="space-y-4">
          <div><Label>Cycle name</Label><Input value={cycleName} onChange={(e) => setCycleName(e.target.value)} placeholder="H2 2026 Performance Review" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Period start</Label><Input type="date" value={cyclePeriodStart} onChange={(e) => setCyclePeriodStart(e.target.value)} /></div>
            <div><Label>Period end</Label><Input type="date" value={cyclePeriodEnd} onChange={(e) => setCyclePeriodEnd(e.target.value)} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Measurement period</Label><Select value={cycleMeasurementPeriod} onChange={(e) => setCycleMeasurementPeriod(e.target.value as KpiMeasurementPeriod)}>{Object.entries(MEASUREMENT_PERIOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
            <div><Label>Review due date</Label><Input type="date" value={cycleReviewDue} onChange={(e) => setCycleReviewDue(e.target.value)} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input type="checkbox" checked={cycleRequiresWorkflow} onChange={(event) => setCycleRequiresWorkflow(event.target.checked)} />
            Require approval workflow (Manager → Skip-level → HR)
          </label>
        </div>
      </Modal>

      <Modal
        open={participantsModalCycleId != null}
        onClose={() => setParticipantsModalCycleId(null)}
        title="Review cycle participants"
        description="Select employees who will receive self and manager assessment forms when the cycle is launched."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setParticipantsModalCycleId(null)}>Cancel</Button>
            <Button onClick={() => void handleSaveParticipants()} disabled={submitting || participantSelection.length === 0}>
              {submitting ? 'Saving…' : 'Save participants'}
            </Button>
          </>
        }
      >
        {formError && <p className="mb-3 text-sm text-danger-600">{formError}</p>}
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-base p-3">
          {employees.map((employee) => (
            <label key={employee.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={participantSelection.includes(employee.id)}
                onChange={(event) => {
                  setParticipantSelection((current) =>
                    event.target.checked
                      ? [...current, employee.id]
                      : current.filter((id) => id !== employee.id),
                  );
                }}
              />
              {employee.firstName} {employee.lastName} ({employee.employeeNumber})
            </label>
          ))}
        </div>
      </Modal>

      <Modal
        open={invite360Modal}
        onClose={() => setInvite360Modal(false)}
        title="Invite 360° reviewers"
        description="Peers, direct reports, and cross-functional partners provide anonymized competency input."
        footer={
          <>
            <Button variant="secondary" onClick={() => setInvite360Modal(false)}>Cancel</Button>
            <Button onClick={() => void handleInvite360()} disabled={submitting || !invite360EmployeeId}>
              {submitting ? 'Inviting…' : 'Send invitation'}
            </Button>
          </>
        }
      >
        {formError && <p className="mb-3 text-sm text-danger-600">{formError}</p>}
        <div className="space-y-4">
          <div>
            <Label>Reviewer</Label>
            <Select value={invite360EmployeeId} onChange={(event) => setInvite360EmployeeId(event.target.value)}>
              <option value="">Select employee…</option>
              {employees
                .filter((employee) => employee.id !== selectedReview?.employeeId)
                .map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label>Relationship</Label>
            <Select
              value={invite360Relationship}
              onChange={(event) =>
                setInvite360Relationship(event.target.value as typeof invite360Relationship)
              }
            >
              {Object.entries(FEEDBACK_360_RELATIONSHIP_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
