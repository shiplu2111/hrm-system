import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, Calendar, Check, Loader2, X } from 'lucide-react';
import type { ShiftSwapRequestRecord, ShiftSwapRequestStatus } from '@hrm/shared-types';
import { usePermissions } from '@hrm/portal-ui';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusPill, type StatusPillTone } from '@/components/ui/StatusPill';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar } from '@/components/ui/Toggle';
import { useCompany } from '@/context/CompanyContext';
import {
  approveShiftSwapRequest,
  listCompanyShiftSwaps,
  rejectShiftSwapRequest,
} from '@/lib/roster-requests-api';
import { ApiError } from '@/lib/tenant-api-client';

const STATUS_TONE: Record<ShiftSwapRequestStatus, StatusPillTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  cancelled: 'neutral',
};

export function ShiftSwapPage() {
  const { companyId } = useCompany();
  const { can } = usePermissions();
  const canApprove = can('attendance', 'approve');

  const [swaps, setSwaps] = useState<ShiftSwapRequestRecord[]>([]);
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
      setSwaps(await listCompanyShiftSwaps(companyId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load shift swap requests');
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
        action === 'approve'
          ? await approveShiftSwapRequest(id)
          : await rejectShiftSwapRequest(id);
      setSwaps((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : `Failed to ${action} request`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-xl font-bold text-primary">Shift Swap Requests</h1>
        <p className="text-sm text-secondary mt-0.5">
          Review and approve shift exchange requests routed through the Approval Workflow Engine.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-900/30 dark:text-error-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardBody>
                <Skeleton className="h-16 w-full" />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : swaps.length === 0 ? (
        <Card>
          <CardBody className="py-8 text-center text-sm text-muted">
            No shift swap requests submitted yet.
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {swaps.map((swap) => {
            const busy = busyId === swap.id;
            const activeStep = swap.workflowInstance?.steps.find((s) => s.status === 'pending');
            return (
              <Card key={swap.id}>
                <CardBody>
                  <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar name={swap.requesterName} size="md" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-primary truncate">
                          {swap.requesterName}
                        </div>
                        <div className="text-xs text-muted">
                          {swap.requesterShiftName ?? swap.swapDate}
                          {swap.requesterShiftWindow ? ` (${swap.requesterShiftWindow})` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center">
                      <div className="h-10 w-10 rounded-full bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center shrink-0">
                        <ArrowLeftRight className="h-5 w-5 text-accent-600 dark:text-accent-400" />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar name={swap.targetName} size="md" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-primary truncate">
                          {swap.targetName}
                        </div>
                        <div className="text-xs text-muted">
                          {swap.targetShiftName ?? swap.targetDate}
                          {swap.targetShiftWindow ? ` (${swap.targetShiftWindow})` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 min-w-[160px]">
                      <div className="flex items-center gap-1 text-xs text-muted">
                        <Calendar className="h-3 w-3" />
                        {swap.swapDate === swap.targetDate
                          ? swap.swapDate
                          : `${swap.swapDate} ↔ ${swap.targetDate}`}
                      </div>
                      {swap.status === 'pending' && activeStep && (
                        <div className="text-[11px] text-warning-700 dark:text-warning-300">
                          Step {activeStep.order}/{swap.workflowInstance?.steps.length ?? 1} ·{' '}
                          {activeStep.roleName}
                        </div>
                      )}
                      {swap.status === 'pending' && canApprove ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={busy}
                            onClick={() => void handleAction(swap.id, 'approve')}
                          >
                            {busy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={busy}
                            onClick={() => void handleAction(swap.id, 'reject')}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <StatusPill tone={STATUS_TONE[swap.status]} className="capitalize">
                          {swap.status}
                        </StatusPill>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-base text-xs text-secondary">
                    {swap.reason}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
