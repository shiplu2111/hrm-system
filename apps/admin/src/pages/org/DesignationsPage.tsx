import { useState } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, ArrowUpDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';

interface Designation {
  id: string;
  name: string;
  code: string;
  department: string;
  jobLevel: string;
  salaryGrade: string;
}

const initialDesignations: Designation[] = [
  { id: '1', name: 'Software Engineer I', code: 'SE-I', department: 'Engineering', jobLevel: 'L1', salaryGrade: 'G3' },
  { id: '2', name: 'Software Engineer II', code: 'SE-II', department: 'Engineering', jobLevel: 'L2', salaryGrade: 'G4' },
  { id: '3', name: 'Senior Software Engineer', code: 'SSE', department: 'Engineering', jobLevel: 'L3', salaryGrade: 'G5' },
  { id: '4', name: 'Staff Engineer', code: 'STE', department: 'Engineering', jobLevel: 'L4', salaryGrade: 'G6' },
  { id: '5', name: 'Engineering Manager', code: 'EM', department: 'Engineering', jobLevel: 'M1', salaryGrade: 'G7' },
  { id: '6', name: 'Sales Representative', code: 'SR', department: 'Sales', jobLevel: 'L2', salaryGrade: 'G4' },
  { id: '7', name: 'Account Executive', code: 'AE', department: 'Sales', jobLevel: 'L3', salaryGrade: 'G5' },
  { id: '8', name: 'Marketing Specialist', code: 'MS', department: 'Marketing', jobLevel: 'L2', salaryGrade: 'G4' },
  { id: '9', name: 'Financial Analyst', code: 'FA', department: 'Finance', jobLevel: 'L3', salaryGrade: 'G5' },
  { id: '10', name: 'HR Coordinator', code: 'HRC', department: 'HR', jobLevel: 'L1', salaryGrade: 'G3' },
];

export function DesignationsPage() {
  const [designations, setDesignations] = useState(initialDesignations);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Designation | null>(null);
  const [form, setForm] = useState({ name: '', code: '', department: '', jobLevel: '', salaryGrade: '' });

  const filtered = designations.filter(
    (d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', code: '', department: '', jobLevel: '', salaryGrade: '' });
    setModalOpen(true);
  };

  const openEdit = (d: Designation) => {
    setEditing(d);
    setForm({ name: d.name, code: d.code, department: d.department, jobLevel: d.jobLevel, salaryGrade: d.salaryGrade });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.name) return;
    if (editing) {
      setDesignations((prev) => prev.map((d) => (d.id === editing.id ? { ...d, ...form } : d)));
    } else {
      setDesignations((prev) => [...prev, { id: Date.now().toString(), ...form }]);
    }
    setModalOpen(false);
  };

  const handleDelete = (id: string) => setDesignations((prev) => prev.filter((d) => d.id !== id));

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Designations & Job Levels</h1>
          <p className="text-sm text-secondary mt-0.5">Manage job titles, codes, levels, and salary grades.</p>
        </div>
        <Button variant="primary" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add Designation
        </Button>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <CardTitle>All Designations</CardTitle>
          <div className="relative w-64 max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search designations..."
              className="pl-9 h-8"
            />
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">
                    <span className="flex items-center gap-1">Name <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Code</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Department</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Job Level</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Salary Grade</th>
                  <th className="w-12 px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors group">
                    <td className="px-5 py-3 font-medium text-primary">{d.name}</td>
                    <td className="px-5 py-3">
                      <Badge tone="neutral">{d.code}</Badge>
                    </td>
                    <td className="px-5 py-3 text-secondary">{d.department}</td>
                    <td className="px-5 py-3">
                      <Badge tone="accent">{d.jobLevel}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone="success">{d.salaryGrade}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Dropdown
                        width="w-36"
                        trigger={
                          <button className="text-muted hover:text-primary p-1 rounded hover:bg-[rgb(var(--bg-muted))] transition-colors">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        }
                      >
                        <DropdownItem icon={<Pencil className="h-4 w-4" />} onClick={() => openEdit(d)}>Edit</DropdownItem>
                        <DropdownDivider />
                        <DropdownItem icon={<Trash2 className="h-4 w-4" />} onClick={() => handleDelete(d.id)}>Delete</DropdownItem>
                      </Dropdown>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Designation' : 'Add Designation'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave}>{editing ? 'Save Changes' : 'Create'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Designation Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Senior Software Engineer" />
          </div>
          <div>
            <Label>Code</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. SSE" />
          </div>
          <div>
            <Label>Department</Label>
            <Select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              <option value="">Select...</option>
              <option>Engineering</option>
              <option>Sales</option>
              <option>Marketing</option>
              <option>Finance</option>
              <option>HR</option>
              <option>Operations</option>
            </Select>
          </div>
          <div>
            <Label>Job Level</Label>
            <Select value={form.jobLevel} onChange={(e) => setForm({ ...form, jobLevel: e.target.value })}>
              <option value="">Select...</option>
              <option>L1 — Entry</option>
              <option>L2 — Junior</option>
              <option>L3 — Senior</option>
              <option>L4 — Staff</option>
              <option>M1 — Manager</option>
              <option>M2 — Director</option>
            </Select>
          </div>
          <div>
            <Label>Salary Grade</Label>
            <Select value={form.salaryGrade} onChange={(e) => setForm({ ...form, salaryGrade: e.target.value })}>
              <option value="">Select...</option>
              <option>G1</option><option>G2</option><option>G3</option><option>G4</option>
              <option>G5</option><option>G6</option><option>G7</option><option>G8</option>
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
