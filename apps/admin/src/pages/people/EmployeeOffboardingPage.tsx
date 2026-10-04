import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  ClipboardList,
  KeyRound,
  Loader2,
  MinusCircle,
  Package,
  PlayCircle,
  RotateCcw,
  ShieldOff,
  SkipForward,
  Star,
  User,
} from 'lucide-react';
import {
  EXIT_REASON_CATEGORY_LABELS,
  OFFBOARDING_TASK_CATEGORIES,
  OFFBOARDING_TASK_CATEGORY_LABELS,
  type EmployeeOffboardingRecord,
  type EmployeeOffboardingTaskRecord,
  type EmployeeRecord,
  type OffboardingChecklistTemplateRecord,
} from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ProgressBar } from '@/components/ui/Progress';
import { Avatar } from '@/components/ui/Toggle';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Skeleton } from '@/components/ui/Skeleton';
import { ExitInterviewFormModal } from '@/components/people/offboarding/ExitInterviewFormModal';
import { FinalSettlementPanel } from '@/components/people/offboarding/FinalSettlementPanel';
import { OffboardingAssetsCard } from '@/components/people/offboarding/OffboardingAssetsCard';
import { useNav } from '@/context/NavContext';
import { getEmployee, listEmployees } from '@/lib/employees-api';
import {
  completeOffboardingTask,
  getOffboardingForEmployee,
  listOffboardingTemplates,
  reopenOffboardingTask,
  returnOffboardingAssets,
  revokeOffboardingAccess,
  skipOffboardingTask,
  startEmployeeOffboarding,
} from '@/lib/offboarding-api';
import {
  ASSET_RETURN_CONDITIONS,
  OFFBOARDING_CATEGORY_ICONS,
  exitInterviewStatusBadge,
  formatDateTime,
  offboardingStatusBadge,
  settlementStatusBadge,
} from '@/lib/offboarding-display';
import { formatShortDate } from '@/lib/onboarding-display';
import { ApiError } from '@/lib/tenant-api-client';

type Filter = 'all' | 'pending' | 'overdue' | 'done';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'done', label: 'Done' },
];

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

function matchesFilter(task: EmployeeOffboardingTaskRecord, filter: Filter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'pending':
      return task.status === 'pending';
    case 'overdue':
      return task.isOverdue;
    case 'done':
      return task.status !== 'pending';
  }
}

