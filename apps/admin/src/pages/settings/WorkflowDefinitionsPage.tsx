import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Info, Loader2, Pencil, Plus, Power, Sparkles, Trash2 } from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import type { WorkflowDefinitionRecord, WorkflowEntityType } from '@hrm/shared-types';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusPill } from '@/components/ui/StatusPill';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { pathForPage } from '@/config/routes';
import {
  WORKFLOW_MODULES,
  WORKFLOW_MODULE_ORDER,
  WORKFLOW_TEMPLATES,
  deleteWorkflowDefinition,
  formatWorkflowTrigger,
  isConnectedModule,
  listWorkflowDefinitions,
  moduleRoutingText,
  stepApproverLabel,
  stepConditionText,
  updateWorkflowDefinition,
} from '@/lib/workflow-api';
import { usageText, workflowStatusDisplay } from '@/lib/workflow-display';
import { ApiError } from '@/lib/tenant-api-client';

const thClass = 'text-left px-4 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider';

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

type ModuleFilter = WorkflowEntityType | 'all';

function DefinitionsContent({ companyId }: { companyId: string }) {
  const routerNavigate = useNavigate();
  const location = useLocation();
  const { can } = usePermissions();
  const canCreate = can('settings', 'create');
  const canEdit = can('settings', 'edit');
  const canDelete = can('settings', 'delete');

  const [definitions, setDefinitions] = useState<WorkflowDefinitionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null,
  );
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('all');
  const [showOff, setShowOff] = useState(false);
  const [turningOff, setTurningOff] = useState<WorkflowDefinitionRecord | null>(null);
  const [deleting, setDeleting] = useState<WorkflowDefinitionRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDefinitions(await listWorkflowDefinitions(companyId));
    } catch (err) {
      setError(errorText(err, 'Failed to load workflows'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const isOff = (d: WorkflowDefinitionRecord) => d.routingStatus === 'inactive' || d.routingStatus === 'ended';
  const offCount = definitions.filter(isOff).length;

  const modules = useMemo(
    () =>
      WORKFLOW_MODULE_ORDER.filter(
        (m) => isConnectedModule(m) || definitions.some((d) => d.entityType === m),
      ),
    [definitions],
  );
  const visibleModules = moduleFilter === 'all' ? modules : modules.filter((m) => m === moduleFilter);
  const rowsFor = (m: WorkflowEntityType) =>
    definitions
      .filter((d) => d.entityType === m && (showOff || !isOff(d)))
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));

  const openBuilder = (id?: string, template?: string) =>
    routerNavigate(
      id
        ? pathForPage('settings-workflow-builder', { definitionId: id })
        : `${pathForPage('settings-workflow-builder')}${template ? `?template=${template}` : ''}`,
    );

  const turnOn = async (definition: WorkflowDefinitionRecord) => {
    setBusyId(definition.id);
    setError(null);
    setNotice(null);
    try {
      await updateWorkflowDefinition(companyId, definition.id, { isActive: true });
      setNotice(`${definition.name} is on.`);
      await load();
    } catch (err) {
      setError(errorText(err, 'Could not turn the workflow on'));
    } finally {
      setBusyId(null);
    }
  };

  const confirmTurnOff = async () => {
    if (!turningOff) return;
    await updateWorkflowDefinition(companyId, turningOff.id, { isActive: false });
    setNotice(`${turningOff.name} is off.`);
    setTurningOff(null);
    await load();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await deleteWorkflowDefinition(companyId, deleting.id);
    setNotice(`${deleting.name} deleted.`);
    setDeleting(null);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading workflows…
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Approval Workflows</h1>
          <p className="text-sm text-secondary mt-0.5">
            Who approves expense claims, timesheets, contract renewals, requisitions, offers and reviews, and in what
            order.
          </p>
        </div>
        {canCreate ? (
          <Button variant="primary" onClick={() => openBuilder()}>
            <Plus className="h-4 w-4" /> New workflow
          </Button>
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

      <div className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          A request picks its workflow when it is submitted and keeps those steps until it is decided, so editing a
          workflow only affects new requests. When no workflow applies, the module&apos;s built-in chain is used.
        </div>
      </div>

      {canCreate ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent-500" />
              Start from a template
            </CardTitle>
          </CardHeader>
          <CardBody className="pt-0 flex flex-wrap gap-2">
            {WORKFLOW_TEMPLATES.map((template) => (
              <Button key={template.key} variant="secondary" size="sm" onClick={() => openBuilder(undefined, template.key)}>
                {template.label}
              </Button>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Module">
          <FilterTab active={moduleFilter === 'all'} onClick={() => setModuleFilter('all')} label="All modules" />
          {modules.map((m) => (
            <FilterTab
              key={m}
              active={moduleFilter === m}
              onClick={() => setModuleFilter(m)}
              label={WORKFLOW_MODULES[m].label}
              count={definitions.filter((d) => d.entityType === m && (showOff || !isOff(d))).length}
            />
          ))}
        </div>
        {offCount ? (
          <label className="inline-flex items-center gap-2 text-sm text-secondary whitespace-nowrap">
            <input
              type="checkbox"
              checked={showOff}
              onChange={(e) => setShowOff(e.target.checked)}
              className="h-4 w-4 rounded border-base"
            />
            Show off and ended ({offCount})
          </label>
        ) : null}
      </div>

      {visibleModules.map((m) => {
        const rows = rowsFor(m);
        const inUse = definitions.some((d) => d.entityType === m && d.routingStatus === 'in_use');
        const connected = isConnectedModule(m);
        return (
          <Card key={m}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{WORKFLOW_MODULES[m].label}</CardTitle>
              <p className="text-sm text-secondary mt-0.5">{moduleRoutingText(m)}</p>
              {connected && !inUse ? (
                <p className="text-sm text-warning-700 dark:text-warning-300 mt-1">
                  No workflow is in use, so new {WORKFLOW_MODULES[m].requests} follow the built-in chain:{' '}
                  {WORKFLOW_MODULES[m].builtInSteps.join(' → ')}.
                </p>
              ) : null}
            </CardHeader>
            <CardBody className="p-0">
              {rows.length === 0 ? (
                <div className="px-5 py-6 text-sm text-secondary border-t border-base">
                  {definitions.some((d) => d.entityType === m)
                    ? 'Only off or ended workflows here.'
                    : 'No workflows yet.'}
                  {canCreate && connected ? (
                    <button
                      type="button"
                      className="ml-2 text-accent-600 hover:underline"
                      onClick={() =>
                        routerNavigate(`${pathForPage('settings-workflow-builder')}?module=${m}`)
                      }
                    >
                      Create one
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="overflow-x-auto border-t border-base">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                        <th className={thClass}>Workflow</th>
                        <th className={thClass}>Approval steps</th>
                        <th className={thClass}>Status</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgb(var(--border-base))]">
                      {rows.map((d) => {
                        const status = workflowStatusDisplay(d);
                        return (
                          <tr key={d.id} className={isOff(d) ? 'opacity-60' : undefined}>
                            <td className="px-4 py-3 align-top min-w-[220px]">
                              <button
                                type="button"
                                onClick={() => openBuilder(d.id)}
                                className="font-medium text-primary hover:text-accent-600 text-left"
                              >
                                {d.name}
                              </button>
                              {d.isDefault ? (
                                <Badge tone="accent" className="ml-2 align-middle">
                                  Default
                                </Badge>
                              ) : null}
                              <div className="text-xs text-muted mt-0.5">
                                {formatWorkflowTrigger(d.entityType, d.triggerConfig)}
                              </div>
                              {d.description ? (
                                <div className="text-xs text-secondary mt-0.5">{d.description}</div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 align-top min-w-[260px]">
                              <ol className="flex flex-wrap items-center gap-1.5">
                                {d.steps.map((step, i) => (
                                  <li key={step.order} className="inline-flex items-center gap-1.5">
                                    <span
                                      className={`rounded-md border px-2 py-0.5 text-xs ${
                                        step.condition
                                          ? 'border-dashed border-accent-300 text-accent-700 dark:border-accent-700 dark:text-accent-300'
                                          : 'border-base text-primary'
                                      }`}
                                      title={step.condition ? stepConditionText(step.condition) : undefined}
                                    >
                                      {stepApproverLabel(step)}
                                      {step.condition ? (
                                        <span className="text-muted">
                                          {' '}
                                          · {step.condition.operator === 'gte' ? '≥' : '>'}{' '}
                                          {step.condition.value.toLocaleString()}
                                        </span>
                                      ) : null}
                                    </span>
                                    {i < d.steps.length - 1 ? (
                                      <ArrowRight className="h-3 w-3 text-muted" aria-hidden />
                                    ) : null}
                                  </li>
                                ))}
                              </ol>
                            </td>
                            <td className="px-4 py-3 align-top min-w-[220px] max-w-[320px]">
                              <StatusPill tone={status.tone}>{status.label}</StatusPill>
                              <div className="text-xs text-secondary mt-1">{status.detail}</div>
                              <div className="text-xs text-muted mt-0.5">{usageText(d)}</div>
                            </td>
                            <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`${canEdit ? 'Edit' : 'View'} ${d.name}`}
                                  title={canEdit ? 'Edit' : 'View'}
                                  onClick={() => openBuilder(d.id)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {canEdit && connected ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`${d.isActive ? 'Turn off' : 'Turn on'} ${d.name}`}
                                    title={d.isActive ? 'Turn off' : 'Turn on'}
                                    disabled={busyId === d.id}
                                    onClick={() => (d.isActive ? setTurningOff(d) : void turnOn(d))}
                                  >
                                    {busyId === d.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Power className={`h-4 w-4 ${d.isActive ? 'text-success-600' : ''}`} />
                                    )}
                                  </Button>
                                ) : null}
                                {canDelete && d.instanceCount === 0 ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Delete ${d.name}`}
                                    title="Delete"
                                    onClick={() => setDeleting(d)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        );
      })}

      <ConfirmDialog
        open={turningOff !== null}
        title={`Turn off ${turningOff?.name ?? ''}?`}
        confirmLabel="Turn off"
        tone="primary"
        description={
          turningOff
            ? [
                `New ${WORKFLOW_MODULES[turningOff.entityType].requests} will stop using this workflow.`,
                turningOff.isDefault
                  ? 'It will also stop being the default; if no other workflow applies, the built-in chain is used.'
                  : null,
                turningOff.pendingInstanceCount > 0
                  ? `${turningOff.pendingInstanceCount} pending request${turningOff.pendingInstanceCount === 1 ? '' : 's'} keep${turningOff.pendingInstanceCount === 1 ? 's' : ''} its current steps.`
                  : null,
              ]
                .filter(Boolean)
                .join(' ')
            : null
        }
        onConfirm={confirmTurnOff}
        onClose={() => setTurningOff(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? ''}?`}
        confirmLabel="Delete"
        description="This workflow has never been used, so it can be removed completely. The deletion is recorded in the audit log."
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
        active
          ? 'bg-accent-600 text-white'
          : 'surface border border-base text-secondary hover:text-primary hover:border-strong'
      }`}
    >
      {label}
      {count !== undefined ? (
        <span className={`text-xs ${active ? 'text-white/80' : 'text-muted'}`}>{count}</span>
      ) : null}
    </button>
  );
}

export function WorkflowDefinitionsPage() {
  return (
    <OrgPageState>
      {(companyId) => (
        <>
          <div className="px-4 lg:px-6 pt-4">
            <CompanySelector />
          </div>
          <DefinitionsContent companyId={companyId} />
        </>
      )}
    </OrgPageState>
  );
}
