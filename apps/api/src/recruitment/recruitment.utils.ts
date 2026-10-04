import {
  OFFER_LETTER_TEMPLATES,
  type ApplicationStage,
  type JobPostingStatus,
  type JobRequisitionStatus,
  type OfferLetterTemplate,
  type WorkflowInstanceRecord,
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

/**
 * Returns why a manual stage change is not allowed, or null when it is.
 * `hired` is only reachable through the hire endpoint (accepted offer + employee record),
 * and hired applications are final.
 */
export function stageChangeBlockReason(
  current: ApplicationStage,
  target: ApplicationStage,
  hiredEmployeeId: string | null,
): string | null {
  if (current === 'hired' || hiredEmployeeId) {
    return current === target
      ? null
      : 'Hired applications are final and cannot change stage';
  }
  if (target === 'hired') {
    return 'Use "Convert to employee" to hire — it requires an accepted offer letter';
  }
  return null;
}

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

export function resolveOfferTemplateLabel(template: string): string {
  return OFFER_LETTER_TEMPLATES[template as OfferLetterTemplate]?.label ?? template;
}

const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Matches an offer's free-text "Reporting to" against employee names (case-insensitive).
 * A trailing title is ignored, e.g. "Alex Thompson, Engineering Manager" or "Alex Thompson (CTO)".
 */
export function matchReportingToEmployee<T extends { id: string; firstName: string; lastName: string }>(
  reportingTo: string | null | undefined,
  employees: T[],
): T | null {
  if (!reportingTo?.trim()) return null;
  const full = normalizeName(reportingTo);
  const nameOnly = normalizeName(reportingTo.split(/[,(]| - | – | — /)[0] ?? '');
  for (const needle of [full, nameOnly]) {
    if (!needle) continue;
    const matches = employees.filter((e) => normalizeName(`${e.firstName} ${e.lastName}`) === needle);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) return null;
  }
  return null;
}

/** First `EMP-###` number not already taken in the tenant. */
export function nextEmployeeNumber(existingNumbers: Iterable<string>, startAt: number): string {
  const taken = new Set(Array.from(existingNumbers, (n) => n.trim().toUpperCase()));
  let n = Math.max(1, startAt);
  while (taken.has(`EMP-${String(n).padStart(3, '0')}`)) n += 1;
  return `EMP-${String(n).padStart(3, '0')}`;
}

export function addMonthsIsoDate(isoDate: string, months: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
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
  if (status === 'cancelled') return workflow?.status === 'rejected' ? 'Rejected' : 'Cancelled';
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
