import type {
  SupportTicketPriority,
  SupportTicketStatus,
  SupportWorkflowStatus,
} from '@hrm/shared-types';
import type { StatusPillTone } from '@/components/ui/StatusPill';

export const SUPPORT_TICKET_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting: 'Waiting',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const SUPPORT_TICKET_PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const SUPPORT_WORKFLOW_DISPLAY: Record<
  SupportWorkflowStatus,
  { label: string; tone: StatusPillTone; hint: string }
> = {
  open: { label: 'Open', tone: 'accent', hint: 'Waiting for an agent to pick it up' },
  in_progress: { label: 'In progress', tone: 'warning', hint: 'An agent is working on it' },
  resolved: { label: 'Resolved', tone: 'success', hint: 'Answered; reopens if the requester replies' },
};

export const SUPPORT_PRIORITY_TONES: Record<SupportTicketPriority, StatusPillTone> = {
  low: 'neutral',
  medium: 'accent',
  high: 'warning',
  urgent: 'error',
};

/** Syntax supported by `KbMarkdown`, shown under the article editor. */
export const KB_MARKDOWN_HINTS = [
  { syntax: '## Heading', label: 'Heading' },
  { syntax: '**bold**', label: 'Bold' },
  { syntax: '*italic*', label: 'Italic' },
  { syntax: '- item', label: 'Bullet list' },
  { syntax: '1. step', label: 'Numbered steps' },
  { syntax: '[text](https://…)', label: 'Link' },
  { syntax: '`code`', label: 'Code' },
];

/** Button labels for moving a ticket to each status. */
export const SUPPORT_TRANSITION_LABELS: Record<SupportWorkflowStatus, string> = {
  open: 'Move back to open',
  in_progress: 'Start working',
  resolved: 'Resolve',
};
