import type {
  ApplicationStage,
  CandidateSource,
  JobRequisitionRecord,
  WorkflowInstanceRecord,
} from '@hrm/shared-types';

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';

export const STAGE_META: Record<
  ApplicationStage,
  { label: string; border: string; tone: BadgeTone }
> = {
  applied: { label: 'Applied', border: 'border-t-slate-400', tone: 'neutral' },
  screening: { label: 'Screening', border: 'border-t-sky-500', tone: 'info' },
  interview: { label: 'Interview', border: 'border-t-accent-500', tone: 'accent' },
  offer: { label: 'Offer', border: 'border-t-warning-500', tone: 'warning' },
  hired: { label: 'Hired', border: 'border-t-success-500', tone: 'success' },
  rejected: { label: 'Rejected', border: 'border-t-error-500', tone: 'error' },
  withdrawn: { label: 'Withdrawn', border: 'border-t-slate-300', tone: 'neutral' },
};

/** Stages a user can pick manually; `hired` requires the convert-to-employee flow. */
export const MANUAL_STAGES: ApplicationStage[] = [
  'applied',
  'screening',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
];

export function canMoveApplication(
  application: { stage: ApplicationStage; hiredEmployeeId: string | null },
  target: ApplicationStage,
): boolean {
  if (application.stage === 'hired' || application.hiredEmployeeId) return false;
  return target !== 'hired' && target !== application.stage;
}

export const SOURCE_LABELS: Record<CandidateSource, string> = {
  referral: 'Referral',
  linkedin: 'LinkedIn',
  job_board: 'Job board',
  agency: 'Agency',
  website: 'Website',
  other: 'Other',
};

export const REQUISITION_STATUS_TONE: Record<JobRequisitionRecord['status'], BadgeTone> = {
  draft: 'neutral',
  pending_approval: 'warning',
  open: 'success',
  closed: 'info',
  cancelled: 'error',
};

export function canActOnWorkflowStep(
  workflow: WorkflowInstanceRecord | null,
  roleName: string,
): boolean {
  if (!workflow) return true;
  const step = workflow.steps.find((s) => s.status === 'pending');
  if (!step) return false;
  if (step.assigneeType !== 'role') return true;
  return roleName === step.roleName || roleName === 'Company Owner';
}

export const RECRUITMENT_FILE_ACCEPT = '.pdf,.png,.jpg,.jpeg';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Mirrors the API's document policy so users get instant feedback. */
export function uploadFileError(file: File): string | null {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  if (!['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
    return 'Files must be PDF, JPG, or PNG';
  }
  if (file.size > MAX_UPLOAD_BYTES) return 'Files must be 10 MB or smaller';
  return null;
}

export function formatRelativeDays(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}
