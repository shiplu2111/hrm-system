import { useCallback, useEffect, useState } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2 } from 'lucide-react';
import type { JobLevelRecord } from '@hrm/shared-types';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Label } from '@/components/ui/Form';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import {
  createJobLevel,
  deleteJobLevel,
  listJobLevels,
  updateJobLevel,
} from '@/lib/organization-api';
import { ApiError } from '@/lib/tenant-api-client';

function JobLevelsContent({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<JobLevelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<JobLevelRecord | null>(null);
  const [form, setForm] = useState({ code: '', name: '', rank: '1' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listJobLevels(companyId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ code: '', name: '', rank: String(rows.length + 1) });
    setModalOpen(true);
  };

  const openEdit = (row: JobLevelRecord) => {
    setEditing(row);
    setForm({ code: row.code, name: row.name, rank: String(row.rank) });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) return;
    setError(null);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        rank: Number(form.rank) || 1,
      };
      if (editing) {
        await updateJobLevel(companyId, editing.id, payload);
      } else {
        await createJobLevel(companyId, payload);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this job level?')) return;
    try {
      await deleteJobLevel(companyId, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Job Levels</h1>
          <p className="text-sm text-secondary mt-0.5">
            Ranked career levels used by designations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          <Button variant="primary" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add Job Level
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Job Levels</CardTitle></CardHeader>
        <CardBody className="p-0">
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Rank</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Code</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Name</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-[rgb(var(--bg-hover))]">
                    <td className="px-5 py-3 text-secondary">{row.rank}</td>
                    <td className="px-5 py-3 font-mono text-primary">{row.code}</td>
                    <td className="px-5 py-3 text-primary">{row.name}</td>
                    <td className="px-5 py-3">
                      <Dropdown
                        trigger={<button type="button" className="text-muted hover:text-primary p-1"><MoreHorizontal className="h-4 w-4" /></button>}
                      >
                        <DropdownItem icon={<Pencil className="h-4 w-4" />} onClick={() => openEdit(row)}>Edit</DropdownItem>
                        <DropdownDivider />
                        <DropdownItem icon={<Trash2 className="h-4 w-4" />} onClick={() => void handleDelete(row.id)}>Delete</DropdownItem>
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
        title={editing ? 'Edit Job Level' : 'Add Job Level'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void handleSave()}>{editing ? 'Save' : 'Create'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Code</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="L3" />
          </div>
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Senior Individual Contributor" />
          </div>
          <div>
            <Label>Rank (sort order)</Label>
            <Input type="number" min={1} value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function JobLevelsPage() {
  return (
    <OrgPageState>{(companyId) => <JobLevelsContent companyId={companyId} />}</OrgPageState>
  );
}
