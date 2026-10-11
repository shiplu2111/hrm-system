/** In-App Support / Help Center (MODULES.md §45) */

export type SupportTicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting'
  | 'resolved'
  | 'closed';

export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export const SUPPORT_TICKET_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting: 'Waiting',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const SUPPORT_TICKET_PRIORITY_LABELS: Record<
  SupportTicketPriority,
  string
> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

/**
 * The admin queue works with three statuses. `waiting` and `closed` are legacy
 * values that are shown as In progress and Resolved.
 */
export type SupportWorkflowStatus = 'open' | 'in_progress' | 'resolved';

export const SUPPORT_WORKFLOW_STATUSES: SupportWorkflowStatus[] = [
  'open',
  'in_progress',
  'resolved',
];

export function supportWorkflowStatus(status: SupportTicketStatus): SupportWorkflowStatus {
  if (status === 'waiting') return 'in_progress';
  if (status === 'closed') return 'resolved';
  return status;
}

/** Statuses an agent may move a ticket to from its current status. */
export function supportNextStatuses(status: SupportTicketStatus): SupportWorkflowStatus[] {
  switch (supportWorkflowStatus(status)) {
    case 'open':
      return ['in_progress', 'resolved'];
    case 'in_progress':
      return status === 'waiting' ? ['open', 'in_progress', 'resolved'] : ['open', 'resolved'];
    case 'resolved':
      return ['in_progress'];
  }
}

/** Status after a new message, or null when it stays the same. */
export function supportStatusAfterMessage(input: {
  status: SupportTicketStatus;
  fromStaff: boolean;
  isInternal: boolean;
  hasAssignee: boolean;
}): SupportWorkflowStatus | null {
  if (input.isInternal) return null;
  const current = supportWorkflowStatus(input.status);
  if (input.fromStaff) {
    return current === 'open' ? 'in_progress' : null;
  }
  if (current === 'resolved') {
    return input.hasAssignee ? 'in_progress' : 'open';
  }
  return input.status === 'waiting' ? 'in_progress' : null;
}

export interface KbCategoryRecord {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  articleCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface KbArticleRecord {
  id: string;
  tenantId: string;
  categoryId: string;
  categoryName?: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  published: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KbArticleListItem {
  id: string;
  categoryId: string;
  categoryName: string;
  title: string;
  slug: string;
  summary: string;
  published: boolean;
  viewCount: number;
  updatedAt: string;
  /** Last editor, or the author if never edited. Only returned to support editors. */
  updatedByName?: string | null;
}

export type KbArticleStatusFilter = 'all' | 'published' | 'draft';

export interface SupportTicketRecord {
  id: string;
  tenantId: string;
  companyId: string | null;
  ticketNumber: string;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  requesterUserId: string;
  requesterEmployeeId: string | null;
  requesterName?: string | null;
  requesterEmail?: string | null;
  assignedToUserId: string | null;
  assigneeName?: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface SupportTicketDetail extends SupportTicketRecord {
  messages: SupportTicketMessageRecord[];
}

export interface SupportTicketMessageRecord {
  id: string;
  ticketId: string;
  authorUserId: string;
  authorName?: string | null;
  /** True when written by support staff rather than the requester. */
  fromStaff?: boolean;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export type SupportQueueAssigneeFilter = 'all' | 'me' | 'unassigned';

export interface SupportQueueQuery {
  status?: SupportWorkflowStatus | 'all';
  priority?: SupportTicketPriority;
  assignee?: SupportQueueAssigneeFilter;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface SupportQueueList {
  items: SupportTicketRecord[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<SupportWorkflowStatus, number>;
}

export interface SupportAgent {
  id: string;
  name: string;
  email: string;
}

export interface CreateKbCategoryInput {
  name: string;
  slug?: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateKbCategoryInput {
  name?: string;
  description?: string;
  sortOrder?: number;
}

export interface CreateKbArticleInput {
  categoryId: string;
  title: string;
  slug?: string;
  summary: string;
  body: string;
  published?: boolean;
}

export interface UpdateKbArticleInput {
  categoryId?: string;
  title?: string;
  slug?: string;
  summary?: string;
  body?: string;
  published?: boolean;
}

export interface CreateSupportTicketInput {
  subject: string;
  description: string;
  priority?: SupportTicketPriority;
  companyId?: string;
}

export interface UpdateSupportTicketInput {
  status?: SupportWorkflowStatus;
  priority?: SupportTicketPriority;
  assignedToUserId?: string | null;
  /** Optional reply to the requester, posted with the status change. */
  note?: string;
}

export interface CreateSupportTicketMessageInput {
  body: string;
  isInternal?: boolean;
}
