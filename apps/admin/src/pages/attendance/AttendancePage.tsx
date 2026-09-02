import { useState } from 'react';
import {
  Search,
  Calendar,
  Clock,
  Check,
  X,
  AlertCircle,
  Coffee,
  MapPin,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Toggle';
import { useNav } from '@/context/NavContext';
import { attendanceRecords, type AttendanceStatus, type AttendanceRecord } from '@/data/attendanceData';

const statusTone: Record<AttendanceStatus, 'success' | 'error' | 'warning' | 'accent' | 'info' | 'neutral'> = {
  Present: 'success',
  Absent: 'error',
  Late: 'warning',
  'Early Leave': 'warning',
  'Half Day': 'warning',
  WFH: 'info',
  'Business Trip': 'accent',
  'On Leave': 'neutral',
};

export function AttendancePage() {
  const { navigate } = useNav();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  const departments = [...new Set(attendanceRecords.map((r) => r.department))];

  const filtered = attendanceRecords.filter((r) => {
    if (search && !r.employeeName.toLowerCase().includes(search.toLowerCase())) return false;
    if (deptFilter !== 'all' && r.department !== deptFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const summary = {
    present: attendanceRecords.filter((r) => r.status === 'Present').length,
    late: attendanceRecords.filter((r) => r.status === 'Late').length,
    absent: attendanceRecords.filter((r) => r.status === 'Absent').length,
    wfh: attendanceRecords.filter((r) => r.status === 'WFH').length,
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Attendance Dashboard</h1>
          <p className="text-sm text-secondary mt-0.5">Daily attendance overview — August 25, 2024</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate('attendance-regularization')}>Regularization Requests</Button>
          <Button variant="primary"><TrendingUp className="h-4 w-4" /> Export Report</Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Present', value: summary.present, icon: Check, tone: 'bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400' },
          { label: 'Late', value: summary.late, icon: Clock, tone: 'bg-warning-50 dark:bg-warning-950/40 text-warning-600 dark:text-warning-400' },
          { label: 'Absent', value: summary.absent, icon: X, tone: 'bg-error-50 dark:bg-error-950/40 text-error-600 dark:text-error-400' },
          { label: 'WFH / Remote', value: summary.wfh, icon: Users, tone: 'bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400' },
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

      {/* Filters */}
      <Card>
        <CardBody className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee..." className="pl-9" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="w-auto h-9">
              <option value="all">All Departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto h-9">
              <option value="all">All Status</option>
              <option>Present</option><option>Late</option><option>Absent</option>
              <option>Early Leave</option><option>Half Day</option><option>WFH</option>
              <option>Business Trip</option><option>On Leave</option>
            </Select>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
              <Input type="date" defaultValue="2024-08-25" className="pl-9 w-auto h-9" />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Attendance table */}
      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Employee</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">Clock In</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">Clock Out</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden lg:table-cell">Total Hours</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden lg:table-cell">OT</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden xl:table-cell">Location</th>
                  <th className="w-20 px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors cursor-pointer" onClick={() => setSelectedRecord(r)}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.employeeName} size="sm" />
                        <div>
                          <div className="font-medium text-primary">{r.employeeName}</div>
                          <div className="text-xs text-muted">{r.employeeId} · {r.department}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3"><Badge tone={statusTone[r.status]} dot>{r.status}</Badge></td>
                    <td className="px-5 py-3 text-secondary hidden md:table-cell">{r.clockIn}</td>
                    <td className="px-5 py-3 text-secondary hidden md:table-cell">{r.clockOut}</td>
                    <td className="px-5 py-3 text-secondary hidden lg:table-cell">{r.totalHours}</td>
                    <td className="px-5 py-3 hidden lg:table-cell">{r.overtime !== '0h' ? <Badge tone="accent">{r.overtime}</Badge> : <span className="text-muted text-xs">—</span>}</td>
                    <td className="px-5 py-3 text-secondary hidden xl:table-cell flex items-center gap-1"><MapPin className="h-3 w-3 text-muted" /> {r.location}</td>
                    <td className="px-5 py-3"><Button variant="ghost" size="sm">Detail</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Detail modal */}
      <Modal
        open={selectedRecord !== null}
        onClose={() => setSelectedRecord(null)}
        title="Attendance Detail"
        size="lg"
        footer={<Button variant="secondary" onClick={() => setSelectedRecord(null)}>Close</Button>}
      >
        {selectedRecord && (
          <div className="space-y-5">
            {/* Employee header */}
            <div className="flex items-center gap-3">
              <Avatar name={selectedRecord.employeeName} size="lg" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-primary">{selectedRecord.employeeName}</span>
                  <Badge tone={statusTone[selectedRecord.status]} dot>{selectedRecord.status}</Badge>
                </div>
                <div className="text-xs text-muted">{selectedRecord.employeeId} · {selectedRecord.department}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted">Date</div>
                <div className="text-sm font-medium text-primary">Aug 25, 2024</div>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Daily Timeline</div>
              <div className="relative">
                <div className="absolute left-[19px] top-4 bottom-4 w-px bg-[rgb(var(--border-base))]" />
                <div className="space-y-4">
                  {[
                    { time: selectedRecord.clockIn, label: 'Clock In', icon: Clock, tone: 'bg-success-100 text-success-700 dark:bg-success-950/40 dark:text-success-300', desc: selectedRecord.location },
                    { time: '12:00', label: 'Break Start', icon: Coffee, tone: 'bg-warning-100 text-warning-700 dark:bg-warning-950/40 dark:text-warning-300', desc: `${selectedRecord.breakTime} break` },
                    { time: '13:00', label: 'Break End', icon: Coffee, tone: 'bg-warning-100 text-warning-700 dark:bg-warning-950/40 dark:text-warning-300', desc: 'Resumed work' },
                    { time: selectedRecord.clockOut, label: 'Clock Out', icon: Clock, tone: 'bg-error-100 text-error-700 dark:bg-error-950/40 dark:text-error-300', desc: selectedRecord.location },
                  ].map((evt, i) => {
                    const Icon = evt.icon;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${evt.tone}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-primary">{evt.label}</div>
                            <div className="text-xs text-muted">{evt.desc}</div>
                          </div>
                          <div className="text-sm font-medium text-secondary">{evt.time}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Working Hours', value: selectedRecord.totalHours, icon: Clock },
                { label: 'Overtime', value: selectedRecord.overtime, icon: TrendingUp },
                { label: 'Break Time', value: selectedRecord.breakTime, icon: Coffee },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="surface border border-base rounded-lg p-3 text-center">
                    <Icon className="h-4 w-4 text-muted mx-auto mb-1.5" />
                    <div className="text-lg font-bold text-primary">{s.value}</div>
                    <div className="text-[10px] text-muted mt-0.5">{s.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
