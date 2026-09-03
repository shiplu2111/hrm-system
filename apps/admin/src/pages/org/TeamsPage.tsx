import { useCallback, useEffect, useState } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2 } from 'lucide-react';
import type { NamedOrgEntity } from '@hrm/shared-types';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Label } from '@/components/ui/Form';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import {
  createTeam,
  deleteTeam,
  listTeams,
  updateTeam,
} from '@/lib/organization-api';
import { ApiError } from '@/lib/tenant-api-client';

function TeamsContent({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<NamedOrgEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NamedOrgEntity | null>(null);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listTeams(companyId));
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
    setName('');
    setModalOpen(true);
  };

  const openEdit = (row: NamedOrgEntity) => {
    setEditing(row);
    setName(row.name);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setError(null);
    try {
      if (editing) {
        await updateTeam(companyId, editing.id, { name: name.trim() });
      } else {
        await createTeam(companyId, { name: name.trim() });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this team?')) return;
    try {
      await deleteTeam(companyId, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Teams</h1>
          <p className="text-sm text-secondary mt-0.5">Cross-functional or project teams.</p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          <Button variant="primary" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add Team
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 rounded-lg px-4 py-2">{error}</div>
      )}

      <Card>
        <CardHeader><CardTitle>Teams</CardTitle></CardHeader>
        <CardBody className="p-0">
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-[rgb(var(--bg-hover))]">
                    <td className="px-5 py-3 font-medium text-primary">{row.name}</td>
                    <td className="px-5 py-3 w-12">
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
                {rows.length === 0 && (
                  <tr><td className="px-5 py-8 text-muted text-sm">No teams yet.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Team' : 'Add Team'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void handleSave()}>{editing ? 'Save' : 'Create'}</Button>
          </>
        }
      >
        <div>
          <Label>Team Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}

export function TeamsPage() {
  return (
    <OrgPageState>{(companyId) => <TeamsContent companyId={companyId} />}</OrgPageState>
  );
}
