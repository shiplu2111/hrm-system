import type { ComponentProps } from 'react';
import { FileText, KeyRound, ListChecks, Monitor, Shield, type LucideIcon } from 'lucide-react';
import type {
  OnboardingDocumentStatus,
  OnboardingStatus,
  OnboardingTaskCategory,
  OnboardingTaskType,
} from '@hrm/shared-types';
import type { Badge } from '@/components/ui/Badge';

type BadgeTone = NonNullable<ComponentProps<typeof Badge>['tone']>;

export const ONBOARDING_CATEGORY_ICONS: Record<OnboardingTaskCategory, LucideIcon> = {
  document_collection: FileText,
  policy_acceptance: Shield,
  equipment_provisioning: Monitor,
  system_access: KeyRound,
  general: ListChecks,
};

/** The task type a new item of each category usually needs. */
export const DEFAULT_TASK_TYPE_FOR_CATEGORY: Record<OnboardingTaskCategory, OnboardingTaskType> = {
  document_collection: 'document_collection',
  policy_acceptance: 'policy_acceptance',
  equipment_provisioning: 'provisioning',
  system_access: 'provisioning',
  general: 'manual_task',
};

export const ONBOARDING_TASK_TYPE_HELP: Record<OnboardingTaskType, string> = {
  document_collection:
    'Completes automatically once the employee document is uploaded (and verified, if its type requires verification).',
  policy_acceptance:
    'HR records the employee’s acceptance. If the document type requires verification, the signed copy must be uploaded and verified instead.',
  manual_task: 'Someone marks it done on the tracker.',
  provisioning:
    'With an asset category, completes when an asset of that category is assigned. Without one, it is marked done by hand (e.g. system access).',
};

export const ASSIGNEE_SUGGESTIONS = ['HR', 'IT', 'Manager', 'Employee', 'Facilities', 'Payroll'];

export function onboardingDocumentStatusBadge(
  status: OnboardingDocumentStatus,
): { label: string; tone: BadgeTone } {
  switch (status) {
    case 'missing':
      return { label: 'Not uploaded', tone: 'neutral' };
    case 'awaiting_file':
      return { label: 'File missing', tone: 'warning' };
    case 'pending_verification':
      return { label: 'Awaiting verification', tone: 'warning' };
    case 'verified':
      return { label: 'Verified', tone: 'success' };
    case 'on_file':
      return { label: 'On file', tone: 'success' };
  }
}

export function onboardingStatusBadge(status: OnboardingStatus): { label: string; tone: BadgeTone } {
  switch (status) {
    case 'in_progress':
      return { label: 'In progress', tone: 'accent' };
    case 'completed':
      return { label: 'Completed', tone: 'success' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'neutral' };
  }
}

export function formatShortDate(value: string | null): string {
  if (!value) return '—';
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function dueOffsetLabel(days: number | null): string {
  if (days == null) return 'No due date';
  if (days === 0) return 'Due on start date';
  return `Due ${days} day${days === 1 ? '' : 's'} after start`;
}
