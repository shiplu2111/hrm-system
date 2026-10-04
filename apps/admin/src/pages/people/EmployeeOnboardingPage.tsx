import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  ExternalLink,
  Eye,
  FileWarning,
  Loader2,
  Mail,
  MinusCircle,
  Paperclip,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Upload,
  User,
} from 'lucide-react';
import {
  ASSET_CATEGORY_LABELS,
  ONBOARDING_TASK_CATEGORIES,
  ONBOARDING_TASK_CATEGORY_LABELS,
  type DocumentTypeRecord,
  type EmployeeOnboardingRecord,
  type EmployeeOnboardingTaskRecord,
  type EmployeeRecord,
  type OnboardingChecklistTemplateRecord,
} from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ProgressBar } from '@/components/ui/Progress';
import { Avatar, Toggle } from '@/components/ui/Toggle';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmployeeDocumentUploadModal } from '@/components/people/EmployeeDocumentUploadModal';
import { AssignAssetModal } from '@/components/assets/AssignAssetModal';
import { EmployeeAssetsCard } from '@/components/assets/EmployeeAssetsCard';
import { useNav } from '@/context/NavContext';
import { listDocumentTypes } from '@/lib/documents-api';
import { getEmployee } from '@/lib/employees-api';
import {
  getEmployeeDocumentFileUrl,
  uploadEmployeeDocumentFile,
  verifyEmployeeDocument,
} from '@/lib/employee-documents-api';
import {
  acceptOnboardingPolicy,
  completeOnboardingTask,
  getOnboardingForEmployee,
  listOnboardingTemplates,
  reopenOnboardingTask,
  resendOnboardingWelcome,
  skipOnboardingTask,
  startEmployeeOnboarding,
} from '@/lib/onboarding-api';
import {
  ONBOARDING_CATEGORY_ICONS,
  formatShortDate,
  onboardingDocumentStatusBadge,
  onboardingStatusBadge,
} from '@/lib/onboarding-display';
import { ApiError } from '@/lib/tenant-api-client';

type Filter = 'all' | 'pending' | 'overdue' | 'documents' | 'done';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'documents', label: 'Documents' },
  { key: 'done', label: 'Done' },
];

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

function matchesFilter(task: EmployeeOnboardingTaskRecord, filter: Filter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'pending':
      return task.status === 'pending';
    case 'overdue':
      return task.isOverdue;
    case 'documents':
      return task.documentTypeId !== null;
    case 'done':
      return task.status !== 'pending';
  }
}

/** Skipped tasks and tasks someone ticked off by hand can be reopened; document/asset completions follow that record. */
function canReopen(task: EmployeeOnboardingTaskRecord): boolean {
  if (task.status === 'skipped') return true;
  if (task.status !== 'completed') return false;
  if (task.companyAssetId) return false;
  return !task.employeeDocumentId || task.policyAcceptedAt !== null;
}

