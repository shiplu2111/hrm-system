import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { LeaveRequestRecord } from '@hrm/shared-types';
import { ApiError, Button } from '@hrm/portal-ui';
import { cancelLeaveRequest } from '@/lib/ess-api';
import { LeaveStatusPill } from './LeaveStatusPill';
import { approverLabel, useLeaveFormat } from './leave-i18n';

interface MyLeaveRequestsProps {
  requests: LeaveRequestRecord[];
  onCancelled: (updated: LeaveRequestRecord) => void;
}

export function MyLeaveRequests({ requests, onCancelled }: MyLeaveRequestsProps) {
  const { t } = useLeaveFormat();

  if (requests.length === 0) {
    return <p className="py-2 text-sm text-muted">{t('leave.noRequests')}</p>;
  }

  return (
    <ul className="divide-y divide-[rgb(var(--border-base))]">
      {requests.map((request) => (
        <MyLeaveRequestRow key={request.id} request={request} onCancelled={onCancelled} />
      ))}
    </ul>
  );
}

function MyLeaveRequestRow({
  request,
  onCancelled,
}: {
  request: LeaveRequestRecord;
  onCancelled: (updated: LeaveRequestRecord) => void;
}) {
  const { t, days, range, date } = useLeaveFormat();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancellable = request.status === 'pending' || request.status === 'draft';

  async function handleCancel() {
    setCancelling(true);
    setError(null);
    try {
      const updated = await cancelLeaveRequest(request.id);
      setConfirming(false);
      onCancelled(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('leave.request.cancelFailed'));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5 text-sm">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-primary">
              {request.leaveTypeName ?? t('dashboard.leaveFallback')}
            </span>
            {request.halfDay && <span className="text-xs text-muted">{t('leave.halfDay')}</span>}
            {request.leaveTypeIsPaid === false && (
              <span className="text-xs text-muted">{t('leave.unpaid')}</span>
            )}
          </div>
          <div className="text-secondary">
            {range(request.startDate, request.endDate)} · {days(request.totalDays)}
          </div>
          <RequestProgress request={request} />
          <div className="text-xs text-muted">
            {t('leave.request.submittedOn', { date: date(request.createdAt) })}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <LeaveStatusPill status={request.status} />
          {cancellable && !confirming && (
            <button
              type="button"
              className="text-xs font-medium text-secondary hover:text-error-600"
              onClick={() => setConfirming(true)}
            >
              {t('leave.request.cancel')}
            </button>
          )}
        </div>
      </div>

      {confirming && cancellable && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs">
          <span className="mr-auto text-secondary">{t('leave.request.confirmCancel')}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={cancelling}
            onClick={() => {
              setConfirming(false);
              setError(null);
            }}
          >
            {t('leave.request.keep')}
          </Button>
          <Button variant="danger" size="sm" disabled={cancelling} onClick={() => void handleCancel()}>
            {cancelling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('leave.request.confirmCancelYes')}
          </Button>
        </div>
      )}
      {error && <p className="mt-1 text-right text-xs text-error-600">{error}</p>}
    </li>
  );
}

function RequestProgress({ request }: { request: LeaveRequestRecord }) {
  const { t, number } = useLeaveFormat();
  const chain = request.approvalChain ?? [];

  if (request.status === 'pending') {
    const index = chain.findIndex((step) => step.status === 'pending');
    if (index < 0) return null;
    return (
      <div className="text-xs text-warning-700 dark:text-warning-300">
        {t('leave.request.waitingFor', {
          approver: approverLabel(t, chain[index].roleName),
          position: number(index + 1),
          total: number(chain.length),
        })}
      </div>
    );
  }

  if (request.status === 'approved') {
    const last = [...chain].reverse().find((step) => step.status === 'approved');
    return (
      <div className="text-xs text-success-700 dark:text-success-300">
        {last?.actedByName
          ? t('leave.request.approvedBy', { name: last.actedByName })
          : t('leave.request.approved')}
      </div>
    );
  }

  if (request.status === 'rejected') {
    const step = chain.find((s) => s.status === 'rejected');
    return (
      <div className="space-y-0.5 text-xs">
        <div className="text-error-700 dark:text-error-300">
          {step?.actedByName
            ? t('leave.request.rejectedBy', { name: step.actedByName })
            : t('leave.request.rejected')}
        </div>
        {step?.comment && <div className="italic text-secondary">“{step.comment}”</div>}
      </div>
    );
  }

  return null;
}
