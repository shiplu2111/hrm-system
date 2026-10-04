import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Inbox,
  Loader2,
  Settings2,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { usePermission } from '@hrm/portal-ui';
import type {
  TimesheetApprovalQueue,
  TimesheetApprovalScope,
  TimesheetBulkAction,
  TimesheetEntryRecord,
  TimesheetProjectRecord,
} from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Toggle';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { TimesheetReviewModal } from '@/components/timesheets/TimesheetReviewModal';
import { useNav } from '@/context/NavContext';
import { listEmployees } from '@/lib/employees-api';
import {
  bulkTimesheetAction,
  listTimesheetApprovals,
  listTimesheetProjects,
} from '@/lib/timesheets-api';
import {
  currentStepLabel,
  formatEntryDate,
  formatHours,
  formatRelative,
  formatTimeRange,
} from '@/lib/timesheet-display';
import { ApiError } from '@/lib/tenant-api-client';

const ASSIGNEE_SHORT = {
  direct_manager: "Employee's manager",
  skip_level_manager: "Manager's manager",
} as const;

const thClass = 'text-left px-4 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider';

function TimesheetApprovalsContent({ companyId }: { companyId: string }) {
  const { navigate } = useNav();
  const canConfigureWorkflows = usePermission('settings', 'view');
  const [params, setParams] = useSearchParams();
  const scope: TimesheetApprovalScope = params.get('scope') === 'all' ? 'all' : 'mine';
  const employeeFilter = params.get('employee') ?? '';
  const projectFilter = params.get('project') ?? '';
  const fromDate = params.get('from') ?? '';
  const toDate = params.get('to') ?? '';

  const [queue, setQueue] = useState<TimesheetApprovalQueue | null>(null);
  const [projects, setProjects] = useState<TimesheetProjectRecord[]>([]);
  const [employees, setEmployees] = useState<{ id: string; fullName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewing, setReviewing] = useState<TimesheetEntryRecord | null>(null);
  const [bulk, setBulk] = useState<TimesheetBulkAction | null>(null);

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listTimesheetProjects(companyId), listEmployees(companyId)])
      .then(([projectRows, employeeRows]) => {
        if (cancelled) return;
        setProjects(projectRows);
        setEmployees(
          employeeRows
            .map((e) => ({ id: e.id, fullName: `${e.firstName} ${e.lastName}`.trim() }))
            .sort((a, b) => a.fullName.localeCompare(b.fullName)),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listTimesheetApprovals(companyId, {
        scope,
        employeeId: employeeFilter || undefined,
        projectId: projectFilter || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setQueue(result);
      setSelected((current) => {
        const actionable = new Set(result.entries.filter((e) => e.canAct).map((e) => e.id));
        return new Set([...current].filter((id) => actionable.has(id)));
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load the approval queue');
    } finally {
      setLoading(false);
    }
  }, [companyId, scope, employeeFilter, projectFilter, fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const entries = useMemo(() => queue?.entries ?? [], [queue]);
  const actionable = entries.filter((e) => e.canAct);
  const selectedEntries = entries.filter((e) => selected.has(e.id));
  const selectedHours = selectedEntries.reduce((s, e) => s + e.totalHours, 0);
  const allSelected = actionable.length > 0 && actionable.every((e) => selected.has(e.id));
  const hasFilters = !!(employeeFilter || projectFilter || fromDate || toDate);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const route = queue?.route;

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-accent-600" /> Timesheet Approvals
          </h1>
          <p className="text-sm text-secondary mt-0.5">
            Submitted time entries move through each step of the timesheet approval workflow.
          </p>
        </div>
        {route ? (
          <div className="surface rounded-xl border border-base px-4 py-3 lg:max-w-md">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted">
                Approval route ·{' '}
                <span className="text-primary font-medium">{route.name}</span>
              </p>
              {canConfigureWorkflows ? (
                <button
                  type="button"
                  onClick={() => navigate('settings-workflows')}
                  className="inline-flex items-center gap-1 text-xs text-accent-600 hover:text-accent-700"
                >
                  <Settings2 className="h-3.5 w-3.5" /> Configure
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {route.steps.map((step, index) => (
                <span key={step.order} className="inline-flex items-center gap-1.5">
                  {index > 0 ? <ArrowRight className="h-3 w-3 text-muted" /> : null}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-base px-2 py-0.5 text-xs text-primary">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-50 dark:bg-accent-950/40 text-[10px] font-semibold text-accent-700 dark:text-accent-300">
                      {step.order}
                    </span>
                    {step.assigneeType === 'role' ? step.roleName : ASSIGNEE_SHORT[step.assigneeType]}
                  </span>
                </span>
              ))}
            </div>
            {route.source === 'system_default' ? (
              <p className="text-xs text-muted mt-1.5">Built-in chain — no timesheet workflow is configured.</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {notice ? (
        <div className="flex items-start gap-2 rounded-lg border border-success-200 bg-success-50 dark:bg-success-950/30 px-4 py-2.5 text-sm text-success-700 dark:text-success-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1 whitespace-pre-line">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-b border-base">
        <div className="flex gap-1">
          {(
            [
              { key: 'mine', label: 'Awaiting me', count: queue?.awaitingMeCount },
              { key: 'all', label: 'All pending', count: queue?.pendingCount },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setSelected(new Set());
                updateParams({ scope: tab.key === 'mine' ? null : tab.key });
              }}
              className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                scope === tab.key
                  ? 'border-accent-600 text-accent-700 dark:text-accent-400'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              {tab.label}
              {tab.count !== undefined ? (
                <span className="rounded-full bg-[rgb(var(--bg-muted))] px-1.5 text-xs text-secondary">{tab.count}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_160px_160px_auto] lg:items-end">
        <div>
          <Label htmlFor="ta-employee">Employee</Label>
          <Select id="ta-employee" value={employeeFilter} onChange={(e) => updateParams({ employee: e.target.value || null })}>
            <option value="">All employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ta-project">Project</Label>
          <Select id="ta-project" value={projectFilter} onChange={(e) => updateParams({ project: e.target.value || null })}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ta-from">Worked from</Label>
          <Input id="ta-from" type="date" value={fromDate} max={toDate || undefined} onChange={(e) => updateParams({ from: e.target.value || null })} />
        </div>
        <div>
          <Label htmlFor="ta-to">Worked to</Label>
          <Input id="ta-to" type="date" value={toDate} min={fromDate || undefined} onChange={(e) => updateParams({ to: e.target.value || null })} />
        </div>
        <div>
          {hasFilters ? (
            <Button variant="ghost" onClick={() => updateParams({ employee: null, project: null, from: null, to: null })}>
              <X className="h-4 w-4" /> Clear
            </Button>
          ) : null}
        </div>
      </div>

      {selectedEntries.length > 0 ? (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-accent-200 bg-accent-50 dark:bg-accent-950/40 dark:border-accent-900 px-4 py-2.5">
          <span className="text-sm font-medium text-primary">
            {selectedEntries.length} selected · {formatHours(selectedHours)}
          </span>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
          <Button size="sm" variant="danger" onClick={() => setBulk('reject')}>
            <ThumbsDown className="h-3.5 w-3.5" /> Reject
          </Button>
          <Button size="sm" variant="primary" onClick={() => setBulk('approve')}>
            <ThumbsUp className="h-3.5 w-3.5" /> Approve
          </Button>
        </div>
      ) : null}

      <Card>
        <CardBody className="p-0">
          {loading && !queue ? (
            <div className="flex items-center justify-center p-12 text-secondary">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading approval queue…
            </div>
          ) : entries.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <Inbox className="mx-auto h-8 w-8 text-muted" />
              <p className="mt-3 text-sm font-medium text-primary">
                {scope === 'mine' ? "You're all caught up" : 'No pending timesheet entries'}
              </p>
              <p className="text-xs text-muted mt-1">
                {hasFilters
                  ? 'Nothing matches these filters.'
                  : scope === 'mine' && (queue?.pendingCount ?? 0) > 0
                    ? `${queue!.pendingCount} ${queue!.pendingCount === 1 ? 'entry is' : 'entries are'} waiting on other approvers.`
                    : 'New submissions will appear here.'}
              </p>
              {scope === 'mine' && !hasFilters && (queue?.pendingCount ?? 0) > 0 ? (
                <Button className="mt-3" size="sm" variant="secondary" onClick={() => updateParams({ scope: 'all' })}>
                  View all pending
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                    <th className="w-10 px-4 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Select all entries you can approve"
                        checked={allSelected}
                        disabled={actionable.length === 0}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(actionable.map((e) => e.id)))}
                        className="h-4 w-4 rounded border-strong disabled:opacity-40"
                      />
                    </th>
                    <th className={thClass}>Employee</th>
                    <th className={thClass}>Worked</th>
                    <th className={`${thClass} hidden md:table-cell`}>Project · Task</th>
                    <th className={thClass}>Hours</th>
                    <th className={`${thClass} hidden lg:table-cell`}>Current step</th>
                    <th className={`${thClass} hidden lg:table-cell`}>Submitted</th>
                    <th className="w-24 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      onClick={() => setReviewing(entry)}
                      className={`cursor-pointer transition-colors ${
                        selected.has(entry.id) ? 'bg-accent-50/60 dark:bg-accent-950/20' : 'hover:bg-[rgb(var(--bg-hover))]'
                      }`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${entry.employeeName}'s entry for ${entry.entryDate}`}
                          checked={selected.has(entry.id)}
                          disabled={!entry.canAct}
                          title={entry.canAct ? undefined : 'Waiting on another approver'}
                          onChange={() => toggle(entry.id)}
                          className="h-4 w-4 rounded border-strong disabled:opacity-40"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={entry.employeeName ?? 'Employee'} size="sm" />
                          <div className="min-w-0">
                            <div className="font-medium text-primary truncate">{entry.employeeName}</div>
                            <div className="text-xs text-muted">{entry.employeeNumber}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-primary">{formatEntryDate(entry.entryDate)}</div>
                        <div className="text-xs text-muted">{formatTimeRange(entry)}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-primary">{entry.projectName}</div>
                        <div className="text-xs text-muted truncate max-w-[240px]">{entry.taskName}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-primary">{formatHours(entry.totalHours)}</span>
                        {entry.timeAnomaly ? (
                          <AlertTriangle className="ml-1.5 inline h-3.5 w-3.5 text-warning-600" aria-label="Clock anomaly" />
                        ) : null}
                        <div className="text-xs text-muted">{entry.isBillable ? 'Billable' : 'Non-billable'}</div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="text-primary">{currentStepLabel(entry) ?? entry.displayStatus}</div>
                        <div className="text-xs mt-0.5">
                          {entry.canAct ? (
                            <Badge tone="warning">Your step</Badge>
                          ) : (
                            <span className="text-muted">Another approver</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-secondary hidden lg:table-cell whitespace-nowrap">
                        {formatRelative(entry.submittedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={entry.canAct ? 'primary' : 'ghost'}
                          onClick={(e) => {
                            e.stopPropagation();
                            setReviewing(entry);
                          }}
                        >
                          {entry.canAct ? 'Review' : 'View'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <TimesheetReviewModal
        entry={reviewing}
        onClose={() => setReviewing(null)}
        onDecided={async (_record, message) => {
          setNotice(message);
          await load();
        }}
      />

      <BulkDecisionModal
        action={bulk}
        entries={selectedEntries}
        companyId={companyId}
        onClose={() => setBulk(null)}
        onDone={async (message) => {
          setNotice(message);
          setSelected(new Set());
          await load();
        }}
      />
    </div>
  );
}

function BulkDecisionModal({
  action,
  entries,
  companyId,
  onClose,
  onDone,
}: {
  action: TimesheetBulkAction | null;
  entries: TimesheetEntryRecord[];
  companyId: string;
  onClose: () => void;
  onDone: (message: string) => void | Promise<void>;
}) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (action) {
      setComment('');
      setError(null);
    }
  }, [action]);

  const people = new Set(entries.map((e) => e.employeeId)).size;
  const hours = entries.reduce((s, e) => s + e.totalHours, 0);

  const submit = async () => {
    if (!action) return;
    if (action === 'reject' && !comment.trim()) {
      setError('Add a reason so employees know what to fix.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await bulkTimesheetAction(companyId, {
        action,
        entryIds: entries.map((e) => e.id),
        comment: comment.trim() || undefined,
      });
      const verb = action === 'approve' ? 'Approved' : 'Rejected';
      const lines = [
        `${verb} ${result.succeeded.length} ${result.succeeded.length === 1 ? 'entry' : 'entries'}.`,
      ];
      const advanced = result.succeeded.filter((r) => r.status === 'pending_approval').length;
      if (action === 'approve' && advanced > 0) {
        lines.push(`${advanced} moved on to the next approval step.`);
      }
      for (const failure of result.failed) {
        const entry = entries.find((e) => e.id === failure.entryId);
        lines.push(
          `Skipped ${entry ? `${entry.employeeName} · ${formatEntryDate(entry.entryDate)}` : 'an entry'}: ${failure.message}`,
        );
      }
      onClose();
      await onDone(lines.join('\n'));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={action !== null}
      onClose={onClose}
      title={action === 'approve' ? 'Approve selected entries' : 'Reject selected entries'}
      description={`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} · ${formatHours(hours)} · ${people} ${people === 1 ? 'employee' : 'employees'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={action === 'approve' ? 'primary' : 'danger'} onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : action === 'approve' ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
            {action === 'approve' ? 'Approve all' : 'Reject all'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-secondary">
          {action === 'approve'
            ? 'Each entry completes your step; entries with further steps move on to the next approver.'
            : 'Rejected entries are closed and the employee is told why. They can log the time again.'}
        </p>
        <div>
          <Label htmlFor="bulk-comment">{action === 'approve' ? 'Comment (optional)' : 'Reason *'}</Label>
          <Textarea
            id="bulk-comment"
            rows={3}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={action === 'reject' ? 'e.g. Please split the hours by task' : ''}
          />
        </div>
        {error ? <p className="text-sm text-error-600">{error}</p> : null}
      </div>
    </Modal>
  );
}

export function TimesheetApprovalsPage() {
  return (
    <OrgPageState>
      {(companyId) => (
        <>
          <div className="px-4 lg:px-6 pt-4">
            <CompanySelector />
          </div>
          <TimesheetApprovalsContent companyId={companyId} />
        </>
      )}
    </OrgPageState>
  );
}
