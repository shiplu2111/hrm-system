/** Performance management — KPI & goal setting (MODULES.md §25) */

export type PerformanceReviewCycleStatus =
  | 'draft'
  | 'active'
  | 'closed'
  | 'archived';

export type KpiMeasurementPeriod =
  | 'monthly'
  | 'quarterly'
  | 'semi_annual'
  | 'annual'
  | 'custom';

export type KpiUnit =
  | 'percentage'
  | 'count'
  | 'currency'
  | 'hours'
  | 'days'
  | 'score'
  | 'other';

export type KpiDirection = 'higher_is_better' | 'lower_is_better';

export type EmployeeKpiAssignmentStatus =
  | 'draft'
  | 'active'
  | 'completed'
  | 'cancelled';

export type EmployeePerformanceReviewStatus =
  | 'not_started'
  | 'self_assessment_draft'
  | 'self_submitted'
  | 'manager_review'
  | 'pending_approval'
  | 'approved'
  | 'returned'
  | 'cancelled';

export interface PerformanceReviewCycleRecord {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  periodStart: string;
  periodEnd: string;
  measurementPeriod: KpiMeasurementPeriod;
  reviewDueDate: string;
  status: PerformanceReviewCycleStatus;
  requiresWorkflowApproval: boolean;
  launchedAt: string | null;
  participantCount: number;
  reviewCount: number;
  completedReviewCount: number;
  assignmentCount: number;
  completedAssignmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceCompetencyAssessment {
  key: string;
  label: string;
  selfRating?: number | null;
  managerRating?: number | null;
  selfComment?: string | null;
  managerComment?: string | null;
}

export interface PerformanceKpiAssessmentItem {
  kpiAssignmentId: string;
  title: string;
  unit: KpiUnit;
  targetValue: number;
  currentValue: number | null;
  progressPercent: number | null;
  /** Absent on reviews launched before these fields were captured. */
  direction?: KpiDirection;
  weightPercent?: number | null;
  measurementPeriodStart?: string;
  measurementPeriodEnd?: string;
  goalStatus?: EmployeeKpiAssignmentStatus;
  selfRating?: number | null;
  selfComment?: string | null;
  managerRating?: number | null;
  managerComment?: string | null;
}

export interface PerformanceAssessmentPayload {
  competencies: PerformanceCompetencyAssessment[];
  kpiAssessments: PerformanceKpiAssessmentItem[];
  overallSelfComment?: string | null;
  overallManagerComment?: string | null;
}

export interface PerformanceReviewParticipantRecord {
  id: string;
  reviewCycleId: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  departmentName: string | null;
  managerEmployeeId: string | null;
  managerName: string | null;
  reviewId: string | null;
  reviewStatus: EmployeePerformanceReviewStatus | null;
  /** Active and completed KPI goals; these are what the review rates. */
  ratedKpiCount: number;
  /** Draft goals are left out of the review until they are activated. */
  draftKpiCount: number;
  kpiWeightTotal: number;
}

export interface EmployeePerformanceReviewRecord {
  id: string;
  companyId: string;
  reviewCycleId: string;
  reviewCycleName: string;
  reviewCycleStatus: PerformanceReviewCycleStatus;
  reviewDueDate: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  employeeDesignationId: string | null;
  employeeDesignationName: string | null;
  managerEmployeeId: string | null;
  managerName: string | null;
  status: EmployeePerformanceReviewStatus;
  feedback360InvitedCount: number;
  feedback360SubmittedCount: number;
  /** True while KPI items still follow the live goals (until the manager submits). */
  kpiItemsLive: boolean;
  selfAssessment: PerformanceAssessmentPayload;
  managerAssessment: PerformanceAssessmentPayload;
  selfSubmittedAt: string | null;
  managerSubmittedAt: string | null;
  approvedAt: string | null;
  returnedAt: string | null;
  returnReason: string | null;
  overallRating: number | null;
  overallRatingLabel: PerformanceOverallRatingLabel | null;
  performance360Summary: Performance360Summary | null;
  promotionRecommended: boolean;
  recommendedDesignationId: string | null;
  recommendedDesignationName: string | null;
  promotionRecommendationNote: string | null;
  promotionRecommendationStatus: PromotionRecommendationStatus;
  performanceLifecycleEventId: string | null;
  promotionLifecycleEventId: string | null;
  workflowInstanceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PerformanceOverallRatingLabel =
  | 'outstanding'
  | 'exceeds_expectations'
  | 'meets_expectations'
  | 'needs_improvement';

export type PromotionRecommendationStatus =
  | 'none'
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'executed';

export type Performance360Relationship = 'peer' | 'direct_report' | 'cross_functional';

export type Performance360FeedbackStatus = 'pending' | 'submitted';

/** An invitation as the manager or HR sees it: who was asked and whether they answered, never what they said. */
export interface Performance360RequestRecord {
  id: string;
  reviewId: string;
  reviewerEmployeeId: string;
  reviewerName: string;
  reviewerNumber: string;
  reviewerDepartmentName: string | null;
  relationship: Performance360Relationship;
  status: Performance360FeedbackStatus;
  submittedAt: string | null;
  createdAt: string;
}

export interface Performance360CompetencyRating {
  key: string;
  label: string;
  rating: number | null;
}

/** A feedback request as the reviewer (or HR entering it for them) sees it. */
export interface Performance360FeedbackRecord {
  id: string;
  reviewId: string;
  reviewCycleName: string;
  reviewDueDate: string;
  subjectEmployeeId: string;
  subjectName: string;
  subjectNumber: string;
  subjectDesignationName: string | null;
  reviewerEmployeeId: string;
  reviewerName: string;
  relationship: Performance360Relationship;
  status: Performance360FeedbackStatus;
  competencyRatings: Performance360CompetencyRating[];
  comment: string | null;
  isAnonymous: boolean;
  /** False once submitted, or when the review is finalised or its cycle is no longer active. */
  editable: boolean;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Performance360CompetencyAverage {
  key: string;
  label: string;
  averageRating: number | null;
}

export interface Performance360RelationshipSummary {
  responseCount: number;
  averageRating: number | null;
  /** True when the group has too few responses to show its average without identifying anyone. */
  hidden: boolean;
}

/** Responses needed before 360° results are shown, overall or for one relationship group. */
export const PERFORMANCE_360_MIN_RESPONSES = 2;

export interface Performance360Summary {
  responseCount: number;
  invitedCount: number;
  minResponses: number;
  /** False until enough responses are in; averages and comments stay empty until then. */
  visible: boolean;
  averageRating: number | null;
  competencyAverages: Performance360CompetencyAverage[];
  byRelationship: Record<Performance360Relationship, Performance360RelationshipSummary>;
  relationshipLabels: Record<Performance360Relationship, string>;
  /** Comments from every relationship, unattributed and sorted so order reveals nothing. */
  comments: string[];
}

export interface PerformanceHistoryPoint {
  reviewCycleName: string;
  overallRating: number | null;
  overallRatingLabel: PerformanceOverallRatingLabel | null;
  approvedAt: string | null;
}

export interface KpiDefinitionRecord {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: KpiUnit;
  direction: KpiDirection;
  defaultTargetValue: number | null;
  isActive: boolean;
  assignmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeKpiAssignmentRecord {
  id: string;
  companyId: string;
  reviewCycleId: string;
  reviewCycleName: string;
  kpiDefinitionId: string | null;
  kpiDefinitionName: string | null;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  title: string;
  description: string | null;
  unit: KpiUnit;
  direction: KpiDirection;
  targetValue: number;
  currentValue: number | null;
  progressPercent: number | null;
  measurementPeriod: KpiMeasurementPeriod;
  measurementPeriodStart: string;
  measurementPeriodEnd: string;
  weightPercent: number | null;
  status: EmployeeKpiAssignmentStatus;
  notes: string | null;
  lockState: KpiAssignmentLockState;
  createdAt: string;
  updatedAt: string;
}

/**
 * - `open`: every field is editable.
 * - `targets_locked`: the employee's review has launched, so only progress, notes and status can change.
 * - `cycle_locked`: the review cycle is closed or archived; the goal is read-only.
 */
export type KpiAssignmentLockState = 'open' | 'targets_locked' | 'cycle_locked';

export interface BulkAssignKpiSkippedItem {
  employeeId: string;
  employeeName: string;
  measurementPeriodStart: string;
  measurementPeriodEnd: string;
  reason: 'already_assigned';
}

export interface BulkAssignKpiResult {
  created: EmployeeKpiAssignmentRecord[];
  skipped: BulkAssignKpiSkippedItem[];
}

export interface PerformanceGoalsSummary {
  activeCycle: PerformanceReviewCycleRecord | null;
  kpiDefinitionCount: number;
  activeAssignmentCount: number;
  onTrackCount: number;
  atRiskCount: number;
  averageProgressPercent: number | null;
}

/** An employee's non-cancelled KPI weights within one review cycle may not exceed this. */
export const KPI_WEIGHT_LIMIT_PERCENT = 100;

/** Progress at or above this percentage counts as on track. */
export const KPI_ON_TRACK_PERCENT = 65;

export interface KpiMeasurementWindow {
  index: number;
  start: string;
  end: string;
  label: string;
  /** True when the window was clipped by the review cycle end. */
  partial: boolean;
}

const WINDOW_MONTHS: Record<Exclude<KpiMeasurementPeriod, 'custom'>, number> = {
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12,
};

const WINDOW_PREFIX: Record<Exclude<KpiMeasurementPeriod, 'custom'>, string> = {
  monthly: 'Month',
  quarterly: 'Q',
  semi_annual: 'H',
  annual: 'Year',
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateKey(value: string): Date | null {
  const match = DATE_KEY.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Adds months keeping the day of month, clamped to the target month's last day. */
function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
}

/** "1 Jul – 30 Sep 2026" (or with both years when the range crosses a year). */
export function formatKpiDateRange(start: string, end: string): string {
  const from = parseDateKey(start);
  const to = parseDateKey(end);
  if (!from || !to) return `${start} – ${end}`;
  const fromDay = `${from.getUTCDate()} ${MONTH_SHORT[from.getUTCMonth()]}`;
  const toLabel = `${to.getUTCDate()} ${MONTH_SHORT[to.getUTCMonth()]} ${to.getUTCFullYear()}`;
  return from.getUTCFullYear() === to.getUTCFullYear()
    ? `${fromDay} – ${toLabel}`
    : `${fromDay} ${from.getUTCFullYear()} – ${toLabel}`;
}

/**
 * Measurement windows of `period` length, stepped from the cycle start (so fiscal cycles get
 * fiscal quarters) and clipped to the cycle end. `custom` has no fixed windows.
 */
export function kpiMeasurementWindows(
  cycleStart: string,
  cycleEnd: string,
  period: KpiMeasurementPeriod,
): KpiMeasurementWindow[] {
  if (period === 'custom') return [];
  const start = parseDateKey(cycleStart);
  const end = parseDateKey(cycleEnd);
  if (!start || !end || start.getTime() > end.getTime()) return [];

  const months = WINDOW_MONTHS[period];
  const windows: KpiMeasurementWindow[] = [];
  for (let index = 0; index < 240; index += 1) {
    const windowStart = addMonthsClamped(start, index * months);
    if (windowStart.getTime() > end.getTime()) break;
    const fullEnd = new Date(addMonthsClamped(start, (index + 1) * months).getTime() - 86_400_000);
    const partial = fullEnd.getTime() > end.getTime();
    const windowEnd = partial ? end : fullEnd;
    const startKey = toDateKey(windowStart);
    const endKey = toDateKey(windowEnd);
    const prefix = WINDOW_PREFIX[period];
    const name =
      startKey === cycleStart && endKey === cycleEnd
        ? 'Full cycle'
        : prefix.length > 1
          ? `${prefix} ${index + 1}`
          : `${prefix}${index + 1}`;
    windows.push({
      index,
      start: startKey,
      end: endKey,
      label: `${name} · ${formatKpiDateRange(startKey, endKey)}`,
      partial,
    });
  }
  return windows;
}

export type PerformanceAssessmentSide = 'self' | 'manager';

/** Every competency and KPI is rated on this 1–5 scale. */
export const PERFORMANCE_RATING_SCALE: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: 'Well below expectations' },
  { value: 2, label: 'Below expectations' },
  { value: 3, label: 'Meets expectations' },
  { value: 4, label: 'Exceeds expectations' },
  { value: 5, label: 'Outstanding' },
];

/** Share of an assessment score that comes from competencies; KPI goals make up the rest. */
export const COMPETENCY_SCORE_SHARE = 0.6;

export interface PerformanceAssessmentCompletion {
  rated: number;
  total: number;
  /** Labels of competencies and KPI goals that still need a rating. */
  missing: string[];
}

function sideRating(
  item: { selfRating?: number | null; managerRating?: number | null },
  side: PerformanceAssessmentSide,
): number | null {
  return (side === 'self' ? item.selfRating : item.managerRating) ?? null;
}

export function assessmentCompletion(
  payload: PerformanceAssessmentPayload,
  side: PerformanceAssessmentSide,
): PerformanceAssessmentCompletion {
  const items = [
    ...payload.competencies.map((item) => ({ label: item.label, rating: sideRating(item, side) })),
    ...payload.kpiAssessments.map((item) => ({ label: item.title, rating: sideRating(item, side) })),
  ];
  const missing = items.filter((item) => item.rating == null).map((item) => item.label);
  return { rated: items.length - missing.length, total: items.length, missing };
}

/** KPI ratings weighted by goal weight when every rated goal has one; otherwise a plain average. */
export function kpiRatingAverage(
  items: PerformanceKpiAssessmentItem[],
  side: PerformanceAssessmentSide,
): number | null {
  const rated = items
    .map((item) => ({ rating: sideRating(item, side), weight: item.weightPercent ?? 0 }))
    .filter((item): item is { rating: number; weight: number } => item.rating != null);
  if (rated.length === 0) return null;
  const totalWeight = rated.reduce((sum, item) => sum + item.weight, 0);
  if (rated.every((item) => item.weight > 0)) {
    return rated.reduce((sum, item) => sum + item.rating * item.weight, 0) / totalWeight;
  }
  return rated.reduce((sum, item) => sum + item.rating, 0) / rated.length;
}

/** Competency average × 60% + KPI average × 40%, or whichever side has ratings. */
export function assessmentScore(
  payload: PerformanceAssessmentPayload,
  side: PerformanceAssessmentSide,
): number | null {
  const competencyRatings = payload.competencies
    .map((item) => sideRating(item, side))
    .filter((value): value is number => value != null);
  const competency =
    competencyRatings.length > 0
      ? competencyRatings.reduce((sum, value) => sum + value, 0) / competencyRatings.length
      : null;
  const kpi = kpiRatingAverage(payload.kpiAssessments, side);
  if (competency == null) return kpi;
  if (kpi == null) return competency;
  return competency * COMPETENCY_SCORE_SHARE + kpi * (1 - COMPETENCY_SCORE_SHARE);
}

/** Share of the overall rating from the manager assessment; 360° feedback makes up the rest. */
export const MANAGER_RATING_SHARE = 0.6;

export function roundRating(value: number): number {
  return Math.round(value * 100) / 100;
}

export function ratingLabelForScore(score: number): PerformanceOverallRatingLabel {
  if (score >= 4.5) return 'outstanding';
  if (score >= 3.5) return 'exceeds_expectations';
  if (score >= 2.5) return 'meets_expectations';
  return 'needs_improvement';
}

/** Manager score × 60% + 360° average × 40%, or whichever is available. */
export function combineOverallRating(
  managerScore: number | null,
  feedbackScore: number | null,
): number | null {
  if (managerScore != null && feedbackScore != null) {
    return roundRating(managerScore * MANAGER_RATING_SHARE + feedbackScore * (1 - MANAGER_RATING_SHARE));
  }
  const only = managerScore ?? feedbackScore;
  return only == null ? null : roundRating(only);
}

export function findKpiMeasurementWindow(
  cycleStart: string,
  cycleEnd: string,
  period: KpiMeasurementPeriod,
  start: string,
  end: string,
): KpiMeasurementWindow | null {
  return (
    kpiMeasurementWindows(cycleStart, cycleEnd, period).find(
      (window) => window.start === start && window.end === end,
    ) ?? null
  );
}
