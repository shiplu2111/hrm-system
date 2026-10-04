import { Check, Circle, Clock, MinusCircle, Settings2, X } from 'lucide-react';
import type {
  WorkflowAssigneeType,
  WorkflowInstanceRecord,
  WorkflowInstanceStep,
  WorkflowStepStatus,
} from '@hrm/shared-types';
import { Badge } from '@/components/ui/Badge';

export interface WorkflowRouteSummary {
  name: string;
  source: 'workflow_builder' | 'system_default';
  steps: Array<{ order: number; assigneeType: WorkflowAssigneeType; roleName: string }>;
}

interface WorkflowApprovalTimelineProps {
  route: WorkflowRouteSummary;
  /** Runtime instance; `null` previews the chain a submission will go through. */
  workflow: WorkflowInstanceRecord | null;
  /** Opens Settings → Approval Workflows; hidden when omitted. */
  onConfigure?: () => void;
}

const ASSIGNEE_LABEL: Record<WorkflowAssigneeType, string> = {
  role: 'Role',
  direct_manager: "Requester's manager",
  skip_level_manager: "Manager's manager",
};

const STATUS_META: Record<
  WorkflowStepStatus | 'upcoming',
  { label: string; icon: typeof Check; ring: string; tone: 'success' | 'error' | 'warning' | 'neutral' }
> = {
  approved: { label: 'Approved', icon: Check, ring: 'bg-success-600 text-white', tone: 'success' },
  rejected: { label: 'Rejected', icon: X, ring: 'bg-error-600 text-white', tone: 'error' },
  pending: { label: 'Awaiting', icon: Clock, ring: 'bg-warning-500 text-white', tone: 'warning' },
  skipped: { label: 'Skipped', icon: MinusCircle, ring: 'bg-slate-300 text-white dark:bg-slate-600', tone: 'neutral' },
  upcoming: { label: 'Upcoming', icon: Circle, ring: 'border-2 border-strong text-muted', tone: 'neutral' },
};

function formatActedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function stepState(
  step: WorkflowInstanceStep,
  workflow: WorkflowInstanceRecord,
): WorkflowStepStatus | 'upcoming' {
  if (step.status !== 'pending') return step.status;
  if (workflow.status !== 'pending') return 'upcoming';
  return step.order === workflow.currentStepOrder ? 'pending' : 'upcoming';
}

/** Read-only view of an approval chain from the Workflow Builder and its runtime progress. */
export function WorkflowApprovalTimeline({ route, workflow, onConfigure }: WorkflowApprovalTimelineProps) {
  const steps: Array<WorkflowInstanceStep & { state: WorkflowStepStatus | 'upcoming' }> = workflow
    ? workflow.steps.map((s) => ({ ...s, state: stepState(s, workflow) }))
    : route.steps.map((s) => ({
        ...s,
        status: 'pending',
        actedAt: null,
        actedByEmployeeId: null,
        actedByUserId: null,
        comment: null,
        state: 'upcoming',
      }));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary truncate">{route.name}</p>
          <p className="text-xs text-muted mt-0.5">
            {route.source === 'workflow_builder'
              ? 'Configured in Approval Workflows'
              : 'Built-in chain — no offer letter workflow is configured'}
          </p>
        </div>
        {onConfigure ? (
          <button
            type="button"
            onClick={onConfigure}
            className="shrink-0 inline-flex items-center gap-1 text-xs text-accent-600 hover:text-accent-700"
          >
            <Settings2 className="h-3.5 w-3.5" /> Configure
          </button>
        ) : null}
      </div>

      <ol className="relative space-y-4">
        {steps.map((step, index) => {
          const meta = STATUS_META[step.state];
          const Icon = meta.icon;
          return (
            <li key={step.order} className="relative flex gap-3">
              {index < steps.length - 1 ? (
                <span className="absolute left-[11px] top-7 bottom-[-14px] w-px bg-[rgb(var(--border-base))]" aria-hidden />
              ) : null}
              <span
                className={`relative z-[1] mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${meta.ring}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-primary">
                    {step.assigneeType === 'role' ? step.roleName : ASSIGNEE_LABEL[step.assigneeType]}
                  </span>
                  {step.state !== 'upcoming' || workflow ? (
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted mt-0.5">
                  Step {step.order} · {ASSIGNEE_LABEL[step.assigneeType]}
                  {step.actedAt ? ` · ${formatActedAt(step.actedAt)}` : ''}
                </p>
                {step.state === 'pending' && step.assigneeType === 'role' ? (
                  <p className="text-xs text-secondary mt-1">
                    Any {step.roleName} can act on this step
                    {step.roleName === 'Company Owner' ? '.' : ' (Company Owner can too).'}
                  </p>
                ) : null}
                {step.comment ? (
                  <p className="mt-1.5 rounded-md bg-[rgb(var(--bg-muted))] px-2.5 py-1.5 text-xs text-secondary whitespace-pre-wrap">
                    “{step.comment}”
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
