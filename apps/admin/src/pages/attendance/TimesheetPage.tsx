import { useState } from 'react';
import { Check, X, DollarSign, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Toggle';
import { Toggle } from '@/components/ui/Toggle';

interface TimesheetEntry {
  id: string;
  employeeName: string;
  employeeId: string;
  project: string;
  task: string;
  hours: number;
  billable: boolean;
  status: 'Pending' | 'Approved' | 'Rejected';
}

const initialEntries: TimesheetEntry[] = [
  { id: 'ts1', employeeName: 'Sarah Chen', employeeId: 'EMP-001', project: 'Platform Redesign', task: 'API development', hours: 6, billable: true, status: 'Approved' },
  { id: 'ts2', employeeName: 'Sarah Chen', employeeId: 'EMP-001', project: 'Internal Tools', task: 'Code review', hours: 2, billable: false, status: 'Approved' },
  { id: 'ts3', employeeName: 'Lisa Wang', employeeId: 'EMP-005', project: 'Mobile App', task: 'Bug fixes', hours: 5, billable: true, status: 'Pending' },
  { id: 'ts4', employeeName: 'Lisa Wang', employeeId: 'EMP-005', project: 'Platform Redesign', task: 'Database migration', hours: 3, billable: true, status: 'Pending' },
  { id: 'ts5', employeeName: 'Nina Garcia', employeeId: 'EMP-009', project: 'QA Automation', task: 'Test suite update', hours: 4, billable: true, status: 'Pending' },
  { id: 'ts6', employeeName: 'Nina Garcia', employeeId: 'EMP-009', project: 'Internal Tools', task: 'CI/CD pipeline', hours: 2, billable: false, status: 'Approved' },
  { id: 'ts7', employeeName: 'David Kim', employeeId: 'EMP-006', project: 'Client: Globex', task: 'Sales call prep', hours: 3, billable: true, status: 'Rejected' },
  { id: 'ts8', employeeName: 'Emma Wilson', employeeId: 'EMP-007', project: 'Client: Initech', task: 'Contract negotiation', hours: 4, billable: true, status: 'Pending' },
];

const statusTone: Record<TimesheetEntry['status'], 'warning' | 'success' | 'error'> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'error',
};

export function TimesheetPage() {
  const [entries, setEntries] = useState(initialEntries);

  const handleAction = (id: string, action: 'Approved' | 'Rejected') => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status: action } : e)));
  };

  const toggleBillable = (id: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, billable: !e.billable } : e)));
  };

  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const billableHours = entries.filter((e) => e.billable).reduce((s, e) => s + e.hours, 0);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Weekly Timesheet</h1>
          <p className="text-sm text-secondary mt-0.5">Week of August 26 — September 1, 2024</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center surface border border-base rounded-lg overflow-hidden">
            <button className="p-2 text-secondary hover:bg-[rgb(var(--bg-hover))]"><ChevronLeft className="h-4 w-4" /></button>
            <span className="px-3 text-xs text-secondary">Aug 26 – Sep 1</span>
            <button className="p-2 text-secondary hover:bg-[rgb(var(--bg-hover))]"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <Button variant="primary"><Check className="h-4 w-4" /> Submit Week</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Hours', value: `${totalHours}h`, icon: Clock, tone: 'bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400' },
          { label: 'Billable Hours', value: `${billableHours}h`, icon: DollarSign, tone: 'bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400' },
          { label: 'Non-Billable', value: `${totalHours - billableHours}h`, icon: Clock, tone: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="surface rounded-xl border shadow-card p-4">
              <div className={`h-9 w-9 rounded-lg ${s.tone} flex items-center justify-center mb-3`}>
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <div className="text-2xl font-bold text-primary">{s.value}</div>
              <div className="text-xs text-secondary mt-0.5">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Timesheet table */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Time Entries</CardTitle>
          <Badge tone="neutral">{entries.length} entries</Badge>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Employee</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">Project</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden lg:table-cell">Task</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Hours</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Billable</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Status</th>
                  <th className="w-20 px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={entry.employeeName} size="sm" />
                        <div className="text-sm font-medium text-primary">{entry.employeeName}</div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-secondary hidden md:table-cell">{entry.project}</td>
                    <td className="px-5 py-3 text-secondary hidden lg:table-cell">{entry.task}</td>
                    <td className="px-5 py-3"><span className="flex items-center gap-1 text-primary font-medium"><Clock className="h-3.5 w-3.5 text-muted" /> {entry.hours}h</span></td>
                    <td className="px-5 py-3"><Toggle checked={entry.billable} onChange={() => toggleBillable(entry.id)} size="sm" /></td>
                    <td className="px-5 py-3"><Badge tone={statusTone[entry.status]} dot>{entry.status}</Badge></td>
                    <td className="px-5 py-3">
                      {entry.status === 'Pending' ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleAction(entry.id, 'Approved')} className="h-7 w-7 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 hover:bg-success-100 flex items-center justify-center transition-colors"><Check className="h-4 w-4" /></button>
                          <button onClick={() => handleAction(entry.id, 'Rejected')} className="h-7 w-7 rounded-lg bg-error-50 dark:bg-error-950/40 text-error-600 dark:text-error-400 hover:bg-error-100 flex items-center justify-center transition-colors"><X className="h-4 w-4" /></button>
                        </div>
                      ) : <span className="text-muted text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
