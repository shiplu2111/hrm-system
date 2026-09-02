import { useState } from 'react';
import { Plus, X, Briefcase, Clock, Calendar, Zap, Heart } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Label } from '@/components/ui/Form';
import { Badge } from '@/components/ui/Badge';

interface EmpType {
  id: string;
  name: string;
  description: string;
  icon: typeof Briefcase;
  color: string;
  count: number;
}

const iconOptions = [
  { icon: Briefcase, label: 'Briefcase', color: 'bg-accent-100 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300' },
  { icon: Clock, label: 'Clock', color: 'bg-success-100 text-success-700 dark:bg-success-950/40 dark:text-success-300' },
  { icon: Calendar, label: 'Calendar', color: 'bg-warning-100 text-warning-700 dark:bg-warning-950/40 dark:text-warning-300' },
  { icon: Zap, label: 'Zap', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' },
  { icon: Heart, label: 'Heart', color: 'bg-error-100 text-error-700 dark:bg-error-950/40 dark:text-error-300' },
];

const initialTypes: EmpType[] = [
  { id: '1', name: 'Full-Time', description: 'Permanent, 40 hrs/week', icon: Briefcase, color: 'bg-accent-100 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300', count: 980 },
  { id: '2', name: 'Part-Time', description: 'Permanent, < 40 hrs/week', icon: Clock, color: 'bg-success-100 text-success-700 dark:bg-success-950/40 dark:text-success-300', count: 145 },
  { id: '3', name: 'Contract', description: 'Fixed-term contract', icon: Calendar, color: 'bg-warning-100 text-warning-700 dark:bg-warning-950/40 dark:text-warning-300', count: 89 },
  { id: '4', name: 'Intern', description: 'Temporary, training role', icon: Zap, color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300', count: 42 },
  { id: '5', name: 'Consultant', description: 'External advisor', icon: Heart, color: 'bg-error-100 text-error-700 dark:bg-error-950/40 dark:text-error-300', count: 28 },
];

export function EmploymentTypesPage() {
  const [types, setTypes] = useState<EmpType[]>(initialTypes);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', iconIdx: 0 });

  const addType = () => {
    if (!form.name) return;
    const iconOpt = iconOptions[form.iconIdx];
    setTypes((prev) => [...prev, {
      id: Date.now().toString(),
      name: form.name,
      description: form.description,
      icon: iconOpt.icon,
      color: iconOpt.color,
      count: 0,
    }]);
    setForm({ name: '', description: '', iconIdx: 0 });
    setModalOpen(false);
  };

  const removeType = (id: string) => setTypes((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Employment Types</h1>
          <p className="text-sm text-secondary mt-0.5">Define how employees are classified in your organization.</p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Add Custom Type
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employment Type Tags</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-3">
            {types.map((t) => {
              const Icon = t.icon;
              return (
                <div
                  key={t.id}
                  className="group relative flex items-center gap-2.5 surface border border-base rounded-xl pl-3 pr-8 py-2.5 hover:shadow-card-hover hover:border-strong transition-all"
                >
                  <div className={`h-8 w-8 rounded-lg ${t.color} flex items-center justify-center shrink-0`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-primary">{t.name}</div>
                    <div className="text-[11px] text-muted">{t.description}</div>
                  </div>
                  <Badge tone="neutral" className="absolute top-1.5 right-2">{t.count}</Badge>
                  <button
                    onClick={() => removeType(t.id)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full surface border border-base text-muted hover:text-error-600 hover:border-error-300 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 border-2 border-dashed border-strong rounded-xl px-4 py-2.5 text-secondary hover:border-accent-500 hover:text-accent-600 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Type
            </button>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Employment Type"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={addType}>Create Type</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Type Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Freelance" />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Project-based, no fixed hours" />
          </div>
          <div>
            <Label>Icon</Label>
            <div className="flex gap-2">
              {iconOptions.map((opt, i) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={i}
                    onClick={() => setForm({ ...form, iconIdx: i })}
                    className={`h-10 w-10 rounded-lg flex items-center justify-center border-2 transition-all ${
                      form.iconIdx === i ? 'border-accent-500 ring-2 ring-accent-500/20' : 'border-base hover:border-strong'
                    } ${opt.color}`}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
