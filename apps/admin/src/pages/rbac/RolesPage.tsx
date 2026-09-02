import { useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Shield,
  Crown,
  Users,
  Wallet,
  UserCog,
  Briefcase,
  Calculator,
  Search,
  MoreHorizontal,
  Check,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Textarea } from '@/components/ui/Form';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { PermissionMatrix, type Permissions, type Action } from '@/components/rbac/PermissionMatrix';

interface Role {
  id: string;
  name: string;
  description: string;
  icon: typeof Shield;
  isDefault: boolean;
  users: number;
  color: string;
}

const initialRoles: Role[] = [
  { id: '1', name: 'Super Admin', description: 'Full system access with all permissions', icon: Crown, isDefault: true, users: 2, color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' },
  { id: '2', name: 'Company Owner', description: 'Organization owner with full access', icon: Crown, isDefault: true, users: 1, color: 'bg-accent-100 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300' },
  { id: '3', name: 'HR Admin', description: 'Manage employees, departments, payroll', icon: Users, isDefault: true, users: 5, color: 'bg-success-100 text-success-700 dark:bg-success-950/40 dark:text-success-300' },
  { id: '4', name: 'Payroll Admin', description: 'Manage payroll runs and compensation', icon: Wallet, isDefault: true, users: 3, color: 'bg-warning-100 text-warning-700 dark:bg-warning-950/40 dark:text-warning-300' },
  { id: '5', name: 'Manager', description: 'Manage team, approve requests, view reports', icon: UserCog, isDefault: true, users: 42, color: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' },
  { id: '6', name: 'Employee', description: 'Self-service access to own records', icon: Briefcase, isDefault: true, users: 1184, color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  { id: '7', name: 'Accountant', description: 'Financial reporting and payroll viewing', icon: Calculator, isDefault: true, users: 8, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  { id: '8', name: 'Recruiter', description: 'Manage candidates and job postings', icon: Users, isDefault: true, users: 12, color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
  { id: '9', name: 'Compliance Officer', description: 'Audit logs, compliance reports, policy review', icon: Shield, isDefault: false, users: 4, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' },
];

export function RolesPage() {
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [permissions, setPermissions] = useState<Permissions>({});

  const filtered = roles.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));

  const addRole = () => {
    if (!form.name) return;
    setRoles((prev) => [...prev, {
      id: Date.now().toString(),
      name: form.name,
      description: form.description,
      icon: Shield,
      isDefault: false,
      users: 0,
      color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
    }]);
    setForm({ name: '', description: '' });
    setPermissions({});
    setModalOpen(false);
  };

  const deleteRole = (id: string) => setRoles((prev) => prev.filter((r) => r.id !== id));

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Roles & Permissions</h1>
          <p className="text-sm text-secondary mt-0.5">Manage user roles and their access levels across the platform.</p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Add Custom Role
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Roles', value: roles.length, tone: 'accent' as const },
          { label: 'Default Roles', value: roles.filter((r) => r.isDefault).length, tone: 'success' as const },
          { label: 'Custom Roles', value: roles.filter((r) => !r.isDefault).length, tone: 'warning' as const },
          { label: 'Total Users Assigned', value: roles.reduce((s, r) => s + r.users, 0).toLocaleString(), tone: 'neutral' as const },
        ].map((s) => (
          <div key={s.label} className="surface rounded-xl border shadow-card p-4">
            <div className="text-2xl font-bold text-primary">{s.value}</div>
            <div className="text-xs text-secondary mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-64 max-w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search roles..." className="pl-9" />
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((role) => {
          const Icon = role.icon;
          return (
            <Card key={role.id} className="hover:shadow-card-hover transition-shadow group">
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg ${role.color} flex items-center justify-center shrink-0`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-primary">{role.name}</span>
                        {role.isDefault && <Badge tone="neutral">Default</Badge>}
                      </div>
                      <div className="text-xs text-muted mt-0.5">{role.users} users assigned</div>
                    </div>
                  </div>
                  <Dropdown
                    width="w-36"
                    trigger={
                      <button className="text-muted hover:text-primary p-1 rounded hover:bg-[rgb(var(--bg-hover))] transition-colors opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    }
                  >
                    <DropdownItem icon={<Pencil className="h-4 w-4" />}>Edit Role</DropdownItem>
                    <DropdownItem icon={<Shield className="h-4 w-4" />}>View Permissions</DropdownItem>
                    {!role.isDefault && <DropdownDivider />}
                    {!role.isDefault && <DropdownItem icon={<Trash2 className="h-4 w-4" />} onClick={() => deleteRole(role.id)}>Delete</DropdownItem>}
                  </Dropdown>
                </div>
                <p className="text-xs text-secondary mt-3 leading-relaxed">{role.description}</p>
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-base">
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-1.5">
                      {['A', 'B', 'C'].map((l) => (
                        <div key={l} className="h-6 w-6 rounded-full bg-accent-100 dark:bg-accent-900/40 text-accent-700 dark:text-accent-300 flex items-center justify-center text-[10px] font-semibold ring-2 ring-[rgb(var(--bg-surface))]">
                          {l}
                        </div>
                      ))}
                    </div>
                    <span className="text-[11px] text-muted">+{Math.max(0, role.users - 3)} more</span>
                  </div>
                  <Button variant="ghost" size="sm">Manage</Button>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Add Custom Role Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Custom Role"
        description="Create a new role with specific permissions"
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={addRole}>
              <Check className="h-4 w-4" /> Create Role
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Role Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Regional Manager" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description of the role" />
            </div>
          </div>
          <div>
            <Label>Permission Matrix</Label>
            <PermissionMatrix permissions={permissions} onChange={setPermissions} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
