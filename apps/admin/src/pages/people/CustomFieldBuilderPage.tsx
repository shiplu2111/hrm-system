import { useState } from 'react';
import {
  Plus,
  Type,
  Hash,
  Calendar,
  ChevronDown,
  FileText,
  PenLine,
  GripVertical,
  Trash2,
  Settings2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';

type FieldType = 'text' | 'number' | 'date' | 'dropdown' | 'file' | 'signature';

interface CustomField {
  id: string;
  label: string;
  type: FieldType;
  entity: string;
  required: boolean;
  options?: string;
}

const fieldIcons: Record<FieldType, typeof Type> = {
  text: Type, number: Hash, date: Calendar, dropdown: ChevronDown, file: FileText, signature: PenLine,
};

const fieldColors: Record<FieldType, string> = {
  text: 'bg-accent-100 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300',
  number: 'bg-success-100 text-success-700 dark:bg-success-950/40 dark:text-success-300',
  date: 'bg-warning-100 text-warning-700 dark:bg-warning-950/40 dark:text-warning-300',
  dropdown: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  file: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  signature: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
};

const entities = ['Employee', 'Company', 'Department', 'Designation', 'Contract', 'Candidate'];

const initialFields: CustomField[] = [
  { id: 'cf1', label: 'Blood Group', type: 'dropdown', entity: 'Employee', required: false, options: 'A+, A-, B+, B-, O+, O-, AB+, AB-' },
  { id: 'cf2', label: 'Uniform Size', type: 'text', entity: 'Employee', required: false },
  { id: 'cf3', label: 'T-Shirt Size', type: 'dropdown', entity: 'Employee', required: true, options: 'XS, S, M, L, XL, XXL' },
  { id: 'cf4', label: 'Parking Slot', type: 'text', entity: 'Employee', required: false },
  { id: 'cf5', label: 'Project Code', type: 'text', entity: 'Contract', required: true },
  { id: 'cf6', label: 'Source Channel', type: 'dropdown', entity: 'Candidate', required: false, options: 'LinkedIn, Referral, Job Board, Direct' },
];

export function CustomFieldBuilderPage() {
  const [fields, setFields] = useState(initialFields);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ label: '', type: 'text' as FieldType, entity: 'Employee', required: false, options: '' });

  const addField = () => {
    if (!form.label) return;
    setFields((prev) => [...prev, { id: `cf${Date.now()}`, ...form }]);
    setForm({ label: '', type: 'text', entity: 'Employee', required: false, options: '' });
    setModalOpen(false);
  };

  const removeField = (id: string) => setFields((prev) => prev.filter((f) => f.id !== id));

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Custom Field Builder</h1>
          <p className="text-sm text-secondary mt-0.5">Create custom fields that can be applied to any entity in the system.</p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Add Field
        </Button>
      </div>

      {/* Entity filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {entities.map((entity) => (
          <button key={entity} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-base surface text-secondary hover:border-accent-500 hover:text-accent-600 transition-colors">
            {entity}
          </button>
        ))}
      </div>

      {/* Field list */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Custom Fields ({fields.length})</CardTitle>
          <Badge tone="neutral">Drag to reorder</Badge>
        </CardHeader>
        <CardBody className="p-0">
          <div className="divide-y divide-[rgb(var(--border-base))]">
            {fields.map((field) => {
              const Icon = fieldIcons[field.type];
              return (
                <div key={field.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[rgb(var(--bg-hover))] transition-colors group">
                  <GripVertical className="h-4 w-4 text-muted opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${fieldColors[field.type]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary">{field.label}</div>
                    {field.options && <div className="text-xs text-muted truncate">Options: {field.options}</div>}
                  </div>
                  <Badge tone="neutral">{field.entity}</Badge>
                  {field.required ? <Badge tone="error">Required</Badge> : <Badge tone="neutral">Optional</Badge>}
                  <button onClick={() => removeField(field.id)} className="text-muted hover:text-error-600 p-1.5 rounded-lg hover:bg-error-50 dark:hover:bg-error-950/40 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Add field modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Custom Field"
        description="Create a new custom field for any entity"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={addField}>Create Field</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Field Label</Label>
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Blood Group" />
          </div>
          <div>
            <Label>Applies To</Label>
            <Select value={form.entity} onChange={(e) => setForm({ ...form, entity: e.target.value })}>
              {entities.map((ent) => <option key={ent}>{ent}</option>)}
            </Select>
          </div>
          <div>
            <Label>Field Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(fieldIcons) as FieldType[]).map((ft) => {
                const Icon = fieldIcons[ft];
                return (
                  <button
                    key={ft}
                    onClick={() => setForm({ ...form, type: ft })}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all capitalize text-sm ${
                      form.type === ft ? 'border-accent-500 ring-2 ring-accent-500/20' : 'border-base hover:border-strong'
                    }`}
                  >
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${fieldColors[ft]}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    {ft}
                  </button>
                );
              })}
            </div>
          </div>
          {form.type === 'dropdown' && (
            <div>
              <Label>Options (comma-separated)</Label>
              <Input value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} placeholder="Option 1, Option 2, Option 3" />
            </div>
          )}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[rgb(var(--bg-muted))]">
            <div>
              <div className="text-sm font-medium text-primary">Required Field</div>
              <div className="text-xs text-muted">Users must fill this field</div>
            </div>
            <Toggle checked={form.required} onChange={(v) => setForm({ ...form, required: v })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
