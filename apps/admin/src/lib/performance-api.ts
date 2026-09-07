import type {
  EmployeeKpiAssignmentRecord,
  EmployeePerformanceReviewRecord,
  KpiDefinitionRecord,
  KpiDirection,
  KpiMeasurementPeriod,
  KpiUnit,
  Performance360FeedbackRecord,
  Performance360Relationship,
  Performance360Summary,
  PerformanceGoalsSummary,
  PerformanceHistoryPoint,
  PerformanceOverallRatingLabel,
  PerformanceReviewCycleRecord,
  PerformanceReviewCycleStatus,
  PerformanceReviewParticipantRecord,
  PromotionRecommendationStatus,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export const KPI_UNIT_LABELS: Record<KpiUnit, string> = {
  percentage: 'Percentage',
  count: 'Count',
  currency: 'Currency',
  hours: 'Hours',
  days: 'Days',
  score: 'Score',
  other: 'Other',
};

export const KPI_DIRECTION_LABELS: Record<KpiDirection, string> = {
  higher_is_better: 'Higher is better',
  lower_is_better: 'Lower is better',
};

export const MEASUREMENT_PERIOD_LABELS: Record<KpiMeasurementPeriod, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: 'Semi-annual',
  annual: 'Annual',
  custom: 'Custom',
};

export const REVIEW_CYCLE_STATUS_LABELS: Record<PerformanceReviewCycleStatus, string> = {
  draft: 'Draft',
  active: 'In progress',
  closed: 'Completed',
  archived: 'Archived',
};

export interface CreateReviewCycleInput {
  name: string;
  description?: string;
  periodStart: string;
  periodEnd: string;
  measurementPeriod: KpiMeasurementPeriod;
  reviewDueDate: string;
  status?: PerformanceReviewCycleStatus;
  requiresWorkflowApproval?: boolean;
}

export interface CreateKpiDefinitionInput {
  name: string;
  description?: string;
  category?: string;
  unit: KpiUnit;
  direction?: KpiDirection;
  defaultTargetValue?: number;
}

export interface CreateKpiAssignmentInput {
  reviewCycleId: string;
  kpiDefinitionId?: string;
  employeeId: string;
  title?: string;
  description?: string;
  targetValue: number;
  unit?: KpiUnit;
  direction?: KpiDirection;
  measurementPeriod?: KpiMeasurementPeriod;
  measurementPeriodStart?: string;
  measurementPeriodEnd?: string;
  weightPercent?: number;
  currentValue?: number;
  notes?: string;
}

export interface BulkAssignKpiInput {
  reviewCycleId: string;
  kpiDefinitionId: string;
  employeeIds: string[];
  targetValue?: number;
  measurementPeriodStart?: string;
  measurementPeriodEnd?: string;
  weightPercent?: number;
}

export function getPerformanceSummary(
  companyId: string,
): Promise<PerformanceGoalsSummary> {
  return tenantApiRequest<PerformanceGoalsSummary>(
    `/companies/${companyId}/performance/summary`,
  );
}

export function listReviewCycles(
  companyId: string,
): Promise<PerformanceReviewCycleRecord[]> {
  return tenantApiRequest<PerformanceReviewCycleRecord[]>(
    `/companies/${companyId}/performance/review-cycles`,
  );
}

