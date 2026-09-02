import { useState } from 'react';
import {
  Plus,
  Search,
  AlertTriangle,
  FileText,
  Calendar,
  DollarSign,
  Clock,
  Upload,
  Check,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { useNav } from '@/context/NavContext';
import { contracts, type Contract } from '@/data/mockData';

const statusTone: Record<Contract['status'], 'success' | 'warning' | 'error' | 'neutral'> = {
  Active: 'success',
  'Expiring Soon': 'warning',
  Expired: 'error',
  Draft: 'neutral',
};

const typeTone: Record<Contract['type'], 'accent' | 'success' | 'warning' | 'info'> = {
  Permanent: 'accent',
  'Fixed-Term': 'warning',
  Casual: 'neutral' as never,
  Project: 'info',
};

export function ContractsPage() {
  const { navigate } = useNav();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = contracts.filter((c) => {
    if (search && !c.employeeName.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Contract Management</h1>
          <p className="text-sm text-secondary mt-0.5">{filtered.length} contracts · {contracts.filter((c) => c.status === 'Expiring Soon').length} expiring soon</p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create Contract
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardBody className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by employee name..." className="pl-9" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto h-9">
            <option value="all">All Status</option>
            <option value="Active">Active</option>
            <option value="Expiring Soon">Expiring Soon</option>
            <option value="Expired">Expired</option>
            <option value="Draft">Draft</option>
          </Select>
        </CardBody>
      </Card>

      {/* Contracts table */}
      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Employee</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Type</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">Start Date</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">End Date</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden lg:table-cell">Pay Rate</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Status</th>
                  <th className="w-12 px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate('emp-contract-detail')}
                    className="hover:bg-[rgb(var(--bg-hover))] transition-colors cursor-pointer group"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 text-accent-600 dark:text-accent-400" />
                        </div>
                        <div>
                          <div className="font-medium text-primary">{c.employeeName}</div>
                          <div className="text-xs text-muted">{c.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3"><Badge tone={typeTone[c.type]}>{c.type}</Badge></td>
                    <td className="px-5 py-3 text-secondary hidden md:table-cell">{c.startDate}</td>
                    <td className="px-5 py-3 text-secondary hidden md:table-cell">{c.endDate}</td>
                    <td className="px-5 py-3 text-secondary hidden lg:table-cell">{c.payRate}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {c.status === 'Expiring Soon' && <AlertTriangle className="h-3.5 w-3.5 text-warning-500" />}
                        <Badge tone={statusTone[c.status]} dot>{c.status}</Badge>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Button variant="ghost" size="sm">View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Create contract modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Contract"
        description="Define a new employment contract"
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setCreateOpen(false)}><Check className="h-4 w-4" /> Create Contract</Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Employee & type */}
          <div>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Contract Basics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Employee</Label>
                <Select><option value="">Select employee...</option><option>Sarah Chen</option><option>James Park</option><option>Emma Wilson</option></Select>
              </div>
              <div>
                <Label>Contract Type</Label>
                <Select><option>Permanent</option><option>Fixed-Term</option><option>Casual</option><option>Project</option></Select>
              </div>
              <div>
                <Label>Start Date</Label>
                <Input type="date" />
              </div>
              <div>
                <Label>End Date (if applicable)</Label>
                <Input type="date" />
              </div>
            </div>
          </div>

          {/* Probation */}
          <div>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Probation</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Probation Period</Label>
                <Select><option>3 months</option><option>6 months</option><option>1 year</option><option>No probation</option></Select>
              </div>
              <div>
                <Label>Probation End Date</Label>
                <Input type="date" />
              </div>
            </div>
          </div>

          {/* Compensation */}
          <div>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Compensation & Working Hours</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pay Rate</Label>
                <Input placeholder="e.g. 85000" />
              </div>
              <div>
                <Label>Pay Frequency</Label>
                <Select><option>Monthly</option><option>Bi-weekly</option><option>Weekly</option><option>Hourly</option></Select>
              </div>
              <div>
                <Label>Working Hours / Week</Label>
                <Input type="number" defaultValue="40" />
              </div>
              <div>
                <Label>Leave Entitlement (days/year)</Label>
                <Input type="number" defaultValue="25" />
              </div>
              <div>
                <Label>Overtime Rule</Label>
                <Select><option>1.5x after 40 hrs</option><option>1.5x after 8 hrs/day</option><option>2x on weekends</option><option>No OT</option></Select>
              </div>
              <div>
                <Label>Notice Period</Label>
                <Select><option>15 days</option><option>30 days</option><option>60 days</option><option>90 days</option></Select>
              </div>
            </div>
          </div>

          {/* Termination */}
          <div>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Termination Rules</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>Termination Notice (Employer)</Label>
                <Select><option>15 days</option><option>30 days</option><option>60 days</option><option>90 days</option></Select>
              </div>
              <div>
                <Label>Termination Conditions</Label>
                <Textarea rows={3} placeholder="Conditions under which contract may be terminated..." />
              </div>
            </div>
          </div>

          {/* Document upload */}
          <div>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Contract Documents</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-strong rounded-lg p-5 text-secondary hover:border-accent-500 hover:text-accent-600 transition-colors min-h-[100px]">
                <Upload className="h-5 w-5" />
                <span className="text-xs font-medium">Signed Contract PDF</span>
              </button>
              <button className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-strong rounded-lg p-5 text-secondary hover:border-accent-500 hover:text-accent-600 transition-colors min-h-[100px]">
                <Upload className="h-5 w-5" />
                <span className="text-xs font-medium">Appendix / Annexure</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
