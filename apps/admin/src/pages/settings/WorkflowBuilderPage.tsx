import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  GitBranch,
  Loader2,
  Plus,
  Sparkles,
} from 'lucide-react';
import type {
  WorkflowDefinitionRecord,
  WorkflowEntityType,
  WorkflowTriggerConfig,
} from '@hrm/shared-types';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';
import { CompanySelector } from '@/components/org/CompanySelector';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import {
  WorkflowStepList,
  createEmptyStep,
  definitionStepsFromDraft,
  draftStepsFromDefinition,
  type DraftWorkflowStep,
} from '@/components/workflow/WorkflowStepList';
import { useCompany } from '@/context/CompanyContext';
import { listTenantRoles, type TenantRoleSummary } from '@/lib/roles-api';
import {
  ENTITY_TYPE_OPTIONS,
  EXPENSE_HIGH_VALUE_TEMPLATE,
  STANDARD_LEAVE_TEMPLATE,
  createWorkflowDefinition,
  entityTypeLabel,
  formatWorkflowTrigger,
  listWorkflowDefinitions,
  updateWorkflowDefinition,
  type SaveWorkflowDefinitionInput,
} from '@/lib/workflow-api';
import { ApiError } from '@/lib/tenant-api-client';

type ViewMode = 'list' | 'editor';

interface EditorState {
  id: string | null;
  name: string;
  entityType: WorkflowEntityType;
  description: string;
  triggerType: 'always' | 'amount_threshold';
  thresholdAmount: string;
  thresholdOperator: 'gt' | 'gte';
  steps: DraftWorkflowStep[];
  isDefault: boolean;
  isActive: boolean;
  effectiveFrom: string;
}

function emptyEditor(roles: TenantRoleSummary[]): EditorState {
  return {
    id: null,
    name: '',
    entityType: 'expense_claim',
    description: '',
    triggerType: 'always',
    thresholdAmount: '1000',
    thresholdOperator: 'gt',
    steps: [createEmptyStep(roles)],
    isDefault: false,
    isActive: true,
    effectiveFrom: new Date().toISOString().slice(0, 10),
  };
}

function editorFromRecord(record: WorkflowDefinitionRecord): EditorState {
  const trigger = record.triggerConfig;
  return {
    id: record.id,
    name: record.name,
    entityType: record.entityType,
    description: record.description ?? '',
    triggerType: trigger?.type === 'amount_threshold' ? 'amount_threshold' : 'always',
    thresholdAmount: trigger?.value != null ? String(trigger.value) : '1000',
    thresholdOperator: trigger?.operator ?? 'gt',
    steps: draftStepsFromDefinition(record.steps),
    isDefault: record.isDefault,
    isActive: record.isActive,
    effectiveFrom: record.effectiveFrom,
  };
}

function editorFromTemplate(
  template: SaveWorkflowDefinitionInput,
  roles: TenantRoleSummary[],
): EditorState {
  const base = emptyEditor(roles);
  return {
    ...base,
    name: template.name,
    entityType: template.entityType,
    description: template.description ?? '',
    triggerType:
      template.triggerConfig?.type === 'amount_threshold' ? 'amount_threshold' : 'always',
    thresholdAmount:
      template.triggerConfig?.value != null ? String(template.triggerConfig.value) : '1000',
    thresholdOperator: template.triggerConfig?.operator ?? 'gt',
    steps: draftStepsFromDefinition(template.steps),
    isDefault: template.isDefault ?? false,
    isActive: template.isActive ?? true,
    effectiveFrom: template.effectiveFrom,
  };
}

function buildTriggerConfig(state: EditorState): WorkflowTriggerConfig {
  if (state.entityType === 'expense_claim' && state.triggerType === 'amount_threshold') {
    return {
      type: 'amount_threshold',
      operator: state.thresholdOperator,
      value: Number(state.thresholdAmount) || 0,
      currency: '$',
    };
  }
  return { type: 'always' };
}

function buildPayload(state: EditorState): SaveWorkflowDefinitionInput {
  return {
    entityType: state.entityType,
    name: state.name.trim(),
    description: state.description.trim() || undefined,
    triggerConfig: buildTriggerConfig(state),
    steps: definitionStepsFromDraft(state.steps),
    isDefault: state.isDefault,
    isActive: state.isActive,
    effectiveFrom: state.effectiveFrom,
  };
}

