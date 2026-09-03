import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Trash2, Loader2 } from 'lucide-react';
import type { CustomFieldType, DocumentTypeRecord } from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import {
  createDocumentType,
  deleteDocumentType,
  listDocumentTypes,
} from '@/lib/documents-api';
import { ApiError } from '@/lib/tenant-api-client';

const fieldTypes: CustomFieldType[] = [
  'text', 'number', 'date', 'dropdown', 'checkbox', 'radio', 'file', 'image', 'signature',
];

function DocumentTypesContent({ companyId }: { companyId: string }) {
  const [types, setTypes] = useState<DocumentTypeRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    scope: 'employee' as 'employee' | 'company',
    requiresVerification: false,
    tracksExpiry: false,
    fieldLabel: '',
    fieldType: 'text' as CustomFieldType,
    fieldRequired: false,
    fieldOptions: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTypes(await listDocumentTypes(companyId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = types.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setError(null);
    try {
      await createDocumentType(companyId, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        scope: form.scope,
        requiresVerification: form.requiresVerification,
        tracksExpiry: form.tracksExpiry,
        fields: form.fieldLabel.trim()
          ? [{
              label: form.fieldLabel.trim(),
              fieldType: form.fieldType,
              required: form.fieldRequired,
              options: form.fieldOptions
                ? form.fieldOptions.split(',').map((o) => o.trim()).filter(Boolean)
                : [],
              sortOrder: 0,
            }]
          : [],
      });
      setModalOpen(false);
      setForm({
        name: '',
        description: '',
        scope: 'employee',
        requiresVerification: false,
        tracksExpiry: false,
        fieldLabel: '',
        fieldType: 'text',
        fieldRequired: false,
        fieldOptions: '',
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Create failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this document type?')) return;
    try {
      await deleteDocumentType(companyId, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Document Types</h1>
          <p className="text-sm text-secondary mt-0.5">
            Admin-defined document categories with configurable field schemas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Add Document Type
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 rounded-lg px-4 py-2">{error}</div>
      )}

      <div className="relative w-64 max-w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9" />
      </div>

      <Card>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Name</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Scope</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Fields</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Flags</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-base))]">
              {filtered.map((dt) => (
                <tr key={dt.id} className="hover:bg-[rgb(var(--bg-hover))] group">
                  <td className="px-5 py-3">
                    <div className="font-medium text-primary">{dt.name}</div>
                    {dt.description && <div className="text-xs text-muted">{dt.description}</div>}
                  </td>
                  <td className="px-5 py-3 capitalize text-secondary">{dt.scope}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {dt.fields.map((f) => (
                        <Badge key={f.id ?? f.fieldKey} tone="neutral">{f.label}</Badge>
                      ))}
                      {dt.fields.length === 0 && <span className="text-muted text-xs">No fields</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 space-x-1">
                    {dt.requiresVerification && <Badge tone="accent">Verify</Badge>}
                    {dt.tracksExpiry && <Badge tone="warning">Expiry</Badge>}
                  </td>
                  <td className="px-5 py-3">
                    <button type="button" onClick={() => void handleDelete(dt.id)} className="text-muted hover:text-error-600 opacity-0 group-hover:opacity-100">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Document Type"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void handleCreate()}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Passport" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label>Scope</Label>
            <Select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as 'employee' | 'company' })}>
              <option value="employee">Employee-specific</option>
              <option value="company">Company-wide</option>
            </Select>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-[rgb(var(--bg-muted))]">
            <span className="text-sm">Requires verification</span>
            <Toggle checked={form.requiresVerification} onChange={(v) => setForm({ ...form, requiresVerification: v })} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-[rgb(var(--bg-muted))]">
            <span className="text-sm">Track expiry</span>
            <Toggle checked={form.tracksExpiry} onChange={(v) => setForm({ ...form, tracksExpiry: v })} />
          </div>
          <hr className="border-base" />
          <p className="text-xs text-secondary">Initial field (add more via field builder or API)</p>
          <div>
            <Label>Field Label</Label>
            <Input value={form.fieldLabel} onChange={(e) => setForm({ ...form, fieldLabel: e.target.value })} placeholder="Passport Number" />
          </div>
          <div>
            <Label>Field Type</Label>
            <Select value={form.fieldType} onChange={(e) => setForm({ ...form, fieldType: e.target.value as CustomFieldType })}>
              {fieldTypes.map((ft) => <option key={ft} value={ft}>{ft}</option>)}
            </Select>
          </div>
          {(form.fieldType === 'dropdown' || form.fieldType === 'radio') && (
            <div>
              <Label>Options (comma-separated)</Label>
              <Input value={form.fieldOptions} onChange={(e) => setForm({ ...form, fieldOptions: e.target.value })} />
            </div>
          )}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[rgb(var(--bg-muted))]">
            <span className="text-sm">Field required</span>
            <Toggle checked={form.fieldRequired} onChange={(v) => setForm({ ...form, fieldRequired: v })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function DocumentTypesPage() {
  return (
    <OrgPageState>{(companyId) => <DocumentTypesContent companyId={companyId} />}</OrgPageState>
  );
}
