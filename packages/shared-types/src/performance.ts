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
  managerName: string | null;
  reviewId: string | null;
  reviewStatus: EmployeePerformanceReviewStatus | null;
}

export interface EmployeePerformanceReviewRecord {
  id: string;
  companyId: string;
  reviewCycleId: string;
  reviewCycleName: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  managerEmployeeId: string | null;
  managerName: string | null;
  status: EmployeePerformanceReviewStatus;
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

export interface Performance360FeedbackRecord {
  id: string;
  reviewId: string;
  reviewerEmployeeId: string;
  reviewerName: string | null;
  relationship: Performance360Relationship;
  status: Performance360FeedbackStatus;
  competencyRatings: Array<{ key: string; rating: number }>;
  comment: string | null;
  isAnonymous: boolean;
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
  comments: string[];
}

export interface Performance360Summary {
  responseCount: number;
  invitedCount: number;
  averageRating: number | null;
  competencyAverages: Performance360CompetencyAverage[];
  byRelationship: Record<Performance360Relationship, Performance360RelationshipSummary>;
  relationshipLabels: Record<Performance360Relationship, string>;
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
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceGoalsSummary {
  activeCycle: PerformanceReviewCycleRecord | null;
  kpiDefinitionCount: number;
  activeAssignmentCount: number;
  onTrackCount: number;
  atRiskCount: number;
  averageProgressPercent: number | null;
}
