import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import type {
  EmployeeOffboardingRecord,
  EmployeeOffboardingTaskRecord,
  OffboardingTaskCategory,
} from '@hrm/shared-types';
import {
  OffboardingChecklistBoard,
  OFFBOARDING_CATEGORY_ICONS,
} from '@/components/people/OffboardingChecklistBoard';
import type { OffboardingChecklistItem } from '@/components/people/OffboardingChecklistBoard';
import { CompanySelector } from '@/components/org/CompanySelector';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Label, Textarea } from '@/components/ui/Form';
import { useCompany } from '@/context/CompanyContext';
import {
  OFFBOARDING_CATEGORY_LABELS,
  completeOffboardingTask,
  getEmployeeOffboarding,
  listEmployeeOffboardings,
  recordExitInterview,
  returnOffboardingAssets,
  revokeOffboardingAccess,
  triggerFinalSettlement,
} from '@/lib/offboarding-api';
import { ApiError } from '@/lib/tenant-api-client';

function formatDueDate(value: string | null): string {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function tasksToItems(
  tasks: EmployeeOffboardingTaskRecord[],
): OffboardingChecklistItem[] {
  return tasks.map((task) => {
    const category = task.category as OffboardingTaskCategory;
    return {
      id: task.id,
      title: task.title,
      description: task.description ?? '',
      category: OFFBOARDING_CATEGORY_LABELS[category],
      assignee: task.assigneeLabel ?? 'Unassigned',
      dueDate: formatDueDate(task.dueDate),
      completed: task.status === 'completed' || task.status === 'skipped',
      icon: OFFBOARDING_CATEGORY_ICONS[category] ?? OFFBOARDING_CATEGORY_ICONS.clearance,
      taskType: task.taskType,
      status: task.status,
      pendingAssetCount: task.pendingAssetCount,
      payrollAdjustmentId: task.payrollAdjustmentId,
    };
  });
}

export function OffboardingPage() {
  const { companyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offboardings, setOffboardings] = useState<EmployeeOffboardingRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmployeeOffboardingRecord | null>(null);
  const [actionTaskId, setActionTaskId] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnTaskId, setReturnTaskId] = useState<string | null>(null);
  const [returnCondition, setReturnCondition] = useState('Good');
  const [returnNotes, setReturnNotes] = useState('');
  const [exitInterviewOpen, setExitInterviewOpen] = useState(false);
  const [exitInterviewTaskId, setExitInterviewTaskId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [reasonForLeaving, setReasonForLeaving] = useState('');

  const loadList = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listEmployeeOffboardings(companyId, 'in_progress');
      setOffboardings(rows);
      setSelectedId((prev) => {
        if (prev && rows.some((row) => row.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load offboardings',
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const loadDetail = useCallback(async (offboardingId: string) => {
    try {
      const row = await getEmployeeOffboarding(offboardingId);
      setDetail(row);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load offboarding checklist',
      );
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

  const checklistItems = useMemo(
    () => (detail?.tasks ? tasksToItems(detail.tasks) : []),
    [detail?.tasks],
  );

  const refresh = async () => {
    if (!detail) return;
    await loadDetail(detail.id);
    await loadList();
  };

  const handleTaskAction = async (taskId: string, action: string) => {
    if (!detail) return;
    setError(null);

    try {
      if (action === 'exit-interview') {
        setExitInterviewTaskId(taskId);
        setExitInterviewOpen(true);
        return;
      }

      if (action === 'return-assets') {
        setReturnTaskId(taskId);
        setReturnOpen(true);
        return;
      }

      setActionTaskId(taskId);

      if (action === 'complete') {
        await completeOffboardingTask(detail.id, taskId);
      } else if (action === 'revoke-access') {
        await revokeOffboardingAccess(detail.id, taskId);
      } else if (action === 'trigger-settlement') {
        await triggerFinalSettlement(detail.id, taskId, {
          reason: `Full & final settlement — ${detail.employeeName}`,
        });
      }
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to update task',
      );
    } finally {
      setActionTaskId(null);
    }
  };

  const submitExitInterview = async () => {
    if (!detail || !exitInterviewTaskId) return;
    setActionTaskId(exitInterviewTaskId);
    setError(null);
    try {
      await recordExitInterview(detail.id, exitInterviewTaskId, {
        conductedAt: new Date().toISOString(),
        feedback: feedback.trim() || undefined,
        reasonForLeaving: reasonForLeaving.trim() || undefined,
      });
      setExitInterviewOpen(false);
      setFeedback('');
      setReasonForLeaving('');
      setExitInterviewTaskId(null);
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to record exit interview',
      );
    } finally {
      setActionTaskId(null);
    }
  };

  const submitAssetReturn = async () => {
    if (!detail || !returnTaskId) return;
    setActionTaskId(returnTaskId);
    setError(null);
    try {
      await returnOffboardingAssets(detail.id, returnTaskId, {
        returnAll: true,
        conditionOnReturn: returnCondition.trim() || undefined,
        notes: returnNotes.trim() || undefined,
      });
      setReturnOpen(false);
      setReturnTaskId(null);
      setReturnNotes('');
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to return assets',
      );
    } finally {
      setActionTaskId(null);
    }
  };

  if (!companyId) {
    return (
      <div className="p-4 lg:p-6">
        <CompanySelector />
        <div className="mt-6 rounded-xl border border-dashed border-strong px-6 py-12 text-center text-sm text-secondary">
          Select a company to manage offboarding.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-primary">Offboarding</h1>
          <p className="text-sm text-secondary mt-0.5">
            Clearance, asset return, access revocation, exit interviews, and final settlement
          </p>
        </div>
        <CompanySelector />
      </div>

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 dark:bg-danger-950/30 px-4 py-3 text-sm text-danger-700 dark:text-danger-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-secondary">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading offboardings…
        </div>
      ) : offboardings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-strong px-6 py-12 text-center text-sm text-secondary">
          No in-progress offboardings. Offboarding starts automatically when a resignation or termination lifecycle event is recorded.
        </div>
      ) : (
        <>
          <Card>
            <CardBody className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <label className="text-sm font-medium text-primary shrink-0">
                Employee
              </label>
              <div className="relative flex-1 max-w-md">
                <select
                  className="w-full appearance-none rounded-lg border border-strong bg-surface px-3 py-2 pr-9 text-sm text-primary"
                  value={selectedId ?? ''}
                  onChange={(event) => setSelectedId(event.target.value || null)}
                >
                  {offboardings.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.employeeName} ({row.employeeNumber}) — {row.progressPercent}%
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              </div>
              {detail && (
                <div className="flex items-center gap-2 sm:ml-auto">
                  {detail.lastWorkingDate && (
                    <Badge tone="neutral">Last day: {formatDueDate(detail.lastWorkingDate)}</Badge>
                  )}
                  {detail.accessRevokedAt ? (
                    <Badge tone="success" dot>Access revoked</Badge>
                  ) : (
                    <Badge tone="warning" dot>Access active</Badge>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {detail && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-primary">{detail.employeeName}</h2>
                <p className="text-sm text-secondary mt-0.5">
                  {detail.designationName ?? 'Employee'} · {detail.employeeNumber}
                  {detail.templateName ? ` · ${detail.templateName}` : ''}
                </p>
              </div>

              <OffboardingChecklistBoard
                config={{
                  title: 'Offboarding Progress',
                  subtitle: `${detail.completedTaskCount} of ${detail.totalTaskCount} required tasks complete`,
                  items: checklistItems,
                }}
                onTaskAction={handleTaskAction}
                actionTaskId={actionTaskId}
              />
            </>
          )}
        </>
      )}

      <Modal
        open={exitInterviewOpen}
        onClose={() => setExitInterviewOpen(false)}
        title="Record exit interview"
        footer={
          <>
            <Button variant="secondary" onClick={() => setExitInterviewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitExitInterview()} disabled={!!actionTaskId}>
              Save & complete
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="reason">Reason for leaving</Label>
            <Textarea
              id="reason"
              value={reasonForLeaving}
              onChange={(event) => setReasonForLeaving(event.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="feedback">Interview feedback</Label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              rows={4}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        title="Return assets"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitAssetReturn()} disabled={!!actionTaskId}>
              Confirm return
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="return-condition">Condition on return</Label>
            <Textarea
              id="return-condition"
              value={returnCondition}
              onChange={(event) => setReturnCondition(event.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="return-notes">Notes</Label>
            <Textarea
              id="return-notes"
              value={returnNotes}
              onChange={(event) => setReturnNotes(event.target.value)}
              rows={2}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
