import { useCallback, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Plus,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react';
import type { WorkflowAssigneeType, WorkflowDefinitionStep } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Label, Select } from '@/components/ui/Form';
import type { TenantRoleSummary } from '@/lib/roles-api';

export interface DraftWorkflowStep {
  id: string;
  assigneeType: WorkflowAssigneeType;
  roleName: string;
}

interface WorkflowStepListProps {
  steps: DraftWorkflowStep[];
  roles: TenantRoleSummary[];
  onChange: (steps: DraftWorkflowStep[]) => void;
}

function normalizeOrder(steps: DraftWorkflowStep[]): WorkflowDefinitionStep[] {
  return steps.map((step, index) => ({
    order: index + 1,
    assigneeType: step.assigneeType,
    roleName: step.roleName,
  }));
}

export function draftStepsFromDefinition(
  steps: WorkflowDefinitionStep[],
): DraftWorkflowStep[] {
  return steps.map((step) => ({
    id: `step-${step.order}-${step.roleName}`,
    assigneeType: step.assigneeType,
    roleName: step.roleName,
  }));
}

export function definitionStepsFromDraft(steps: DraftWorkflowStep[]): WorkflowDefinitionStep[] {
  return normalizeOrder(steps);
}

export function createEmptyStep(roles: TenantRoleSummary[]): DraftWorkflowStep {
  const fallbackRole = roles.find((r) => r.name === 'HR Admin') ?? roles[0];
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    assigneeType: 'role',
    roleName: fallbackRole?.name ?? 'HR Admin',
  };
}

export function WorkflowStepList({ steps, roles, onChange }: WorkflowStepListProps) {
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
    onChange(
      steps.map((step, i) => {
        if (i !== index) return step;
        const updated = { ...step, ...patch };
        if (patch.assigneeType === 'direct_manager') {
          updated.roleName = 'Manager';
        } else if (patch.assigneeType === 'role' && step.assigneeType === 'direct_manager') {
          updated.roleName =
            roles.find((r) => r.name === 'HR Admin')?.name ?? roles[0]?.name ?? 'HR Admin';
        }
        return updated;
      }),
    );
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    onChange(steps.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Approval steps (drag to reorder)</Label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...steps, createEmptyStep(roles)])}
        >
          <Plus className="h-3.5 w-3.5" /> Add step
        </Button>
      </div>

      <div className="space-y-2">
        {steps.map((step, index) => (
          <div
            key={step.id}
            draggable
            onDragStart={() => {
              dragIndex.current = index;
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverIndex(index);
            }}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={() => {
              if (dragIndex.current != null) {
                moveStep(dragIndex.current, index);
              }
              dragIndex.current = null;
              setDragOverIndex(null);
            }}
            className={`surface border rounded-xl p-3 transition-all ${
              dragOverIndex === index ? 'border-accent-500 ring-2 ring-accent-500/20' : 'border-base'
            }`}
          >
            <div className="flex items-start gap-2">
              <button
                type="button"
                className="mt-2 p-1 text-muted cursor-grab active:cursor-grabbing"
                aria-label="Drag to reorder"
              >
                <GripVertical className="h-4 w-4" />
              </button>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Step {index + 1} — Assignee</Label>
                  <Select
                    value={step.assigneeType}
                    onChange={(e) =>
                      updateStep(index, {
                        assigneeType: e.target.value as WorkflowAssigneeType,
                      })
                    }
                  >
                    <option value="direct_manager">Requester&apos;s direct manager</option>
                    <option value="role">Specific role</option>
                  </Select>
                </div>

                <div>
                  <Label>{step.assigneeType === 'direct_manager' ? 'Step label' : 'Role'}</Label>
                  {step.assigneeType === 'direct_manager' ? (
                    <div className="flex items-center gap-2 h-[38px] px-3 rounded-lg border border-base bg-[rgb(var(--bg-muted))] text-sm text-secondary">
                      <Users className="h-4 w-4 shrink-0" />
                      Direct Manager (reporting line)
                    </div>
                  ) : (
                    <Select
                      value={step.roleName}
                      onChange={(e) => updateStep(index, { roleName: e.target.value })}
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.name}>
                          {role.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1 mt-1">
                <button
                  type="button"
                  className="p-1 rounded text-muted hover:text-primary disabled:opacity-30"
                  disabled={index === 0}
                  onClick={() => moveStep(index, index - 1)}
                  aria-label="Move up"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded text-muted hover:text-primary disabled:opacity-30"
                  disabled={index === steps.length - 1}
                  onClick={() => moveStep(index, index + 1)}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded text-muted hover:text-danger-600 disabled:opacity-30"
                  disabled={steps.length <= 1}
                  onClick={() => removeStep(index)}
                  aria-label="Remove step"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-2 ml-8 flex items-center gap-2 text-[11px] text-muted">
              {step.assigneeType === 'direct_manager' ? (
                <>
                  <Users className="h-3 w-3" />
                  Resolved from employee manager_id at runtime
                </>
              ) : (
                <>
                  <UserCog className="h-3 w-3" />
                  Users with role &quot;{step.roleName}&quot; can approve this step
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
