import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, X, Calendar, Loader2 } from 'lucide-react';
import type { EmployeeRecord, LeaveRequestRecord } from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Toggle';
import { CompanySelector } from '@/components/org/CompanySelector';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import { useCompany } from '@/context/CompanyContext';
import { listEmployees } from '@/lib/employees-api';
import {
  approveLeaveRequest,
  listLeaveRequests,
  rejectLeaveRequest,
} from '@/lib/leave-api';
import { ApiError } from '@/lib/tenant-api-client';

const statusTone: Record<
  LeaveRequestRecord['status'],
  'warning' | 'accent' | 'success' | 'error' | 'neutral'
> = {
  draft: 'neutral',
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  cancelled: 'neutral',
};

export function LeaveRequestsPage() {
  const { companyId, loading: companyLoading, error: companyError } = useCompany();
  const [requests, setRequests] = useState<LeaveRequestRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const employeeMap = useMemo(() => {
    const map = new Map<string, EmployeeRecord>();
    for (const e of employees) map.set(e.id, e);
    return map;
  }, [employees]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [reqRows, empRows] = await Promise.all([
        listLeaveRequests(companyId),
        listEmployees(companyId),
      ]);
      setRequests(reqRows);
      setEmployees(empRows);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAction(requestId: string, action: 'approve' | 'reject') {
    setActingId(requestId);
    setError(null);
    try {
      if (action === 'approve') {
        await approveLeaveRequest(requestId);
      } else {
        await rejectLeaveRequest(requestId);
      }
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : `Failed to ${action} request`);
    } finally {
      setActingId(null);
    }
  }

  if (companyLoading) return <PageLoadingState message="Loading company…" />;
  if (companyError) return <PageErrorState error={companyError} />;
  if (!companyId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">
        No company found for this tenant.
      </div>
    );
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Leave Requests</h1>
          <p className="text-sm text-secondary mt-0.5">{pendingCount} pending approvals</p>
        </div>
        <CompanySelector />
      </div>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </div>
      ) : (
        <div className="space-y-4">
          {requests.length === 0 ? (
            <Card><CardBody className="text-sm text-muted">No leave requests yet.</CardBody></Card>
          ) : (
            requests.map((req) => {
              const emp = employeeMap.get(req.employeeId);
              const name = emp ? `${emp.firstName} ${emp.lastName}` : req.employeeId;
              return (
                <Card key={req.id}>
                  <CardBody>
                    <div className="flex flex-col lg:flex-row items-start gap-4">
                      <div className="flex items-center gap-3 lg:w-56 shrink-0">
                        <Avatar name={name} size="md" />
                        <div>
                          <div className="text-sm font-semibold text-primary">{name}</div>
                          <div className="text-xs text-muted">{req.leaveTypeName ?? 'Leave'}</div>
                        </div>
                      </div>
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-muted">Dates</div>
                          <div className="flex items-center gap-1 text-secondary">
                            <Calendar className="h-3.5 w-3.5" />
                            {req.startDate} → {req.endDate}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted">Days</div>
                          <div className="text-secondary">{req.totalDays}{req.halfDay ? ' (half)' : ''}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted">Status</div>
                          <Badge tone={statusTone[req.status]} className="capitalize">{req.status}</Badge>
                        </div>
                        <div>
                          <div className="text-xs text-muted">Reason</div>
                          <div className="text-secondary truncate">{req.reason ?? '—'}</div>
                        </div>
                      </div>
                      {req.status === 'pending' && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={actingId === req.id}
                            onClick={() => void handleAction(req.id, 'reject')}
                          >
                            <X className="h-4 w-4" /> Reject
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={actingId === req.id}
                            onClick={() => void handleAction(req.id, 'approve')}
                          >
                            <Check className="h-4 w-4" /> Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
