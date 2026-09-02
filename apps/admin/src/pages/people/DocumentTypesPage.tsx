import { useState } from 'react';
import {
  Plus,
  Type,
  Hash,
  Calendar,
  ChevronDown,
  FileText,
  PenLine,
  Pencil,
  Trash2,
  Search,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';
import { docTypes, type DocType } from '@/data/mockData';

const fieldIcons: Record<DocType['fieldType'], typeof Type> = {
  text: Type,
  number: Hash,
  date: Calendar,
  dropdown: ChevronDown,
  file: FileText,
  signature: PenLine,
};

const fieldIconColors: Record<DocType['fieldType'], string> = {
  text: 'bg-accent-100 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300',
  number: 'bg-success-100 text-success-700 dark:bg-success-950/40 dark:text-success-300',
  date: 'bg-warning-100 text-warning-700 dark:bg-warning-950/40 dark:text-warning-300',
  dropdown: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  file: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  signature: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
};

export function DocumentTypesPage() {
  const [types, setTypes] = useState(docTypes);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', fieldType: 'text' as DocType['fieldType'], required: false, expiryTracking: false });

  const filtered = types.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  const addType = () => {
    if (!form.name) return;
    setTypes((prev) => [...prev, { id: `dt${Date.now()}`, ...form }]);
    setForm({ name: '', description: '', fieldType: 'text', required: false, expiryTracking: false });
    setModalOpen(false);
  };

  const removeType = (id: string) => setTypes((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Document Types</h1>
          <p className="text-sm text-secondary mt-0.5">Define the types of documents your organization manages.</p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Add Document Type
        </Button>
      </div>

      {/* Search */}
      <div className="relative w-64 max-w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search document types..." className="pl-9" />
      </div>

      {/* Table */}
      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Field Name</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Field Type</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">Description</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Required</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Expiry Tracking</th>
                  <th className="w-12 px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filtered.map((dt) => {
                  const Icon = fieldIcons[dt.fieldType];
                  return (
                    <tr key={dt.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors group">
                      <td className="px-5 py-3 font-medium text-primary">{dt.name}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${fieldIconColors[dt.fieldType]}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-secondary capitalize">{dt.fieldType}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-secondary hidden md:table-cell">{dt.description}</td>
                      <td className="px-5 py-3">
                        {dt.required ? <Badge tone="error">Required</Badge> : <Badge tone="neutral">Optional</Badge>}
                      </td>
                      <td className="px-5 py-3">
                        {dt.expiryTracking ? <Badge tone="warning" dot>Tracked</Badge> : <span className="text-muted text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="text-muted hover:text-primary p-1 rounded hover:bg-[rgb(var(--bg-muted))]"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => removeType(dt.id)} className="text-muted hover:text-error-600 p-1 rounded hover:bg-error-50 dark:hover:bg-error-950/40"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Add modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Document Type"
        description="Define a new document type for your organization"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={addType}>Create Type</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Document Type Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Work Permit" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this document type represents..." />
          </div>
          <div>
            <Label>Field Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(fieldIcons) as DocType['fieldType'][]).map((ft) => {
                const Icon = fieldIcons[ft];
                return (
                  <button
                    key={ft}
                    onClick={() => setForm({ ...form, fieldType: ft })}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all capitalize text-sm ${
                      form.fieldType === ft ? 'border-accent-500 ring-2 ring-accent-500/20' : 'border-base hover:border-strong'
                    }`}
                  >
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${fieldIconColors[ft]}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    {ft}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-[rgb(var(--bg-muted))]">
            <div>
              <div className="text-sm font-medium text-primary">Required Field</div>
              <div className="text-xs text-muted">Employees must provide this document</div>
            </div>
            <Toggle checked={form.required} onChange={(v) => setForm({ ...form, required: v })} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-[rgb(var(--bg-muted))]">
            <div>
              <div className="text-sm font-medium text-primary">Expiry Tracking</div>
              <div className="text-xs text-muted">Track and alert when this document expires</div>
            </div>
            <Toggle checked={form.expiryTracking} onChange={(v) => setForm({ ...form, expiryTracking: v })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
