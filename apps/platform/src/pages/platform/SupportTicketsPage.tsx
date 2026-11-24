// apps/platform/src/pages/platform/SupportTicketsPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ClockAlert,
  ExternalLink,
  Filter,
  Headphones,
  KeyRound,
  Lock,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import {
  CreateSupportAccessRequestDto,
  PlatformStaffAssignee,
  PlatformSupportQueueResponse,
  PlatformSupportTicketDetail,
  PlatformSupportTicketItem,
  PlatformSupportTicketPriority,
  PlatformSupportTicketStatus,
  PlatformTenantSummary,
  SlaStatus,
  SupportAccessMode,
} from '@hrm/shared-types';
import {
  createPlatformTicketMessage,
  getPlatformStaffAssignees,
  getPlatformTicketDetail,
  getPlatformTickets,
  updatePlatformTicket,
} from '@/lib/platform-support-api';
import {
  fetchPlatformTenants,
  getPlatformStoredUser,
  requestSupportAccess,
} from '@/lib/api-client';

// Design System Badges and Styling
const statusConfig: Record<PlatformSupportTicketStatus, { label: string; bg: string; text: string; border: string }> = {
  open: {
    label: 'Open',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
  },
  waiting: {
    label: 'Waiting on Customer',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  resolved: {
    label: 'Resolved',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  closed: {
    label: 'Closed',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
  },
};

const priorityConfig: Record<PlatformSupportTicketPriority, { label: string; bg: string; text: string; border: string; dot: string }> = {
  urgent: {
    label: 'Urgent',
    bg: 'bg-red-50 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    dot: 'bg-red-500',
  },
  high: {
    label: 'High',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-500',
  },
  medium: {
    label: 'Medium',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
    dot: 'bg-indigo-500',
  },
  low: {
    label: 'Low',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
};

const planBadges: Record<string, { label: string; bg: string; text: string; border: string }> = {
  enterprise: {
    label: 'Enterprise',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
  },
  business: {
    label: 'Business',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800',
  },
  starter: {
    label: 'Starter',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  free: {
    label: 'Free',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
  },
};

const slaBadgeStyles: Record<SlaStatus, { label: string; bg: string; text: string; border: string; icon: any }> = {
  healthy: {
    label: 'Healthy',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: CheckCircle2,
  },
  warning: {
    label: 'Nearing SLA',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    icon: ClockAlert,
  },
  breached: {
    label: 'Breached',
    bg: 'bg-red-50 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    icon: AlertTriangle,
  },
  met: {
    label: 'Met',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    icon: CheckCircle2,
  },
};

function formatTimeAgo(isoString: string): string {
  if (!isoString) return 'just now';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getPlanBadge(planId?: string) {
  const key = (planId || 'starter').toLowerCase();
  for (const [k, v] of Object.entries(planBadges)) {
    if (key.includes(k)) return v;
  }
  return planBadges.starter;
}

export function SupportTicketsPage() {
  const currentUser = getPlatformStoredUser();

  // State: Queue and Detail
  const [data, setData] = useState<PlatformSupportQueueResponse | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<PlatformSupportTicketDetail | null>(null);
  const [staffList, setStaffList] = useState<PlatformStaffAssignee[]>([]);
  const [tenantList, setTenantList] = useState<PlatformTenantSummary[]>([]);

  // Filters
  const [filterTenant, setFilterTenant] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<PlatformSupportTicketStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<PlatformSupportTicketPriority | 'all'>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterSla, setFilterSla] = useState<SlaStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [ticketDetailLoading, setTicketDetailLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Message composer state
  const [composerBody, setComposerBody] = useState<string>('');
  const [composerIsInternal, setComposerIsInternal] = useState<boolean>(false);
  const [submittingMessage, setSubmittingMessage] = useState<boolean>(false);

  // Quick updating in ticket detail
  const [updatingTicket, setUpdatingTicket] = useState<boolean>(false);

  // Support Access Request Modal State (Stage D Integration)
  const [accessModalOpen, setAccessModalOpen] = useState<boolean>(false);
  const [accessReason, setAccessReason] = useState<string>('');
  const [accessDuration, setAccessDuration] = useState<number>(60);
  const [accessMode, setAccessMode] = useState<SupportAccessMode>('read_write');
  const [submittingAccess, setSubmittingAccess] = useState<boolean>(false);
  const [accessFeedback, setAccessFeedback] = useState<string | null>(null);

  // Load Queue & Reference Data
  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const queueRes = await getPlatformTickets({
        tenantId: filterTenant !== 'all' ? filterTenant : undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
        priority: filterPriority !== 'all' ? filterPriority : undefined,
        assigneeId: filterAssignee !== 'all' ? filterAssignee : undefined,
        slaStatus: filterSla !== 'all' ? filterSla : undefined,
        search: searchQuery.trim() || undefined,
        pageSize: 50,
      });
      setData(queueRes);
    } catch (err: any) {
      setError(err?.message || 'Failed to load support ticket queue');
    } finally {
      setLoading(false);
    }
  }, [filterTenant, filterStatus, filterPriority, filterAssignee, filterSla, searchQuery]);

  // Load metadata on initial mount
  useEffect(() => {
    async function loadMeta() {
      try {
        const [staff, tenants] = await Promise.all([
          getPlatformStaffAssignees().catch(() => []),
          fetchPlatformTenants().catch(() => []),
        ]);
        setStaffList(staff);
        setTenantList(tenants);
      } catch (err) {
        console.error('Failed to load support reference data', err);
      }
    }
    loadMeta();
  }, []);

  // Reload queue when filters change
  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Load ticket details when selected
  const loadTicketDetail = useCallback(async (id: string) => {
    try {
      setTicketDetailLoading(true);
      const detail = await getPlatformTicketDetail(id);
      setSelectedTicket(detail);
      // Pre-fill Support Access modal reason
      setAccessReason(`Support inquiry for ticket ${detail.ticketNumber}: ${detail.subject}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch ticket detail');
    } finally {
      setTicketDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTicketId) {
      loadTicketDetail(selectedTicketId);
    } else {
      setSelectedTicket(null);
    }
  }, [selectedTicketId, loadTicketDetail]);

  // Handle Quick Status / Priority / Assignee Change
  const handleUpdateTicket = async (patch: {
    status?: PlatformSupportTicketStatus;
    priority?: PlatformSupportTicketPriority;
    assignedToUserId?: string | null;
  }) => {
    if (!selectedTicket) return;
    try {
      setUpdatingTicket(true);
      const updated = await updatePlatformTicket(selectedTicket.id, patch);
      setSelectedTicket(updated);
      setActionSuccess('Ticket updated successfully');
      setTimeout(() => setActionSuccess(null), 3000);
      loadQueue();
    } catch (err: any) {
      setError(err?.message || 'Failed to update ticket');
    } finally {
      setUpdatingTicket(false);
    }
  };

  // Handle Message Submission (Public reply vs Internal note)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !composerBody.trim()) return;

    try {
      setSubmittingMessage(true);
      await createPlatformTicketMessage(selectedTicket.id, {
        body: composerBody.trim(),
        isInternal: composerIsInternal,
      });

      setComposerBody('');
      setActionSuccess(
        composerIsInternal
          ? 'Internal staff note added successfully (private to platform)'
          : 'Public reply sent to customer successfully'
      );
      setTimeout(() => setActionSuccess(null), 3500);

      // Refresh ticket details & queue
      await loadTicketDetail(selectedTicket.id);
      loadQueue();
    } catch (err: any) {
      setError(err?.message || 'Failed to send message');
    } finally {
      setSubmittingMessage(false);
    }
  };

  // Handle Support Access Request (Stage D)
  const handleRequestSupportAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    try {
      setSubmittingAccess(true);
      const dto: CreateSupportAccessRequestDto = {
        reason: accessReason.trim() || `Support access for ${selectedTicket.ticketNumber}`,
        durationMinutes: Number(accessDuration),
        accessMode,
      };

      const result = await requestSupportAccess(selectedTicket.tenantId, dto);
      setAccessFeedback(`Support access request submitted successfully (Status: ${result.status.toUpperCase()})`);
      setTimeout(() => {
        setAccessModalOpen(false);
        setAccessFeedback(null);
      }, 2000);

      // Refresh detail to show updated session indicator
      await loadTicketDetail(selectedTicket.id);
    } catch (err: any) {
      setError(err?.message || 'Failed to request support access');
    } finally {
      setSubmittingAccess(false);
    }
  };

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const counts = data?.counts || {
      all: 0,
      open: 0,
      in_progress: 0,
      waiting: 0,
      resolved: 0,
      closed: 0,
    };
    const slaCounts = data?.slaCounts || {
      healthy: 0,
      warning: 0,
      breached: 0,
    };

    return [
      { label: 'Total Tickets', count: counts.all, color: 'text-slate-900 dark:text-white', icon: Headphones },
      { label: 'Open / In Progress', count: (counts.open || 0) + (counts.in_progress || 0), color: 'text-blue-600 dark:text-blue-400', icon: Clock },
      { label: 'Waiting on Customer', count: counts.waiting || 0, color: 'text-amber-600 dark:text-amber-400', icon: MessageSquare },
      { label: 'SLA Breached', count: slaCounts.breached || 0, color: 'text-red-600 dark:text-red-400', icon: AlertTriangle },
    ];
  }, [data]);

  // RENDER: Ticket Detail View
  if (selectedTicket) {
    const planInfo = getPlanBadge(selectedTicket.planId || selectedTicket.planName);
    const priority = priorityConfig[selectedTicket.priority] || priorityConfig.medium;
    const status = statusConfig[selectedTicket.status] || statusConfig.open;
    const slaInfo = slaBadgeStyles[selectedTicket.sla?.status] || slaBadgeStyles.healthy;
    const SlaIcon = slaInfo.icon;

    return (
      <div className="space-y-6 animate-fade-in text-slate-900 dark:text-slate-100 pb-12">
        {/* Navigation & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <button
            onClick={() => setSelectedTicketId(null)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Ticket Queue</span>
          </button>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Assignee Picker */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-sm text-xs">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-500 font-medium">Assignee:</span>
              <select
                value={selectedTicket.assignedToUserId || ''}
                disabled={updatingTicket}
                onChange={(e) => handleUpdateTicket({ assignedToUserId: e.target.value || null })}
                className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="">Unassigned</option>
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.firstName} {staff.lastName} ({staff.roleName})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Priority Selector */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-sm text-xs">
              <span className={`h-2 w-2 rounded-full ${priority.dot}`} />
              <span className="text-slate-500 font-medium">Priority:</span>
              <select
                value={selectedTicket.priority}
                disabled={updatingTicket}
                onChange={(e) => handleUpdateTicket({ priority: e.target.value as PlatformSupportTicketPriority })}
                className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Quick Status Selector */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-sm text-xs">
              <span className="text-slate-500 font-medium">Status:</span>
              <select
                value={selectedTicket.status}
                disabled={updatingTicket}
                onChange={(e) => handleUpdateTicket({ status: e.target.value as PlatformSupportTicketStatus })}
                className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting">Waiting on Customer</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* One-Click Request Support Access Button (Stage D) */}
            <button
              onClick={() => setAccessModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-semibold shadow-sm transition active:scale-95"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Request Support Access</span>
            </button>
          </div>
        </div>

        {/* Action / Error Banner */}
        {actionSuccess && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs font-semibold animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Ticket Header & Metadata */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                  {selectedTicket.ticketNumber}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${priority.bg} ${priority.text} ${priority.border}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} />
                  {priority.label}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${status.bg} ${status.text} ${status.border}`}>
                  {status.label}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${planInfo.bg} ${planInfo.text} ${planInfo.border}`}>
                  {selectedTicket.planName || planInfo.label} Plan
                </span>
              </div>

              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">
                {selectedTicket.subject}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {selectedTicket.tenantName || 'Tenant'}
                  </span>
                  <span className="text-slate-400 font-mono">({selectedTicket.tenantSubdomain}.hrm.local)</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span>Requester: <strong className="text-slate-700 dark:text-slate-300">{selectedTicket.requesterName || 'Customer'}</strong> ({selectedTicket.requesterEmail || 'N/A'})</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>Opened {new Date(selectedTicket.createdAt).toLocaleDateString()} at {new Date(selectedTicket.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            {/* SLA Status Card */}
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 min-w-[280px] space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Clock className="h-3.5 w-3.5 text-indigo-500" />
                  <span>SLA Policy: {selectedTicket.planName || planInfo.label}</span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  {selectedTicket.sla?.responseTargetHours}h Resp / {selectedTicket.sla?.resolutionTargetHours}h Resol
                </span>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">Current SLA Status:</span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${slaInfo.bg} ${slaInfo.text} ${slaInfo.border}`}>
                  <SlaIcon className="h-3.5 w-3.5" />
                  {selectedTicket.sla?.label || slaInfo.label}
                </span>
              </div>

              {/* Response Deadline */}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Response Target:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {new Date(selectedTicket.sla?.responseDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {selectedTicket.sla?.isResponseBreached ? ' (Breached)' : ''}
                </span>
              </div>

              {/* Resolution Deadline */}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Resolution Target:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {new Date(selectedTicket.sla?.resolutionDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {selectedTicket.sla?.isResolutionBreached ? ' (Breached)' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Active Support Access Banner if active */}
          {selectedTicket.activeSupportSession && (
            <div className="mt-5 p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-xs text-indigo-900 dark:text-indigo-200 font-semibold">
                <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Active Support Access Session detected for this tenant. Platform staff have authorized impersonation permissions.</span>
              </div>
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 px-2.5 py-1 rounded-md">
                Session Active (Mode: {selectedTicket.activeSupportSession.accessMode})
              </span>
            </div>
          )}
        </div>

        {/* Conversation Thread */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-500" />
              <span>Conversation Thread ({selectedTicket.messages.length + 1} items)</span>
            </h2>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                Customer Messages
              </span>
              <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                Public Replies
              </span>
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                <Lock className="h-3 w-3" />
                Internal Staff Notes
              </span>
            </div>
          </div>

          {/* Initial Ticket Description by Customer */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300">
                  {selectedTicket.requesterName?.charAt(0) || 'C'}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {selectedTicket.requesterName || 'Customer'}
                    <span className="ml-2 font-normal text-slate-500 text-[11px]">
                      ({selectedTicket.tenantName})
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Customer Ticket Submission</div>
                </div>
              </div>
              <div className="text-xs text-slate-400">
                {formatTimeAgo(selectedTicket.createdAt)}
              </div>
            </div>
            <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {selectedTicket.description}
            </div>
          </div>

          {/* Messages Loop: Public vs Internal */}
          {selectedTicket.messages.map((msg) => {
            const isStaffAuthor = msg.authorRole === 'staff';

            if (msg.isInternal) {
              // Internal Staff Note Card
              return (
                <div
                  key={msg.id}
                  className="bg-amber-50/60 dark:bg-amber-950/20 border-2 border-amber-300/80 dark:border-amber-700/60 rounded-2xl p-5 shadow-sm space-y-3 animate-fade-in"
                >
                  <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-800/60 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-amber-200 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center font-bold text-xs text-amber-800 dark:text-amber-200">
                        <Lock className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                            {msg.authorName || 'Platform Staff'}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 dark:bg-amber-900/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                            <Lock className="h-2.5 w-2.5" />
                            Internal Staff Note (Private to Platform)
                          </span>
                        </div>
                        <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                          Customer cannot see this message
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      {formatTimeAgo(msg.createdAt)}
                    </div>
                  </div>
                  <div className="text-sm text-amber-950 dark:text-amber-100 whitespace-pre-wrap leading-relaxed font-mono text-[13px]">
                    {msg.body}
                  </div>
                </div>
              );
            }

            // Customer or Staff Public Reply
            return (
              <div
                key={msg.id}
                className={`rounded-2xl p-5 shadow-sm space-y-3 animate-fade-in border ${
                  isStaffAuthor
                    ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/60'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div
                  className={`flex items-center justify-between border-b pb-3 ${
                    isStaffAuthor
                      ? 'border-indigo-100 dark:border-indigo-900/60'
                      : 'border-slate-100 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${
                        isStaffAuthor
                          ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {msg.authorName?.charAt(0) || (isStaffAuthor ? 'S' : 'C')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {msg.authorName || (isStaffAuthor ? 'Support Staff' : 'Customer')}
                        </span>
                        {isStaffAuthor ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                            Public Reply
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            Customer
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isStaffAuthor ? 'Platform Support Team' : selectedTicket.tenantName}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatTimeAgo(msg.createdAt)}
                  </div>
                </div>
                <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {msg.body}
                </div>
              </div>
            );
          })}
        </div>

        {/* Message Composer */}
        <form
          onSubmit={handleSendMessage}
          className={`rounded-2xl p-5 shadow-sm border transition ${
            composerIsInternal
              ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          {/* Mode Switcher */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setComposerIsInternal(false)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  !composerIsInternal
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Customer Reply (Public)
              </button>
              <button
                type="button"
                onClick={() => setComposerIsInternal(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  composerIsInternal
                    ? 'bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 shadow-sm'
                    : 'text-slate-500 hover:text-amber-600 dark:hover:text-amber-400'
                }`}
              >
                <Lock className="h-3 w-3" />
                <span>Internal Staff Note (Private)</span>
              </button>
            </div>

            {composerIsInternal ? (
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Private Note: Only visible to platform team
              </span>
            ) : (
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Visible to customer on tenant portal
              </span>
            )}
          </div>

          <div className="relative">
            <textarea
              rows={4}
              value={composerBody}
              onChange={(e) => setComposerBody(e.target.value)}
              placeholder={
                composerIsInternal
                  ? 'Write an internal investigation note, reproduction steps, or sync notes for platform staff (not visible to customer)...'
                  : 'Type your official customer-visible reply here. This will be visible on the tenant portal...'
              }
              className={`w-full p-3.5 rounded-xl text-sm border focus:outline-none transition ${
                composerIsInternal
                  ? 'border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-amber-950 dark:text-amber-100 focus:ring-2 focus:ring-amber-400/40'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-400/40'
              }`}
            />
          </div>

          <div className="flex items-center justify-between mt-3 pt-2">
            <span className="text-xs text-slate-500">
              {!composerIsInternal && selectedTicket.status === 'open' && (
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                  • Sending a customer reply will automatically move status to <strong>In Progress</strong> and assign to you.
                </span>
              )}
            </span>

            <button
              type="submit"
              disabled={submittingMessage || !composerBody.trim()}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition disabled:opacity-50 ${
                composerIsInternal
                  ? 'bg-amber-600 hover:bg-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500'
                  : 'bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500'
              }`}
            >
              {submittingMessage ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : composerIsInternal ? (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>Save Internal Note</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Send Customer Reply</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Modal: Request Support Access (Stage D) */}
        {accessModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5 animate-scale-in">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Request Support Access (Stage D)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Scoped access grant for tenant: <strong>{selectedTicket.tenantName}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAccessModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {accessFeedback && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>{accessFeedback}</span>
                </div>
              )}

              <form onSubmit={handleRequestSupportAccess} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Target Tenant & Plan
                  </label>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedTicket.tenantName} ({selectedTicket.tenantSubdomain}.hrm.local)
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${planInfo.bg} ${planInfo.text} ${planInfo.border}`}>
                      {selectedTicket.planName || planInfo.label}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Justification Reason (Audit Logged)
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={accessReason}
                    onChange={(e) => setAccessReason(e.target.value)}
                    placeholder="Enter explicit diagnostic or troubleshooting reason..."
                    className="w-full p-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 font-mono"
                  />
                  <span className="text-[10px] text-slate-500">
                    This reason is recorded in the platform immutable audit logs and tenant audit trail.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Session Duration
                    </label>
                    <select
                      value={accessDuration}
                      onChange={(e) => setAccessDuration(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value={15}>15 Minutes</option>
                      <option value={30}>30 Minutes</option>
                      <option value={60}>1 Hour (Standard)</option>
                      <option value={120}>2 Hours</option>
                      <option value={240}>4 Hours (Max)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Access Mode
                    </label>
                    <select
                      value={accessMode}
                      onChange={(e) => setAccessMode(e.target.value as SupportAccessMode)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="read_only">Read-Only Access</option>
                      <option value="read_write">Read-Write (Troubleshooting)</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    According to <strong>RULES.md</strong> and <strong>MODULES.md #45</strong>, support impersonation is time-bounded, scoped to this tenant, and triggers automatic session expiration upon timer lapse.
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setAccessModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAccess || !accessReason.trim()}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                  >
                    {submittingAccess ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="h-3.5 w-3.5" />
                        <span>Submit Access Request</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // RENDER: Cross-Tenant Ticket Queue View
  return (
    <div className="space-y-6 animate-fade-in text-slate-900 dark:text-slate-100 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs mb-1">
            <Headphones className="h-4 w-4" />
            <span>Platform Support Operations</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Support Ticket Queue
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Cross-tenant ticket management, SLA enforcement, internal notes, and one-click support access
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadQueue}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-semibold shadow-sm transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary Statistics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{metric.label}</p>
                <p className={`text-2xl font-black mt-1 ${metric.color}`}>{metric.count}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center text-slate-500">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Tickets' },
              { id: 'open', label: 'Open' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'waiting', label: 'Waiting' },
              { id: 'resolved', label: 'Resolved' },
              { id: 'closed', label: 'Closed' },
            ].map((tab) => {
              const active = filterStatus === tab.id;
              const count =
                tab.id === 'all'
                  ? data?.counts?.all
                  : (data?.counts as any)?.[tab.id] || 0;

              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id as any)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  {count !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        active
                          ? 'bg-indigo-700 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search ticket #, subject, tenant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Sub-Filters: Tenant, Priority, Assignee, SLA */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Filter className="h-3.5 w-3.5 text-indigo-500" />
            <span>Refine:</span>
          </div>

          {/* Tenant Filter */}
          <select
            value={filterTenant}
            onChange={(e) => setFilterTenant(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Tenants</option>
            {tenantList.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.planId || 'Starter'})
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as any)}
            className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* SLA Filter */}
          <select
            value={filterSla}
            onChange={(e) => setFilterSla(e.target.value as any)}
            className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All SLA States</option>
            <option value="healthy">Healthy</option>
            <option value="warning">Nearing SLA (Warning)</option>
            <option value="breached">Breached</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Assignees</option>
            <option value="me">Assigned to Me</option>
            <option value="unassigned">Unassigned</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName} ({s.roleName})
              </option>
            ))}
          </select>

          {(filterTenant !== 'all' || filterPriority !== 'all' || filterAssignee !== 'all' || filterSla !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setFilterTenant('all');
                setFilterPriority('all');
                setFilterAssignee('all');
                setFilterSla('all');
                setSearchQuery('');
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Ticket Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Tenant & Plan</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">SLA Status & Remaining</th>
                <th className="px-4 py-3">Last Active</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && !data ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    <span>Loading support ticket queue...</span>
                  </td>
                </tr>
              ) : data?.items?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <Headphones className="h-8 w-8 mx-auto mb-2 text-slate-400 opacity-60" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No tickets found</p>
                    <p className="text-[11px] text-slate-400 mt-1">Try relaxing filters or search query.</p>
                  </td>
                </tr>
              ) : (
                data?.items?.map((ticket) => {
                  const plan = getPlanBadge(ticket.planId || ticket.planName);
                  const priority = priorityConfig[ticket.priority] || priorityConfig.medium;
                  const status = statusConfig[ticket.status] || statusConfig.open;
                  const sla = slaBadgeStyles[ticket.sla?.status] || slaBadgeStyles.healthy;
                  const SlaIcon = sla.icon;

                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition group"
                    >
                      {/* Ticket # & Subject */}
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold text-slate-500 text-[11px]">
                          {ticket.ticketNumber}
                        </div>
                        <div className="font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                          {ticket.subject}
                        </div>
                        <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {ticket.description}
                        </div>
                      </td>

                      {/* Tenant & Plan */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <Building2 className="h-3 w-3 text-indigo-500" />
                          <span>{ticket.tenantName || 'Tenant'}</span>
                        </div>
                        <div className="mt-1">
                          <span className={`inline-flex px-1.5 py-0.2 rounded text-[10px] font-bold border ${plan.bg} ${plan.text} ${plan.border}`}>
                            {ticket.planName || plan.label}
                          </span>
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold border ${priority.bg} ${priority.text} ${priority.border}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} />
                          {priority.label}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-md font-semibold border ${status.bg} ${status.text} ${status.border}`}>
                          {status.label}
                        </span>
                      </td>

                      {/* Assignee */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {ticket.assigneeName ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center font-bold text-[10px] text-indigo-700 dark:text-indigo-300">
                              {ticket.assigneeName.charAt(0)}
                            </div>
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {ticket.assigneeName}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                            <UserPlus className="h-3 w-3" />
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* SLA Status & Remaining */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${sla.bg} ${sla.text} ${sla.border}`}>
                          <SlaIcon className="h-3.5 w-3.5" />
                          <span>{ticket.sla?.label || sla.label}</span>
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Policy: {ticket.sla?.responseTargetHours}h Resp / {ticket.sla?.resolutionTargetHours}h Resol
                        </div>
                      </td>

                      {/* Last Active */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {formatTimeAgo(ticket.updatedAt)}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicketId(ticket.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold hover:border-indigo-400 hover:text-indigo-600 transition"
                        >
                          <span>View</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default SupportTicketsPage;