export function createReviewCycle(
  companyId: string,
  input: CreateReviewCycleInput,
): Promise<PerformanceReviewCycleRecord> {
  return tenantApiRequest<PerformanceReviewCycleRecord>(
    `/companies/${companyId}/performance/review-cycles`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateReviewCycle(
  cycleId: string,
  input: Partial<CreateReviewCycleInput>,
): Promise<PerformanceReviewCycleRecord> {
  return tenantApiRequest<PerformanceReviewCycleRecord>(
    `/performance/review-cycles/${cycleId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function listKpiDefinitions(
  companyId: string,
  activeOnly = false,
): Promise<KpiDefinitionRecord[]> {
  const query = activeOnly ? '?activeOnly=true' : '';
  return tenantApiRequest<KpiDefinitionRecord[]>(
    `/companies/${companyId}/performance/kpi-definitions${query}`,
  );
}

export function createKpiDefinition(
  companyId: string,
  input: CreateKpiDefinitionInput,
): Promise<KpiDefinitionRecord> {
  return tenantApiRequest<KpiDefinitionRecord>(
    `/companies/${companyId}/performance/kpi-definitions`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateKpiDefinition(
  definitionId: string,
  input: Partial<CreateKpiDefinitionInput & { isActive: boolean }>,
): Promise<KpiDefinitionRecord> {
  return tenantApiRequest<KpiDefinitionRecord>(
    `/performance/kpi-definitions/${definitionId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function listKpiAssignments(
  companyId: string,
  params?: {
    reviewCycleId?: string;
    employeeId?: string;
    kpiDefinitionId?: string;
    status?: string;
  },
): Promise<EmployeeKpiAssignmentRecord[]> {
  const search = new URLSearchParams();
  if (params?.reviewCycleId) search.set('reviewCycleId', params.reviewCycleId);
  if (params?.employeeId) search.set('employeeId', params.employeeId);
  if (params?.kpiDefinitionId) search.set('kpiDefinitionId', params.kpiDefinitionId);
  if (params?.status) search.set('status', params.status);
  const query = search.toString();
  return tenantApiRequest<EmployeeKpiAssignmentRecord[]>(
    `/companies/${companyId}/performance/kpi-assignments${query ? `?${query}` : ''}`,
  );
}

export function createKpiAssignment(
  companyId: string,
  input: CreateKpiAssignmentInput,
): Promise<EmployeeKpiAssignmentRecord> {
  return tenantApiRequest<EmployeeKpiAssignmentRecord>(
    `/companies/${companyId}/performance/kpi-assignments`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function bulkAssignKpi(
  companyId: string,
  input: BulkAssignKpiInput,
): Promise<EmployeeKpiAssignmentRecord[]> {
  return tenantApiRequest<EmployeeKpiAssignmentRecord[]>(
    `/companies/${companyId}/performance/kpi-assignments/bulk`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateKpiAssignment(
  assignmentId: string,
  input: {
    currentValue?: number;
    targetValue?: number;
    status?: string;
    notes?: string;
  },
): Promise<EmployeeKpiAssignmentRecord> {
  return tenantApiRequest<EmployeeKpiAssignmentRecord>(
    `/performance/kpi-assignments/${assignmentId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  self_assessment_draft: 'Self assessment draft',
  self_submitted: 'Self submitted',
  manager_review: 'Manager review',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  returned: 'Returned',
  cancelled: 'Cancelled',
};

export function listReviewParticipants(
  companyId: string,
  cycleId: string,
): Promise<PerformanceReviewParticipantRecord[]> {
  return tenantApiRequest<PerformanceReviewParticipantRecord[]>(
    `/companies/${companyId}/performance/review-cycles/${cycleId}/participants`,
  );
}

export function setReviewParticipants(
  companyId: string,
  cycleId: string,
  employeeIds: string[],
): Promise<PerformanceReviewParticipantRecord[]> {
  return tenantApiRequest<PerformanceReviewParticipantRecord[]>(
    `/companies/${companyId}/performance/review-cycles/${cycleId}/participants`,
    { method: 'POST', body: JSON.stringify({ employeeIds }) },
  );
}

export function launchReviewCycle(
  companyId: string,
  cycleId: string,
): Promise<{ participantCount: number; reviewCount: number }> {
  return tenantApiRequest<{ participantCount: number; reviewCount: number }>(
    `/companies/${companyId}/performance/review-cycles/${cycleId}/launch`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export function listPerformanceReviews(
  companyId: string,
  params?: { reviewCycleId?: string; employeeId?: string; status?: string },
): Promise<EmployeePerformanceReviewRecord[]> {
  const search = new URLSearchParams();
  if (params?.reviewCycleId) search.set('reviewCycleId', params.reviewCycleId);
  if (params?.employeeId) search.set('employeeId', params.employeeId);
  if (params?.status) search.set('status', params.status);
  const query = search.toString();
  return tenantApiRequest<EmployeePerformanceReviewRecord[]>(
    `/companies/${companyId}/performance/reviews${query ? `?${query}` : ''}`,
  );
}

export function getPerformanceReview(reviewId: string): Promise<EmployeePerformanceReviewRecord> {
  return tenantApiRequest<EmployeePerformanceReviewRecord>(`/performance/reviews/${reviewId}`);
}

export function saveSelfAssessment(
  reviewId: string,
  payload: Partial<EmployeePerformanceReviewRecord['selfAssessment']>,
): Promise<EmployeePerformanceReviewRecord> {
  return tenantApiRequest<EmployeePerformanceReviewRecord>(
    `/performance/reviews/${reviewId}/self-assessment`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  );
}

export function submitSelfAssessment(reviewId: string): Promise<EmployeePerformanceReviewRecord> {
  return tenantApiRequest<EmployeePerformanceReviewRecord>(
    `/performance/reviews/${reviewId}/submit-self`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export function saveManagerAssessment(
  reviewId: string,
  payload: Partial<EmployeePerformanceReviewRecord['managerAssessment']>,
): Promise<EmployeePerformanceReviewRecord> {
  return tenantApiRequest<EmployeePerformanceReviewRecord>(
    `/performance/reviews/${reviewId}/manager-assessment`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  );
}

export function submitManagerAssessment(
  reviewId: string,
): Promise<EmployeePerformanceReviewRecord> {
  return tenantApiRequest<EmployeePerformanceReviewRecord>(
    `/performance/reviews/${reviewId}/submit-manager`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export function approvePerformanceReview(
  reviewId: string,
  comment?: string,
): Promise<EmployeePerformanceReviewRecord> {
  return tenantApiRequest<EmployeePerformanceReviewRecord>(
    `/performance/reviews/${reviewId}/approve`,
    { method: 'POST', body: JSON.stringify({ comment }) },
  );
}

export function rejectPerformanceReview(
  reviewId: string,
  comment?: string,
): Promise<EmployeePerformanceReviewRecord> {
  return tenantApiRequest<EmployeePerformanceReviewRecord>(
    `/performance/reviews/${reviewId}/reject`,
    { method: 'POST', body: JSON.stringify({ comment }) },
  );
}

export const OVERALL_RATING_LABELS: Record<PerformanceOverallRatingLabel, string> = {
  outstanding: 'Outstanding',
  exceeds_expectations: 'Exceeds expectations',
  meets_expectations: 'Meets expectations',
  needs_improvement: 'Needs improvement',
};

export const PROMOTION_STATUS_LABELS: Record<PromotionRecommendationStatus, string> = {
  none: 'None',
  draft: 'Draft',
  submitted: 'Awaiting HR',
  approved: 'Approved',
  rejected: 'Rejected',
  executed: 'Promoted',
};

export const FEEDBACK_360_RELATIONSHIP_LABELS: Record<Performance360Relationship, string> = {
  peer: 'Peer',
  direct_report: 'Direct report',
  cross_functional: 'Cross-functional',
};

export function list360Feedback(reviewId: string): Promise<Performance360FeedbackRecord[]> {
  return tenantApiRequest<Performance360FeedbackRecord[]>(
    `/performance/reviews/${reviewId}/360-feedback`,
  );
}

export function get360Summary(reviewId: string): Promise<Performance360Summary> {
  return tenantApiRequest<Performance360Summary>(`/performance/reviews/${reviewId}/360-summary`);
}

export function invite360Reviewers(
  reviewId: string,
  reviewers: Array<{ employeeId: string; relationship: Performance360Relationship }>,
): Promise<Performance360FeedbackRecord[]> {
  return tenantApiRequest<Performance360FeedbackRecord[]>(
    `/performance/reviews/${reviewId}/360-feedback/invite`,
    { method: 'POST', body: JSON.stringify({ reviewers }) },
  );
}

export function submit360Feedback(
  feedbackId: string,
  payload: { competencyRatings: Array<{ key: string; rating: number }>; comment?: string },
): Promise<Performance360FeedbackRecord> {
  return tenantApiRequest<Performance360FeedbackRecord>(`/performance/360-feedback/${feedbackId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function saveReviewOutcome(
  reviewId: string,
  payload: {
    overallRating?: number;
    overallRatingLabel?: PerformanceOverallRatingLabel;
    promotionRecommended?: boolean;
    recommendedDesignationId?: string | null;
    promotionRecommendationNote?: string | null;
  },
): Promise<EmployeePerformanceReviewRecord> {
  return tenantApiRequest<EmployeePerformanceReviewRecord>(
    `/performance/reviews/${reviewId}/outcome`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  );
}

export function submitPromotionRecommendation(
  reviewId: string,
): Promise<EmployeePerformanceReviewRecord> {
  return tenantApiRequest<EmployeePerformanceReviewRecord>(
    `/performance/reviews/${reviewId}/submit-promotion`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export function approvePromotionRecommendation(
  reviewId: string,
): Promise<EmployeePerformanceReviewRecord> {
  return tenantApiRequest<EmployeePerformanceReviewRecord>(
    `/performance/reviews/${reviewId}/approve-promotion`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export function rejectPromotionRecommendation(
  reviewId: string,
  comment?: string,
): Promise<EmployeePerformanceReviewRecord> {
  return tenantApiRequest<EmployeePerformanceReviewRecord>(
    `/performance/reviews/${reviewId}/reject-promotion`,
    { method: 'POST', body: JSON.stringify({ comment }) },
  );
}

export function executePromotionFromReview(
  reviewId: string,
  payload: { effectiveDate: string; newDepartmentId?: string },
): Promise<EmployeePerformanceReviewRecord> {
  return tenantApiRequest<EmployeePerformanceReviewRecord>(
    `/performance/reviews/${reviewId}/execute-promotion`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
}

export function listPerformanceHistory(
  companyId: string,
  employeeId: string,
): Promise<PerformanceHistoryPoint[]> {
  return tenantApiRequest<PerformanceHistoryPoint[]>(
    `/companies/${companyId}/performance/employees/${employeeId}/history`,
  );
}

export function formatKpiMetric(
  assignment: Pick<
    EmployeeKpiAssignmentRecord,
    'unit' | 'currentValue' | 'targetValue' | 'direction'
  >,
): string {
  const current = assignment.currentValue ?? 0;
  const target = assignment.targetValue;
  const suffix =
    assignment.unit === 'percentage'
      ? '%'
      : assignment.unit === 'hours'
        ? 'h'
        : assignment.unit === 'days'
          ? 'd'
          : '';
  return `${current}${suffix} / ${target}${suffix}`;
}
