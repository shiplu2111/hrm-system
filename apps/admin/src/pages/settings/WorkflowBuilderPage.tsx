import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, CheckCircle2, CircleSlash, Info, Loader2, Send, Trash2 } from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import {
  WORKFLOW_ROUTING_MODES,
  type WorkflowDefinitionRecord,
  type WorkflowEntityType,
  type WorkflowTriggerConfig,
} from '@hrm/shared-types';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { Toggle } from '@/components/ui/Toggle';
import { OrgPageState } from '@/components/org/OrgPageState';
import {
  WorkflowStepList,
  createEmptyStep,
  definitionStepsFromDraft,
  draftStepIssues,
  draftStepsFromDefinition,
  type DraftWorkflowStep,
} from '@/components/workflow/WorkflowStepList';
import { pathForPage } from '@/config/routes';
import { listTenantRoles, type TenantRoleSummary } from '@/lib/roles-api';
import { MONEY_PATTERN, formatMoney, todayIso } from '@/lib/payroll-copy';
import {
  WORKFLOW_MODULES,
  WORKFLOW_MODULE_ORDER,
  WORKFLOW_TEMPLATES,
  createWorkflowDefinition,
  deleteWorkflowDefinition,
  formatWorkflowTrigger,
  getWorkflowDefinition,
  isConnectedModule,
  listWorkflowDefinitions,
  matchesAmount,
  moduleRoutingText,
  stepApproverLabel,
  supportsAmounts,
  updateWorkflowDefinition,
  type SaveWorkflowDefinitionInput,
} from '@/lib/workflow-api';
import { usageText, workflowStatusDisplay } from '@/lib/workflow-display';
import { ApiError } from '@/lib/tenant-api-client';

interface FormState {
  name: string;
  entityType: WorkflowEntityType;
  description: string;
  triggerType: 'always' | 'amount_threshold';
  triggerOperator: 'gt' | 'gte';
  triggerAmount: string;
  steps: DraftWorkflowStep[];
  isDefault: boolean;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string;
}

function emptyForm(entityType: WorkflowEntityType): FormState {
  return {
    name: '',
    entityType,
    description: '',
    triggerType: 'always',
    triggerOperator: 'gt',
    triggerAmount: '',
    steps: [createEmptyStep()],
    isDefault: false,
    isActive: true,
    effectiveFrom: todayIso(),
    effectiveTo: '',
  };
}

function formFromInput(input: Omit<SaveWorkflowDefinitionInput, 'effectiveFrom'> & { effectiveFrom?: string }): FormState {
  const trigger = input.triggerConfig;
  return {
    name: input.name,
    entityType: input.entityType,
    description: input.description ?? '',
    triggerType: trigger?.type === 'amount_threshold' ? 'amount_threshold' : 'always',
    triggerOperator: trigger?.operator ?? 'gt',
    triggerAmount: trigger?.value != null ? String(trigger.value) : '',
    steps: draftStepsFromDefinition(input.steps),
    isDefault: input.isDefault ?? false,
    isActive: input.isActive ?? true,
    effectiveFrom: input.effectiveFrom ?? todayIso(),
    effectiveTo: input.effectiveTo ?? '',
  };
}

function buildTrigger(form: FormState): WorkflowTriggerConfig {
  if (supportsAmounts(form.entityType) && form.triggerType === 'amount_threshold') {
    return { type: 'amount_threshold', operator: form.triggerOperator, value: Number(form.triggerAmount) };
  }
  return { type: 'always' };
}

