import type {
  ApplicationStage,
  JobPostingStatus,
  JobRequisitionStatus,
  WorkflowInstanceRecord,
} from '@hrm/shared-types';
import { getCurrentWorkflowStep } from '../workflow/workflow.utils';

export function buildRequisitionReferenceNumber(
  countExisting: number,
  asOf: Date = new Date(),
): string {
  const year = asOf.getUTCFullYear();
  const seq = String(countExisting + 1).padStart(3, '0');
  return `REQ-${year}-${seq}`;
}

export function resolveRequisitionDisplayStatus(
  status: JobRequisitionStatus,
  workflow?: WorkflowInstanceRecord | null,
): string {
  if (status === 'open') return 'Open';
  if (status === 'closed') return 'Closed';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'draft') return 'Draft';

  if (status === 'pending_approval') {
    const step = workflow ? getCurrentWorkflowStep(workflow.steps) : null;
    if (!step) return 'Pending Approval';
    if (step.assigneeType === 'direct_manager' || step.roleName === 'Manager') {
      return 'Pending Manager';
    }
    return `Pending ${step.roleName}`;
  }

  return status;
}

export function resolvePostingDisplayStatus(status: JobPostingStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'published':
      return 'Published';
    case 'closed':
      return 'Closed';
    default:
      return status;
  }
}

export function resolveApplicationDisplayStage(stage: ApplicationStage): string {
  switch (stage) {
    case 'applied':
      return 'Applied';
    case 'screening':
      return 'Screening';
    case 'interview':
      return 'Interview';
    case 'offer':
      return 'Offer';
    case 'hired':
      return 'Hired';
    case 'rejected':
      return 'Rejected';
    case 'withdrawn':
      return 'Withdrawn';
    default:
      return stage;
  }
}

export function formatCandidateName(
  firstName: string,
  lastName: string,
): string {
  return `${firstName} ${lastName}`.trim();
}

export function formatExperienceLabel(years: number | null): string {
  if (years == null || years <= 0) return '—';
  return years === 1 ? '1 year' : `${years} years`;
}

export const PIPELINE_STAGES: ApplicationStage[] = [
  'applied',
  'screening',
  'interview',
  'offer',
  'hired',
];

export type InterviewRoundType =
  | 'technical'
  | 'hr'
  | 'management'
  | 'final_decision';

export type InterviewRoundStatus =
  | 'pending'
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'skipped';

export type InterviewRecommendation =
  | 'strong_yes'
  | 'yes'
  | 'neutral'
  | 'no'
  | 'strong_no';

export const INTERVIEW_ROUND_SEQUENCE: ReadonlyArray<{
  roundType: InterviewRoundType;
  roundOrder: number;
  label: string;
}> = [
  { roundType: 'technical', roundOrder: 1, label: 'Technical' },
  { roundType: 'hr', roundOrder: 2, label: 'HR' },
  { roundType: 'management', roundOrder: 3, label: 'Management' },
  { roundType: 'final_decision', roundOrder: 4, label: 'Final Decision' },
];

export function resolveInterviewRoundLabel(roundType: InterviewRoundType): string {
  return (
    INTERVIEW_ROUND_SEQUENCE.find((r) => r.roundType === roundType)?.label ??
    roundType
  );
}

export function resolveInterviewRoundStatus(
  status: InterviewRoundStatus,
): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'scheduled':
      return 'Scheduled';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'skipped':
      return 'Skipped';
    default:
      return status;
  }
}

export function resolveInterviewRecommendation(
  recommendation: InterviewRecommendation,
): string {
  switch (recommendation) {
    case 'strong_yes':
      return 'Strong Yes';
    case 'yes':
      return 'Yes';
    case 'neutral':
      return 'Neutral';
    case 'no':
      return 'No';
    case 'strong_no':
      return 'Strong No';
    default:
      return recommendation;
  }
}

export function isPositiveRecommendation(
  recommendation: InterviewRecommendation,
): boolean {
  return recommendation === 'strong_yes' || recommendation === 'yes';
}

export function averageInterviewScore(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const sum = scores.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

const OFFER_TEMPLATE_LABELS: Record<string, string> = {
  standard: 'Standard Offer Letter',
  senior: 'Senior Role Offer',
  contract: 'Contract Offer',
  remote: 'Remote Worker Offer',
};

export function resolveOfferTemplateLabel(template: string): string {
  return OFFER_TEMPLATE_LABELS[template] ?? template;
}

export function resolveOfferLetterDisplayStatus(
  status: string,
  workflow?: WorkflowInstanceRecord | null,
): string {
  if (status === 'draft') return 'Draft';
  if (status === 'approved') return 'Approved';
  if (status === 'sent') return 'Sent';
  if (status === 'accepted') return 'Accepted';
  if (status === 'declined') return 'Declined';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'pending_approval') {
    const step = workflow ? getCurrentWorkflowStep(workflow.steps) : null;
    if (!step) return 'Pending Approval';
    return `Pending ${step.roleName}`;
  }
  return status;
}

export function formatOfferMoney(amount: number | null, currency: string): string | undefined {
  if (amount == null) return undefined;
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
