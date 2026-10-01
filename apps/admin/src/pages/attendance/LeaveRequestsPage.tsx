import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Inbox,
  X,
} from 'lucide-react';
import {
  LEAVE_REQUEST_STATUS_META,
  leaveApproverLabel,
  type LeaveRequestRecord,
  type LeaveRequestStatus,
} from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Toggle';
import { DataTable, DataTableBody, DataTableHead } from '@/components/ui/DataTable';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgErrorBanner, OrgTableSkeleton } from '@/components/org/OrgScreenParts';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import { LeaveStatusPill } from '@/components/leave/LeaveStatusPill';
import {
  LeaveRequestDetailPanel,
  type LeaveDecision,
} from '@/components/leave/LeaveRequestDetailPanel';
import { useCompany } from '@/context/CompanyContext';
import { approveLeaveRequest, listLeaveApprovals, listLeaveRequests } from '@/lib/leave-api';
import { formatDays } from '@/lib/leave-policy';
import {
  approvalProgress,
  currentStepLabel,
  daysUntil,
  formatDateTime,
  formatLeaveDates,
  formatLeaveLength,
  formatRelativeTime,
} from '@/lib/leave-request';
import { ApiError } from '@/lib/tenant-api-client';

type Tab = 'inbox' | 'all';

const PAGE_SIZE = 50;
const STATUS_FILTERS: Array<LeaveRequestStatus | ''> = [
  '',
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'draft',
];

export function LeaveRequestsPage() {
  const { companyId, loading: companyLoading, error: companyError } = useCompany();

  if (companyLoading) return <PageLoadingState message="Loading company…" />;
  if (companyError) return <PageErrorState error={companyError} />;
  if (!companyId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">No company found for this tenant.</div>
    );
  }
  return <LeaveRequestsScreen key={companyId} companyId={companyId} />;
}

function startsLabel(startDate: string): { text: string; urgent: boolean } | null {
  const days = daysUntil(startDate);
  if (days < 0) return { text: 'Already started', urgent: true };
  if (days === 0) return { text: 'Starts today', urgent: true };
  if (days === 1) return { text: 'Starts tomorrow', urgent: true };
  if (days <= 7) return { text: `Starts in ${days} days`, urgent: false };
  return null;
}

function nextApproverText(roleName: string | undefined): string {
  if (!roleName) return 'the next approver';
  const label = leaveApproverLabel(roleName);
  return label === roleName ? label : `the ${label.toLowerCase()}`;
}

