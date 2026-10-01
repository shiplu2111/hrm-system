import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';
import { usePermission } from '@hrm/portal-ui';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label } from '@/components/ui/Form';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  DataTable,
  DataTableBody,
  DataTableHead,
  SortableHeader,
  type SortDirection,
} from '@/components/ui/DataTable';
import {
  OrgErrorBanner,
  OrgFormModal,
  OrgPageHeader,
  OrgRowActions,
  OrgSearchInput,
  OrgTableSkeleton,
  UsageBadge,
} from '@/components/org/OrgScreenParts';
import { useOrgForm } from '@/hooks/useOrgForm';
import { useEmployeeUsage, type UsageField } from '@/hooks/useEmployeeUsage';
import { validateOrgCode, validateOrgName } from '@/lib/org-validation';
import { ApiError } from '@/lib/tenant-api-client';

export interface SimpleOrgEntity {
  id: string;
  name: string;
  code?: string;
}

export interface SimpleOrgEntityInput {
  name: string;
  code?: string;
}

export interface SimpleOrgEntityConfig<T extends SimpleOrgEntity> {
  title: string;
  description: string;
  /** Lower-case singular noun, e.g. "cost centre". */
  noun: string;
  icon: LucideIcon;
  emptyDescription: string;
  namePlaceholder: string;
  /** Adds a required, company-unique, upper-case code field and column. */
  withCode?: boolean;
  codePlaceholder?: string;
  /** Employee field referencing this entity; enables usage counts and blocks deleting used rows. */
  usageField?: UsageField;
  /** One-click suggestions shown for names the company hasn't created yet. */
  suggestions?: string[];
  list: (companyId: string) => Promise<T[]>;
  create: (companyId: string, input: SimpleOrgEntityInput) => Promise<unknown>;
  update: (companyId: string, id: string, input: SimpleOrgEntityInput) => Promise<unknown>;
  remove: (companyId: string, id: string) => Promise<void>;
}