function safeExternalUrl(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

export function EmployeeOnboardingPage() {
  const { selectedEmployeeId, openEmployee, navigate } = useNav();
  const canCreate = usePermission('employee', 'create');
  const canEdit = usePermission('employee', 'edit');
  const canApprove = usePermission('employee', 'approve');

  const [employee, setEmployee] = useState<EmployeeRecord | null>(null);
  const [onboarding, setOnboarding] = useState<EmployeeOnboardingRecord | null>(null);
  const [docTypes, setDocTypes] = useState<DocumentTypeRecord[]>([]);
  const [templates, setTemplates] = useState<OnboardingChecklistTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [actionTaskId, setActionTaskId] = useState<string | null>(null);
  const [welcomeSending, setWelcomeSending] = useState(false);

  const [startForm, setStartForm] = useState({ templateId: '', startDate: '', sendWelcome: true });
  const [starting, setStarting] = useState(false);

  const [uploadTask, setUploadTask] = useState<EmployeeOnboardingTaskRecord | null>(null);
  const [attachTask, setAttachTask] = useState<EmployeeOnboardingTaskRecord | null>(null);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attaching, setAttaching] = useState(false);

  const [skipTask, setSkipTask] = useState<EmployeeOnboardingTaskRecord | null>(null);
  const [skipReason, setSkipReason] = useState('');
  const [reopenTask, setReopenTask] = useState<EmployeeOnboardingTaskRecord | null>(null);

  const [assignTask, setAssignTask] = useState<EmployeeOnboardingTaskRecord | null>(null);
  const [assetsRefreshKey, setAssetsRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!selectedEmployeeId) return;
    setLoading(true);
    setError(null);
    try {
      const emp = await getEmployee(selectedEmployeeId);
      const [record, types] = await Promise.all([
        getOnboardingForEmployee(selectedEmployeeId),
        listDocumentTypes(emp.companyId),
      ]);
      setEmployee(emp);
      setOnboarding(record);
      setDocTypes(types.filter((t) => t.isActive && t.scope === 'employee'));
      if (!record) {
        const active = await listOnboardingTemplates(emp.companyId, true);
        setTemplates(active);
        setStartForm({
          templateId: (active.find((t) => t.isDefault) ?? active[0])?.id ?? '',
          startDate: emp.hireDate,
          sendWelcome: true,
        });
      }
    } catch (err) {
      setError(errorMessage(err, 'Failed to load onboarding'));
    } finally {
      setLoading(false);
    }
  }, [selectedEmployeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    if (!selectedEmployeeId) return;
    setOnboarding(await getOnboardingForEmployee(selectedEmployeeId));
  }, [selectedEmployeeId]);

  const runTaskAction = async (
    task: EmployeeOnboardingTaskRecord,
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
      setError(errorMessage(err, 'Failed to update task'));
    } finally {
      setActionTaskId(null);
    }
  };

  const tasks = useMemo(() => onboarding?.tasks ?? [], [onboarding?.tasks]);
  const filterCounts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map(({ key }) => [key, tasks.filter((t) => matchesFilter(t, key)).length]),
      ) as Record<Filter, number>,
    [tasks],
  );
  const visibleTasks = tasks.filter((t) => matchesFilter(t, filter));
  const sections = ONBOARDING_TASK_CATEGORIES.map((category) => ({
    category,
    tasks: visibleTasks.filter((t) => t.category === category),
    total: tasks.filter((t) => t.category === category),
  })).filter((section) => section.tasks.length > 0);

  const handleStart = async () => {
    if (!employee) return;
    setStarting(true);
    setError(null);
    try {
      const record = await startEmployeeOnboarding(employee.companyId, {
        employeeId: employee.id,
        templateId: startForm.templateId || undefined,
        startDate: startForm.startDate || undefined,
        sendWelcome: startForm.sendWelcome,
      });
      setOnboarding(record);
      setNotice(`Onboarding started with ${record.templateName ?? 'the selected template'}.`);
    } catch (err) {
      setError(errorMessage(err, 'Failed to start onboarding'));
    } finally {
      setStarting(false);
    }
  };

  const handleResendWelcome = async () => {
    if (!onboarding) return;
    setWelcomeSending(true);
    setError(null);
    try {
      setOnboarding(await resendOnboardingWelcome(onboarding.id));
      setNotice('Welcome notification sent.');
    } catch (err) {
      setError(errorMessage(err, 'Failed to resend welcome notification'));
    } finally {
      setWelcomeSending(false);
    }
  };

  const handleAssetsChanged = async (message: string, checklistUpdates: string[]) => {
    setAssetsRefreshKey((key) => key + 1);
    await refresh();
    setError(null);
    setNotice([message, ...checklistUpdates].join(' · '));
  };

  const submitAttach = async () => {
    if (!employee || !attachTask?.employeeDocumentId || !attachFile) return;
    setAttaching(true);
    setError(null);
    try {
      await uploadEmployeeDocumentFile(employee.id, attachTask.employeeDocumentId, attachFile);
      setAttachTask(null);
      await refresh();
      setNotice(`File attached to ${attachTask.documentTypeName ?? 'the document'}.`);
    } catch (err) {
      setError(errorMessage(err, 'Failed to attach file'));
    } finally {
      setAttaching(false);
    }
  };

  const viewDocument = async (task: EmployeeOnboardingTaskRecord) => {
    if (!employee || !task.employeeDocumentId) return;
    try {
      const { url } = await getEmployeeDocumentFileUrl(employee.id, task.employeeDocumentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(errorMessage(err, 'Failed to open document'));
    }
  };

  const renderDocumentLine = (task: EmployeeOnboardingTaskRecord) => {
    if (!task.documentTypeId || !task.documentStatus) return null;
    const pending = task.status === 'pending';
    if (!pending && task.documentStatus === 'missing') return null;
    const badge = onboardingDocumentStatusBadge(task.documentStatus);
    const busy = actionTaskId === task.id;
    const hasFile =
      task.documentStatus !== 'missing' && task.documentStatus !== 'awaiting_file';
    const active = onboarding?.status !== 'cancelled';
    const canSupplyFile = active && pending;
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-base bg-[rgb(var(--bg-muted))]/40 px-3 py-2">
        <Paperclip className="h-3.5 w-3.5 text-muted shrink-0" />
        <span className="text-xs font-medium text-primary">{task.documentTypeName}</span>
        <Badge tone={badge.tone} dot>
          {badge.label}
        </Badge>
        {task.documentRequiresVerification ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <ShieldCheck className="h-3 w-3" /> Verification required
          </span>
        ) : null}
        {task.documentUploadedAt ? (
          <span className="text-xs text-muted">
            Uploaded {formatShortDate(task.documentUploadedAt)}
          </span>
        ) : null}
        {task.documentVerifiedAt ? (
          <span className="text-xs text-muted">
            · Verified {formatShortDate(task.documentVerifiedAt)}
          </span>
        ) : null}
        <div className="flex items-center gap-1 ml-auto">
          {hasFile ? (
            <Button variant="ghost" size="sm" onClick={() => void viewDocument(task)}>
              <Eye className="h-3.5 w-3.5" /> View
            </Button>
          ) : null}
          {canSupplyFile && task.documentStatus === 'missing' && canCreate ? (
            <Button variant="secondary" size="sm" onClick={() => setUploadTask(task)}>
              <Upload className="h-3.5 w-3.5" /> Upload
            </Button>
          ) : null}
          {canSupplyFile && task.documentStatus === 'awaiting_file' && canEdit ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAttachFile(null);
                setAttachTask(task);
              }}
            >
              <Upload className="h-3.5 w-3.5" /> Attach file
            </Button>
          ) : null}
          {active && task.documentStatus === 'pending_verification' && canApprove && employee ? (
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() =>
                void runTaskAction(
                  task,
                  () => verifyEmployeeDocument(employee.id, task.employeeDocumentId!),
                  `${task.documentTypeName} verified.`,
                )
              }
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Verify
            </Button>
          ) : null}
        </div>
      </div>
    );
  };

  const renderActions = (task: EmployeeOnboardingTaskRecord) => {
    if (!onboarding || onboarding.status === 'cancelled') return null;
    const busy = actionTaskId === task.id;
    const spinner = <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    const buttons: ReactElement[] = [];

    if (task.status === 'pending') {
      if (
        canEdit &&
        (task.taskType === 'manual_task' ||
          (task.taskType === 'provisioning' && !task.assetCategory))
      ) {
        buttons.push(
          <Button
            key="done"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() =>
              void runTaskAction(task, () => completeOnboardingTask(onboarding.id, task.id))
            }
          >
            {busy ? spinner : <Check className="h-3.5 w-3.5" />} Mark done
          </Button>,
        );
      }
      if (canEdit && task.taskType === 'policy_acceptance' && !task.documentRequiresVerification) {
        buttons.push(
          <Button
            key="accept"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() =>
              void runTaskAction(
                task,
                () => acceptOnboardingPolicy(onboarding.id, task.id),
                `Policy acceptance recorded for "${task.title}".`,
              )
            }
          >
            {busy ? spinner : <ShieldCheck className="h-3.5 w-3.5" />} Record acceptance
          </Button>,
        );
      }
      if (canEdit && task.taskType === 'provisioning' && task.assetCategory) {
        const none = (task.pendingAssetAssignCount ?? 0) === 0;
        buttons.push(
          <Button
            key="assign"
            variant="secondary"
            size="sm"
            disabled={busy || none}
            title={none ? 'No available assets in this category' : undefined}
            onClick={() => setAssignTask(task)}
          >
            {busy ? spinner : null}
            Assign {task.assetCategory.replace('_', ' ')}
            {none ? ' (none free)' : ''}
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
    } else if (canEdit && canReopen(task)) {
      buttons.push(
        <Button key="reopen" variant="ghost" size="sm" disabled={busy} onClick={() => setReopenTask(task)}>
          <RotateCcw className="h-3.5 w-3.5" /> Reopen
        </Button>,
      );
    }

    return buttons.length > 0 ? <div className="flex flex-wrap gap-1.5 justify-end">{buttons}</div> : null;
  };

  const renderTask = (task: EmployeeOnboardingTaskRecord) => {
    const policyUrl = safeExternalUrl(task.policyDocumentUrl);
    return (
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
        <div className="flex-1 min-w-0">
          <div className="flex flex-col md:flex-row md:items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-sm font-medium ${
                    task.status === 'pending' ? 'text-primary' : 'text-secondary'
                  }`}
                >
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
              {task.description ? (
                <p className="text-xs text-secondary mt-0.5">{task.description}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3" /> {task.assigneeLabel ?? 'Unassigned'}
                </span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    task.isOverdue ? 'text-error-600 font-medium' : ''
                  }`}
                >
                  <Calendar className="h-3 w-3" />
                  {task.dueDate ? `Due ${formatShortDate(task.dueDate)}` : 'No due date'}
                </span>
                {task.completedAt ? (
                  <span>
                    {task.status === 'skipped' ? 'Skipped' : 'Completed'}{' '}
                    {formatShortDate(task.completedAt)}
                  </span>
                ) : null}
                {task.policyAcceptedAt ? (
                  <span>Accepted {formatShortDate(task.policyAcceptedAt)}</span>
                ) : null}
                {task.companyAssetName ? <span>Asset: {task.companyAssetName}</span> : null}
                {policyUrl ? (
                  <a
                    href={policyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-accent-600 hover:underline"
                  >
                    View policy <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            </div>
            <div className="shrink-0">{renderActions(task)}</div>
          </div>
          {renderDocumentLine(task)}
        </div>
      </li>
    );
  };

  if (!selectedEmployeeId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">
        Select an employee to view their onboarding.
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('onboarding')}>
            Go to Onboarding
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

  const statusBadge = onboarding ? onboardingStatusBadge(onboarding.status) : null;

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
          onClick={() => navigate('onboarding')}
          className="text-sm text-secondary hover:text-primary transition-colors"
        >
          All onboardings
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
              <h1 className="text-xl font-bold text-primary">Onboarding · {employee.fullName}</h1>
              {statusBadge ? (
                <Badge tone={statusBadge.tone} dot>
                  {statusBadge.label}
                </Badge>
              ) : (
                <Badge tone="neutral">Not started</Badge>
              )}
            </div>
            <p className="text-sm text-secondary mt-1">
              {employee.designation?.name ?? 'No designation'} ·{' '}
              {employee.department?.name ?? 'No department'} · {employee.employeeNumber}
            </p>
            <p className="text-xs text-muted mt-1">
              Hire date {formatShortDate(employee.hireDate)}
              {onboarding ? (
                <>
                  {' · '}Checklist: {onboarding.templateName ?? 'Template removed'}
                  {' · '}Started {formatShortDate(onboarding.startedAt)}
                  {onboarding.completedAt
                    ? ` · Completed ${formatShortDate(onboarding.completedAt)}`
                    : ''}
                </>
              ) : null}
            </p>
          </div>
          {onboarding ? (
            <div className="flex items-center gap-2 shrink-0">
              <Badge tone={onboarding.welcomeSentAt ? 'success' : 'warning'} dot>
                {onboarding.welcomeSentAt
                  ? `Welcome sent ${formatShortDate(onboarding.welcomeSentAt)}`
                  : 'Welcome not sent'}
              </Badge>
              {canEdit ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleResendWelcome()}
                  disabled={welcomeSending}
                >
                  {welcomeSending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                  {onboarding.welcomeSentAt ? 'Resend welcome' : 'Send welcome'}
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardBody>
      </Card>

      {!onboarding ? (
        <Card>
          <CardHeader>
            <CardTitle>Start onboarding</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-secondary">
              {employee.fullName} has no onboarding checklist yet. Onboarding starts automatically
              when a candidate is converted to an employee; for anyone else, start it here.
            </p>
            {templates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-strong px-4 py-6 text-center text-sm text-secondary">
                No active checklist templates.{' '}
                <button
                  type="button"
                  className="text-accent-600 hover:underline"
                  onClick={() => navigate('onboarding-templates')}
                >
                  Create one in Onboarding Templates
                </button>
                .
              </div>
            ) : canCreate ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                  <div>
                    <Label>Checklist template</Label>
                    <Select
                      value={startForm.templateId}
                      onChange={(e) => setStartForm({ ...startForm, templateId: e.target.value })}
                    >
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} ({template.itemCount} items)
                          {template.isDefault ? ' — default' : ''}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Start date</Label>
                    <Input
                      type="date"
                      value={startForm.startDate}
                      onChange={(e) => setStartForm({ ...startForm, startDate: e.target.value })}
                    />
                    <p className="text-xs text-muted mt-1">Due dates count from this day.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Toggle
                    checked={startForm.sendWelcome}
                    label="Send welcome notification"
                    onChange={(sendWelcome) => setStartForm({ ...startForm, sendWelcome })}
                  />
                  <span className="text-sm text-primary">Send welcome notification</span>
                </div>
                <Button onClick={() => void handleStart()} disabled={starting || !startForm.templateId}>
                  {starting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircle className="h-4 w-4" />
                  )}
                  Start onboarding
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted">You do not have permission to start onboarding.</p>
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
                  <span className="text-lg font-bold text-primary">
                    {onboarding.progressPercent}%
                  </span>
                </div>
                <ProgressBar
                  value={onboarding.progressPercent}
                  tone={onboarding.progressPercent === 100 ? 'success' : 'accent'}
                />
                <div className="text-xs text-secondary mt-1.5">
                  {onboarding.requiredCompletedCount} of {onboarding.requiredTaskCount} required
                  tasks done
                </div>
              </CardBody>
            </Card>
            {[
              {
                label: 'Overdue tasks',
                value: onboarding.overdueTaskCount,
                icon: AlertTriangle,
                tone: onboarding.overdueTaskCount > 0 ? 'text-error-600' : 'text-muted',
                filter: 'overdue' as Filter,
              },
              {
                label: 'Documents not uploaded',
                value: onboarding.documentsMissingCount,
                icon: FileWarning,
                tone: onboarding.documentsMissingCount > 0 ? 'text-warning-600' : 'text-muted',
                filter: 'documents' as Filter,
              },
              {
                label: 'Awaiting verification',
                value: onboarding.documentsPendingVerificationCount,
                icon: ShieldCheck,
                tone:
                  onboarding.documentsPendingVerificationCount > 0
                    ? 'text-warning-600'
                    : 'text-muted',
                filter: 'documents' as Filter,
              },
            ].map((stat) => (
              <button
                key={stat.label}
                type="button"
                onClick={() => setFilter(stat.filter)}
                className="text-left"
              >
                <Card className="h-full hover:ring-1 hover:ring-accent-200 transition">
                  <CardBody className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-muted">{stat.label}</div>
                      <div className="text-2xl font-bold text-primary mt-1">{stat.value}</div>
                    </div>
                    <stat.icon className={`h-5 w-5 ${stat.tone}`} />
                  </CardBody>
                </Card>
              </button>
            ))}
          </div>

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
              No tasks match this filter.
            </div>
          ) : (
            sections.map(({ category, tasks: sectionTasks, total }) => {
              const Icon = ONBOARDING_CATEGORY_ICONS[category];
              const done = total.filter((t) => t.status !== 'pending').length;
              return (
                <Card key={category}>
                  <CardHeader className="flex items-center justify-between">
                    <CardTitle>
                      <span className="inline-flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted" />
                        {ONBOARDING_TASK_CATEGORY_LABELS[category]}
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

          <EmployeeAssetsCard
            companyId={employee.companyId}
            employee={{ id: employee.id, fullName: employee.fullName }}
            canEdit={canEdit && onboarding.status !== 'cancelled'}
            refreshKey={assetsRefreshKey}
            onChanged={handleAssetsChanged}
          />
        </>
      )}

      <EmployeeDocumentUploadModal
        open={uploadTask !== null}
        onClose={() => setUploadTask(null)}
        employeeId={employee.id}
        documentTypes={docTypes}
        presetDocumentTypeId={uploadTask?.documentTypeId ?? null}
        onUploaded={async () => {
          const name = uploadTask?.documentTypeName;
          await refresh();
          setNotice(`${name ?? 'Document'} uploaded.`);
        }}
      />

      <Modal
        open={attachTask !== null}
        onClose={() => setAttachTask(null)}
        title={`Attach file to ${attachTask?.documentTypeName ?? 'document'}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAttachTask(null)} disabled={attaching}>
              Cancel
            </Button>
            <Button onClick={() => void submitAttach()} disabled={attaching || !attachFile}>
              {attaching ? 'Uploading…' : 'Attach'}
            </Button>
          </>
        }
      >
        <div>
          <Label>File (PDF, JPG, PNG — max 10MB)</Label>
          <Input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(e) => setAttachFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </Modal>

      <Modal
        open={skipTask !== null}
        onClose={() => setSkipTask(null)}
        title="Skip task"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSkipTask(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!skipTask || !onboarding) return;
                const task = skipTask;
                setSkipTask(null);
                void runTaskAction(
                  task,
                  () => skipOnboardingTask(onboarding.id, task.id, skipReason.trim() || undefined),
                  `"${task.title}" skipped.`,
                );
              }}
            >
              Skip task
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-secondary">
            “{skipTask?.title}” will count as done for onboarding progress. The reason is
            recorded in the audit log.
          </p>
          <div>
            <Label>Reason</Label>
            <Textarea
              rows={2}
              maxLength={1000}
              value={skipReason}
              placeholder="e.g. Not applicable to remote employees"
              onChange={(e) => setSkipReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={reopenTask !== null}
        title="Reopen task"
        tone="primary"
        description={
          reopenTask
            ? `Put "${reopenTask.title}" back to pending?${
                onboarding?.status === 'completed' && reopenTask.isRequired
                  ? ' The onboarding will move back to in progress.'
                  : ''
              }`
            : undefined
        }
        confirmLabel="Reopen"
        onConfirm={async () => {
          if (!reopenTask || !onboarding) return;
          await reopenOnboardingTask(onboarding.id, reopenTask.id);
          await refresh();
        }}
        onClose={() => setReopenTask(null)}
      />

      <AssignAssetModal
        open={assignTask !== null}
        onClose={() => setAssignTask(null)}
        companyId={employee.companyId}
        employee={{ id: employee.id, fullName: employee.fullName }}
        category={assignTask?.assetCategory ?? null}
        onboardingTaskId={assignTask?.id}
        title={assignTask?.title}
        description={
          assignTask?.assetCategory
            ? `Pick an available ${ASSET_CATEGORY_LABELS[assignTask.assetCategory].toLowerCase()} from the asset register.`
            : undefined
        }
        onAssigned={(assignment) =>
          handleAssetsChanged(
            `${assignment.assetName} assigned to ${assignment.employeeName}.`,
            assignment.checklistUpdates ?? [],
          )
        }
      />
    </div>
  );
}
