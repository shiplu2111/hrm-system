import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Check,
  Circle,
  Clock,
  Send,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  leaveApproverLabel,
  type LeaveBalanceRecord,
  type LeaveRequestRecord,
} from '@hrm/shared-types';
import { SidePanel } from '@/components/ui/SidePanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Label, Textarea } from '@/components/ui/Form';
import { Skeleton } from '@/components/ui/Skeleton';
import { Timeline, type TimelineItem, type TimelineTone } from '@/components/ui/Timeline';
import { OrgErrorBanner } from '@/components/org/OrgScreenParts';
import { LeaveStatusPill } from '@/components/leave/LeaveStatusPill';
import {
  approveLeaveRequest,
  getEmployeeLeaveBalances,
  rejectLeaveRequest,
} from '@/lib/leave-api';
import { formatDays, formatIsoDate } from '@/lib/leave-policy';
import {
  currentStepLabel,
  formatDateTime,
  formatLeaveDates,
  formatLeaveLength,
  formatRelativeTime,
} from '@/lib/leave-request';
import { ApiError } from '@/lib/tenant-api-client';

export type LeaveDecision = 'approve' | 'reject';

function buildTimeline(request: LeaveRequestRecord): TimelineItem[] {
  const items: TimelineItem[] = [
    {
      id: 'submitted',
      title: 'Submitted',
      subtitle: request.employee?.fullName,
      date: formatDateTime(request.createdAt),
      tone: 'accent',
      icon: Send,
    },
  ];
  const firstPending = request.approvalChain.findIndex((s) => s.status === 'pending');

  request.approvalChain.forEach((step, index) => {
    const title = leaveApproverLabel(step.roleName);
    const comment = step.comment ? `“${step.comment}”` : undefined;
    let tone: TimelineTone = 'neutral';
    let icon: LucideIcon = Circle;
    let subtitle: string;

    if (step.status === 'approved') {
      tone = 'success';
      icon = Check;
      subtitle = `Approved${step.actedByName ? ` by ${step.actedByName}` : ''}`;
    } else if (step.status === 'rejected') {
      tone = 'error';
      icon = X;
      subtitle = `Rejected${step.actedByName ? ` by ${step.actedByName}` : ''}`;
    } else if (step.status === 'skipped') {
      subtitle = 'Skipped';
    } else if (request.status !== 'pending') {
      subtitle = request.status === 'cancelled' ? 'Not reached — request cancelled' : 'Not reached';
    } else if (index === firstPending) {
      tone = 'warning';
      icon = Clock;
      subtitle = 'Awaiting decision';
    } else {
      subtitle = 'Waiting for the previous step';
    }

    items.push({
      id: `step-${index}`,
      title,
      subtitle,
      meta: comment,
      date: step.actedAt ? formatDateTime(step.actedAt) : '',
      tone,
      icon,
    });
  });

  if (request.status === 'cancelled') {
    items.push({
      id: 'cancelled',
      title: 'Cancelled by the employee',
      date: formatDateTime(request.updatedAt),
      tone: 'neutral',
      icon: Ban,
    });
  }
  return items;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="col-span-2 text-sm text-primary">{children}</dd>
    </div>
  );
}

