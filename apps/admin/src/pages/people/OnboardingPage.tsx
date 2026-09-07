import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Shield,
  Monitor,
  KeyRound,
  Loader2,
  Mail,
  ChevronDown,
} from 'lucide-react';
import type {
  EmployeeOnboardingRecord,
  EmployeeOnboardingTaskRecord,
  OnboardingTaskCategory,
} from '@hrm/shared-types';
import { ChecklistBoard } from '@/components/people/ChecklistBoard';
import type { ChecklistItem } from '@/components/people/ChecklistBoard';
import { CompanySelector } from '@/components/org/CompanySelector';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCompany } from '@/context/CompanyContext';
import {
  acceptOnboardingPolicy,
  completeOnboardingTask,
  getEmployeeOnboarding,
  listEmployeeOnboardings,
  resendOnboardingWelcome,
} from '@/lib/onboarding-api';
import { ApiError } from '@/lib/tenant-api-client';

const CATEGORY_LABELS: Record<OnboardingTaskCategory, string> = {
  document_collection: 'Document Collection',
  policy_acceptance: 'Policy Acceptance',
  equipment_provisioning: 'Equipment Provisioning',
  system_access: 'System Access',
  general: 'General',
};

const CATEGORY_ICONS = {
  document_collection: FileText,
  policy_acceptance: Shield,
  equipment_provisioning: Monitor,
  system_access: KeyRound,
  general: FileText,
} as const;

function formatDueDate(value: string | null): string {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function tasksToChecklistItems(
  tasks: EmployeeOnboardingTaskRecord[],
): ChecklistItem[] {
  return tasks.map((task) => {
    const category = task.category as OnboardingTaskCategory;
    return {
      id: task.id,
      title: task.title,
      description: task.description ?? '',
      category: CATEGORY_LABELS[category],
      assignee: task.assigneeLabel ?? 'Unassigned',
      dueDate: formatDueDate(task.dueDate),
      completed: task.status === 'completed' || task.status === 'skipped',
      icon: CATEGORY_ICONS[category] ?? FileText,
      taskType: task.taskType,
      status: task.status,
      documentTypeName: task.documentTypeName,
      policyAcceptedAt: task.policyAcceptedAt,
    };
  });
}

export function OnboardingPage() {
  const { companyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onboardings, setOnboardings] = useState<EmployeeOnboardingRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmployeeOnboardingRecord | null>(null);
  const [actionTaskId, setActionTaskId] = useState<string | null>(null);
  const [welcomeSending, setWelcomeSending] = useState(false);

  const loadList = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listEmployeeOnboardings(companyId, 'in_progress');
      setOnboardings(rows);
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
            : 'Failed to load onboardings',
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const loadDetail = useCallback(async (onboardingId: string) => {
    try {
      const row = await getEmployeeOnboarding(onboardingId);
      setDetail(row);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load onboarding checklist',
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
    () => (detail?.tasks ? tasksToChecklistItems(detail.tasks) : []),
    [detail?.tasks],
  );

  const handleTaskAction = async (taskId: string) => {
    if (!detail) return;
    const task = detail.tasks?.find(
      (item: EmployeeOnboardingTaskRecord) => item.id === taskId,
    );
    if (!task || task.status !== 'pending') return;

    setActionTaskId(taskId);
    setError(null);
    try {
      if (task.taskType === 'policy_acceptance') {
        await acceptOnboardingPolicy(detail.id, taskId);
      } else if (
        task.taskType === 'manual_task' ||
        task.taskType === 'provisioning'
      ) {
        await completeOnboardingTask(detail.id, taskId);
      }
      await loadDetail(detail.id);
      await loadList();
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

  const handleResendWelcome = async () => {
    if (!detail) return;
    setWelcomeSending(true);
    setError(null);
    try {
      const updated = await resendOnboardingWelcome(detail.id);
      setDetail(updated);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to resend welcome notification',
      );
    } finally {
      setWelcomeSending(false);
    }
  };

  if (!companyId) {
    return (
      <div className="p-4 lg:p-6">
        <CompanySelector />
        <div className="mt-6 rounded-xl border border-dashed border-strong px-6 py-12 text-center text-sm text-secondary">
          Select a company to manage onboarding.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-primary">Onboarding</h1>
          <p className="text-sm text-secondary mt-0.5">
            Track checklist progress, document collection, and policy acceptance
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
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading onboardings…
        </div>
      ) : onboardings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-strong px-6 py-12 text-center text-sm text-secondary">
          No in-progress onboardings. Onboarding starts automatically when a candidate is hired.
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
                  {onboardings.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.employeeName} ({row.employeeNumber}) — {row.progressPercent}%
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              </div>
              {detail && (
                <div className="flex items-center gap-2 sm:ml-auto">
                  <Badge tone={detail.welcomeSentAt ? 'success' : 'warning'} dot>
                    {detail.welcomeSentAt ? 'Welcome sent' : 'Welcome pending'}
                  </Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleResendWelcome()}
                    disabled={welcomeSending}
                  >
                    {welcomeSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    Resend welcome
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          {detail && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-primary">
                  {detail.employeeName}
                </h2>
                <p className="text-sm text-secondary mt-0.5">
                  {detail.designationName ?? 'Employee'} · {detail.employeeNumber}
                  {detail.templateName ? ` · ${detail.templateName}` : ''}
                </p>
              </div>

              <ChecklistBoard
                config={{
                  title: 'Onboarding Progress',
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
    </div>
  );
}
