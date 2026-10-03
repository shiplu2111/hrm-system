import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { CustomFieldDefinitionRecord } from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toggle } from '@/components/ui/Toggle';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { OrgErrorBanner, OrgTableSkeleton } from '@/components/org/OrgScreenParts';
import { CustomFieldModal } from '@/components/custom-fields/CustomFieldModal';
import { FormPreview } from '@/components/custom-fields/FieldPreview';
import { fieldTypeIcons } from '@/components/custom-fields/fieldTypeIcons';
import { deleteCustomField, listCustomFields, updateCustomField } from '@/lib/documents-api';
import { customFieldsCopy, type BuilderEntityType } from '@/lib/custom-fields-copy';
import { moveItem } from '@/lib/custom-field-schema';
import { ApiError } from '@/lib/tenant-api-client';

const copy = customFieldsCopy.customFields;

const ENTITIES: BuilderEntityType[] = ['employee', 'department', 'designation', 'company', 'contract', 'candidate'];

type ModalState = { record: CustomFieldDefinitionRecord | null } | null;

function byOrder(a: CustomFieldDefinitionRecord, b: CustomFieldDefinitionRecord): number {
  return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label);
}

function CustomFieldBuilderContent({ companyId }: { companyId: string }) {
  const canCreate = usePermission('settings', 'create');
  const canEdit = usePermission('settings', 'edit');
  const canDelete = usePermission('settings', 'delete');

  const [fields, setFields] = useState<CustomFieldDefinitionRecord[]>([]);
  const [entity, setEntity] = useState<BuilderEntityType>('employee');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [pendingDelete, setPendingDelete] = useState<CustomFieldDefinitionRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await listCustomFields(companyId);
      setFields(rows.filter((f) => f.entityType !== 'document'));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const result = Object.fromEntries(ENTITIES.map((e) => [e, 0])) as Record<BuilderEntityType, number>;
    for (const field of fields) {
      if (field.entityType in result) result[field.entityType as BuilderEntityType] += 1;
    }
    return result;
  }, [fields]);

  const entityFields = useMemo(
    () => fields.filter((f) => f.entityType === entity).sort(byOrder),
    [fields, entity],
  );

  const takenKeys = useMemo(() => {
    const editingId = modal?.record?.id;
    return new Set(entityFields.filter((f) => f.id !== editingId).map((f) => f.fieldKey));
  }, [entityFields, modal]);

  const nextSortOrder = entityFields.reduce((max, f) => Math.max(max, f.sortOrder + 1), 0);

  const upsert = (record: CustomFieldDefinitionRecord) =>
    setFields((prev) =>
      prev.some((f) => f.id === record.id) ? prev.map((f) => (f.id === record.id ? record : f)) : [...prev, record],
    );

  const toggleActive = async (field: CustomFieldDefinitionRecord, isActive: boolean) => {
    setBusyId(field.id);
    setActionError(null);
    try {
      upsert(await updateCustomField(companyId, field.id, { isActive }));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : copy.toggleError);
    } finally {
      setBusyId(null);
    }
  };

  const move = async (from: number, to: number) => {
    const reordered = moveItem(entityFields, from, to);
    const changes = reordered
      .map((field, index) => ({ field, index }))
      .filter(({ field, index }) => field.sortOrder !== index);
    if (!changes.length) return;

    const previous = fields;
    const nextOrder = new Map(changes.map(({ field, index }) => [field.id, index]));
    setFields((prev) => prev.map((f) => (nextOrder.has(f.id) ? { ...f, sortOrder: nextOrder.get(f.id)! } : f)));
    setReordering(true);
    setActionError(null);
    try {
      await Promise.all(
        changes.map(({ field, index }) => updateCustomField(companyId, field.id, { sortOrder: index })),
      );
    } catch (err) {
      setFields(previous);
      setActionError(err instanceof ApiError ? err.message : copy.reorderError);
      void load();
    } finally {
      setReordering(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteCustomField(companyId, pendingDelete.id);
    setFields((prev) => prev.filter((f) => f.id !== pendingDelete.id));
  };

  const entityCopy = copy.entities[entity];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
          <p className="text-sm text-secondary mt-0.5">{copy.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          {canCreate && (
            <Button variant="primary" onClick={() => setModal({ record: null })} disabled={loading || Boolean(loadError)}>
              <Plus className="h-4 w-4" /> {copy.add}
            </Button>
          )}
        </div>
      </div>

      {loadError && <OrgErrorBanner message={loadError} onRetry={() => void load()} />}
      {actionError && <OrgErrorBanner message={actionError} />}

      <div role="tablist" aria-label={copy.title} className="flex gap-1 overflow-x-auto border-b border-base">
        {ENTITIES.map((e) => {
          const selected = e === entity;
          return (
            <button
              key={e}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setEntity(e)}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                selected
                  ? 'border-accent-500 text-accent-700 dark:text-accent-300'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              {copy.entities[e].label}
              {!loading && (
                <span className="rounded-full bg-[rgb(var(--bg-muted))] px-1.5 text-[11px] tabular-nums text-muted">
                  {counts[e]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!loadError && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{copy.fieldsFor(entityCopy.label)}</CardTitle>
                <p className="mt-0.5 text-xs text-muted">{entityCopy.description}</p>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {loading ? (
                <OrgTableSkeleton columns={4} />
              ) : entityFields.length === 0 ? (
                <EmptyState
                  compact
                  icon={SlidersHorizontal}
                  title={copy.emptyTitle(entityCopy.label)}
                  description={copy.emptyDescription}
                  action={canCreate ? { label: copy.add, icon: Plus, onClick: () => setModal({ record: null }) } : undefined}
                />
              ) : (
                <ol className="divide-y divide-[rgb(var(--border-base))]">
                  {entityFields.map((field, index) => {
                    const Icon = fieldTypeIcons[field.fieldType];
                    return (
                      <li
                        key={field.id}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-[rgb(var(--bg-hover))] ${field.isActive ? '' : 'opacity-60'}`}
                      >
                        {canEdit && (
                          <div className="flex flex-col">
                            <button
                              type="button"
                              disabled={reordering || index === 0}
                              onClick={() => void move(index, index - 1)}
                              className="rounded p-0.5 text-muted hover:text-primary disabled:opacity-30"
                              aria-label={`${copy.moveUp}: ${field.label}`}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={reordering || index === entityFields.length - 1}
                              onClick={() => void move(index, index + 1)}
                              className="rounded p-0.5 text-muted hover:text-primary disabled:opacity-30"
                              aria-label={`${copy.moveDown}: ${field.label}`}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-950/50 dark:text-accent-300">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-primary">{field.label}</div>
                          <div className="truncate text-xs text-muted">
                            <span className="font-mono">{field.fieldKey}</span> · {customFieldsCopy.fieldTypes[field.fieldType].label}
                            {field.options.length > 0 && ` · ${field.options.join(', ')}`}
                          </div>
                        </div>
                        <Badge tone={field.required ? 'error' : 'neutral'}>
                          {field.required ? copy.required : copy.optional}
                        </Badge>
                        {canEdit && (
                          <Toggle
                            size="sm"
                            checked={field.isActive}
                            disabled={busyId === field.id}
                            label={copy.toggleActive(field.label)}
                            onChange={(value) => void toggleActive(field, value)}
                          />
                        )}
                        <div className="flex items-center gap-0.5">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setModal({ record: field })}
                              aria-label={`${copy.edit} ${field.label}`}
                              title={copy.edit}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPendingDelete(field)}
                              aria-label={`${copy.delete} ${field.label}`}
                              title={copy.delete}
                              className="hover:text-error-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardBody>
          </Card>

          <div className="lg:sticky lg:top-4 lg:self-start">
            <FormPreview fields={entityFields.map((f) => ({ ...f, key: f.id }))} />
          </div>
        </div>
      )}

      {modal && (
        <CustomFieldModal
          companyId={companyId}
          entityType={entity}
          record={modal.record}
          takenKeys={takenKeys}
          nextSortOrder={nextSortOrder}
          onClose={() => setModal(null)}
          onSaved={upsert}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={copy.deleteTitle}
        description={pendingDelete ? copy.deleteDescription(pendingDelete.label) : undefined}
        confirmLabel={copy.delete}
        tone="danger"
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}

export function CustomFieldBuilderPage() {
  return (
    <OrgPageState>{(companyId) => <CustomFieldBuilderContent companyId={companyId} />}</OrgPageState>
  );
}
