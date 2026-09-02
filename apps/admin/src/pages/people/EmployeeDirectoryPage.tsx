import { useState } from 'react';
import {
  Search,
  LayoutGrid,
  List,
  Mail,
  Phone,
  MoreHorizontal,
  Filter,
  ChevronDown,
  Plus,
  Download,
} from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Toggle';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { useNav } from '@/context/NavContext';
import { employees, type Employee } from '@/data/mockData';

const statusTone: Record<Employee['status'], 'success' | 'warning' | 'accent' | 'error' | 'neutral'> = {
  Active: 'success',
  'On Leave': 'warning',
  Probation: 'accent',
  Suspended: 'error',
  Resigned: 'neutral',
};

export function EmployeeDirectoryPage() {
  const { navigate } = useNav();
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const departments = [...new Set(employees.map((e) => e.department))];
  const types = [...new Set(employees.map((e) => e.employmentType))];

  const filtered = employees.filter((e) => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.designation.toLowerCase().includes(search.toLowerCase())) return false;
    if (deptFilter !== 'all' && e.department !== deptFilter) return false;
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (typeFilter !== 'all' && e.employmentType !== typeFilter) return false;
    return true;
  });

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Employee Directory</h1>
          <p className="text-sm text-secondary mt-0.5">{filtered.length} of {employees.length} employees</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="md"><Download className="h-4 w-4" /> Export</Button>
          <Button variant="primary" size="md"><Plus className="h-4 w-4" /> Add Employee</Button>
        </div>
      </div>

      {/* Filters bar */}
      <Card>
        <CardBody className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or designation..."
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="w-auto h-9">
              <option value="all">All Departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto h-9">
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Probation">Probation</option>
              <option value="Suspended">Suspended</option>
              <option value="Resigned">Resigned</option>
            </Select>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto h-9">
              <option value="all">All Types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <div className="flex items-center surface-muted rounded-lg p-0.5">
              <button
                onClick={() => setView('list')}
                className={`p-1.5 rounded-md transition-colors ${view === 'list' ? 'surface shadow-sm text-accent-600' : 'text-muted'}`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView('grid')}
                className={`p-1.5 rounded-md transition-colors ${view === 'grid' ? 'surface shadow-sm text-accent-600' : 'text-muted'}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* List view */}
      {view === 'list' && (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Employee</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Designation</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">Department</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden lg:table-cell">Type</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Status</th>
                    <th className="w-12 px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {filtered.map((emp) => (
                    <tr
                      key={emp.id}
                      onClick={() => navigate('emp-profile')}
                      className="hover:bg-[rgb(var(--bg-hover))] transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={emp.name} size="sm" />
                          <div>
                            <div className="font-medium text-primary">{emp.name}</div>
                            <div className="text-xs text-muted">{emp.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-secondary">{emp.designation}</td>
                      <td className="px-5 py-3 text-secondary hidden md:table-cell">{emp.department}</td>
                      <td className="px-5 py-3 hidden lg:table-cell"><Badge tone="neutral">{emp.employmentType}</Badge></td>
                      <td className="px-5 py-3"><Badge tone={statusTone[emp.status]} dot>{emp.status}</Badge></td>
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                          width="w-40"
                          trigger={<button className="text-muted hover:text-primary p-1 rounded hover:bg-[rgb(var(--bg-muted))]"><MoreHorizontal className="h-4 w-4" /></button>}
                        >
                          <DropdownItem onClick={() => navigate('emp-profile')}>View Profile</DropdownItem>
                          <DropdownItem>Edit</DropdownItem>
                          <DropdownDivider />
                          <DropdownItem onClick={() => navigate('emp-lifecycle')}>Lifecycle Actions</DropdownItem>
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

      {/* Grid view */}
      {view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((emp) => (
            <Card key={emp.id} className="hover:shadow-card-hover transition-shadow cursor-pointer group" onClick={() => navigate('emp-profile')}>
              <CardBody className="flex flex-col items-center text-center">
                <Avatar name={emp.name} size="lg" />
                <div className="mt-3 font-semibold text-primary text-sm">{emp.name}</div>
                <div className="text-xs text-secondary">{emp.designation}</div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge tone={statusTone[emp.status]} dot>{emp.status}</Badge>
                </div>
                <div className="mt-3 pt-3 border-t border-base w-full space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted justify-center">
                    <Mail className="h-3 w-3" /> <span className="truncate">{emp.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted justify-center">
                    <Phone className="h-3 w-3" /> {emp.phone}
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted">{emp.department}</div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