/** Completed asset, access and settlement steps follow their underlying records and can't simply be reopened. */
function canReopen(task: EmployeeOffboardingTaskRecord): boolean {
  if (task.status === 'skipped') return true;
  if (task.status !== 'completed') return false;
  return !['asset_return', 'access_revocation', 'final_settlement'].includes(task.taskType);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function EmployeeOffboardingPage() {
  const { selectedEmployeeId, openEmployee, navigate } = useNav();
  const canCreate = usePermission('employee', 'create');
  const canEdit = usePermission('employee', 'edit');
  const canApprove = usePermission('employee', 'approve');
  const canCreatePayroll = usePermission('payroll', 'create');
  const canEditPayroll = usePermission('payroll', 'edit');
  const canFinalizePayroll = usePermission('payroll', 'finalize');

  const [employee, setEmployee] = useState<EmployeeRecord | null>(null);
  const [offboarding, setOffboarding] = useState<EmployeeOffboardingRecord | null>(null);
  const [templates, setTemplates] = useState<OffboardingChecklistTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [actionTaskId, setActionTaskId] = useState<string | null>(null);

  const [startForm, setStartForm] = useState({ templateId: '', lastWorkingDate: '', startDate: '' });
  const [starting, setStarting] = useState(false);

  const [clearanceTask, setClearanceTask] = useState<EmployeeOffboardingTaskRecord | null>(null);
  const [clearanceNote, setClearanceNote] = useState('');
  const [skipTask, setSkipTask] = useState<EmployeeOffboardingTaskRecord | null>(null);
  const [skipReason, setSkipReason] = useState('');
  const [reopenTask, setReopenTask] = useState<EmployeeOffboardingTaskRecord | null>(null);
  const [revokeTask, setRevokeTask] = useState<EmployeeOffboardingTaskRecord | null>(null);
  const [returnTask, setReturnTask] = useState<EmployeeOffboardingTaskRecord | null>(null);
  const [returnForm, setReturnForm] = useState({ condition: ASSET_RETURN_CONDITIONS[0], notes: '' });

  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewers, setInterviewers] = useState<Array<{ id: string; fullName: string }> | null>(null);
  const settlementRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!selectedEmployeeId) return;
    setLoading(true);
    setError(null);
    try {
      const [emp, record] = await Promise.all([
        getEmployee(selectedEmployeeId),
        getOffboardingForEmployee(selectedEmployeeId),
      ]);
      setEmployee(emp);
      setOffboarding(record);
      if (!record) {
        const active = await listOffboardingTemplates(emp.companyId, true);
        setTemplates(active);
        setStartForm({
          templateId: (active.find((t) => t.isDefault) ?? active[0])?.id ?? '',
          lastWorkingDate: '',
          startDate: todayIso(),
        });
      }
    } catch (err) {
      setError(errorMessage(err, 'Failed to load offboarding'));
    } finally {
      setLoading(false);
    }
  }, [selectedEmployeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(
    async (record?: EmployeeOffboardingRecord) => {
      if (record) {
        setOffboarding(record);
        return;
      }
      if (!selectedEmployeeId) return;
      setOffboarding(await getOffboardingForEmployee(selectedEmployeeId));
    },
    [selectedEmployeeId],
  );

  const showNotice = useCallback((message: string) => {
    setError(null);
    setNotice(message);
  }, []);

  const runTaskAction = async (
    task: EmployeeOffboardingTaskRecord,
    action: () => Promise<unknown>,
    successMessage?: string,
  ) => {
    setActionTaskId(task.id);
    setError(null);
    setNotice(null);
    try {
      await action();
      await refresh();
      if (successMessage) setNotice(successMessage);
    } catch (err) {
      setError(errorMessage(err, 'Failed to update the step'));
    } finally {
      setActionTaskId(null);
    }
  };

  const openInterview = async () => {
    setInterviewOpen(true);
    if (interviewers || !employee) return;
    try {
      const all = await listEmployees(employee.companyId);
      setInterviewers(
        all
          .filter((e) => e.id !== employee.id && e.employmentStatus !== 'terminated')
          .map((e) => ({ id: e.id, fullName: e.fullName }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName)),
      );
    } catch {
      setInterviewers([]);
    }
  };

  const tasks = useMemo(() => offboarding?.tasks ?? [], [offboarding?.tasks]);
  const filterCounts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map(({ key }) => [key, tasks.filter((t) => matchesFilter(t, key)).length]),
      ) as Record<Filter, number>,
    [tasks],
  );
  const visibleTasks = tasks.filter((t) => matchesFilter(t, filter));
  const sections = OFFBOARDING_TASK_CATEGORIES.map((category) => ({
    category,
    tasks: visibleTasks.filter((t) => t.category === category),
    total: tasks.filter((t) => t.category === category),
  })).filter((section) => section.tasks.length > 0);
  const settlementTask = tasks.find((t) => t.taskType === 'final_settlement') ?? null;
  const accessTask = tasks.find((t) => t.taskType === 'access_revocation') ?? null;
  const interviewTask = tasks.find((t) => t.taskType === 'exit_interview') ?? null;

  const handleStart = async () => {
    if (!employee) return;
    setStarting(true);
    setError(null);
    try {
      const record = await startEmployeeOffboarding(employee.companyId, {
        employeeId: employee.id,
        templateId: startForm.templateId || undefined,
        lastWorkingDate: startForm.lastWorkingDate || undefined,
        startDate: startForm.startDate || undefined,
      });
      setOffboarding(record);
      setNotice(`Offboarding started with ${record.templateName ?? 'the selected checklist'}.`);
    } catch (err) {
      setError(errorMessage(err, 'Failed to start offboarding'));
    } finally {
      setStarting(false);
    }
  };

  const renderActions = (task: EmployeeOffboardingTaskRecord) => {
    if (!offboarding || offboarding.status === 'cancelled') return null;
    const busy = actionTaskId === task.id;
    const spinner = <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    const buttons: ReactElement[] = [];

    if (task.status === 'pending') {
      if (canEdit && task.taskType === 'manual_task') {
        buttons.push(
          <Button
            key="done"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() =>
              void runTaskAction(task, () => completeOffboardingTask(offboarding.id, task.id))
            }
          >
            {busy ? spinner : <Check className="h-3.5 w-3.5" />} Mark done
          </Button>,
        );
      }
      if (canEdit && task.taskType === 'clearance') {
        buttons.push(
          <Button
            key="clear"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => {
              setClearanceNote('');
              setClearanceTask(task);
            }}
          >
            {busy ? spinner : <Check className="h-3.5 w-3.5" />} Sign off
          </Button>,
        );
      }
      if (canEdit && task.taskType === 'asset_return') {
        const outstanding = task.pendingAssetCount ?? 0;
        buttons.push(
          <Button
            key="return"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => {
              if (outstanding === 0) {
                void runTaskAction(
                  task,
                  () => returnOffboardingAssets(offboarding.id, task.id),
                  `"${task.title}" confirmed — nothing outstanding.`,
                );
                return;
              }
              setReturnForm({ condition: ASSET_RETURN_CONDITIONS[0], notes: '' });
              setReturnTask(task);
            }}
          >
            {busy ? spinner : <Package className="h-3.5 w-3.5" />}
            {outstanding === 0
              ? 'Confirm nothing to return'
              : `Return ${outstanding} asset${outstanding === 1 ? '' : 's'}`}
          </Button>,
        );
      }
      if (canApprove && task.taskType === 'access_revocation') {
        buttons.push(
          <Button key="revoke" variant="danger" size="sm" disabled={busy} onClick={() => setRevokeTask(task)}>
            {busy ? spinner : <ShieldOff className="h-3.5 w-3.5" />}
            {offboarding.access?.hasPortalAccount ? 'Revoke access' : 'Confirm no access'}
          </Button>,
        );
      }
      if (canEdit && task.taskType === 'exit_interview') {
        buttons.push(
          <Button key="interview" variant="secondary" size="sm" onClick={() => void openInterview()}>
            <ClipboardList className="h-3.5 w-3.5" />
            {offboarding.exitInterview ? 'Continue interview' : 'Open interview form'}
          </Button>,
        );
      }
      if (task.taskType === 'final_settlement' && offboarding.settlementVisible) {
        buttons.push(
          <Button
            key="settlement"
            variant="secondary"
            size="sm"
            onClick={() => settlementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Go to settlement
          </Button>,
        );
      }
      if (canApprove) {
        buttons.push(
          <Button
            key="skip"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              setSkipReason('');
              setSkipTask(task);
            }}
          >
            <SkipForward className="h-3.5 w-3.5" /> Skip
          </Button>,
        );
      }
    } else {
      if (task.taskType === 'exit_interview' && offboarding.exitInterview) {
        buttons.push(
          <Button key="view" variant="ghost" size="sm" onClick={() => void openInterview()}>
            <ClipboardList className="h-3.5 w-3.5" /> View answers
          </Button>,
        );
      }
      if (canEdit && canReopen(task)) {
        buttons.push(
          <Button key="reopen" variant="ghost" size="sm" disabled={busy} onClick={() => setReopenTask(task)}>
            <RotateCcw className="h-3.5 w-3.5" /> Reopen
          </Button>,
        );
      }
    }

    return buttons.length > 0 ? <div className="flex flex-wrap gap-1.5 justify-end">{buttons}</div> : null;
  };

  const renderTaskDetail = (task: EmployeeOffboardingTaskRecord) => {
    if (!offboarding) return null;
    switch (task.taskType) {
      case 'asset_return':
        return task.status === 'pending' ? (
          <span className={task.pendingAssetCount ? 'text-warning-700' : ''}>
            {task.pendingAssetCount
              ? `${task.pendingAssetCount} ${task.assetCategory?.replace('_', ' ') ?? 'asset'}${
                  task.pendingAssetCount === 1 ? '' : 's'
                } still with employee`
              : 'Nothing outstanding'}
          </span>
        ) : null;
      case 'access_revocation':
        return offboarding.accessRevokedAt ? (
          <span>Revoked {formatDateTime(offboarding.accessRevokedAt)}</span>
        ) : null;
      case 'exit_interview': {
        const interview = offboarding.exitInterview;
        if (!interview) return null;
        return interview.conductedAt ? (
          <span>Conducted {formatDateTime(interview.conductedAt)}</span>
        ) : interview.scheduledAt ? (
          <span>Scheduled {formatDateTime(interview.scheduledAt)}</span>
        ) : (
          <span>Draft saved</span>
        );
      }
      case 'final_settlement': {
        const adjustment = offboarding.settlement?.adjustment;
        return adjustment ? (
          <span>Settlement entry: {settlementStatusBadge(adjustment.status).label.toLowerCase()}</span>
        ) : null;
      }
      default:
        return null;
    }
  };

  const renderTask = (task: EmployeeOffboardingTaskRecord) => (
    <li key={task.id} className="flex items-start gap-3 px-5 py-4">
      <div className="pt-0.5 shrink-0">
        {task.status === 'completed' ? (
          <CheckCircle2 className="h-5 w-5 text-success-600" />
        ) : task.status === 'skipped' ? (
          <MinusCircle className="h-5 w-5 text-muted" />
        ) : task.isOverdue ? (
          <AlertTriangle className="h-5 w-5 text-error-600" />
        ) : (
          <Circle className="h-5 w-5 text-muted" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${task.status === 'pending' ? 'text-primary' : 'text-secondary'}`}>
              {task.title}
            </span>
            {!task.isRequired ? <Badge tone="neutral">Optional</Badge> : null}
            {task.status === 'completed' ? (
              <Badge tone="success">Done</Badge>
            ) : task.status === 'skipped' ? (
              <Badge tone="neutral">Skipped</Badge>
            ) : task.isOverdue ? (
              <Badge tone="error">Overdue</Badge>
            ) : (
              <Badge tone="warning">Pending</Badge>
            )}
          </div>
          {task.description ? <p className="text-xs text-secondary mt-0.5">{task.description}</p> : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" /> {task.assigneeLabel ?? 'Unassigned'}
            </span>
            <span className={`inline-flex items-center gap-1 ${task.isOverdue ? 'text-error-600 font-medium' : ''}`}>
              <Calendar className="h-3 w-3" />
              {task.dueDate ? `Due ${formatShortDate(task.dueDate)}` : 'No due date'}
            </span>
            {task.completedAt ? (
              <span>
                {task.status === 'skipped' ? 'Skipped' : 'Completed'} {formatShortDate(task.completedAt)}
              </span>
            ) : null}
            {renderTaskDetail(task)}
          </div>
        </div>
        <div className="shrink-0">{renderActions(task)}</div>
      </div>
    </li>
  );

  if (!selectedEmployeeId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">
        Select an employee to view their offboarding.
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('offboarding')}>
            Go to Offboarding
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-4 max-w-[1200px] mx-auto">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-8 text-center text-sm space-y-4">
        <p className="text-error-600">{error ?? 'Failed to load employee'}</p>
        <Button variant="primary" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  const statusBadge = offboarding ? offboardingStatusBadge(offboarding.status) : null;
  const access = offboarding?.access;
  const interview = offboarding?.exitInterview ?? null;
  const interviewBadge = exitInterviewStatusBadge(interview?.status ?? 'not_started');

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => openEmployee(employee.id)}
          className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to {employee.fullName}
        </button>
        <button
          type="button"
          onClick={() => navigate('offboarding')}
          className="text-sm text-secondary hover:text-primary transition-colors"
        >
          All offboardings
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-success-700 dark:text-success-400 bg-success-50 dark:bg-success-950/30 border border-success-200 dark:border-success-800 rounded-lg px-4 py-2"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="flex-1">{notice}</span>
        </div>
      ) : null}

      <Card>
        <CardBody className="flex flex-col md:flex-row md:items-center gap-4">
          <Avatar name={employee.fullName} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-primary">Offboarding · {employee.fullName}</h1>
              {statusBadge ? (
                <Badge tone={statusBadge.tone} dot>
                  {statusBadge.label}
                </Badge>
              ) : (
                <Badge tone="neutral">Not started</Badge>
              )}
            </div>
            <p className="text-sm text-secondary mt-1">
              {employee.designation?.name ?? 'No designation'} · {employee.department?.name ?? 'No department'} ·{' '}
              {employee.employeeNumber}
            </p>
            {offboarding ? (
              <p className="text-xs text-muted mt-1">
                Checklist: {offboarding.templateName ?? 'Template removed'} · Started{' '}
                {formatShortDate(offboarding.startedAt)}
                {offboarding.completedAt ? ` · Completed ${formatShortDate(offboarding.completedAt)}` : ''}
              </p>
            ) : null}
          </div>
          {offboarding ? (
            <div className="flex flex-col items-start md:items-end gap-1 shrink-0">
              <div className="text-xs text-muted">Last working day</div>
              <div className="text-base font-semibold text-primary inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 text-muted" />
                {offboarding.lastWorkingDate ? formatShortDate(offboarding.lastWorkingDate) : 'Not set'}
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {!offboarding ? (
        <Card>
          <CardHeader>
            <CardTitle>Start offboarding</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-secondary">
              {employee.fullName} has no offboarding checklist. It starts automatically when a
              resignation or termination is recorded under Lifecycle Events; you can also start it here.
            </p>
            {templates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-strong px-4 py-6 text-center text-sm text-secondary">
                No active offboarding checklist templates for this company.
              </div>
            ) : canCreate ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
                  <div>
                    <Label htmlFor="off-template">Checklist template</Label>
                    <Select
                      id="off-template"
                      value={startForm.templateId}
                      onChange={(e) => setStartForm({ ...startForm, templateId: e.target.value })}
                    >
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} ({template.itemCount} items){template.isDefault ? ' — default' : ''}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="off-lwd">Last working day</Label>
                    <Input
                      id="off-lwd"
                      type="date"
                      value={startForm.lastWorkingDate}
                      onChange={(e) => setStartForm({ ...startForm, lastWorkingDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="off-start">Start date</Label>
                    <Input
                      id="off-start"
                      type="date"
                      value={startForm.startDate}
                      onChange={(e) => setStartForm({ ...startForm, startDate: e.target.value })}
                    />
                    <p className="text-xs text-muted mt-1">Due dates count from this day.</p>
                  </div>
                </div>
                <Button onClick={() => void handleStart()} disabled={starting || !startForm.templateId}>
                  {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                  Start offboarding
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted">You do not have permission to start offboarding.</p>
            )}
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardBody>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted">Progress</span>
                  <span className="text-lg font-bold text-primary">{offboarding.progressPercent}%</span>
                </div>
                <ProgressBar
                  value={offboarding.progressPercent}
                  tone={offboarding.progressPercent === 100 ? 'success' : 'accent'}
                />
                <div className="text-xs text-secondary mt-1.5">
                  {offboarding.requiredCompletedCount} of {offboarding.requiredTaskCount} required steps done
                </div>
              </CardBody>
            </Card>
            <button type="button" className="text-left" onClick={() => setFilter('overdue')}>
              <Card className="h-full hover:ring-1 hover:ring-accent-200 transition">
                <CardBody className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-muted">Overdue steps</div>
                    <div className="text-2xl font-bold text-primary mt-1">{offboarding.overdueTaskCount}</div>
                  </div>
                  <AlertTriangle
                    className={`h-5 w-5 ${offboarding.overdueTaskCount > 0 ? 'text-error-600' : 'text-muted'}`}
                  />
                </CardBody>
              </Card>
            </button>
            <Card>
              <CardBody className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-muted">Assets outstanding</div>
                  <div className="text-2xl font-bold text-primary mt-1">{offboarding.assetsOutstandingCount}</div>
                </div>
                <Package
                  className={`h-5 w-5 ${offboarding.assetsOutstandingCount > 0 ? 'text-warning-600' : 'text-muted'}`}
                />
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-muted">System access</div>
                  <div className="text-base font-semibold text-primary mt-1.5">
                    {!access?.hasPortalAccount
                      ? 'No portal account'
                      : access.accountActive
                        ? 'Active'
                        : 'Revoked'}
                  </div>
                </div>
                <KeyRound
                  className={`h-5 w-5 ${access?.hasPortalAccount && access.accountActive ? 'text-warning-600' : 'text-success-600'}`}
                />
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex gap-1 border-b border-base overflow-x-auto scrollbar-thin">
                {FILTERS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                      filter === key
                        ? 'border-accent-600 text-accent-600'
                        : 'border-transparent text-secondary hover:text-primary'
                    }`}
                  >
                    {label} <span className="text-xs text-muted">({filterCounts[key]})</span>
                  </button>
                ))}
              </div>

              {sections.length === 0 ? (
                <div className="rounded-xl border border-dashed border-strong px-6 py-10 text-center text-sm text-secondary">
                  No steps match this filter.
                </div>
              ) : (
                sections.map(({ category, tasks: sectionTasks, total }) => {
                  const Icon = OFFBOARDING_CATEGORY_ICONS[category];
                  const done = total.filter((t) => t.status !== 'pending').length;
                  return (
                    <Card key={category}>
                      <CardHeader className="flex items-center justify-between">
                        <CardTitle>
                          <span className="inline-flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted" />
                            {OFFBOARDING_TASK_CATEGORY_LABELS[category]}
                          </span>
                        </CardTitle>
                        <Badge tone={done === total.length ? 'success' : 'neutral'}>
                          {done}/{total.length}
                        </Badge>
                      </CardHeader>
                      <CardBody className="p-0">
                        <ul className="divide-y divide-[rgb(var(--border-base))]">
                          {sectionTasks.map(renderTask)}
                        </ul>
                      </CardBody>
                    </Card>
                  );
                })
              )}

              <OffboardingAssetsCard
                offboarding={offboarding}
                canEdit={canEdit}
                onChanged={() => refresh()}
                onNotice={showNotice}
              />
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle>
                    <span className="inline-flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-muted" /> Access revocation
                    </span>
                  </CardTitle>
                  <Badge
                    tone={!access?.hasPortalAccount || !access.accountActive ? 'success' : 'warning'}
                    dot
                  >
                    {!access?.hasPortalAccount ? 'No account' : access.accountActive ? 'Active' : 'Revoked'}
                  </Badge>
                </CardHeader>
                <CardBody className="space-y-2 text-sm">
                  {access?.hasPortalAccount ? (
                    <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 text-xs">
                      <dt className="text-muted">Portal login</dt>
                      <dd className="text-primary break-all">{access.email}</dd>
                      <dt className="text-muted">Active sessions</dt>
                      <dd className={access.activeSessionCount > 0 ? 'text-warning-700 font-medium' : 'text-primary'}>
                        {access.activeSessionCount}
                      </dd>
                      <dt className="text-muted">Last sign-in</dt>
                      <dd className="text-primary">{formatDateTime(access.lastLoginAt)}</dd>
                      {access.revokedAt ? (
                        <>
                          <dt className="text-muted">Revoked</dt>
                          <dd className="text-primary">{formatDateTime(access.revokedAt)}</dd>
                        </>
                      ) : null}
                    </dl>
                  ) : (
                    <p className="text-xs text-secondary">
                      {employee.fullName} has no HR portal account, so there is nothing to deactivate here.
                      Revoke email and other systems outside the HR system.
                    </p>
                  )}
                  {access?.hasPortalAccount && access.accountActive && !accessTask ? (
                    <p className="text-xs text-warning-700">
                      This checklist has no access-revocation step. Deactivate the account under Settings → Users.
                    </p>
                  ) : null}
                  {accessTask?.status === 'pending' && canApprove && offboarding.status !== 'cancelled' ? (
                    <Button
                      variant="danger"
                      size="sm"
                      className="w-full justify-center"
                      onClick={() => setRevokeTask(accessTask)}
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                      {access?.hasPortalAccount ? 'Revoke access now' : 'Confirm no access'}
                    </Button>
                  ) : null}
                </CardBody>
              </Card>

              <Card>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle>
                    <span className="inline-flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-muted" /> Exit interview
                    </span>
                  </CardTitle>
                  <Badge tone={interviewBadge.tone} dot>
                    {interviewBadge.label}
                  </Badge>
                </CardHeader>
                <CardBody className="space-y-3 text-sm">
                  {interview ? (
                    <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 text-xs">
                      {interview.scheduledAt ? (
                        <>
                          <dt className="text-muted">Scheduled</dt>
                          <dd className="text-primary">{formatDateTime(interview.scheduledAt)}</dd>
                        </>
                      ) : null}
                      <dt className="text-muted">Interviewer</dt>
                      <dd className="text-primary">{interview.interviewerName ?? 'Not assigned'}</dd>
                      {interview.conductedAt ? (
                        <>
                          <dt className="text-muted">Conducted</dt>
                          <dd className="text-primary">{formatDateTime(interview.conductedAt)}</dd>
                        </>
                      ) : null}
                      <dt className="text-muted">Main reason</dt>
                      <dd className="text-primary">
                        {interview.reasonCategory ? EXIT_REASON_CATEGORY_LABELS[interview.reasonCategory] : '—'}
                      </dd>
                      <dt className="text-muted">Overall</dt>
                      <dd className="text-primary inline-flex items-center gap-1">
                        {interview.rating ? (
                          <>
                            <Star className="h-3 w-3 fill-warning-400 text-warning-500" /> {interview.rating}/5
                          </>
                        ) : (
                          '—'
                        )}
                      </dd>
                      <dt className="text-muted">Would recommend</dt>
                      <dd className="text-primary">
                        {interview.wouldRecommend === null ? '—' : interview.wouldRecommend ? 'Yes' : 'No'}
                      </dd>
                      <dt className="text-muted">Rehire eligible</dt>
                      <dd className="text-primary">
                        {interview.wouldRehire === null ? '—' : interview.wouldRehire ? 'Yes' : 'No'}
                      </dd>
                    </dl>
                  ) : (
                    <p className="text-xs text-secondary">
                      Schedule the interview and record the answers here. Completing it ticks off the
                      exit interview step.
                    </p>
                  )}
                  {interviewTask?.status === 'skipped' ? (
                    <p className="text-xs text-muted">The exit interview step was skipped.</p>
                  ) : null}
                  <Button
                    variant={interview?.status === 'completed' ? 'secondary' : 'primary'}
                    size="sm"
                    className="w-full justify-center"
                    disabled={!canEdit && !interview}
                    onClick={() => void openInterview()}
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    {!interview
                      ? 'Open interview form'
                      : interview.status === 'completed'
                        ? canEdit
                          ? 'View / edit answers'
                          : 'View answers'
                        : 'Continue interview'}
                  </Button>
                </CardBody>
              </Card>
            </div>
          </div>

          <div ref={settlementRef} className="scroll-mt-4">
            <FinalSettlementPanel
              offboarding={offboarding}
              task={settlementTask}
              canGenerate={canCreatePayroll}
              canEditPayroll={canEditPayroll}
              canFinalizePayroll={canFinalizePayroll}
              onChanged={refresh}
              onNotice={showNotice}
            />
          </div>

          <ExitInterviewFormModal
            open={interviewOpen}
            onClose={() => setInterviewOpen(false)}
            offboardingId={offboarding.id}
            employeeName={employee.fullName}
            interview={interview}
            interviewers={interviewers ?? []}
            readOnly={!canEdit || offboarding.status === 'cancelled'}
            onSaved={async (record, completedNow) => {
              await refresh(record);
              showNotice(completedNow ? 'Exit interview completed.' : 'Exit interview saved.');
            }}
          />
        </>
      )}

      <Modal
        open={clearanceTask !== null}
        onClose={() => setClearanceTask(null)}
        title={`Sign off: ${clearanceTask?.title ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setClearanceTask(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!clearanceTask || !offboarding) return;
                const task = clearanceTask;
                setClearanceTask(null);
                void runTaskAction(
                  task,
                  () => completeOffboardingTask(offboarding.id, task.id, clearanceNote.trim() || undefined),
                  `"${task.title}" signed off.`,
                );
              }}
            >
              Sign off
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-secondary">
            Confirm {employee.fullName} has no pending items with {clearanceTask?.assigneeLabel ?? 'this team'}.
          </p>
          <div>
            <Label htmlFor="clearance-note">Note (optional)</Label>
            <Textarea
              id="clearance-note"
              rows={2}
              maxLength={1000}
              value={clearanceNote}
              placeholder="e.g. No outstanding expenses or advances"
              onChange={(e) => setClearanceNote(e.target.value)}
            />
            <p className="text-xs text-muted mt-1">Recorded in the audit log.</p>
          </div>
        </div>
      </Modal>

      <Modal
        open={returnTask !== null}
        onClose={() => setReturnTask(null)}
        title={`Return ${returnTask?.pendingAssetCount ?? 0} asset${returnTask?.pendingAssetCount === 1 ? '' : 's'}`}
        description="Every matching asset still assigned is marked returned with this condition. Use the asset list to return items one by one."
        footer={
          <>
            <Button variant="secondary" onClick={() => setReturnTask(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!returnTask || !offboarding) return;
                const task = returnTask;
                setReturnTask(null);
                void runTaskAction(
                  task,
                  () =>
                    returnOffboardingAssets(offboarding.id, task.id, {
                      conditionOnReturn: returnForm.condition,
                      notes: returnForm.notes.trim() || undefined,
                    }),
                  `Assets returned for "${task.title}".`,
                );
              }}
            >
              Confirm return
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="bulk-condition">Condition on return</Label>
            <Select
              id="bulk-condition"
              value={returnForm.condition}
              onChange={(e) => setReturnForm({ ...returnForm, condition: e.target.value })}
            >
              {ASSET_RETURN_CONDITIONS.map((condition) => (
                <option key={condition} value={condition}>
                  {condition}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="bulk-notes">Notes</Label>
            <Textarea
              id="bulk-notes"
              rows={2}
              maxLength={1000}
              value={returnForm.notes}
              onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={skipTask !== null}
        onClose={() => setSkipTask(null)}
        title="Skip step"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSkipTask(null)}>
              Cancel
            </Button>
            <Button
              disabled={!skipReason.trim()}
              onClick={() => {
                if (!skipTask || !offboarding) return;
                const task = skipTask;
                setSkipTask(null);
                void runTaskAction(
                  task,
                  () => skipOffboardingTask(offboarding.id, task.id, skipReason.trim()),
                  `"${task.title}" skipped.`,
                );
              }}
            >
              Skip step
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-secondary">
            “{skipTask?.title}” will count as done for offboarding progress. The reason is recorded in the
            audit log.
          </p>
          <div>
            <Label htmlFor="skip-reason">Reason *</Label>
            <Textarea
              id="skip-reason"
              rows={2}
              maxLength={1000}
              value={skipReason}
              placeholder="e.g. Employee declined an exit interview"
              onChange={(e) => setSkipReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={reopenTask !== null}
        title="Reopen step"
        tone="primary"
        description={
          reopenTask
            ? `Put "${reopenTask.title}" back to pending?${
                reopenTask.taskType === 'exit_interview' && reopenTask.status === 'completed'
                  ? ' The interview answers are kept but it is no longer marked as conducted.'
                  : ''
              }${
                offboarding?.status === 'completed' && reopenTask.isRequired
                  ? ' The offboarding will move back to in progress.'
                  : ''
              }`
            : undefined
        }
        confirmLabel="Reopen"
        onConfirm={async () => {
          if (!reopenTask || !offboarding) return;
          await reopenOffboardingTask(offboarding.id, reopenTask.id);
          await refresh();
          showNotice(`"${reopenTask.title}" reopened.`);
        }}
        onClose={() => setReopenTask(null)}
      />

      <ConfirmDialog
        open={revokeTask !== null}
        title={access?.hasPortalAccount ? 'Revoke system access' : 'Confirm no system access'}
        tone="danger"
        description={
          access?.hasPortalAccount ? (
            <div className="space-y-2">
              <p>
                The HR portal account <strong>{access.email}</strong> will be deactivated and{' '}
                {access.activeSessionCount === 1
                  ? 'its active session'
                  : `all ${access.activeSessionCount} active sessions`}{' '}
                signed out immediately.
              </p>
              <p className="text-xs">
                Do this on or after the last working day
                {offboarding?.lastWorkingDate ? ` (${formatShortDate(offboarding.lastWorkingDate)})` : ''}.
              </p>
            </div>
          ) : (
            `${employee.fullName} has no HR portal account. Confirm that access to other systems has been removed.`
          )
        }
        confirmLabel={access?.hasPortalAccount ? 'Revoke access' : 'Confirm'}
        onConfirm={async () => {
          if (!revokeTask || !offboarding) return;
          await revokeOffboardingAccess(offboarding.id, revokeTask.id);
          await refresh();
          showNotice(access?.hasPortalAccount ? 'Access revoked and sessions signed out.' : 'Access step confirmed.');
        }}
        onClose={() => setRevokeTask(null)}
      />
    </div>
  );
}
