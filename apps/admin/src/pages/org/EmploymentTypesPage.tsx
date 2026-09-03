import { useCallback, useEffect, useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import type { NamedOrgEntity } from '@hrm/shared-types';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Label } from '@/components/ui/Form';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import {
  createEmploymentType,
  deleteEmploymentType,
  listEmploymentTypes,
} from '@/lib/organization-api';
import { ApiError } from '@/lib/tenant-api-client';

function EmploymentTypesContent({ companyId }: { companyId: string }) {
  const [types, setTypes] = useState<NamedOrgEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTypes(await listEmploymentTypes(companyId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addType = async () => {
    if (!name.trim()) return;
    setError(null);
    try {
      await createEmploymentType(companyId, { name: name.trim() });
      setName('');
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Create failed');
    }
  };

  const removeType = async (id: string) => {
    if (!window.confirm('Delete this employment type?')) return;
    try {
      await deleteEmploymentType(companyId, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Employment Types</h1>
          <p className="text-sm text-secondary mt-0.5">
            Define how employees are classified in your organization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Add Type
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Employment Types</CardTitle></CardHeader>
        <CardBody>
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {types.map((t) => (
                <div
                  key={t.id}
                  className="group relative flex items-center gap-2 surface border border-base rounded-xl pl-3 pr-8 py-2.5"
                >
                  <div className="text-sm font-medium text-primary">{t.name}</div>
                  <button
                    type="button"
                    onClick={() => void removeType(t.id)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full surface border border-base text-muted hover:text-error-600 flex items-center justify-center opacity-0 group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {types.length === 0 && (
                <p className="text-sm text-muted">No employment types defined yet.</p>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Employment Type"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void addType()}>Create</Button>
          </>
        }
      >
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full-Time" />
        </div>
      </Modal>
    </div>
  );
}

export function EmploymentTypesPage() {
  return (
    <OrgPageState>{(companyId) => <EmploymentTypesContent companyId={companyId} />}</OrgPageState>
  );
}