function LeaveRequestsScreen({ companyId }: { companyId: string }) {
  const canApprove = usePermission('leave', 'approve');
  const [tab, setTab] = useState<Tab>(canApprove ? 'inbox' : 'all');

  const [inbox, setInbox] = useState<LeaveRequestRecord[]>([]);
  const [inboxLoading, setInboxLoading] = useState(canApprove);
  const [inboxError, setInboxError] = useState<string | null>(null);

  const [rows, setRows] = useState<LeaveRequestRecord[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | ''>('');
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<LeaveRequestRecord | null>(null);
  const [quickApprovingId, setQuickApprovingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    if (!canApprove) return;
    setInboxError(null);
    try {
      setInbox(await listLeaveApprovals(companyId));
    } catch (err) {
      setInboxError(err instanceof ApiError ? err.message : 'Failed to load your approval inbox');
    } finally {
      setInboxLoading(false);
    }
  }, [canApprove, companyId]);

  const loadRows = useCallback(async () => {
    setRowsLoading(true);
    setRowsError(null);
    try {
      setRows(
        await listLeaveRequests(companyId, {
          status: statusFilter || undefined,
          page,
          pageSize: PAGE_SIZE,
        }),
      );
    } catch (err) {
      setRowsError(err instanceof ApiError ? err.message : 'Failed to load leave requests');
    } finally {
      setRowsLoading(false);
    }
  }, [companyId, statusFilter, page]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const inboxIds = useMemo(() => new Set(inbox.map((r) => r.id)), [inbox]);

  const handleDecided = (updated: LeaveRequestRecord, decision: LeaveDecision) => {
    const who = updated.employee?.fullName ?? 'the employee';
    const what = `${updated.leaveTypeName ?? 'leave'} (${formatLeaveDates(updated.startDate, updated.endDate)})`;
    const next = approvalProgress(updated.approvalChain).current;
    setNotice(
      decision === 'reject'
        ? `Rejected ${who}'s ${what}.`
        : updated.status === 'approved'
          ? `Approved ${who}'s ${what}. The balance has been updated.`
          : `Approved your step for ${who}'s ${what}. It now waits for ${nextApproverText(next?.roleName)}.`,
    );
    setSelected(null);
    void loadInbox();
    void loadRows();
  };

  const quickApprove = async (request: LeaveRequestRecord) => {
    setQuickApprovingId(request.id);
    setInboxError(null);
    try {
      handleDecided(await approveLeaveRequest(request.id), 'approve');
    } catch (err) {
      setInboxError(err instanceof ApiError ? err.message : 'Could not approve the request');
    } finally {
      setQuickApprovingId(null);
    }
  };

  const flaggedCount = inbox.filter((r) => r.balanceWarning).length;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">Leave</p>
          <h1 className="text-xl font-bold text-primary">Leave Requests</h1>
          <p className="text-sm text-secondary mt-0.5">
            {canApprove
              ? 'Decide on requests waiting for you and look up any request in the company.'
              : 'Every leave request in the company, with its approval progress.'}
          </p>
        </div>
        <CompanySelector />
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-success-700 dark:text-success-300 bg-success-50 dark:bg-success-900/30 border border-success-200 dark:border-success-800 rounded-lg px-4 py-2"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="text-muted hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {canApprove ? (
        <div role="tablist" aria-label="Leave request views" className="flex gap-1 border-b border-base">
          {(
            [
              { key: 'inbox', label: 'Awaiting my approval', icon: Inbox, count: inbox.length },
              { key: 'all', label: 'All requests', icon: ClipboardList, count: null },
            ] as const
          ).map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key
                  ? 'border-accent-600 text-accent-700 dark:text-accent-300'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {count !== null && !inboxLoading ? (
                <span
                  className={`min-w-[1.25rem] rounded-full px-1.5 text-2xs font-semibold tabular-nums ${
                    count > 0
                      ? 'bg-accent-600 text-white'
                      : 'bg-[rgb(var(--bg-muted))] text-muted'
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {tab === 'inbox' && canApprove ? (
        <section className="space-y-3">
          {inboxError ? <OrgErrorBanner message={inboxError} onRetry={() => void loadInbox()} /> : null}
          {!inboxLoading && inbox.length > 0 ? (
            <p className="text-sm text-secondary">
              {inbox.length} request{inbox.length === 1 ? '' : 's'} waiting for you, soonest first
              {flaggedCount > 0 ? ` · ${flaggedCount} would overdraw a balance` : ''}.
            </p>
          ) : null}
          <Card>
            {inboxLoading ? (
              <OrgTableSkeleton columns={4} />
            ) : inbox.length === 0 ? (
              <EmptyState
                compact
                icon={CheckCircle2}
                title="You're all caught up"
                description="Requests that reach your step in the approval chain will appear here."
                action={{ label: 'Browse all requests', onClick: () => setTab('all'), variant: 'secondary' }}
              />
            ) : (
              <ul className="divide-y divide-[rgb(var(--border-base))]">
                {inbox.map((request) => {
                  const starts = startsLabel(request.startDate);
                  const name = request.employee?.fullName ?? 'Employee';
                  return (
                    <li
                      key={request.id}
                      className="flex flex-col lg:flex-row lg:items-center gap-3 px-5 py-4 hover:bg-[rgb(var(--bg-hover))] cursor-pointer"
                      onClick={() => setSelected(request)}
                    >
                      <div className="flex items-center gap-3 lg:w-64 shrink-0 min-w-0">
                        <Avatar name={name} size="md" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-primary truncate">{name}</p>
                          <p className="text-xs text-muted truncate">
                            {[request.employee?.employeeNumber, request.employee?.departmentName]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium text-primary">
                            {request.leaveTypeName ?? 'Leave'}
                          </span>
                          <span className="text-secondary">
                            {formatLeaveDates(request.startDate, request.endDate)}
                          </span>
                          <span className="text-muted">·</span>
                          <span className="text-secondary tabular-nums">{formatLeaveLength(request)}</span>
                          {request.leaveTypeIsPaid === false ? <Badge tone="neutral">Unpaid</Badge> : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className="text-muted" title={formatDateTime(request.createdAt)}>
                            Submitted {formatRelativeTime(request.createdAt)}
                          </span>
                          {currentStepLabel(request.approvalChain) ? (
                            <span className="text-secondary">{currentStepLabel(request.approvalChain)}</span>
                          ) : null}
                          {starts ? (
                            <span
                              className={
                                starts.urgent
                                  ? 'font-medium text-warning-700 dark:text-warning-300'
                                  : 'text-secondary'
                              }
                            >
                              {starts.text}
                            </span>
                          ) : null}
                          {request.balanceWarning ? (
                            <span className="inline-flex items-center gap-1 font-medium text-error-700 dark:text-error-400">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Balance after approval: {formatDays(request.balanceWarning.projectedBalance)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div
                        className="flex items-center gap-2 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button variant="secondary" size="sm" onClick={() => setSelected(request)}>
                          Review
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={quickApprovingId !== null}
                          onClick={() => void quickApprove(request)}
                          aria-label={`Approve ${name}'s request`}
                        >
                          <Check className="h-4 w-4" />
                          {quickApprovingId === request.id ? 'Approving…' : 'Approve'}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>
      ) : (
        <section className="space-y-3">
          {rowsError ? <OrgErrorBanner message={rowsError} onRetry={() => void loadRows()} /> : null}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as LeaveRequestStatus | '');
                    setPage(1);
                  }}
                  className="max-w-[12rem]"
                >
                  {STATUS_FILTERS.map((status) => (
                    <option key={status || 'all'} value={status}>
                      {status ? LEAVE_REQUEST_STATUS_META[status].label : 'All statuses'}
                    </option>
                  ))}
                </Select>
                <span className="text-xs text-muted">Newest first</span>
              </div>
            </CardHeader>
            {rowsLoading ? (
              <OrgTableSkeleton columns={6} />
            ) : rows.length === 0 ? (
              <EmptyState
                compact
                icon={ClipboardList}
                title={statusFilter || page > 1 ? 'No matching requests' : 'No leave requests yet'}
                description={
                  statusFilter
                    ? `There are no ${LEAVE_REQUEST_STATUS_META[statusFilter].label.toLowerCase()} requests.`
                    : 'Requests appear here once employees submit them from the employee portal.'
                }
              />
            ) : (
              <DataTable>
                <DataTableHead>
                  <tr className="text-left text-xs font-semibold text-secondary uppercase tracking-wide">
                    <th className="px-5 py-2.5">Employee</th>
                    <th className="px-5 py-2.5">Leave type</th>
                    <th className="px-5 py-2.5">Dates</th>
                    <th className="px-5 py-2.5 hidden md:table-cell">Length</th>
                    <th className="px-5 py-2.5">Status</th>
                    <th className="px-5 py-2.5 hidden lg:table-cell">Progress</th>
                    <th className="px-5 py-2.5 hidden xl:table-cell">Submitted</th>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {rows.map((request) => {
                    const name = request.employee?.fullName ?? 'Employee';
                    const waitingForMe = inboxIds.has(request.id);
                    return (
                      <tr
                        key={request.id}
                        onClick={() => setSelected(request)}
                        className="hover:bg-[rgb(var(--bg-hover))] cursor-pointer"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar name={name} size="sm" />
                            <div className="min-w-0">
                              <p className="font-medium text-primary truncate">{name}</p>
                              <p className="text-xs text-muted truncate">
                                {request.employee?.employeeNumber}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-secondary">{request.leaveTypeName ?? 'Leave'}</td>
                        <td className="px-5 py-3 text-secondary whitespace-nowrap">
                          {formatLeaveDates(request.startDate, request.endDate)}
                        </td>
                        <td className="px-5 py-3 text-secondary tabular-nums hidden md:table-cell">
                          {formatLeaveLength(request)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-col items-start gap-1">
                            <LeaveStatusPill status={request.status} />
                            {waitingForMe ? (
                              <span className="text-2xs font-medium text-accent-700 dark:text-accent-300">
                                Waiting for you
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-secondary hidden lg:table-cell">
                          {request.status === 'pending'
                            ? currentStepLabel(request.approvalChain) ?? '—'
                            : request.approvalChain.length
                              ? `${request.approvalChain.filter((s) => s.status === 'approved').length} of ${request.approvalChain.length} approved`
                              : '—'}
                        </td>
                        <td
                          className="px-5 py-3 text-xs text-muted hidden xl:table-cell whitespace-nowrap"
                          title={formatDateTime(request.createdAt)}
                        >
                          {formatRelativeTime(request.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </DataTableBody>
              </DataTable>
            )}
            {!rowsLoading && (page > 1 || rows.length === PAGE_SIZE) ? (
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-base">
                <span className="text-xs text-secondary mr-2">Page {page}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={rows.length < PAGE_SIZE}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </Card>
        </section>
      )}

      <LeaveRequestDetailPanel
        open={selected !== null}
        request={selected}
        canDecide={selected !== null && inboxIds.has(selected.id)}
        onClose={() => setSelected(null)}
        onDecided={handleDecided}
      />
    </div>
  );
}
