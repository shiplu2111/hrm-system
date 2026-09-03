import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import type { CustomFieldDefinitionRecord, CustomFieldEntityType, CustomFieldType } from '@hrm/shared-types';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import {
  createCustomField,
  deleteCustomField,
  listCustomFields,
} from '@/lib/documents-api';
import { ApiError } from '@/lib/tenant-api-client';

const entities: CustomFieldEntityType[] = [
  'employee', 'company', 'department', 'designation', 'contract', 'candidate',
];

const fieldTypes: CustomFieldType[] = [
  'text', 'number', 'date', 'dropdown', 'checkbox', 'radio', 'file', 'image', 'signature',
];

function CustomFieldBuilderContent({ companyId }: { companyId: string }) {
  const [fields, setFields] = useState<CustomFieldDefinitionRecord[]>([]);
  const [entityFilter, setEntityFilter] = useState<CustomFieldEntityType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    label: '',
    type: 'text' as CustomFieldType,
    entity: 'employee' as CustomFieldEntityType,
    required: false,
    options: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listCustomFields(
        companyId,
        entityFilter === 'all' ? undefined : entityFilter,
      );
      setFields(rows.filter((f) => f.entityType !== 'document'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [companyId, entityFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const addField = async () => {
    if (!form.label.trim()) return;
    setError(null);
    try {
      await createCustomField(companyId, {
        entityType: form.entity,
        label: form.label.trim(),
        fieldType: form.type,
        required: form.required,
        options: form.options
          ? form.options.split(',').map((o) => o.trim()).filter(Boolean)
          : [],
      });
      setModalOpen(false);
      setForm({ label: '', type: 'text', entity: 'employee', required: false, options: '' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Create failed');
    }
  };

  const removeField = async (id: string) => {
    if (!window.confirm('Delete this custom field?')) return;
    try {
      await deleteCustomField(companyId, id);
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
    <div className="p-4 lg:p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Custom Field Builder</h1>
          <p className="text-sm text-secondary mt-0.5">
            Generalized fields for Employee, Company, Department, and other entities.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Add Field
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 rounded-lg px-4 py-2">{error}</div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setEntityFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${entityFilter === 'all' ? 'border-accent-500 text-accent-600' : 'border-base text-secondary'}`}
        >
          All
        </button>
        {entities.map((entity) => (
          <button
            key={entity}
            type="button"
            onClick={() => setEntityFilter(entity)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize ${entityFilter === entity ? 'border-accent-500 text-accent-600' : 'border-base text-secondary'}`}
          >
            {entity}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Custom Fields ({fields.length})</CardTitle></CardHeader>
        <CardBody className="p-0 divide-y divide-[rgb(var(--border-base))]">
          {fields.map((field) => (
            <div key={field.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[rgb(var(--bg-hover))] group">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-primary">{field.label}</div>
                <div className="text-xs text-muted">{field.fieldKey} · {field.fieldType}</div>
              </div>
              <Badge tone="neutral" className="capitalize">{field.entityType}</Badge>
              {field.required ? <Badge tone="error">Required</Badge> : <Badge tone="neutral">Optional</Badge>}
              <button type="button" onClick={() => void removeField(field.id)} className="text-muted hover:text-error-600 opacity-0 group-hover:opacity-100">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {fields.length === 0 && (
            <p className="px-5 py-8 text-sm text-muted text-center">No custom fields for this filter.</p>
          )}
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Custom Field"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void addField()}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Field Label</Label>
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div>
            <Label>Applies To</Label>
            <Select value={form.entity} onChange={(e) => setForm({ ...form, entity: e.target.value as CustomFieldEntityType })}>
              {entities.map((ent) => <option key={ent} value={ent} className="capitalize">{ent}</option>)}
            </Select>
          </div>
          <div>
            <Label>Field Type</Label>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CustomFieldType })}>
              {fieldTypes.map((ft) => <option key={ft} value={ft}>{ft}</option>)}
            </Select>
          </div>
          {(form.type === 'dropdown' || form.type === 'radio') && (
            <div>
              <Label>Options (comma-separated)</Label>
              <Input value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} />
            </div>
          )}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[rgb(var(--bg-muted))]">
            <span className="text-sm">Required</span>
            <Toggle checked={form.required} onChange={(v) => setForm({ ...form, required: v })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function CustomFieldBuilderPage() {
  return (
    <OrgPageState>{(companyId) => <CustomFieldBuilderContent companyId={companyId} />}</OrgPageState>
  );
}
