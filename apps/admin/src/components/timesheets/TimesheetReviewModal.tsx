import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { usePermission } from '@hrm/portal-ui';
import type { TimesheetEntryRecord, WorkflowApprovalRoute } from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Label, Textarea } from '@/components/ui/Form';
import { WorkflowApprovalTimeline } from '@/components/workflow/WorkflowApprovalTimeline';
import { useNav } from '@/context/NavContext';
import { approveTimesheetEntry, rejectTimesheetEntry } from '@/lib/timesheets-api';
import {
  currentStepLabel,
  formatEntryDate,
  formatHours,
  formatTimeRange,
  timesheetStatusTone,
} from '@/lib/timesheet-display';
import { ApiError } from '@/lib/tenant-api-client';

interface TimesheetReviewModalProps {
  entry: TimesheetEntryRecord | null;
  onClose: () => void;
  /** Route shown for entries that haven't been submitted yet. */
  defaultRoute?: WorkflowApprovalRoute | null;
  onDecided: (record: TimesheetEntryRecord, message: string) => void | Promise<void>;
}

export function TimesheetReviewModal({ entry, onClose, defaultRoute, onDecided }: TimesheetReviewModalProps) {
  const { navigate } = useNav();
  const canConfigureWorkflows = usePermission('settings', 'view');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setComment('');
    setError(null);
    setBusy(null);
  }, [entry?.id]);

  const decide = async (action: 'approve' | 'reject') => {
    if (!entry) return;
    const text = comment.trim();
    if (action === 'reject' && !text) {
      setError('Add a reason so the employee knows what to fix.');
      return;
    }
    setBusy(action);
    setError(null);
    try {
      const record =
        action === 'approve'
          ? await approveTimesheetEntry(entry.id, text || undefined)
          : await rejectTimesheetEntry(entry.id, text);
      const message =
        action === 'reject'
          ? `Rejected ${entry.employeeName}'s entry for ${formatEntryDate(entry.entryDate)}.`
          : record.status === 'approved'
            ? `Approved ${entry.employeeName}'s entry for ${formatEntryDate(entry.entryDate)}.`
            : `Approved your step — ${currentStepLabel(record) ?? 'next step'} is next.`;
      await onDecided(record, message);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const route = entry?.approvalRoute ?? (entry?.status === 'draft' ? defaultRoute : null) ?? null;
  const stepLabel = entry ? currentStepLabel(entry) : null;

  return (
    <Modal
      open={entry !== null}
      onClose={onClose}
      size="lg"
      title="Timesheet entry"
      description={entry ? `${entry.employeeName} · ${formatEntryDate(entry.entryDate)}` : undefined}
      footer={
        entry?.canAct ? (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy !== null}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void decide('reject')} disabled={busy !== null}>
              {busy === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
              Reject
            </Button>
            <Button variant="primary" onClick={() => void decide('approve')} disabled={busy !== null}>
              {busy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
              Approve
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {entry ? (
        <div className="grid gap-5 md:grid-cols-[1fr_260px]">
          <div className="space-y-4 min-w-0">
            {entry.timeAnomaly ? (
              <div className="flex items-start gap-2 rounded-lg bg-warning-50 dark:bg-warning-950/30 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                The device clock differed from the server when this entry was logged offline. Check the times
                before approving.
              </div>
            ) : null}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Employee</dt>
                <dd className="text-primary font-medium">{entry.employeeName}</dd>
                <dd className="text-xs text-muted">{entry.employeeNumber}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Status</dt>
                <dd className="mt-0.5">
                  <Badge tone={timesheetStatusTone(entry)} dot>
                    {entry.displayStatus}
                  </Badge>
                </dd>
                {stepLabel ? <dd className="text-xs text-muted mt-1">{stepLabel}</dd> : null}
              </div>
              <div>
                <dt className="text-xs text-muted">Project</dt>
                <dd className="text-primary">{entry.projectName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Task</dt>
                <dd className="text-primary">{entry.taskName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Time</dt>
                <dd className="text-primary">{formatTimeRange(entry)}</dd>
                <dd className="text-xs text-muted">
                  {entry.breakMinutes ? `${entry.breakMinutes} min break` : 'No break'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Hours</dt>
                <dd className="text-primary font-medium">{formatHours(entry.totalHours)}</dd>
                <dd className="text-xs text-muted">{entry.isBillable ? 'Billable' : 'Non-billable'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Source</dt>
                <dd className="text-primary capitalize">{entry.source.replace(/_/g, ' ')}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Submitted</dt>
                <dd className="text-primary">
                  {entry.submittedAt ? new Date(entry.submittedAt).toLocaleString() : 'Not submitted'}
                </dd>
              </div>
            </dl>

            {entry.notes ? (
              <div>
                <p className="text-xs text-muted mb-1">Notes</p>
                <p className="rounded-md bg-[rgb(var(--bg-muted))] px-3 py-2 text-sm text-secondary whitespace-pre-wrap">
                  {entry.notes}
                </p>
              </div>
            ) : null}

            {entry.canAct ? (
              <div>
                <Label htmlFor="ts-review-comment">Comment (required to reject)</Label>
                <Textarea
                  id="ts-review-comment"
                  rows={3}
                  maxLength={1000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="e.g. Hours look right — thanks"
                />
              </div>
            ) : entry.status === 'pending_approval' ? (
              <p className="text-xs text-muted">
                {stepLabel ? `Waiting on ${stepLabel.split(' · ')[1]}.` : 'Waiting for approval.'} You can't act
                on this step.
              </p>
            ) : null}
            {error ? <p className="text-sm text-error-600">{error}</p> : null}
          </div>

          <div className="rounded-lg border border-base p-4 h-fit">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Approval workflow</p>
            {route ? (
              <WorkflowApprovalTimeline
                route={route}
                workflow={entry.workflow}
                entityLabel="timesheet"
                onConfigure={canConfigureWorkflows ? () => navigate('settings-workflows') : undefined}
              />
            ) : (
              <p className="text-sm text-secondary">Not submitted for approval yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
