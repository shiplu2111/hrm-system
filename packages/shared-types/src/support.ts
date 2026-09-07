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
}

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
  assignedToUserId: string | null;
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
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface CreateKbCategoryInput {
  name: string;
  slug?: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateKbCategoryInput {
  name?: string;
  slug?: string;
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
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assignedToUserId?: string | null;
}

export interface CreateSupportTicketMessageInput {
  body: string;
  isInternal?: boolean;
}
