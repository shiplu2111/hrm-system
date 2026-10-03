import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import type { DocumentTypeRecord } from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toggle } from '@/components/ui/Toggle';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { OrgErrorBanner, OrgSearchInput, OrgTableSkeleton } from '@/components/org/OrgScreenParts';
import { DocumentTypeEditor } from '@/components/custom-fields/DocumentTypeEditor';
import { fieldTypeIcons } from '@/components/custom-fields/fieldTypeIcons';
import { deleteDocumentType, listDocumentTypes, updateDocumentType } from '@/lib/documents-api';
import { customFieldsCopy } from '@/lib/custom-fields-copy';
import { ApiError } from '@/lib/tenant-api-client';

const copy = customFieldsCopy.documentTypes;
const MAX_FIELD_BADGES = 4;

type EditorState = { mode: 'create' } | { mode: 'edit'; record: DocumentTypeRecord } | null;

function DocumentTypesContent({ companyId }: { companyId: string }) {
  const canCreate = usePermission('settings', 'create');
  const canEdit = usePermission('settings', 'edit');
  const canDelete = usePermission('settings', 'delete');

  const [types, setTypes] = useState<DocumentTypeRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [pendingDelete, setPendingDelete] = useState<DocumentTypeRecord | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setTypes(await listDocumentTypes(companyId));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return types;
    return types.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q),
    );
  }, [types, search]);

  const upsert = (record: DocumentTypeRecord) =>
    setTypes((prev) => {
      const exists = prev.some((t) => t.id === record.id);
      const next = exists ? prev.map((t) => (t.id === record.id ? record : t)) : [...prev, record];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });

  const toggleActive = async (record: DocumentTypeRecord, isActive: boolean) => {
    setTogglingId(record.id);
    setActionError(null);
    try {
      upsert(await updateDocumentType(companyId, record.id, { isActive }));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : copy.toggleError);
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteDocumentType(companyId, pendingDelete.id);
    setTypes((prev) => prev.filter((t) => t.id !== pendingDelete.id));
  };

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
            <Button variant="primary" onClick={() => setEditor({ mode: 'create' })}>
              <Plus className="h-4 w-4" /> {copy.add}
            </Button>
          )}
        </div>
      </div>

      {loadError && <OrgErrorBanner message={loadError} onRetry={() => void load()} />}
      {actionError && <OrgErrorBanner message={actionError} />}

      {!loadError && (types.length > 0 || loading) && (
        <OrgSearchInput value={search} onChange={setSearch} placeholder={copy.searchPlaceholder} />
      )}

      {loading ? (
        <Card>
          <CardBody className="p-0">
            <OrgTableSkeleton columns={6} />
          </CardBody>
        </Card>
      ) : loadError ? null : types.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          action={canCreate ? { label: copy.add, icon: Plus, onClick: () => setEditor({ mode: 'create' }) } : undefined}
        />
      ) : (
        <Card>
          <CardBody className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  {[copy.columns.name, copy.columns.scope, copy.columns.fields, copy.columns.rules, copy.columns.documents, copy.columns.status].map(
                    (heading) => (
                      <th key={heading} className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase whitespace-nowrap">
                        {heading}
                      </th>
                    ),
                  )}
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filtered.map((dt) => {
                  const activeFields = dt.fields.filter((f) => f.isActive !== false);
                  const deleteBlocked = dt.documentCount > 0;
                  return (
                    <tr key={dt.id} className={`hover:bg-[rgb(var(--bg-hover))] ${dt.isActive ? '' : 'opacity-70'}`}>
                      <td className="px-5 py-3 min-w-[200px]">
                        <div className="font-medium text-primary">{dt.name}</div>
                        {dt.description && <div className="text-xs text-muted line-clamp-1">{dt.description}</div>}
                      </td>
                      <td className="px-5 py-3 text-secondary whitespace-nowrap">{copy.scopes[dt.scope].label}</td>
                      <td className="px-5 py-3">
                        {activeFields.length === 0 ? (
                          <span className="text-muted text-xs">{copy.noFields}</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1" title={copy.fieldCount(activeFields.length)}>
                            {activeFields.slice(0, MAX_FIELD_BADGES).map((f) => {
                              const Icon = fieldTypeIcons[f.fieldType];
                              return (
                                <Badge key={f.id ?? f.fieldKey} tone="neutral" className="gap-1">
                                  <Icon className="h-3 w-3" />
                                  {f.label}
                                  {f.required && <span className="text-error-600">*</span>}
                                </Badge>
                              );
                            })}
                            {activeFields.length > MAX_FIELD_BADGES && (
                              <span className="text-xs text-muted">+{activeFields.length - MAX_FIELD_BADGES}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {dt.requiresVerification && <Badge tone="accent">{copy.verification}</Badge>}
                          {dt.tracksExpiry && <Badge tone="warning">{copy.expiry}</Badge>}
                          {!dt.requiresVerification && !dt.tracksExpiry && <span className="text-muted text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-secondary whitespace-nowrap tabular-nums">
                        {copy.documentCount(dt.documentCount)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <Toggle
                              size="sm"
                              checked={dt.isActive}
                              disabled={togglingId === dt.id}
                              label={dt.isActive ? copy.deactivate : copy.activate}
                              onChange={(value) => void toggleActive(dt, value)}
                            />
                          )}
                          <Badge tone={dt.isActive ? 'success' : 'neutral'} dot>
                            {dt.isActive ? copy.statusActive : copy.statusInactive}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditor({ mode: 'edit', record: dt })}
                              aria-label={`${copy.edit} ${dt.name}`}
                              title={copy.edit}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={deleteBlocked}
                              onClick={() => setPendingDelete(dt)}
                              aria-label={`${copy.delete} ${dt.name}`}
                              title={deleteBlocked ? copy.deleteBlocked : copy.delete}
                              className="hover:text-error-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted">
                      {copy.noMatches}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {editor && (
        <DocumentTypeEditor
          companyId={companyId}
          record={editor.mode === 'edit' ? editor.record : null}
          onClose={() => setEditor(null)}
          onSaved={upsert}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={copy.deleteTitle}
        description={pendingDelete ? copy.deleteDescription(pendingDelete.name) : undefined}
        confirmLabel={copy.delete}
        tone="danger"
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}

export function DocumentTypesPage() {
  return (
    <OrgPageState>{(companyId) => <DocumentTypesContent companyId={companyId} />}</OrgPageState>
  );
}
