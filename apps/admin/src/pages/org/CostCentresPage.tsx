import { useCallback, useEffect, useState } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2 } from 'lucide-react';
import type { CostCentreRecord } from '@hrm/shared-types';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Label } from '@/components/ui/Form';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import {
  createCostCentre,
  deleteCostCentre,
  listCostCentres,
  updateCostCentre,
} from '@/lib/organization-api';
import { ApiError } from '@/lib/tenant-api-client';

function CostCentresContent({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<CostCentreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CostCentreRecord | null>(null);
  const [form, setForm] = useState({ name: '', code: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listCostCentres(companyId));
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
    setForm({ name: '', code: '' });
    setModalOpen(true);
  };

  const openEdit = (row: CostCentreRecord) => {
    setEditing(row);
    setForm({ name: row.name, code: row.code });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) return;
    setError(null);
    try {
      const payload = { name: form.name.trim(), code: form.code.trim() };
      if (editing) {
        await updateCostCentre(companyId, editing.id, payload);
      } else {
        await createCostCentre(companyId, payload);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this cost centre?')) return;
    try {
      await deleteCostCentre(companyId, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Cost Centres</h1>
          <p className="text-sm text-secondary mt-0.5">Financial allocation units for payroll and reporting.</p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          <Button variant="primary" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add Cost Centre
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 rounded-lg px-4 py-2">{error}</div>
      )}

      <Card>
        <CardHeader><CardTitle>Cost Centres</CardTitle></CardHeader>
        <CardBody className="p-0">
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Code</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Name</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-[rgb(var(--bg-hover))]">
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
        title={editing ? 'Edit Cost Centre' : 'Add Cost Centre'}
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
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CC-100" />
          </div>
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Head Office" />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function CostCentresPage() {
  return (
    <OrgPageState>{(companyId) => <CostCentresContent companyId={companyId} />}</OrgPageState>
  );
}
