import { useCallback, useEffect, useState } from 'react';
import {
  Search,
  LayoutGrid,
  List,
  Mail,
  Phone,
  MoreHorizontal,
  Plus,
  Loader2,
} from 'lucide-react';
import type { EmployeeRecord, EmploymentStatus } from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select, Label } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Toggle';
import { Modal } from '@/components/ui/Modal';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { useNav } from '@/context/NavContext';
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
} from '@/lib/employees-api';
import {
  listDepartments,
  listDesignations,
  listEmploymentTypes,
} from '@/lib/organization-api';
import { ApiError } from '@/lib/tenant-api-client';

const statusTone: Record<
  EmploymentStatus,
  'success' | 'warning' | 'accent' | 'error' | 'neutral'
> = {
  active: 'success',
  on_leave: 'warning',
  inactive: 'neutral',
  terminated: 'error',
};

const statusLabel: Record<EmploymentStatus, string> = {
  active: 'Active',
  on_leave: 'On Leave',
  inactive: 'Inactive',
  terminated: 'Terminated',
};

function EmployeeDirectoryContent({ companyId }: { companyId: string }) {
  const { openEmployee } = useNav();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [designations, setDesignations] = useState<{ id: string; name: string }[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    employeeNumber: '',
    firstName: '',
    lastName: '',
    email: '',
    hireDate: new Date().toISOString().slice(0, 10),
    departmentId: '',
    designationId: '',
    employmentTypeId: '',
    employmentStatus: 'active' as EmploymentStatus,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, depts, desigs, types] = await Promise.all([
        listEmployees(companyId),
        listDepartments(companyId),
        listDesignations(companyId),
        listEmploymentTypes(companyId),
      ]);
      setEmployees(emps);
      setDepartments(depts.map((d) => ({ id: d.id, name: d.name })));
      setDesignations(desigs.map((d) => ({ id: d.id, name: d.name })));
      setEmploymentTypes(types.map((t) => ({ id: t.id, name: t.name })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    if (
      q &&
      !e.fullName.toLowerCase().includes(q) &&
      !e.employeeNumber.toLowerCase().includes(q) &&
      !(e.designation?.name ?? '').toLowerCase().includes(q)
    ) {
      return false;
    }
    if (deptFilter !== 'all' && e.departmentId !== deptFilter) return false;
    if (statusFilter !== 'all' && e.employmentStatus !== statusFilter) return false;
    return true;
  });

  const handleCreate = async () => {
    if (!form.employeeNumber.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      return;
    }
    setError(null);
    try {
      await createEmployee({
        companyId,
        employeeNumber: form.employeeNumber.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        hireDate: form.hireDate,
        employmentStatus: form.employmentStatus,
        departmentId: form.departmentId || null,
        designationId: form.designationId || null,
        employmentTypeId: form.employmentTypeId || null,
        personalInfo: form.email
          ? { contact: { email: form.email.trim() } }
          : {},
      });
      setModalOpen(false);
      setForm({
        employeeNumber: '',
        firstName: '',
        lastName: '',
        email: '',
        hireDate: new Date().toISOString().slice(0, 10),
        departmentId: '',
        designationId: '',
        employmentTypeId: '',
        employmentStatus: 'active',
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Create failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Soft-delete this employee?')) return;
    try {
      await deleteEmployee(id);
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
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Employee Directory</h1>
          <p className="text-sm text-secondary mt-0.5">
            {filtered.length} of {employees.length} employees
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <Card>
        <CardBody className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or employee number…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-auto h-9"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-auto h-9"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="inactive">Inactive</option>
              <option value="terminated">Terminated</option>
            </Select>
            <div className="flex items-center surface-muted rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setView('list')}
                className={`p-1.5 rounded-md transition-colors ${view === 'list' ? 'surface shadow-sm text-accent-600' : 'text-muted'}`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('grid')}
                className={`p-1.5 rounded-md transition-colors ${view === 'grid' ? 'surface shadow-sm text-accent-600' : 'text-muted'}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardBody>
      </Card>

      {view === 'list' && (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Employee</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Designation</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase hidden md:table-cell">Department</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase hidden lg:table-cell">Type</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">Status</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {filtered.map((emp) => (
                    <tr
                      key={emp.id}
                      onClick={() => openEmployee(emp.id)}
                      className="hover:bg-[rgb(var(--bg-hover))] transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={emp.fullName} size="sm" />
                          <div>
                            <div className="font-medium text-primary">{emp.fullName}</div>
                            <div className="text-xs text-muted">{emp.employeeNumber}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-secondary">{emp.designation?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-secondary hidden md:table-cell">{emp.department?.name ?? '—'}</td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        {emp.employmentType ? (
                          <Badge tone="neutral">{emp.employmentType.name}</Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={statusTone[emp.employmentStatus]} dot>
                          {statusLabel[emp.employmentStatus]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                          trigger={
                            <button type="button" className="text-muted hover:text-primary p-1 rounded hover:bg-[rgb(var(--bg-muted))]">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          }
                        >
                          <DropdownItem onClick={() => openEmployee(emp.id)}>View Profile</DropdownItem>
                          <DropdownDivider />
                          <DropdownItem onClick={() => void handleDelete(emp.id)}>Delete</DropdownItem>
                        </Dropdown>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((emp) => (
            <Card
              key={emp.id}
              className="hover:shadow-card-hover transition-shadow cursor-pointer"
              onClick={() => openEmployee(emp.id)}
            >
              <CardBody className="flex flex-col items-center text-center">
                <Avatar name={emp.fullName} size="lg" />
                <div className="mt-3 font-semibold text-primary text-sm">{emp.fullName}</div>
                <div className="text-xs text-secondary">{emp.designation?.name ?? '—'}</div>
                <div className="mt-2">
                  <Badge tone={statusTone[emp.employmentStatus]} dot>
                    {statusLabel[emp.employmentStatus]}
                  </Badge>
                </div>
                {emp.personalInfo?.contact?.email && (
                  <div className="mt-3 pt-3 border-t border-base w-full flex items-center gap-2 text-xs text-muted justify-center">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{String(emp.personalInfo.contact.email)}</span>
                  </div>
                )}
                {emp.personalInfo?.contact?.phone && (
                  <div className="flex items-center gap-2 text-xs text-muted justify-center">
                    <Phone className="h-3 w-3" /> {String(emp.personalInfo.contact.phone)}
                  </div>
                )}
                <div className="mt-2 text-xs text-muted">{emp.department?.name ?? '—'}</div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Employee"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void handleCreate()}>Create</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Employee Number</Label>
            <Input value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} />
          </div>
          <div>
            <Label>Hire Date</Label>
            <Input type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} />
          </div>
          <div>
            <Label>First Name</Label>
            <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <div>
            <Label>Last Name</Label>
            <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Work Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Department</Label>
            <Select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Designation</Label>
            <Select value={form.designationId} onChange={(e) => setForm({ ...form, designationId: e.target.value })}>
              <option value="">None</option>
              {designations.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Employment Type</Label>
            <Select value={form.employmentTypeId} onChange={(e) => setForm({ ...form, employmentTypeId: e.target.value })}>
              <option value="">None</option>
              {employmentTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={form.employmentStatus}
              onChange={(e) => setForm({ ...form, employmentStatus: e.target.value as EmploymentStatus })}
            >
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="inactive">Inactive</option>
              <option value="terminated">Terminated</option>
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function EmployeeDirectoryPage() {
  return (
    <OrgPageState>
      {(companyId) => <EmployeeDirectoryContent companyId={companyId} />}
    </OrgPageState>
  );
}
