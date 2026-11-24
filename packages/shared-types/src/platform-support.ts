// packages/shared-types/src/platform-support.ts
// Shared types for Platform Support Ticket Queue (MODULES.md §45, Phase 2 Stage 23)

export type PlatformSupportTicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting'
  | 'resolved'
  | 'closed';

export type PlatformSupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type SlaStatus = 'healthy' | 'warning' | 'breached' | 'met';

export interface PlanSlaPolicy {
  responseHours: number;
  resolutionHours: number;
}

export const PLAN_SLA_POLICIES: Record<string, PlanSlaPolicy> = {
  enterprise: { responseHours: 1, resolutionHours: 4 },
  business: { responseHours: 4, resolutionHours: 12 },
  starter: { responseHours: 12, resolutionHours: 24 },
  free: { responseHours: 48, resolutionHours: 72 },
  default: { responseHours: 24, resolutionHours: 48 },
};

export interface TicketSlaMetrics {
  planCode: string;
  planName: string;
  responseTargetHours: number;
  resolutionTargetHours: number;
  responseDeadline: string;
  resolutionDeadline: string;
  isResponseBreached: boolean;
  isResolutionBreached: boolean;
  remainingMinutes: number;
  status: SlaStatus;
  label: string;
}

export interface PlatformSupportTicketItem {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: PlatformSupportTicketStatus;
  priority: PlatformSupportTicketPriority;
  tenantId: string;
  tenantName: string;
  tenantSubdomain: string;
  planId: string;
  planName: string;
  requesterUserId: string;
  requesterName: string;
  requesterEmail: string;
  assignedToUserId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  messagesCount: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  sla: TicketSlaMetrics;
}

export interface PlatformTicketMessageItem {
  id: string;
  ticketId: string;
  authorUserId: string;
  authorName: string;
  authorEmail: string;
  authorRole: 'customer' | 'staff';
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface PlatformSupportTicketDetail extends PlatformSupportTicketItem {
  messages: PlatformTicketMessageItem[];
  activeSupportSession?: {
    id: string;
    status: string;
    expiresAt: string;
    accessMode: string;
  } | null;
}

export interface PlatformSupportQueueQuery {
  tenantId?: string;
  status?: PlatformSupportTicketStatus | 'all';
  priority?: PlatformSupportTicketPriority | 'all';
  assigneeId?: string; // 'all' | 'unassigned' | 'me' | staff UUID
  search?: string;
  slaStatus?: SlaStatus | 'all';
  page?: number;
  pageSize?: number;
}

export interface PlatformSupportQueueResponse {
  items: PlatformSupportTicketItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  counts: {
    all: number;
    open: number;
    in_progress: number;
    waiting: number;
    resolved: number;
    closed: number;
  };
  slaCounts: {
    healthy: number;
    warning: number;
    breached: number;
  };
}

export interface UpdatePlatformTicketInput {
  status?: PlatformSupportTicketStatus;
  priority?: PlatformSupportTicketPriority;
  assignedToUserId?: string | null;
}

export interface CreatePlatformTicketMessageInput {
  body: string;
  isInternal: boolean;
  status?: PlatformSupportTicketStatus;
}

export interface PlatformStaffAssignee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleName: string;
}
