import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2 } from 'lucide-react';
import type { DesignationRecord } from '@hrm/shared-types';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import {
  createDesignation,
  deleteDesignation,
  listDepartments,
  listDesignations,
  listJobLevels,
  updateDesignation,
} from '@/lib/organization-api';
import { ApiError } from '@/lib/tenant-api-client';

function DesignationsContent({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<DesignationRecord[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [jobLevels, setJobLevels] = useState<{ id: string; code: string; name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DesignationRecord | null>(null);
  const [form, setForm] = useState({
    name: '',
    departmentId: '',
    jobLevelId: '',
    salaryGrade: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [designations, depts, levels] = await Promise.all([
        listDesignations(companyId),
        listDepartments(companyId),
        listJobLevels(companyId),
      ]);
      setRows(designations);
      setDepartments(depts.map((d) => ({ id: d.id, name: d.name })));
      setJobLevels(levels.map((l) => ({ id: l.id, code: l.code, name: l.name })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', departmentId: '', jobLevelId: '', salaryGrade: '' });
    setModalOpen(true);
  };

  const openEdit = (d: DesignationRecord) => {
    setEditing(d);
    setForm({
      name: d.name,
      departmentId: d.departmentId ?? '',
      jobLevelId: d.jobLevelId ?? '',
      salaryGrade: d.salaryGrade ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        departmentId: form.departmentId || null,
        jobLevelId: form.jobLevelId || null,
        salaryGrade: form.salaryGrade.trim() || null,
      };
      if (editing) {
        await updateDesignation(companyId, editing.id, payload);
      } else {
        await createDesignation(companyId, payload);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this designation?')) return;
    try {
      await deleteDesignation(companyId, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Designations</h1>
          <p className="text-sm text-secondary mt-0.5">
            Job titles linked to departments and job levels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          <Button variant="primary" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add Designation
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <CardTitle>All Designations</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Name</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase hidden md:table-cell">Department</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase hidden lg:table-cell">Job Level</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase hidden sm:table-cell">Grade</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-[rgb(var(--bg-hover))]">
                    <td className="px-5 py-3 font-medium text-primary">{d.name}</td>
                    <td className="px-5 py-3 text-secondary hidden md:table-cell">{d.department?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-secondary hidden lg:table-cell">
                      {d.jobLevel ? `${d.jobLevel.code} — ${d.jobLevel.name}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-secondary hidden sm:table-cell">{d.salaryGrade ?? '—'}</td>
                    <td className="px-5 py-3">
                      <Dropdown
                        trigger={
                          <button type="button" className="text-muted hover:text-primary p-1">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        }
                      >
                        <DropdownItem icon={<Pencil className="h-4 w-4" />} onClick={() => openEdit(d)}>Edit</DropdownItem>
                        <DropdownDivider />
                        <DropdownItem icon={<Trash2 className="h-4 w-4" />} onClick={() => void handleDelete(d.id)}>Delete</DropdownItem>
                      </Dropdown>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Designation' : 'Add Designation'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void handleSave()}>{editing ? 'Save' : 'Create'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Department</Label>
            <Select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Job Level</Label>
            <Select value={form.jobLevelId} onChange={(e) => setForm({ ...form, jobLevelId: e.target.value })}>
              <option value="">None</option>
              {jobLevels.map((l) => (
                <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Salary Grade</Label>
            <Input value={form.salaryGrade} onChange={(e) => setForm({ ...form, salaryGrade: e.target.value })} placeholder="e.g. G5" />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function DesignationsPage() {
  return (
    <OrgPageState>{(companyId) => <DesignationsContent companyId={companyId} />}</OrgPageState>
  );
}
