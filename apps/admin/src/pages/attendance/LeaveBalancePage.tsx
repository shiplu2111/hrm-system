import { Search } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Toggle';
import { ProgressBar } from '@/components/ui/Progress';
import { useState } from 'react';

interface LeaveBalance {
  id: string;
  employeeName: string;
  employeeId: string;
  department: string;
  balances: { type: string; used: number; total: number; color: string }[];
}

const balances: LeaveBalance[] = [
  { id: '1', employeeName: 'Sarah Chen', employeeId: 'EMP-001', department: 'Engineering', balances: [
    { type: 'Annual', used: 12, total: 25, color: 'accent' },
    { type: 'Sick', used: 3, total: 12, color: 'error' },
    { type: 'Personal', used: 1, total: 5, color: 'warning' },
  ]},
  { id: '2', employeeName: 'Marcus Johnson', employeeId: 'EMP-002', department: 'Sales', balances: [
    { type: 'Annual', used: 18, total: 25, color: 'accent' },
    { type: 'Sick', used: 5, total: 12, color: 'error' },
    { type: 'Personal', used: 3, total: 5, color: 'warning' },
  ]},
  { id: '3', employeeName: 'Priya Patel', employeeId: 'EMP-003', department: 'Marketing', balances: [
    { type: 'Annual', used: 8, total: 25, color: 'accent' },
    { type: 'Sick', used: 2, total: 12, color: 'error' },
    { type: 'Personal', used: 0, total: 5, color: 'warning' },
  ]},
  { id: '4', employeeName: 'Lisa Wang', employeeId: 'EMP-005', department: 'Engineering', balances: [
    { type: 'Annual', used: 20, total: 25, color: 'accent' },
    { type: 'Sick', used: 7, total: 12, color: 'error' },
    { type: 'Personal', used: 4, total: 5, color: 'warning' },
  ]},
  { id: '5', employeeName: 'David Kim', employeeId: 'EMP-006', department: 'Sales', balances: [
    { type: 'Annual', used: 5, total: 25, color: 'accent' },
    { type: 'Sick', used: 1, total: 12, color: 'error' },
    { type: 'Personal', used: 2, total: 5, color: 'warning' },
  ]},
];

export function LeaveBalancePage() {
  const [search, setSearch] = useState('');
  const filtered = balances.filter((b) => b.employeeName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-xl font-bold text-primary">Leave Balance Dashboard</h1>
        <p className="text-sm text-secondary mt-0.5">Per-employee leave entitlement and usage overview</p>
      </div>

      <div className="relative w-64 max-w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee..." className="pl-9" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((emp) => (
          <Card key={emp.id}>
            <CardBody>
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={emp.employeeName} size="md" />
                <div>
                  <div className="text-sm font-semibold text-primary">{emp.employeeName}</div>
                  <div className="text-xs text-muted">{emp.employeeId} · {emp.department}</div>
                </div>
              </div>
              <div className="space-y-3">
                {emp.balances.map((b) => {
                  const remaining = b.total - b.used;
                  const pct = (b.used / b.total) * 100;
                  return (
                    <div key={b.type}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-secondary font-medium">{b.type} Leave</span>
                        <span className="text-muted">
                          <span className="text-primary font-medium">{remaining}</span> / {b.total} days left
                        </span>
                      </div>
                      <ProgressBar value={pct} tone={b.color} />
                      <div className="flex items-center justify-between text-[10px] text-muted mt-1">
                        <span>Used: {b.used}</span>
                        <span>{Math.round(pct)}% used</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