type FormValues = { name: string; code: string };
type SortKey = 'name' | 'code' | 'usage';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function SimpleOrgEntityScreen<T extends SimpleOrgEntity>({
  companyId,
  config,
}: {
  companyId: string;
  config: SimpleOrgEntityConfig<T>;
}) {
  const { noun, withCode = false } = config;
  const Noun = capitalize(noun);
  const canCreate = usePermission('settings', 'create');
  const usage = useEmployeeUsage(companyId, config.usageField ?? null);
  const { countFor } = usage;

  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDirection }>({
    key: withCode ? 'code' : 'name',
    dir: 'asc',
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);
  const [addingSuggestion, setAddingSuggestion] = useState<string | null>(null);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const { list } = config;
  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setRows(await list(companyId));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : `Failed to load ${noun}s`);
    } finally {
      setLoading(false);
    }
  }, [companyId, list, noun]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter(
      (r) => !q || r.name.toLowerCase().includes(q) || (r.code ?? '').toLowerCase().includes(q),
    );
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp: number;
      if (sort.key === 'usage') cmp = (countFor(a.id) ?? 0) - (countFor(b.id) ?? 0);
      else
        cmp = (a[sort.key] ?? '').localeCompare(b[sort.key] ?? '', undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      return cmp * factor || a.name.localeCompare(b.name);
    });
  }, [rows, search, sort, countFor]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));

  const missingSuggestions = useMemo(() => {
    const existing = new Set(rows.map((r) => r.name.trim().toLowerCase()));
    return (config.suggestions ?? []).filter((s) => !existing.has(s.toLowerCase()));
  }, [rows, config.suggestions]);

  const validate = useCallback(
    (values: FormValues) => ({
      name: validateOrgName(values.name, 'Name', rows, editing?.id),
      code: withCode
        ? validateOrgCode(
            values.code,
            'Code',
            rows.map((r) => ({ id: r.id, code: r.code ?? '' })),
            editing?.id,
          )
        : undefined,
    }),
    [rows, editing, withCode],
  );
  const form = useOrgForm<FormValues>({ name: '', code: '' }, validate);

  const openCreate = () => {
    setEditing(null);
    setSaveError(null);
    form.reset({ name: '', code: '' });
    setModalOpen(true);
  };

  const openEdit = (row: T) => {
    setEditing(row);
    setSaveError(null);
    form.reset({ name: row.name, code: row.code ?? '' });
    setModalOpen(true);
  };

  const toInput = (values: FormValues): SimpleOrgEntityInput =>
    withCode
      ? { name: values.name.trim(), code: values.code.trim().toUpperCase() }
      : { name: values.name.trim() };

  const handleSave = async () => {
    form.touchAll();
    if (!form.isValid) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (editing) await config.update(companyId, editing.id, toInput(form.values));
      else await config.create(companyId, toInput(form.values));
      setModalOpen(false);
      await load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : `Could not save the ${noun}`);
    } finally {
      setSaving(false);
    }
  };

  const addSuggestion = async (name: string) => {
    setAddingSuggestion(name);
    setSuggestionError(null);
    try {
      await config.create(companyId, { name });
      await load();
    } catch (err) {
      setSuggestionError(err instanceof ApiError ? err.message : `Could not add ${name}`);
    } finally {
      setAddingSuggestion(null);
    }
  };

  const suggestionBar =
    canCreate && !withCode && missingSuggestions.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-t border-base">
        <span className="text-xs text-muted">Quick add:</span>
        {missingSuggestions.map((s) => (
          <button
            key={s}
            type="button"
            disabled={addingSuggestion !== null}
            onClick={() => void addSuggestion(s)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-base px-2.5 py-1 text-xs text-secondary hover:text-primary hover:border-accent-400 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-3 w-3" />
            {addingSuggestion === s ? 'Adding…' : s}
          </button>
        ))}
        {suggestionError ? <span className="text-xs text-error-600">{suggestionError}</span> : null}
      </div>
    ) : null;

  const usageBlocked = (row: T): string | null => {
    const count = usage.countFor(row.id);
    return count ? `Assigned to ${count} employee(s)` : null;
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <OrgPageHeader
        title={config.title}
        description={config.description}
        actionLabel={`Add ${noun}`}
        onAction={openCreate}
      />

      {loadError ? <OrgErrorBanner message={loadError} onRetry={() => void load()} /> : null}

      <Card>
        <CardHeader>
          <OrgSearchInput
            value={search}
            onChange={setSearch}
            placeholder={withCode ? 'Search code or name' : `Search ${noun}s`}
          />
        </CardHeader>
        {loading ? (
          <OrgTableSkeleton columns={withCode ? 3 : 2} />
        ) : rows.length === 0 ? (
          <EmptyState
            compact
            icon={config.icon}
            title={`No ${noun}s yet`}
            description={config.emptyDescription}
            action={canCreate ? { label: `Add first ${noun}`, onClick: openCreate, icon: Plus } : undefined}
          />
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">No {noun}s match “{search}”.</p>
        ) : (
          <DataTable className="max-h-[65vh] overflow-y-auto">
            <DataTableHead>
              <tr>
                {withCode ? (
                  <th className="text-left px-5 py-2.5 w-36">
                    <SortableHeader label="Code" active={sort.key === 'code'} direction={sort.dir} onSort={() => toggleSort('code')} />
                  </th>
                ) : null}
                <th className="text-left px-5 py-2.5">
                  <SortableHeader label="Name" active={sort.key === 'name'} direction={sort.dir} onSort={() => toggleSort('name')} />
                </th>
                {config.usageField ? (
                  <th className="text-left px-5 py-2.5 hidden sm:table-cell">
                    <SortableHeader label="Employees" active={sort.key === 'usage'} direction={sort.dir} onSort={() => toggleSort('usage')} />
                  </th>
                ) : null}
                <th className="w-12" />
              </tr>
            </DataTableHead>
            <DataTableBody>
              {visible.map((row) => (
                <tr key={row.id} className="hover:bg-[rgb(var(--bg-hover))]">
                  {withCode ? <td className="px-5 py-3 font-mono text-primary">{row.code}</td> : null}
                  <td className="px-5 py-3 font-medium text-primary">{row.name}</td>
                  {config.usageField ? (
                    <td className="px-5 py-3 text-sm hidden sm:table-cell tabular-nums">
                      <UsageBadge count={usage.countFor(row.id)} noun="employee" />
                    </td>
                  ) : null}
                  <td className="px-3 py-3 text-right">
                    <OrgRowActions
                      label={row.name}
                      onEdit={() => openEdit(row)}
                      onDelete={() => setDeleting(row)}
                      deleteBlockedReason={usageBlocked(row)}
                    />
                  </td>
                </tr>
              ))}
            </DataTableBody>
          </DataTable>
        )}
        {!loading && rows.length > 0 ? (
          <p className="px-5 py-2.5 text-xs text-muted border-t border-base">
            {visible.length === rows.length
              ? `${rows.length} ${noun}${rows.length === 1 ? '' : 's'}`
              : `Showing ${visible.length} of ${rows.length}`}
          </p>
        ) : null}
        {!loading ? suggestionBar : null}
      </Card>

      <OrgFormModal
        open={modalOpen}
        title={editing ? `Edit ${noun}` : `Add ${noun}`}
        submitLabel={editing ? 'Save changes' : `Create ${noun}`}
        saving={saving}
        error={saveError}
        onClose={() => setModalOpen(false)}
        onSubmit={() => void handleSave()}
      >
        {withCode ? (
          <div>
            <Label htmlFor="org-entity-code">Code *</Label>
            <Input
              id="org-entity-code"
              autoFocus
              value={form.values.code}
              onChange={(e) => form.setField('code', e.target.value.toUpperCase())}
              onBlur={() => form.touch('code')}
              aria-invalid={Boolean(form.showError('code'))}
              placeholder={config.codePlaceholder}
              className="font-mono"
            />
            {form.showError('code') ? (
              <FieldError message={form.showError('code')} />
            ) : (
              <p className="mt-1 text-xs text-muted">Unique within the company, e.g. used on payroll exports.</p>
            )}
          </div>
        ) : null}
        <div>
          <Label htmlFor="org-entity-name">{Noun} name *</Label>
          <Input
            id="org-entity-name"
            autoFocus={!withCode}
            value={form.values.name}
            onChange={(e) => form.setField('name', e.target.value)}
            onBlur={() => form.touch('name')}
            aria-invalid={Boolean(form.showError('name'))}
            placeholder={config.namePlaceholder}
          />
          <FieldError message={form.showError('name')} />
        </div>
        {editing && config.usageField && (usage.countFor(editing.id) ?? 0) > 0 ? (
          <p className="text-xs text-muted">
            Renaming updates all {usage.countFor(editing.id)} assigned employee record(s).
          </p>
        ) : null}
      </OrgFormModal>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${noun}?`}
        confirmLabel={`Delete ${noun}`}
        description={
          deleting ? (
            <>
              <span className="font-medium text-primary">
                {deleting.code ? `${deleting.code} — ` : ''}
                {deleting.name}
              </span>{' '}
              will be permanently removed.
            </>
          ) : null
        }
        onConfirm={async () => {
          if (!deleting) return;
          await config.remove(companyId, deleting.id);
          await Promise.all([load(), usage.reload()]);
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
