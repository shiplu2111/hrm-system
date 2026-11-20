import { useCallback, useEffect, useState } from 'react';
import { Check, Clock, X } from 'lucide-react';
import type {
  OvertimeRateType,
  OvertimeRequestRecord,
  OvertimeRequestStatus,
} from '@hrm/shared-types';
import { usePermissions } from '@hrm/portal-ui';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusPill, type StatusPillTone } from '@/components/ui/StatusPill';
import { Avatar } from '@/components/ui/Toggle';
import { useCompany } from '@/context/CompanyContext';
import {
  approveOvertimeRequest,
  listCompanyOvertimeRequests,
  rejectOvertimeRequest,
} from '@/lib/roster-requests-api';
import { ApiError } from '@/lib/tenant-api-client';

const statusTone: Record<OvertimeRequestStatus, StatusPillTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  cancelled: 'neutral',
};

const rateTone: Record<OvertimeRateType, 'accent' | 'warning' | 'error' | 'info'> = {
  weekday: 'accent',
  weekend: 'warning',
  holiday: 'error',
  night: 'info',
};

export function OvertimePage() {
  const { companyId } = useCompany();
  const { can } = usePermissions();
  const canApprove = can('attendance', 'approve');

  const [requests, setRequests] = useState<OvertimeRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRequests(await listCompanyOvertimeRequests(companyId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load overtime requests');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id);
    setError(null);
    try {
      const updated =
        action === 'approve' ? await approveOvertimeRequest(id) : await rejectOvertimeRequest(id);
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : `Failed to ${action} overtime request`);
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const totalHours = requests
    .filter((r) => r.status === 'approved')
    .reduce((s, r) => s + r.hours, 0);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Overtime Requests</h1>
          <p className="text-sm text-secondary mt-0.5">
            {pendingCount} pending · {totalHours}h approved
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-900/30 dark:text-error-300">
          {error}
        </div>
      )}

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted">
              No overtime requests submitted yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">
                      Date
                    </th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Hours
                    </th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Rate Type
                    </th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden lg:table-cell">
                      Reason
                    </th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="w-24 px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {requests.map((req) => {
                    const busy = busyId === req.id;
                    return (
                      <tr key={req.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={req.employeeName} size="sm" />
                            <div>
                              <div className="font-medium text-primary">{req.employeeName}</div>
                              <div className="text-xs text-muted">{req.employeeNumber}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-secondary hidden md:table-cell">
                          {req.date}
                        </td>
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-1 text-primary font-medium tabular-nums">
                            <Clock className="h-3.5 w-3.5 text-muted" /> {req.hours}h
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={rateTone[req.rateType]} className="capitalize">
                            {req.rateType}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-secondary hidden lg:table-cell max-w-[200px] truncate">
                          {req.reason}
                        </td>
                        <td className="px-5 py-3">
                          <StatusPill tone={statusTone[req.status]} className="capitalize">
                            {req.status}
                          </StatusPill>
                        </td>
                        <td className="px-5 py-3">
                          {req.status === 'pending' && canApprove ? (
                            <div className="flex items-center gap-1">
                              <button
                                disabled={busy}
                                onClick={() => void handleAction(req.id, 'approve')}
                                aria-label="Approve"
                                className="h-7 w-7 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 hover:bg-success-100 flex items-center justify-center transition-colors disabled:opacity-50"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => void handleAction(req.id, 'reject')}
                                aria-label="Reject"
                                className="h-7 w-7 rounded-lg bg-error-50 dark:bg-error-950/40 text-error-600 dark:text-error-400 hover:bg-error-100 flex items-center justify-center transition-colors disabled:opacity-50"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
