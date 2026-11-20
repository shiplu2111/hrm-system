import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, Clock, Loader2, X } from 'lucide-react';
import type {
  AttendanceCorrectionStatus,
  CompanyAttendanceCorrectionItem,
} from '@hrm/shared-types';
import { usePermissions } from '@hrm/portal-ui';
import { correctionStatusTone } from '@/components/attendance/attendance-status';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Toggle';
import { useCompany } from '@/context/CompanyContext';
import {
  approveAttendanceCorrection,
  listCompanyCorrections,
  rejectAttendanceCorrection,
} from '@/lib/attendance-api';
import { ApiError } from '@/lib/tenant-api-client';

function formatClock(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function RegularizationPage() {
  const { companyId } = useCompany();
  const { can } = usePermissions();
  const canReview = can('attendance', 'approve') || can('attendance', 'edit');

  const [requests, setRequests] = useState<CompanyAttendanceCorrectionItem[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const status: AttendanceCorrectionStatus | undefined =
        filter === 'pending' ? 'pending' : undefined;
      setRequests(await listCompanyCorrections(companyId, status));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load regularization requests');
    } finally {
      setLoading(false);
    }
  }, [companyId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAction = async (id: string, action: 'approved' | 'rejected') => {
    setBusyId(id);
    setError(null);
    try {
      const updated =
        action === 'approved'
          ? await approveAttendanceCorrection(id)
          : await rejectAttendanceCorrection(id);
      setRequests((prev) =>
        filter === 'pending'
          ? prev.filter((item) => item.id !== id)
          : prev.map((item) => (item.id === id ? updated : item)),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to process request');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Attendance Regularization</h1>
          <p className="text-sm text-secondary mt-0.5">
            Review and approve clock-in/out correction requests from employees.
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-base surface p-0.5">
          {(['pending', 'all'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                filter === tab
                  ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-300'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted" />
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No regularization requests"
          description={
            filter === 'pending'
              ? 'All pending attendance correction requests have been reviewed.'
              : 'No attendance correction requests have been filed yet.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {requests.map((req) => (
            <Card key={req.id}>
              <CardBody>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={req.employeeName} size="md" />
                    <div>
                      <div className="text-sm font-semibold text-primary">
                        {req.employeeName}
                      </div>
                      <div className="text-xs text-muted">
                        {req.employeeNumber} · {req.date}
                      </div>
                    </div>
                  </div>
                  <Badge tone={correctionStatusTone(req.status)} dot className="capitalize">
                    {req.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="surface border border-base rounded-lg p-3">
                    <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">
                      Before (Original)
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted">Clock In</span>
                        <span className="text-secondary font-medium">
                          {formatClock(req.originalValues?.clockInAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted">Clock Out</span>
                        <span className="text-secondary font-medium">
                          {formatClock(req.originalValues?.clockOutAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="surface border-2 border-accent-500/30 rounded-lg p-3 bg-accent-50/30 dark:bg-accent-950/20">
                    <div className="text-[10px] font-semibold text-accent-600 uppercase tracking-wider mb-2">
                      After (Requested)
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted">Clock In</span>
                        <span className="text-primary font-medium">
                          {formatClock(req.requestedClockInAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted">Clock Out</span>
                        <span className="text-primary font-medium">
                          {formatClock(req.requestedClockOutAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-[rgb(var(--bg-muted))] mb-4">
                  <Clock className="h-4 w-4 text-muted shrink-0 mt-0.5" />
                  <p className="text-xs text-secondary">{req.reason}</p>
                </div>

                {req.status === 'pending' && canReview ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      disabled={busyId === req.id}
                      onClick={() => void handleAction(req.id, 'approved')}
                    >
                      <Check className="h-4 w-4" /> Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      className="flex-1"
                      disabled={busyId === req.id}
                      onClick={() => void handleAction(req.id, 'rejected')}
                    >
                      <X className="h-4 w-4" /> Reject
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <ArrowRight className="h-3.5 w-3.5" />
                    Request {req.status}
                    {req.reviewedBy ? ` by ${req.reviewedBy}` : ''}
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
