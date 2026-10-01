import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Plus } from 'lucide-react';
import type { DesignationRecord, JobLevelRecord } from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label, Select } from '@/components/ui/Form';
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
import { useEmployeeUsage } from '@/hooks/useEmployeeUsage';
import { useOrgForm } from '@/hooks/useOrgForm';
import { flattenDepartments, type FlatDepartment } from '@/lib/department-tree';
import { validateOrgName } from '@/lib/org-validation';
import {
  createDesignation,
  deleteDesignation,
  getDepartmentTree,
  listDesignations,
  listJobLevels,
  updateDesignation,
} from '@/lib/organization-api';
import { ApiError } from '@/lib/tenant-api-client';

type DesignationForm = {
  name: string;
  departmentId: string;
  jobLevelId: string;
  salaryGrade: string;
};

type SortKey = 'name' | 'department' | 'jobLevel' | 'salaryGrade' | 'employees';

const EMPTY_FORM: DesignationForm = { name: '', departmentId: '', jobLevelId: '', salaryGrade: '' };
const SALARY_GRADE_MAX = 20;

function DesignationsContent({ companyId }: { companyId: string }) {
  const canCreate = usePermission('settings', 'create');
  const usage = useEmployeeUsage(companyId, 'designationId');
  const [rows, setRows] = useState<DesignationRecord[]>([]);
  const [departments, setDepartments] = useState<FlatDepartment[]>([]);
  const [jobLevels, setJobLevels] = useState<JobLevelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [jobLevelFilter, setJobLevelFilter] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDirection }>({ key: 'name', dir: 'asc' });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DesignationRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DesignationRecord | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [designations, tree, levels] = await Promise.all([
        listDesignations(companyId),
        getDepartmentTree(companyId),
        listJobLevels(companyId),
      ]);
      setRows(designations);
      setDepartments(flattenDepartments(tree));
      setJobLevels(levels);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load designations');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const departmentPath = useMemo(
    () => new Map(departments.map((d) => [d.node.id, d.path.join(' › ')])),
    [departments],
  );
  const levelRank = useMemo(() => new Map(jobLevels.map((l) => [l.id, l.rank])), [jobLevels]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter(
      (d) =>
        (!q ||
          d.name.toLowerCase().includes(q) ||
          (d.salaryGrade ?? '').toLowerCase().includes(q)) &&
        (!departmentFilter ||
          (departmentFilter === 'none' ? !d.departmentId : d.departmentId === departmentFilter)) &&
        (!jobLevelFilter ||
          (jobLevelFilter === 'none' ? !d.jobLevelId : d.jobLevelId === jobLevelFilter)),
    );
    const value = (d: DesignationRecord): string | number => {
      switch (sort.key) {
        case 'department':
          return d.departmentId ? (departmentPath.get(d.departmentId) ?? d.department?.name ?? '') : '\uffff';
        case 'jobLevel':
          return d.jobLevelId ? (levelRank.get(d.jobLevelId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
        case 'salaryGrade':
          return d.salaryGrade ?? '\uffff';
        case 'employees':
          return usage.countFor(d.id) ?? 0;
        default:
          return d.name;
      }
    };
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), undefined, { sensitivity: 'base', numeric: true });
      return cmp * factor || a.name.localeCompare(b.name);
    });
  }, [rows, search, departmentFilter, jobLevelFilter, sort, departmentPath, levelRank, usage]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));

  const validate = useCallback(
    (values: DesignationForm) => {
      const sameDepartment = rows.filter((r) => (r.departmentId ?? '') === values.departmentId);
      const deptName = values.departmentId ? departmentPath.get(values.departmentId) : null;
      return {
        name: validateOrgName(
          values.name,
          'Designation name',
          sameDepartment,
          editing?.id,
          deptName ? `in ${deptName}` : 'without a department',
        ),
        salaryGrade:
          values.salaryGrade.trim().length > SALARY_GRADE_MAX
            ? `Salary grade must be ${SALARY_GRADE_MAX} characters or fewer.`
            : undefined,
      };
    },
    [rows, departmentPath, editing],
  );
  const form = useOrgForm<DesignationForm>(EMPTY_FORM, validate);

  const openCreate = () => {
    setEditing(null);
    setSaveError(null);
    form.reset({
      ...EMPTY_FORM,
      departmentId: departmentFilter && departmentFilter !== 'none' ? departmentFilter : '',
    });
    setModalOpen(true);
  };

  const openEdit = (row: DesignationRecord) => {
    setEditing(row);
    setSaveError(null);
    form.reset({
      name: row.name,
      departmentId: row.departmentId ?? '',
      jobLevelId: row.jobLevelId ?? '',
      salaryGrade: row.salaryGrade ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    form.touchAll();
    if (!form.isValid) return;
    setSaving(true);
    setSaveError(null);
    const payload = {
      name: form.values.name.trim(),
      departmentId: form.values.departmentId || null,
      jobLevelId: form.values.jobLevelId || null,
      salaryGrade: form.values.salaryGrade.trim() || null,
    };
    try {
      if (editing) await updateDesignation(companyId, editing.id, payload);
      else await createDesignation(companyId, payload);
      setModalOpen(false);
      await load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Could not save the designation');
    } finally {
      setSaving(false);
    }
  };

  const filtersActive = Boolean(search || departmentFilter || jobLevelFilter);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      <OrgPageHeader
        title="Designations"
        description="Job titles, each optionally tied to a department, a job level and a salary grade."
        actionLabel="Add designation"
        onAction={openCreate}
      />

      {loadError ? <OrgErrorBanner message={loadError} onRetry={() => void load()} /> : null}

      <Card>
        <CardHeader className="flex flex-col lg:flex-row lg:items-center gap-3">
          <OrgSearchInput value={search} onChange={setSearch} placeholder="Search name or grade" />
          <div className="flex flex-col sm:flex-row gap-2 lg:ml-auto">
            <Select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-9 sm:w-56"
              aria-label="Filter by department"
            >
              <option value="">All departments</option>
              <option value="none">No department</option>
              {departments.map((d) => (
                <option key={d.node.id} value={d.node.id}>
                  {`${'\u00A0\u00A0'.repeat(d.depth)}${d.node.name}`}
                </option>
              ))}
            </Select>
            <Select
              value={jobLevelFilter}
              onChange={(e) => setJobLevelFilter(e.target.value)}
              className="h-9 sm:w-48"
              aria-label="Filter by job level"
            >
              <option value="">All job levels</option>
              <option value="none">No job level</option>
              {jobLevels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.name}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>

        {loading ? (
          <OrgTableSkeleton columns={5} />
        ) : rows.length === 0 ? (
          <EmptyState
            compact
            icon={BadgeCheck}
            title="No designations yet"
            description="Designations are the job titles you assign to employees, such as Software Engineer or HR Manager."
            action={canCreate ? { label: 'Add first designation', onClick: openCreate, icon: Plus } : undefined}
          />
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">
            No designations match the current filters.
          </p>
        ) : (
          <DataTable className="max-h-[65vh] overflow-y-auto">
            <DataTableHead>
              <tr>
                <th className="text-left px-5 py-2.5">
                  <SortableHeader label="Name" active={sort.key === 'name'} direction={sort.dir} onSort={() => toggleSort('name')} />
                </th>
                <th className="text-left px-5 py-2.5 hidden md:table-cell">
                  <SortableHeader label="Department" active={sort.key === 'department'} direction={sort.dir} onSort={() => toggleSort('department')} />
                </th>
                <th className="text-left px-5 py-2.5 hidden lg:table-cell">
                  <SortableHeader label="Job level" active={sort.key === 'jobLevel'} direction={sort.dir} onSort={() => toggleSort('jobLevel')} />
                </th>
                <th className="text-left px-5 py-2.5 hidden sm:table-cell">
                  <SortableHeader label="Grade" active={sort.key === 'salaryGrade'} direction={sort.dir} onSort={() => toggleSort('salaryGrade')} />
                </th>
                <th className="text-left px-5 py-2.5 hidden sm:table-cell">
                  <SortableHeader label="Employees" active={sort.key === 'employees'} direction={sort.dir} onSort={() => toggleSort('employees')} />
                </th>
                <th className="w-12" />
              </tr>
            </DataTableHead>
            <DataTableBody>
              {visible.map((d) => {
                const count = usage.countFor(d.id);
                return (
                  <tr key={d.id} className="hover:bg-[rgb(var(--bg-hover))]">
                    <td className="px-5 py-3 font-medium text-primary">{d.name}</td>
                    <td className="px-5 py-3 text-secondary hidden md:table-cell">
                      {d.departmentId ? (departmentPath.get(d.departmentId) ?? d.department?.name) : '—'}
                    </td>
                    <td className="px-5 py-3 text-secondary hidden lg:table-cell">
                      {d.jobLevel ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Badge tone="neutral">{d.jobLevel.code}</Badge>
                          {d.jobLevel.name}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3 text-secondary hidden sm:table-cell">{d.salaryGrade ?? '—'}</td>
                    <td className="px-5 py-3 text-sm hidden sm:table-cell tabular-nums">
                      <UsageBadge count={count} noun="employee" />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <OrgRowActions
                        label={d.name}
                        onEdit={() => openEdit(d)}
                        onDelete={() => setDeleting(d)}
                        deleteBlockedReason={count ? `Assigned to ${count} employee(s)` : null}
                      />
                    </td>
                  </tr>
                );
              })}
            </DataTableBody>
          </DataTable>
        )}
        {!loading && rows.length > 0 ? (
          <div className="px-5 py-2.5 border-t border-base text-xs text-muted">
            {filtersActive ? `${visible.length} of ${rows.length}` : rows.length} designation
            {rows.length === 1 ? '' : 's'}
          </div>
        ) : null}
      </Card>

      <OrgFormModal
        open={modalOpen}
        title={editing ? 'Edit designation' : 'Add designation'}
        submitLabel={editing ? 'Save changes' : 'Create designation'}
        saving={saving}
        error={saveError}
        onClose={() => setModalOpen(false)}
        onSubmit={() => void handleSave()}
      >
        <div>
          <Label htmlFor="designation-name">Name *</Label>
          <Input
            id="designation-name"
            autoFocus
            value={form.values.name}
            onChange={(e) => form.setField('name', e.target.value)}
            onBlur={() => form.touch('name')}
            aria-invalid={Boolean(form.showError('name'))}
            placeholder="e.g. Senior Software Engineer"
          />
          <FieldError message={form.showError('name')} />
        </div>
        <div>
          <Label htmlFor="designation-department">Department</Label>
          <Select
            id="designation-department"
            value={form.values.departmentId}
            onChange={(e) => form.setField('departmentId', e.target.value)}
          >
            <option value="">No specific department</option>
            {departments.map((d) => (
              <option key={d.node.id} value={d.node.id}>
                {`${'\u00A0\u00A0\u00A0'.repeat(d.depth)}${d.depth > 0 ? '└ ' : ''}${d.node.name}`}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="designation-level">Job level</Label>
            <Select
              id="designation-level"
              value={form.values.jobLevelId}
              onChange={(e) => form.setField('jobLevelId', e.target.value)}
            >
              <option value="">None</option>
              {jobLevels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.name}
                </option>
              ))}
            </Select>
            {jobLevels.length === 0 ? (
              <p className="mt-1 text-xs text-muted">No job levels defined yet.</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="designation-grade">Salary grade</Label>
            <Input
              id="designation-grade"
              value={form.values.salaryGrade}
              onChange={(e) => form.setField('salaryGrade', e.target.value)}
              onBlur={() => form.touch('salaryGrade')}
              aria-invalid={Boolean(form.showError('salaryGrade'))}
              placeholder="e.g. G5"
            />
            <FieldError message={form.showError('salaryGrade')} />
          </div>
        </div>
      </OrgFormModal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete designation?"
        confirmLabel="Delete designation"
        description={
          deleting ? (
            <>
              <span className="font-medium text-primary">{deleting.name}</span> will be permanently
              removed.
            </>
          ) : null
        }
        onConfirm={async () => {
          if (!deleting) return;
          await deleteDesignation(companyId, deleting.id);
          await Promise.all([load(), usage.reload()]);
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

export function DesignationsPage() {
  return (
    <OrgPageState>{(companyId) => <DesignationsContent companyId={companyId} />}</OrgPageState>
  );
}