function buildPayload(form: FormState): SaveWorkflowDefinitionInput {
  const trigger = buildTrigger(form);
  return {
    entityType: form.entityType,
    name: form.name.trim(),
    description: form.description.trim() || null,
    triggerConfig: trigger,
    steps: definitionStepsFromDraft(form.steps, supportsAmounts(form.entityType)),
    isDefault: form.isDefault && form.isActive && trigger.type === 'always',
    isActive: form.isActive,
    effectiveFrom: form.effectiveFrom,
    effectiveTo: form.effectiveTo || null,
  };
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function BuilderContent({ companyId }: { companyId: string }) {
  const { definitionId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const routerNavigate = useNavigate();
  const { can } = usePermissions();
  const isNew = !definitionId;
  const canSave = isNew ? can('settings', 'create') : can('settings', 'edit');
  const canDelete = can('settings', 'delete');

  const [record, setRecord] = useState<WorkflowDefinitionRecord | null>(null);
  const [peers, setPeers] = useState<WorkflowDefinitionRecord[]>([]);
  const [roles, setRoles] = useState<TenantRoleSummary[]>([]);
  const [form, setForm] = useState<FormState>(() => emptyForm('expense_claim'));
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sampleAmount, setSampleAmount] = useState('');
  const initialCompany = useRef(companyId);

  const goToList = useCallback(
    (notice?: string) => routerNavigate(pathForPage('settings-workflows'), notice ? { state: { notice } } : undefined),
    [routerNavigate],
  );

  useEffect(() => {
    if (initialCompany.current !== companyId) goToList();
  }, [companyId, goToList]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const [roleRows, allDefinitions, existing] = await Promise.all([
          listTenantRoles(),
          listWorkflowDefinitions(companyId),
          definitionId ? getWorkflowDefinition(companyId, definitionId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setRoles(roleRows);
        setPeers(allDefinitions);
        setRecord(existing);

        let next: FormState;
        if (existing) {
          next = formFromInput(existing);
        } else {
          const template = WORKFLOW_TEMPLATES.find((t) => t.key === searchParams.get('template'));
          const moduleParam = searchParams.get('module') as WorkflowEntityType | null;
          const entityType =
            moduleParam && WORKFLOW_MODULES[moduleParam] && isConnectedModule(moduleParam) ? moduleParam : 'expense_claim';
          next = template ? formFromInput(template.input) : emptyForm(entityType);
        }
        setForm(next);
        setSavedSnapshot(existing ? JSON.stringify(buildPayload(next)) : '');
        setSampleAmount(
          next.triggerType === 'amount_threshold' && next.triggerAmount
            ? String(Math.round(Number(next.triggerAmount) * 1.5))
            : '500',
        );
      } catch (err) {
        if (!cancelled) setLoadError(errorText(err, 'Could not load this workflow'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, definitionId, searchParams]);

  const payload = useMemo(() => buildPayload(form), [form]);
  const dirty = isNew ? true : JSON.stringify(payload) !== savedSnapshot;

  useEffect(() => {
    if (!dirty || !canSave) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, canSave]);

  const amountCapable = supportsAmounts(form.entityType);
  const routingMode = WORKFLOW_ROUTING_MODES[form.entityType];
  const moduleInfo = WORKFLOW_MODULES[form.entityType];
  const trigger = buildTrigger(form);
  const triggerAmountValid =
    MONEY_PATTERN.test(form.triggerAmount.trim()) && Number(form.triggerAmount) > 0;
  const workflowThreshold =
    trigger.type === 'amount_threshold' && triggerAmountValid
      ? { operator: form.triggerOperator, value: Number(form.triggerAmount) }
      : null;
  const stepIssues = useMemo(() => draftStepIssues(form.steps, amountCapable), [form.steps, amountCapable]);
  const currentDefault = peers.find(
    (d) => d.entityType === form.entityType && d.isDefault && d.id !== record?.id,
  );

  const issues = useMemo(() => {
    const list: string[] = [];
    const name = form.name.trim();
    if (!name) list.push('Give the workflow a name.');
    else if (name.length > 120) list.push('Keep the name to 120 characters or fewer.');
    else if (
      peers.some(
        (d) => d.id !== record?.id && d.entityType === form.entityType && d.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      list.push(`Another ${moduleInfo.request} workflow is already called "${name}".`);
    }
    if (form.description.trim().length > 500) list.push('Keep the description to 500 characters or fewer.');
    if (amountCapable && form.triggerType === 'amount_threshold' && !triggerAmountValid) {
      list.push('Enter the claim amount this workflow starts at (above zero, at most 2 decimals).');
    }
    if (Object.keys(stepIssues).length) list.push('Fix the highlighted steps.');
    if (amountCapable && form.steps.length > 0 && form.steps.every((s) => s.hasCondition)) {
      list.push('At least one step must apply to every claim; remove the amount condition from one step.');
    }
    if (!form.effectiveFrom) list.push('Choose the date the workflow starts applying.');
    if (form.effectiveTo && form.effectiveFrom && form.effectiveTo < form.effectiveFrom) {
      list.push('The end date must be on or after the start date.');
    }
    return list;
  }, [form, peers, record?.id, moduleInfo.request, amountCapable, triggerAmountValid, stepIssues]);

  const update = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setNotice(null);
  };

  const changeModule = (entityType: WorkflowEntityType) => {
    setForm((prev) => ({
      ...prev,
      entityType,
      ...(supportsAmounts(entityType)
        ? {}
        : {
            triggerType: 'always' as const,
            steps: prev.steps.map((step) => ({ ...step, hasCondition: false })),
          }),
    }));
  };

  const save = async () => {
    setAttempted(true);
    setError(null);
    setNotice(null);
    if (issues.length) return;
    setSaving(true);
    try {
      if (record) {
        const updated = await updateWorkflowDefinition(companyId, record.id, payload);
        const next = formFromInput(updated);
        setRecord(updated);
        setForm(next);
        setSavedSnapshot(JSON.stringify(buildPayload(next)));
        setPeers(await listWorkflowDefinitions(companyId));
        setAttempted(false);
        setNotice('Workflow saved. New requests use these steps; requests already in progress keep theirs.');
      } else {
        const created = await createWorkflowDefinition(companyId, payload);
        routerNavigate(pathForPage('settings-workflow-builder', { definitionId: created.id }), {
          replace: true,
          state: { notice: 'Workflow created.' },
        });
      }
    } catch (err) {
      setError(errorText(err, 'Could not save the workflow'));
    } finally {
      setSaving(false);
    }
  };

  const leave = () => {
    if (canSave && dirty && (record || form.name.trim())) setLeaving(true);
    else goToList();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading workflow…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">
        <BackLink onClick={() => goToList()} />
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {loadError}
        </div>
      </div>
    );
  }

  if (isNew && !canSave) {
    return (
      <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">
        <BackLink onClick={() => goToList()} />
        <p className="text-sm text-secondary">You don&apos;t have permission to create workflows.</p>
      </div>
    );
  }

  const readOnly = !canSave;
  const status = record ? workflowStatusDisplay(record) : null;
  const moduleLocked = !!record && record.instanceCount > 0;
  const moduleOptions = WORKFLOW_MODULE_ORDER.filter((m) => isConnectedModule(m) || m === form.entityType);
  const sample = MONEY_PATTERN.test(sampleAmount.trim()) ? Number(sampleAmount) : null;
  const reachesWorkflow = !amountCapable || sample == null || !workflowThreshold || matchesAmount(sample, workflowThreshold);

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <BackLink onClick={leave} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-primary">
              {record ? record.name : 'New approval workflow'}
            </h1>
            {status ? <StatusPill tone={status.tone}>{status.label}</StatusPill> : null}
            {record?.isDefault ? <Badge tone="accent">Default</Badge> : null}
          </div>
          <p className="text-sm text-secondary mt-0.5">
            {record
              ? `${moduleInfo.label} · ${usageText(record)}`
              : 'Choose the module, who approves, and in what order.'}
          </p>
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-2">
            {record && canDelete && record.instanceCount === 0 ? (
              <Button variant="ghost" onClick={() => setDeleting(true)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            ) : null}
            <Button variant="secondary" onClick={leave}>
              {record && !dirty ? 'Close' : 'Cancel'}
            </Button>
            <Button variant="primary" disabled={saving || (!!record && !dirty)} onClick={() => void save()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {record ? 'Save changes' : 'Create workflow'}
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-lg border border-success-200 bg-success-50 dark:bg-success-950/30 px-4 py-3 text-sm text-success-700 dark:text-success-300">
          {notice}
        </div>
      ) : null}
      {attempted && issues.length ? (
        <div className="rounded-lg border border-warning-200 bg-warning-50 dark:bg-warning-950/30 px-4 py-3 text-sm text-warning-800 dark:text-warning-200">
          <div className="font-medium">Fix these before saving:</div>
          <ul className="mt-1 list-disc pl-5 space-y-0.5">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {readOnly ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          You can view this workflow but not change it.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="wf-name">Name</Label>
                  <Input
                    id="wf-name"
                    value={form.name}
                    maxLength={120}
                    disabled={readOnly}
                    onChange={(e) => update({ name: e.target.value })}
                    placeholder="e.g. Expense Approval"
                  />
                </div>
                <div>
                  <Label htmlFor="wf-module">Module</Label>
                  <Select
                    id="wf-module"
                    value={form.entityType}
                    disabled={readOnly || moduleLocked}
                    onChange={(e) => changeModule(e.target.value as WorkflowEntityType)}
                  >
                    {moduleOptions.map((m) => (
                      <option key={m} value={m}>
                        {WORKFLOW_MODULES[m].label}
                        {isConnectedModule(m) ? '' : ' (not applied)'}
                      </option>
                    ))}
                  </Select>
                  {moduleLocked ? (
                    <p className="mt-1 text-xs text-muted">Locked because requests have already used this workflow.</p>
                  ) : null}
                </div>
              </div>
              <p className="text-xs text-secondary">{moduleRoutingText(form.entityType)}</p>
              <div>
                <Label htmlFor="wf-desc">Description (optional)</Label>
                <Textarea
                  id="wf-desc"
                  rows={2}
                  maxLength={500}
                  disabled={readOnly}
                  value={form.description}
                  onChange={(e) => update({ description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="wf-from">Applies from</Label>
                  <Input
                    id="wf-from"
                    type="date"
                    disabled={readOnly}
                    value={form.effectiveFrom}
                    onChange={(e) => update({ effectiveFrom: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="wf-to">Applies until (optional)</Label>
                  <Input
                    id="wf-to"
                    type="date"
                    disabled={readOnly}
                    min={form.effectiveFrom || undefined}
                    value={form.effectiveTo}
                    onChange={(e) => update({ effectiveTo: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-base pt-4">
                <div>
                  <Label>On</Label>
                  <p className="text-xs text-muted mt-0.5">
                    Turned-off workflows are kept but never chosen for new requests.
                  </p>
                </div>
                <Toggle
                  checked={form.isActive}
                  disabled={readOnly}
                  onChange={(checked) => update({ isActive: checked, ...(checked ? {} : { isDefault: false }) })}
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label>Default for {moduleInfo.label.toLowerCase()}</Label>
                  <p className="text-xs text-muted mt-0.5">
                    {routingMode === 'amount_match'
                      ? 'Claims that pass no amount workflow follow the default.'
                      : routingMode === 'default_only'
                        ? `${moduleInfo.label} only use the default workflow.`
                        : 'This module does not use workflows yet.'}{' '}
                    {!form.isActive
                      ? 'Turn the workflow on to make it the default.'
                      : trigger.type === 'amount_threshold'
                        ? 'A workflow with an amount trigger can’t be the default.'
                        : form.isDefault && currentDefault
                          ? `Saving replaces ${currentDefault.name} as the default.`
                          : currentDefault
                            ? `${currentDefault.name} is the default now.`
                            : 'There is no default now, so the built-in chain is used.'}
                  </p>
                </div>
                <Toggle
                  checked={form.isDefault && form.isActive && trigger.type === 'always'}
                  disabled={readOnly || !form.isActive || trigger.type === 'amount_threshold'}
                  onChange={(checked) => update({ isDefault: checked })}
                />
              </div>
            </CardBody>
          </Card>

          {amountCapable ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Which claims use this workflow</CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-primary">
                  <input
                    type="radio"
                    name="wf-trigger"
                    className="h-4 w-4"
                    disabled={readOnly}
                    checked={form.triggerType === 'always'}
                    onChange={() => update({ triggerType: 'always' })}
                  />
                  Every claim
                </label>
                <div className="flex flex-wrap items-center gap-2 text-sm text-primary">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="wf-trigger"
                      className="h-4 w-4"
                      disabled={readOnly}
                      checked={form.triggerType === 'amount_threshold'}
                      onChange={() =>
                        update({
                          triggerType: 'amount_threshold',
                          isDefault: false,
                          triggerAmount: form.triggerAmount || '1000',
                        })
                      }
                    />
                    Only claims
                  </label>
                  <div className="w-32">
                    <Select
                      aria-label="Amount comparison"
                      disabled={readOnly || form.triggerType !== 'amount_threshold'}
                      value={form.triggerOperator}
                      onChange={(e) => update({ triggerOperator: e.target.value as 'gt' | 'gte' })}
                    >
                      <option value="gt">over</option>
                      <option value="gte">of at least</option>
                    </Select>
                  </div>
                  <div className="w-36">
                    <Input
                      aria-label="Claim amount"
                      inputMode="decimal"
                      disabled={readOnly || form.triggerType !== 'amount_threshold'}
                      value={form.triggerAmount}
                      onChange={(e) => update({ triggerAmount: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted">
                  Amounts are compared with the claim amount as submitted, in the claim&apos;s own currency. To add an
                  approver only for large claims without a separate workflow, give that step an amount condition
                  instead.
                </p>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Approval steps</CardTitle>
              <p className="text-xs text-secondary mt-0.5">
                Steps run in order; each must approve before the next is asked. Drag or use the arrows to reorder.
                {amountCapable ? ' A step with an amount condition is skipped for smaller claims.' : ''}
              </p>
            </CardHeader>
            <CardBody>
              <WorkflowStepList
                steps={form.steps}
                roles={roles}
                onChange={(steps) => update({ steps })}
                allowConditions={amountCapable}
                workflowThreshold={workflowThreshold}
                issues={stepIssues}
                showIssues={attempted}
                disabled={readOnly}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5 lg:col-span-5">
          <Card className="lg:sticky lg:top-4">
            <CardHeader>
              <CardTitle className="text-sm">Preview</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {amountCapable ? (
                <div>
                  <Label htmlFor="wf-sample">Try a claim amount</Label>
                  <Input
                    id="wf-sample"
                    inputMode="decimal"
                    value={sampleAmount}
                    onChange={(e) => setSampleAmount(e.target.value)}
                  />
                </div>
              ) : null}

              {!reachesWorkflow && workflowThreshold && sample != null ? (
                <div className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-800 dark:border-warning-900 dark:bg-warning-950/30 dark:text-warning-200">
                  A {formatMoney(sample)} claim doesn&apos;t use this workflow: it only applies to claims{' '}
                  {workflowThreshold.operator === 'gte' ? 'of at least' : 'over'} {formatMoney(workflowThreshold.value)}.
                </div>
              ) : null}

              <ol className={`space-y-0 ${reachesWorkflow ? '' : 'opacity-50'}`}>
                <FlowNode
                  icon={<Send className="h-3.5 w-3.5" />}
                  title="Submitted"
                  detail={formatWorkflowTrigger(form.entityType, workflowThreshold ? trigger : null)}
                />
                {form.steps.map((step, index) => {
                  const conditionAmount = Number(step.conditionAmount);
                  const skipped =
                    amountCapable &&
                    step.hasCondition &&
                    sample != null &&
                    MONEY_PATTERN.test(step.conditionAmount.trim()) &&
                    !matchesAmount(sample, { operator: step.conditionOperator, value: conditionAmount });
                  const conditionText =
                    amountCapable && step.hasCondition && MONEY_PATTERN.test(step.conditionAmount.trim())
                      ? `only when ${step.conditionOperator === 'gte' ? 'at least' : 'over'} ${formatMoney(conditionAmount)}`
                      : null;
                  return (
                    <FlowNode
                      key={step.id}
                      step={index + 1}
                      muted={skipped}
                      title={stepApproverLabel(step)}
                      detail={
                        skipped
                          ? `Skipped for this amount (${conditionText})`
                          : conditionText
                            ? `Approves ${conditionText}`
                            : step.assigneeType === 'role'
                              ? `Anyone with the ${step.roleName} role`
                              : 'From the reporting line'
                      }
                    />
                  );
                })}
                <FlowNode
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  title="Approved"
                  detail="Every step above has approved"
                  last
                />
              </ol>
              <p className="flex items-start gap-1.5 text-xs text-muted">
                <CircleSlash className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Any approver can reject; that ends the request and skips the remaining steps.
              </p>
            </CardBody>
          </Card>

          {record && status ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">How it&apos;s used now</CardTitle>
              </CardHeader>
              <CardBody className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  <span className="text-secondary">{usageText(record)}</span>
                </div>
                <p className="text-secondary">{status.detail}</p>
                {record.pendingInstanceCount > 0 ? (
                  <p className="text-xs text-muted">
                    {record.pendingInstanceCount} pending request{record.pendingInstanceCount === 1 ? '' : 's'} keep
                    {record.pendingInstanceCount === 1 ? 's' : ''} the steps it started with, even if you change them
                    here.
                  </p>
                ) : null}
                {record.instanceCount > 0 ? (
                  <p className="text-xs text-muted">
                    Used workflows can&apos;t be deleted, so their history stays readable. Turn it off instead.
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={leaving}
        title="Discard your changes?"
        confirmLabel="Discard"
        description="Your edits to this workflow haven't been saved."
        onConfirm={async () => {
          setLeaving(false);
          goToList();
        }}
        onClose={() => setLeaving(false)}
      />
      <ConfirmDialog
        open={deleting}
        title={`Delete ${record?.name ?? 'this workflow'}?`}
        confirmLabel="Delete"
        description="This workflow has never been used, so it can be removed completely. The deletion is recorded in the audit log."
        onConfirm={async () => {
          if (!record) return;
          await deleteWorkflowDefinition(companyId, record.id);
          setDeleting(false);
          goToList(`${record.name} deleted.`);
        }}
        onClose={() => setDeleting(false)}
      />
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary"
    >
      <ArrowLeft className="h-4 w-4" /> Approval Workflows
    </button>
  );
}

function FlowNode({
  title,
  detail,
  step,
  icon,
  muted = false,
  last = false,
}: {
  title: string;
  detail: string;
  step?: number;
  icon?: ReactNode;
  muted?: boolean;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last ? <span className="absolute left-3 top-6 bottom-0 w-px bg-[rgb(var(--border-base))]" aria-hidden /> : null}
      <span
        className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          muted
            ? 'border border-dashed border-base bg-[rgb(var(--bg-muted))] text-muted'
            : step
              ? 'bg-accent-500 text-white'
              : 'bg-[rgb(var(--bg-muted))] text-secondary'
        }`}
      >
        {step ?? icon}
      </span>
      <div className={`min-w-0 ${muted ? 'opacity-60' : ''}`}>
        <div className={`text-sm font-medium ${muted ? 'text-secondary line-through' : 'text-primary'}`}>{title}</div>
        <div className="text-xs text-secondary">{detail}</div>
      </div>
    </li>
  );
}

export function WorkflowBuilderPage() {
  return <OrgPageState>{(companyId) => <BuilderContent companyId={companyId} />}</OrgPageState>;
}
