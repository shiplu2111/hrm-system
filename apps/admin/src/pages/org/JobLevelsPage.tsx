import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers, Plus } from 'lucide-react';
import type { JobLevelRecord } from '@hrm/shared-types';
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
import { OrgPageState } from '@/components/org/OrgPageState';
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
import { validateOrgCode, validateOrgName, validatePositiveInt } from '@/lib/org-validation';
import {
  createJobLevel,
  deleteJobLevel,
  listDesignations,
  listJobLevels,
  updateJobLevel,
} from '@/lib/organization-api';
import { ApiError } from '@/lib/tenant-api-client';

type JobLevelForm = { code: string; name: string; rank: string };
type SortKey = 'rank' | 'code' | 'name' | 'designations';

function JobLevelsContent({ companyId }: { companyId: string }) {
  const canCreate = usePermission('settings', 'create');
  const [rows, setRows] = useState<JobLevelRecord[]>([]);
  const [designationCounts, setDesignationCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDirection }>({ key: 'rank', dir: 'asc' });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<JobLevelRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<JobLevelRecord | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [levels, designations] = await Promise.all([
        listJobLevels(companyId),
        listDesignations(companyId),
      ]);
      setRows(levels);
      const counts = new Map<string, number>();
      for (const d of designations) {
        if (d.jobLevelId) counts.set(d.jobLevelId, (counts.get(d.jobLevelId) ?? 0) + 1);
      }
      setDesignationCounts(counts);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load job levels');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter(
      (r) => !q || r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
    );
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp: number;
      if (sort.key === 'rank') cmp = a.rank - b.rank;
      else if (sort.key === 'designations')
        cmp = (designationCounts.get(a.id) ?? 0) - (designationCounts.get(b.id) ?? 0);
      else cmp = a[sort.key].localeCompare(b[sort.key], undefined, { numeric: true, sensitivity: 'base' });
      return cmp * factor || a.rank - b.rank || a.code.localeCompare(b.code);
    });
  }, [rows, search, sort, designationCounts]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));

  const validate = useCallback(
    (values: JobLevelForm) => ({
      code: validateOrgCode(values.code, 'Code', rows, editing?.id),
      name: validateOrgName(values.name, 'Name', rows, editing?.id),
      rank: validatePositiveInt(values.rank, 'Rank'),
    }),
    [rows, editing],
  );
  const form = useOrgForm<JobLevelForm>({ code: '', name: '', rank: '1' }, validate);

  const sharedRank = useMemo(() => {
    const rank = Number(form.values.rank);
    if (!Number.isInteger(rank)) return [];
    return rows.filter((r) => r.rank === rank && r.id !== editing?.id);
  }, [rows, form.values.rank, editing]);

  const openCreate = () => {
    setEditing(null);
    setSaveError(null);
    const nextRank = rows.reduce((max, r) => Math.max(max, r.rank), 0) + 1;
    form.reset({ code: `L${nextRank}`, name: '', rank: String(nextRank) });
    setModalOpen(true);
  };

  const openEdit = (row: JobLevelRecord) => {
    setEditing(row);
    setSaveError(null);
    form.reset({ code: row.code, name: row.name, rank: String(row.rank) });
    setModalOpen(true);
  };

  const handleSave = async () => {
    form.touchAll();
    if (!form.isValid) return;
    setSaving(true);
    setSaveError(null);
    const payload = {
      code: form.values.code.trim().toUpperCase(),
      name: form.values.name.trim(),
      rank: Number(form.values.rank),
    };
    try {
      if (editing) await updateJobLevel(companyId, editing.id, payload);
      else await createJobLevel(companyId, payload);
      setModalOpen(false);
      await load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Could not save the job level');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <OrgPageHeader
        title="Job Levels"
        description="Your career ladder, e.g. L1 Intern → L8 Executive. Rank 1 is the most junior."
        actionLabel="Add job level"
        onAction={openCreate}
      />

      {loadError ? <OrgErrorBanner message={loadError} onRetry={() => void load()} /> : null}

      <Card>
        <CardHeader>
          <OrgSearchInput value={search} onChange={setSearch} placeholder="Search code or name" />
        </CardHeader>
        {loading ? (
          <OrgTableSkeleton columns={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            compact
            icon={Layers}
            title="No job levels yet"
            description="Define ranked levels so designations and pay grades can be compared across departments."
            action={canCreate ? { label: 'Add first job level', onClick: openCreate, icon: Plus } : undefined}
          />
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">No job levels match “{search}”.</p>
        ) : (
          <DataTable className="max-h-[65vh] overflow-y-auto">
            <DataTableHead>
              <tr>
                <th className="text-left px-5 py-2.5 w-24">
                  <SortableHeader label="Rank" active={sort.key === 'rank'} direction={sort.dir} onSort={() => toggleSort('rank')} />
                </th>
                <th className="text-left px-5 py-2.5 w-32">
                  <SortableHeader label="Code" active={sort.key === 'code'} direction={sort.dir} onSort={() => toggleSort('code')} />
                </th>
                <th className="text-left px-5 py-2.5">
                  <SortableHeader label="Name" active={sort.key === 'name'} direction={sort.dir} onSort={() => toggleSort('name')} />
                </th>
                <th className="text-left px-5 py-2.5 hidden sm:table-cell">
                  <SortableHeader label="Used by" active={sort.key === 'designations'} direction={sort.dir} onSort={() => toggleSort('designations')} />
                </th>
                <th className="w-12" />
              </tr>
            </DataTableHead>
            <DataTableBody>
              {visible.map((row) => {
                const count = designationCounts.get(row.id) ?? 0;
                return (
                  <tr key={row.id} className="hover:bg-[rgb(var(--bg-hover))]">
                    <td className="px-5 py-3">
                      <span className="inline-flex h-7 min-w-7 px-2 items-center justify-center rounded-md bg-accent-50 dark:bg-accent-950/40 text-accent-700 dark:text-accent-300 text-xs font-semibold tabular-nums">
                        {row.rank}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-primary">{row.code}</td>
                    <td className="px-5 py-3 text-primary">{row.name}</td>
                    <td className="px-5 py-3 text-sm hidden sm:table-cell tabular-nums">
                      <UsageBadge count={count} noun="designation" />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <OrgRowActions
                        label={`${row.code} ${row.name}`}
                        onEdit={() => openEdit(row)}
                        onDelete={() => setDeleting(row)}
                        deleteBlockedReason={count ? `Used by ${count} designation(s)` : null}
                      />
                    </td>
                  </tr>
                );
              })}
            </DataTableBody>
          </DataTable>
        )}
      </Card>

      <OrgFormModal
        open={modalOpen}
        title={editing ? 'Edit job level' : 'Add job level'}
        submitLabel={editing ? 'Save changes' : 'Create job level'}
        saving={saving}
        error={saveError}
        onClose={() => setModalOpen(false)}
        onSubmit={() => void handleSave()}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="level-code">Code *</Label>
            <Input
              id="level-code"
              autoFocus
              value={form.values.code}
              onChange={(e) => form.setField('code', e.target.value.toUpperCase())}
              onBlur={() => form.touch('code')}
              aria-invalid={Boolean(form.showError('code'))}
              placeholder="L3"
              className="font-mono"
            />
            <FieldError message={form.showError('code')} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="level-name">Name *</Label>
            <Input
              id="level-name"
              value={form.values.name}
              onChange={(e) => form.setField('name', e.target.value)}
              onBlur={() => form.touch('name')}
              aria-invalid={Boolean(form.showError('name'))}
              placeholder="e.g. Senior Individual Contributor"
            />
            <FieldError message={form.showError('name')} />
          </div>
        </div>
        <div className="sm:w-1/3">
          <Label htmlFor="level-rank">Rank *</Label>
          <Input
            id="level-rank"
            type="number"
            min={1}
            step={1}
            value={form.values.rank}
            onChange={(e) => form.setField('rank', e.target.value)}
            onBlur={() => form.touch('rank')}
            aria-invalid={Boolean(form.showError('rank'))}
          />
          {form.showError('rank') ? (
            <FieldError message={form.showError('rank')} />
          ) : sharedRank.length > 0 ? (
            <p className="mt-1 text-xs text-warning-700 dark:text-warning-400">
              Same rank as {sharedRank.map((r) => r.code).join(', ')}. Levels with equal rank are treated as peers.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted">Higher numbers are more senior.</p>
          )}
        </div>
      </OrgFormModal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete job level?"
        confirmLabel="Delete job level"
        description={
          deleting ? (
            <>
              <span className="font-medium text-primary">
                {deleting.code} — {deleting.name}
              </span>{' '}
              will be permanently removed.
            </>
          ) : null
        }
        onConfirm={async () => {
          if (!deleting) return;
          await deleteJobLevel(companyId, deleting.id);
          await load();
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

export function JobLevelsPage() {
  return (
    <OrgPageState>{(companyId) => <JobLevelsContent companyId={companyId} />}</OrgPageState>
  );
}
