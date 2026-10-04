import { useCallback, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import {
  WORKFLOW_MAX_STEPS,
  type WorkflowAssigneeType,
  type WorkflowDefinitionStep,
} from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import type { TenantRoleSummary } from '@/lib/roles-api';
import { MONEY_PATTERN, formatMoney } from '@/lib/payroll-copy';
import { stepApproverLabel } from '@/lib/workflow-api';

export interface DraftWorkflowStep {
  id: string;
  assigneeType: WorkflowAssigneeType;
  roleName: string;
  hasCondition: boolean;
  conditionOperator: 'gt' | 'gte';
  conditionAmount: string;
}

function newStepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function draftStepsFromDefinition(steps: WorkflowDefinitionStep[]): DraftWorkflowStep[] {
  return [...steps]
    .sort((a, b) => a.order - b.order)
    .map((step) => ({
      id: newStepId(),
      assigneeType: step.assigneeType,
      roleName: step.roleName,
      hasCondition: !!step.condition,
      conditionOperator: step.condition?.operator ?? 'gt',
      conditionAmount: step.condition ? String(step.condition.value) : '',
    }));
}

export function definitionStepsFromDraft(
  steps: DraftWorkflowStep[],
  allowConditions: boolean,
): WorkflowDefinitionStep[] {
  return steps.map((step, index) => ({
    order: index + 1,
    assigneeType: step.assigneeType,
    roleName: step.roleName,
    ...(allowConditions && step.hasCondition
      ? {
          condition: {
            type: 'amount_threshold' as const,
            operator: step.conditionOperator,
            value: Number(step.conditionAmount),
          },
        }
      : {}),
  }));
}

export function createEmptyStep(): DraftWorkflowStep {
  return {
    id: newStepId(),
    assigneeType: 'direct_manager',
    roleName: 'Manager',
    hasCondition: false,
    conditionOperator: 'gt',
    conditionAmount: '',
  };
}

/** Problems that would block saving, keyed by step id. */
export function draftStepIssues(
  steps: DraftWorkflowStep[],
  allowConditions: boolean,
): Record<string, string> {
  const issues: Record<string, string> = {};
  steps.forEach((step, index) => {
    if (step.assigneeType === 'role' && !step.roleName) {
      issues[step.id] = 'Choose a role';
      return;
    }
    const earlier = steps.findIndex(
      (other, i) =>
        i < index &&
        other.assigneeType === step.assigneeType &&
        other.roleName.toLowerCase() === step.roleName.toLowerCase(),
    );
    if (earlier >= 0) {
      issues[step.id] = `Same approver as step ${earlier + 1}`;
      return;
    }
    if (allowConditions && step.hasCondition) {
      const amount = step.conditionAmount.trim();
      if (!MONEY_PATTERN.test(amount) || Number(amount) <= 0) {
        issues[step.id] = 'Enter an amount above zero with at most 2 decimals';
      }
    }
  });
  return issues;
}

const MANAGER_VALUE: Record<string, WorkflowAssigneeType> = {
  direct_manager: 'direct_manager',
  skip_level_manager: 'skip_level_manager',
};

function approverValue(step: DraftWorkflowStep): string {
  return step.assigneeType === 'role' ? `role:${step.roleName}` : step.assigneeType;
}

interface WorkflowStepListProps {
  steps: DraftWorkflowStep[];
  roles: TenantRoleSummary[];
  onChange: (steps: DraftWorkflowStep[]) => void;
  allowConditions: boolean;
  /** Request amount the workflow itself starts at; conditions at or below it always pass. */
  workflowThreshold: { operator: 'gt' | 'gte'; value: number } | null;
  issues: Record<string, string>;
  showIssues: boolean;
  disabled?: boolean;
}

export function WorkflowStepList({
  steps,
  roles,
  onChange,
  allowConditions,
  workflowThreshold,
  issues,
  showIssues,
  disabled = false,
}: WorkflowStepListProps) {
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const moveStep = useCallback(
    (from: number, to: number) => {
      if (from === to || to < 0 || to >= steps.length) return;
      const next = [...steps];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      onChange(next);
    },
    [onChange, steps],
  );

  const updateStep = (index: number, patch: Partial<DraftWorkflowStep>) => {
    onChange(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  };

  const setApprover = (index: number, value: string) => {
    const managerType = MANAGER_VALUE[value];
    if (managerType) {
      updateStep(index, {
        assigneeType: managerType,
        roleName: managerType === 'direct_manager' ? 'Manager' : 'Skip-level Manager',
      });
    } else {
      updateStep(index, { assigneeType: 'role', roleName: value.replace(/^role:/, '') });
    }
  };

  const roleNames = new Set(roles.map((role) => role.name));

  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const issue = showIssues ? issues[step.id] : undefined;
        const missingRole = step.assigneeType === 'role' && !!step.roleName && !roleNames.has(step.roleName);
        const conditionValue = Number(step.conditionAmount);
        const alwaysPasses =
          allowConditions &&
          step.hasCondition &&
          workflowThreshold &&
          MONEY_PATTERN.test(step.conditionAmount.trim()) &&
          (conditionValue < workflowThreshold.value ||
            (conditionValue === workflowThreshold.value &&
              (step.conditionOperator === 'gte' || workflowThreshold.operator === 'gt')));

        return (
          <div
            key={step.id}
            draggable={!disabled}
            onDragStart={() => {
              dragIndex.current = index;
            }}
            onDragOver={(e) => {
              if (disabled) return;
              e.preventDefault();
              setDragOverIndex(index);
            }}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={() => {
              if (dragIndex.current != null) moveStep(dragIndex.current, index);
              dragIndex.current = null;
              setDragOverIndex(null);
            }}
            className={`rounded-xl border p-3 transition-all ${
              dragOverIndex === index
                ? 'border-accent-500 ring-2 ring-accent-500/20'
                : issue
                  ? 'border-error-300 dark:border-error-800'
                  : 'border-base'
            }`}
          >
            <div className="flex items-start gap-2">
              {!disabled ? (
                <span className="mt-2 p-1 text-muted cursor-grab active:cursor-grabbing" aria-hidden>
                  <GripVertical className="h-4 w-4" />
                </span>
              ) : null}
              <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-500 text-xs font-semibold text-white">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1 space-y-2">
                <Select
                  aria-label={`Step ${index + 1} approver`}
                  value={approverValue(step)}
                  disabled={disabled}
                  onChange={(e) => setApprover(index, e.target.value)}
                >
                  <optgroup label="Reporting line">
                    <option value="direct_manager">Requester&apos;s manager</option>
                    <option value="skip_level_manager">Manager&apos;s manager (skip level)</option>
                  </optgroup>
                  <optgroup label="Anyone with this role">
                    {missingRole ? (
                      <option value={`role:${step.roleName}`}>{step.roleName} (role not found)</option>
                    ) : null}
                    {roles.map((role) => (
                      <option key={role.id} value={`role:${role.name}`}>
                        {role.name}
                      </option>
                    ))}
                  </optgroup>
                </Select>
                <p className="text-xs text-muted">
                  {step.assigneeType === 'direct_manager'
                    ? 'The manager the requester reports to. Company Owners and HR Admins can also act.'
                    : step.assigneeType === 'skip_level_manager'
                      ? "The requester's manager's manager. Company Owners and HR Admins can also act."
                      : `Any ${step.roleName} who can see the requester; team-scoped roles only for their own reports.`}
                </p>

                {allowConditions ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <label className="inline-flex items-center gap-2 text-secondary">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-base"
                        checked={step.hasCondition}
                        disabled={disabled}
                        onChange={(e) =>
                          updateStep(index, {
                            hasCondition: e.target.checked,
                            conditionAmount: step.conditionAmount || '1000',
                          })
                        }
                      />
                      Only when claim is
                    </label>
                    {step.hasCondition ? (
                      <>
                        <div className="w-28">
                          <Select
                            aria-label={`Step ${index + 1} amount comparison`}
                            value={step.conditionOperator}
                            disabled={disabled}
                            onChange={(e) =>
                              updateStep(index, { conditionOperator: e.target.value as 'gt' | 'gte' })
                            }
                          >
                            <option value="gt">over</option>
                            <option value="gte">at least</option>
                          </Select>
                        </div>
                        <div className="w-28">
                          <Input
                            aria-label={`Step ${index + 1} amount`}
                            inputMode="decimal"
                            value={step.conditionAmount}
                            disabled={disabled}
                            onChange={(e) => updateStep(index, { conditionAmount: e.target.value })}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {missingRole ? (
                  <p className="flex items-center gap-1.5 text-xs text-warning-700 dark:text-warning-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    No role called &ldquo;{step.roleName}&rdquo; exists any more; pick another approver.
                  </p>
                ) : null}
                {alwaysPasses && workflowThreshold ? (
                  <p className="text-xs text-warning-700 dark:text-warning-300">
                    This workflow only runs for claims {workflowThreshold.operator === 'gte' ? 'of at least' : 'over'}{' '}
                    {formatMoney(workflowThreshold.value)}, so this step always applies.
                  </p>
                ) : null}
                {issue ? <p className="text-xs text-error-600 dark:text-error-400">{issue}</p> : null}
              </div>

              {!disabled ? (
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    className="rounded p-1 text-muted hover:text-primary disabled:opacity-30"
                    disabled={index === 0}
                    onClick={() => moveStep(index, index - 1)}
                    aria-label={`Move step ${index + 1} up`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-muted hover:text-primary disabled:opacity-30"
                    disabled={index === steps.length - 1}
                    onClick={() => moveStep(index, index + 1)}
                    aria-label={`Move step ${index + 1} down`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-muted hover:text-error-600 disabled:opacity-30"
                    disabled={steps.length <= 1}
                    onClick={() => onChange(steps.filter((_, i) => i !== index))}
                    aria-label={`Remove step ${index + 1} (${stepApproverLabel(step)})`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}

      {!disabled ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={steps.length >= WORKFLOW_MAX_STEPS}
          onClick={() => onChange([...steps, createEmptyStep()])}
        >
          <Plus className="h-3.5 w-3.5" /> Add step
        </Button>
      ) : null}
    </div>
  );
}