export function WorkflowBuilderPage() {
  const { companyId, loading: companyLoading, error: companyError } = useCompany();
  const [workflows, setWorkflows] = useState<WorkflowDefinitionRecord[]>([]);
  const [roles, setRoles] = useState<TenantRoleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editor, setEditor] = useState<EditorState>(() => emptyEditor([]));
  const [filterEntity, setFilterEntity] = useState<WorkflowEntityType | ''>('');

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [wfRows, roleRows] = await Promise.all([
        listWorkflowDefinitions(companyId, {
          entityType: filterEntity || undefined,
        }),
        listTenantRoles(),
      ]);
      setWorkflows(wfRows);
      setRoles(roleRows);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, [companyId, filterEntity]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (roles.length && editor.steps.length === 1 && !editor.id && editor.name === '') {
      setEditor(emptyEditor(roles));
    }
  }, [roles, editor.id, editor.name, editor.steps.length]);

  const triggerPreview = useMemo(
    () => formatWorkflowTrigger(editor.entityType, buildTriggerConfig(editor)),
    [editor],
  );

  const openCreate = () => {
    setEditor(emptyEditor(roles));
    setViewMode('editor');
    setSuccess(null);
  };

  const openEdit = (record: WorkflowDefinitionRecord) => {
    setEditor(editorFromRecord(record));
    setViewMode('editor');
    setSuccess(null);
  };

  const applyTemplate = (template: SaveWorkflowDefinitionInput) => {
    setEditor(editorFromTemplate(template, roles));
    setViewMode('editor');
    setSuccess(null);
  };

  async function handleSave() {
    if (!companyId || !editor.name.trim()) {
      setError('Workflow name is required');
      return;
    }
    if (editor.steps.length === 0) {
      setError('Add at least one approval step');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = buildPayload(editor);
      if (editor.id) {
        await updateWorkflowDefinition(companyId, editor.id, payload);
        setSuccess('Workflow updated');
      } else {
        const created = await createWorkflowDefinition(companyId, payload);
        setEditor(editorFromRecord(created));
        setSuccess('Workflow created');
      }
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  }

  if (companyLoading) return <PageLoadingState message="Loading company…" />;
  if (companyError) return <PageErrorState error={companyError} />;
  if (!companyId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">
        No company found for this tenant.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-accent-500" />
            Approval Workflow Builder
          </h1>
          <p className="text-sm text-secondary mt-0.5">
            Configure multi-step approval chains for leave, expenses, payroll, and contracts — no
            code changes required.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CompanySelector />
          {viewMode === 'list' ? (
            <Button variant="primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> New workflow
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setViewMode('list')}>
              Back to list
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger-500/30 bg-danger-50/50 dark:bg-danger-950/20 px-4 py-3 text-sm text-danger-700 dark:text-danger-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-success-500/30 bg-success-50/50 dark:bg-success-950/20 px-4 py-3 text-sm text-success-700 dark:text-success-300">
          {success}
        </div>
      )}

      {viewMode === 'list' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent-500" />
                Quick-start templates
              </CardTitle>
            </CardHeader>
            <CardBody className="pt-0 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => applyTemplate(EXPENSE_HIGH_VALUE_TEMPLATE)}
              >
                Expense &gt; $1,000 → Manager → Finance → Director
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => applyTemplate(STANDARD_LEAVE_TEMPLATE)}
              >
                Standard leave (Manager → HR Admin)
              </Button>
            </CardBody>
          </Card>

          <div className="flex items-center gap-3">
            <Label>Filter by module</Label>
            <Select
              className="w-48"
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value as WorkflowEntityType | '')}
            >
              <option value="">All modules</option>
              {ENTITY_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          <Card>
            <CardBody className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-secondary">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading workflows…
                </div>
              ) : workflows.length === 0 ? (
                <div className="py-16 text-center text-secondary text-sm">
                  No workflows yet. Create one or use a template above.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-[rgb(var(--bg-muted))] border-b border-base">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-secondary">
                        Name
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-secondary">
                        Module
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-secondary">
                        Trigger
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-secondary">
                        Steps
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-secondary">
                        Status
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-secondary">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgb(var(--border-base))]">
                    {workflows.map((wf) => (
                      <tr key={wf.id} className="hover:bg-[rgb(var(--bg-hover))]">
                        <td className="px-5 py-3.5 font-semibold text-primary text-xs">
                          {wf.name}
                          {wf.isDefault && (
                            <Badge tone="accent" className="ml-2 text-[10px]">
                              Default
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone="accent">{entityTypeLabel(wf.entityType)}</Badge>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-secondary max-w-xs truncate">
                          {formatWorkflowTrigger(wf.entityType, wf.triggerConfig)}
                        </td>
                        <td className="px-5 py-3.5 text-xs font-bold text-primary">
                          {wf.steps.length}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={wf.isActive ? 'success' : 'neutral'} dot>
                            {wf.isActive ? 'Active' : 'Disabled'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Button variant="secondary" size="sm" onClick={() => openEdit(wf)}>
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {viewMode === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Workflow details</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <div>
                  <Label htmlFor="wf-name">Name</Label>
                  <Input
                    id="wf-name"
                    value={editor.name}
                    onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                    placeholder="High-Value Expense Approval"
                  />
                </div>
                <div>
                  <Label htmlFor="wf-module">Module</Label>
                  <Select
                    id="wf-module"
                    value={editor.entityType}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        entityType: e.target.value as WorkflowEntityType,
                      })
                    }
                  >
                    {ENTITY_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="wf-desc">Description</Label>
                  <Textarea
                    id="wf-desc"
                    rows={2}
                    value={editor.description}
                    onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="wf-effective">Effective from</Label>
                  <Input
                    id="wf-effective"
                    type="date"
                    value={editor.effectiveFrom}
                    onChange={(e) => setEditor({ ...editor, effectiveFrom: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Toggle
                    checked={editor.isActive}
                    onChange={(checked) => setEditor({ ...editor, isActive: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Default for module</Label>
                    <p className="text-[11px] text-muted mt-0.5">
                      Used when no entity-specific policy steps exist
                    </p>
                  </div>
                  <Toggle
                    checked={editor.isDefault}
                    onChange={(checked) => setEditor({ ...editor, isDefault: checked })}
                  />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Entry trigger</CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                {editor.entityType === 'expense_claim' ? (
                  <>
                    <div>
                      <Label>When to apply this chain</Label>
                      <Select
                        value={editor.triggerType}
                        onChange={(e) =>
                          setEditor({
                            ...editor,
                            triggerType: e.target.value as 'always' | 'amount_threshold',
                          })
                        }
                      >
                        <option value="always">All expense claims</option>
                        <option value="amount_threshold">Amount exceeds threshold</option>
                      </Select>
                    </div>
                    {editor.triggerType === 'amount_threshold' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Operator</Label>
                          <Select
                            value={editor.thresholdOperator}
                            onChange={(e) =>
                              setEditor({
                                ...editor,
                                thresholdOperator: e.target.value as 'gt' | 'gte',
                              })
                            }
                          >
                            <option value="gt">Greater than (&gt;)</option>
                            <option value="gte">Greater than or equal (≥)</option>
                          </Select>
                        </div>
                        <div>
                          <Label>Amount (USD)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={editor.thresholdAmount}
                            onChange={(e) =>
                              setEditor({ ...editor, thresholdAmount: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-secondary">
                    This module uses the workflow for all matching requests. Amount-based triggers
                    are available for expense claims.
                  </p>
                )}
                <div className="rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs text-secondary">
                  Trigger preview: <span className="font-semibold text-primary">{triggerPreview}</span>
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <Card className="border-2 border-accent-500/20">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Approval pipeline</CardTitle>
                <Button variant="primary" size="sm" disabled={saving} onClick={() => void handleSave()}>
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Save workflow
                </Button>
              </CardHeader>
              <CardBody className="space-y-4">
                <WorkflowStepList
                  steps={editor.steps}
                  roles={roles}
                  onChange={(steps) => setEditor({ ...editor, steps })}
                />

                <div className="pt-2 border-t border-base">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-3">
                    Visual preview
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-full max-w-sm rounded-xl border-2 border-accent-500/40 bg-accent-50/20 dark:bg-accent-950/20 px-4 py-3 text-center">
                      <div className="text-xs font-bold text-primary">Start</div>
                      <div className="text-[11px] text-secondary mt-0.5">{triggerPreview}</div>
                    </div>
                    {editor.steps.map((step, index) => (
                      <div key={step.id} className="flex flex-col items-center w-full">
                        <div className="h-4 w-0.5 bg-accent-500/50" />
                        <div className="h-5 w-5 rounded-full bg-accent-500 text-white flex items-center justify-center">
                          <ArrowRight className="h-3 w-3 rotate-90" />
                        </div>
                        <div className="h-2 w-0.5 bg-accent-500/50" />
                        <div className="w-full max-w-sm rounded-xl border border-success-500/40 bg-success-50/10 dark:bg-success-950/10 px-4 py-3">
                          <div className="text-xs font-bold text-primary">
                            Step {index + 1}:{' '}
                            {step.assigneeType === 'direct_manager'
                              ? 'Direct Manager'
                              : step.roleName}
                          </div>
                          <div className="text-[11px] text-secondary mt-0.5">
                            {step.assigneeType === 'direct_manager'
                              ? 'Resolved from reporting line'
                              : `Role: ${step.roleName}`}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="h-4 w-0.5 bg-accent-500/50" />
                    <div className="w-full max-w-sm rounded-xl border border-purple-500/40 bg-purple-50/10 px-4 py-2 text-center text-xs font-bold text-primary">
                      Complete
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