function BalanceImpact({ request }: { request: LeaveRequestRecord }) {
  const [balance, setBalance] = useState<LeaveBalanceRecord | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    getEmployeeLeaveBalances(request.employeeId)
      .then((rows) => {
        if (!active) return;
        setBalance(rows.find((b) => b.leaveTypeId === request.leaveTypeId) ?? null);
        setState('ready');
      })
      .catch(() => active && setState('error'));
    return () => {
      active = false;
    };
  }, [request.employeeId, request.leaveTypeId]);

  if (state === 'loading') return <Skeleton className="h-20 w-full" />;
  if (state === 'error' || !balance) {
    return <p className="text-xs text-muted">The current balance could not be loaded.</p>;
  }

  const available = balance.balanceDays;
  const countedInYearPending =
    request.status === 'pending' &&
    (!balance.leaveYearStart || request.startDate >= balance.leaveYearStart) &&
    (!balance.leaveYearEnd || request.startDate <= balance.leaveYearEnd);
  const pendingOthers = Math.max(
    0,
    (balance.pendingDays ?? 0) - (countedInYearPending ? request.totalDays : 0),
  );
  const after = available - request.totalDays;

  const stats =
    request.status === 'pending'
      ? [
          { label: 'Available now', value: formatDays(available) },
          { label: 'Other pending', value: formatDays(pendingOthers) },
          { label: 'After approval', value: formatDays(after), negative: after < 0 },
        ]
      : [
          { label: 'Available now', value: formatDays(available) },
          { label: 'Used this year', value: formatDays(balance.usedDays ?? 0) },
          { label: 'Pending', value: formatDays(balance.pendingDays ?? 0) },
        ];

  return (
    <div className="grid grid-cols-3 gap-3 rounded-lg border border-base px-4 py-3">
      {stats.map((s) => (
        <div key={s.label}>
          <p className="text-2xs uppercase tracking-wide text-muted">{s.label}</p>
          <p
            className={`text-sm font-semibold tabular-nums ${
              s.negative ? 'text-error-700 dark:text-error-400' : 'text-primary'
            }`}
          >
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function LeaveRequestDetailPanel({
  open,
  request,
  canDecide,
  onClose,
  onDecided,
}: {
  open: boolean;
  request: LeaveRequestRecord | null;
  /** The request sits in the current user's approval inbox. */
  canDecide: boolean;
  onClose: () => void;
  onDecided: (updated: LeaveRequestRecord, decision: LeaveDecision) => void;
}) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState<LeaveDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectAttempted, setRejectAttempted] = useState(false);

  useEffect(() => {
    setComment('');
    setError(null);
    setSubmitting(null);
    setRejectAttempted(false);
  }, [request?.id]);

  if (!request) return null;

  const employee = request.employee;
  const description = [employee?.employeeNumber, employee?.designationName, employee?.departmentName]
    .filter(Boolean)
    .join(' · ');
  const warning = request.balanceWarning;
  const stepLabel = currentStepLabel(request.approvalChain);
  const showDecision = canDecide && request.status === 'pending';
  const rejectMissingReason = rejectAttempted && !comment.trim();

  const decide = async (decision: LeaveDecision) => {
    if (decision === 'reject' && !comment.trim()) {
      setRejectAttempted(true);
      return;
    }
    setSubmitting(decision);
    setError(null);
    try {
      const updated =
        decision === 'approve'
          ? await approveLeaveRequest(request.id, comment.trim() || undefined)
          : await rejectLeaveRequest(request.id, comment.trim());
      onDecided(updated, decision);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${decision} the request`);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={employee?.fullName ?? 'Leave request'}
      description={description || undefined}
    >
      <div className="space-y-6">
        <section>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <LeaveStatusPill status={request.status} />
            <span className="text-sm font-semibold text-primary">
              {request.leaveTypeName ?? 'Leave'}
            </span>
            {request.leaveTypeIsPaid === false ? <Badge tone="neutral">Unpaid</Badge> : null}
          </div>
          <dl className="divide-y divide-[rgb(var(--border-base))]">
            <Detail label="Dates">{formatLeaveDates(request.startDate, request.endDate)}</Detail>
            <Detail label="Length">
              {formatLeaveLength(request)}
              {request.halfDay ? ' (0.5 day)' : ' (working days)'}
            </Detail>
            <Detail label="Submitted">
              <span title={formatDateTime(request.createdAt)}>
                {formatRelativeTime(request.createdAt)}
              </span>
            </Detail>
            <Detail label="Reason">
              {request.reason ? (
                <span className="whitespace-pre-line">{request.reason}</span>
              ) : (
                <span className="text-muted">No reason given</span>
              )}
            </Detail>
            {request.deductedAt ? (
              <Detail label="Deducted">{formatIsoDate(request.deductedAt)}</Detail>
            ) : null}
          </dl>
        </section>

        {request.leaveTypeIsPaid !== false ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">
              {request.leaveTypeName ?? 'Leave'} balance
            </h3>
            {warning && request.status === 'pending' ? (
              <div
                role="alert"
                className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
                  warning.negativeCapExceeded
                    ? 'border-error-200 bg-error-50 text-error-700 dark:border-error-800 dark:bg-error-900/30 dark:text-error-300'
                    : 'border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-800 dark:bg-warning-900/30 dark:text-warning-300'
                }`}
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Approving takes the balance to{' '}
                  <strong className="tabular-nums">{formatDays(warning.projectedBalance)}</strong>
                  {warning.negativeCapExceeded
                    ? ', beyond what the policy allows.'
                    : '. The policy allows a negative balance.'}
                </span>
              </div>
            ) : null}
            <BalanceImpact key={request.id} request={request} />
          </section>
        ) : null}

        {showDecision ? (
          <section className="rounded-lg border border-accent-200 dark:border-accent-800 bg-accent-50/50 dark:bg-accent-950/20 px-4 py-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-primary">Your decision</h3>
              {stepLabel ? <p className="text-xs text-secondary mt-0.5">{stepLabel}</p> : null}
            </div>
            <div>
              <Label htmlFor="leave-decision-comment">Comment</Label>
              <Textarea
                id="leave-decision-comment"
                rows={3}
                maxLength={1000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional when approving, required when rejecting"
                aria-invalid={rejectMissingReason}
                className={rejectMissingReason ? 'border-error-500 focus:border-error-500' : ''}
              />
              {rejectMissingReason ? (
                <p className="text-xs text-error-600 mt-1">
                  Add a reason so the employee knows why it was rejected.
                </p>
              ) : null}
            </div>
            {error ? <OrgErrorBanner message={error} /> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                disabled={submitting !== null}
                onClick={() => void decide('reject')}
              >
                <X className="h-4 w-4" /> {submitting === 'reject' ? 'Rejecting…' : 'Reject'}
              </Button>
              <Button
                variant="primary"
                disabled={submitting !== null}
                onClick={() => void decide('approve')}
              >
                <Check className="h-4 w-4" /> {submitting === 'approve' ? 'Approving…' : 'Approve'}
              </Button>
            </div>
          </section>
        ) : null}

        <section>
          <h3 className="text-sm font-semibold text-primary mb-4">Approval progress</h3>
          <Timeline items={buildTimeline(request)} />
        </section>
      </div>
    </SidePanel>
  );
}
