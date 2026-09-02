import { useState } from 'react';
import {
  Users,
  CalendarClock,
  UserX,
  Briefcase,
  DollarSign,
  Clock,
  FileCheck,
  FileWarning,
  Check,
  X,
  ChevronRight,
  Cake,
  Award,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LineChart, BarChart, DonutChart } from '@/components/charts/Charts';

const kpis = [
  { label: 'Total Headcount', value: '1,284', icon: Users, tone: 'accent' as const, trend: { value: '+3.2%', up: true }, sparkData: [20, 22, 21, 25, 28, 30, 32] },
  { label: 'On Leave Today', value: '47', icon: CalendarClock, tone: 'warning' as const, trend: { value: '-5%', up: true }, sparkData: [30, 28, 25, 22, 20, 18, 15] },
  { label: 'Absent / Late Today', value: '23', icon: UserX, tone: 'error' as const, trend: { value: '+1.4%', up: false }, sparkData: [10, 12, 14, 11, 13, 15, 14] },
  { label: 'Working Now', value: '1,214', icon: Briefcase, tone: 'success' as const, trend: { value: '+8.7%', up: true }, sparkData: [40, 42, 45, 48, 50, 52, 55] },
  { label: 'Payroll Cost (Month)', value: '$4.82M', icon: DollarSign, tone: 'accent' as const, trend: { value: '+2.1%', up: false }, sparkData: [30, 32, 34, 36, 38, 40, 42] },
  { label: 'Pending Payroll', value: '$340K', icon: Clock, tone: 'warning' as const, sparkData: [20, 18, 15, 12, 10, 8, 6] },
  { label: 'Pending Approvals', value: '18', icon: FileCheck, tone: 'warning' as const, trend: { value: '+12%', up: false }, sparkData: [5, 8, 10, 12, 15, 18, 20] },
  { label: 'Doc / Contract Expiry', value: '9', icon: FileWarning, tone: 'error' as const, trend: { value: '3 this week', up: false }, sparkData: [2, 3, 5, 4, 6, 7, 9] },
];

const attendanceData = [
  { label: 'Mon', value: 1180 }, { label: 'Tue', value: 1210 }, { label: 'Wed', value: 1195 },
  { label: 'Thu', value: 1225 }, { label: 'Fri', value: 1150 }, { label: 'Sat', value: 480 },
  { label: 'Sun', value: 120 },
];

const deptData = [
  { label: 'Engineering', value: 420, color: '#2563eb' },
  { label: 'Sales', value: 280, color: '#16a34a' },
  { label: 'Marketing', value: 145, color: '#f59e0b' },
  { label: 'Operations', value: 210, color: '#8b5cf6' },
  { label: 'Finance', value: 95, color: '#ef4444' },
  { label: 'HR', value: 134, color: '#06b6d4' },
];

const approvals = [
  { id: 1, name: 'Sarah Chen', type: 'Leave Request', detail: '2 days — Aug 27-28', date: '2m ago' },
  { id: 2, name: 'Marcus Johnson', type: 'Expense Report', detail: '$1,240 — Client dinner', date: '15m ago' },
  { id: 3, name: 'Priya Patel', type: 'Overtime Claim', detail: '8 hours — Aug 24', date: '1h ago' },
  { id: 4, name: 'David Kim', type: 'Leave Request', detail: '1 day — Aug 30', date: '2h ago' },
  { id: 5, name: 'Lisa Wang', type: 'Remote Work', detail: '3 days — Aug 29-31', date: '3h ago' },
];

const upcoming = [
  { id: 1, type: 'contract', text: 'James Park — Contract expires', date: 'In 3 days', icon: FileText, tone: 'error' as const },
  { id: 2, type: 'probation', text: 'Emma Wilson — Probation ending', date: 'In 5 days', icon: Award, tone: 'warning' as const },
  { id: 3, type: 'birthday', text: 'Tom Anderson — Birthday', date: 'Aug 27', icon: Cake, tone: 'accent' as const },
  { id: 4, type: 'anniversary', text: 'Nina Garcia — 5th Anniversary', date: 'Aug 28', icon: Award, tone: 'success' as const },
  { id: 5, type: 'contract', text: 'Robert Lee — Contract expires', date: 'In 7 days', icon: FileText, tone: 'warning' as const },
  { id: 6, type: 'birthday', text: 'Sofia Martinez — Birthday', date: 'Aug 30', icon: Cake, tone: 'accent' as const },
];

export function DashboardPage() {
  const [chartMode, setChartMode] = useState<'line' | 'bar'>('line');
  const [approvalState, setApprovalState] = useState<Record<number, 'approved' | 'rejected' | null>>({});

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Dashboard</h1>
          <p className="text-sm text-secondary mt-0.5">Welcome back, Alex — here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="md">
            <TrendingUp className="h-4 w-4" /> Export Report
          </Button>
          <Button variant="primary" size="md">View Analytics</Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Attendance Trend</CardTitle>
              <p className="text-xs text-muted mt-0.5">Daily headcount present — this week</p>
            </div>
            <div className="flex items-center gap-1 surface-muted rounded-lg p-0.5">
              <button
                onClick={() => setChartMode('line')}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${chartMode === 'line' ? 'surface shadow-sm text-primary font-medium' : 'text-muted'}`}
              >
                Line
              </button>
              <button
                onClick={() => setChartMode('bar')}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${chartMode === 'bar' ? 'surface shadow-sm text-primary font-medium' : 'text-muted'}`}
              >
                Bar
              </button>
            </div>
          </CardHeader>
          <CardBody>
            {chartMode === 'line' ? (
              <LineChart data={attendanceData} color="#2563eb" />
            ) : (
              <BarChart data={attendanceData} color="#2563eb" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Department Headcount</CardTitle>
            <p className="text-xs text-muted mt-0.5">Distribution across departments</p>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col items-center">
              <DonutChart data={deptData} size={180} />
              <div className="mt-4 w-full space-y-2">
                {deptData.map((d) => (
                  <div key={d.label} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="flex-1 text-secondary">{d.label}</span>
                    <span className="text-primary font-medium">{d.value}</span>
                    <span className="text-muted w-10 text-right">{Math.round((d.value / 1284) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Approvals + Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Pending Approvals</CardTitle>
            <Badge tone="warning" dot>{approvals.length} pending</Badge>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-[rgb(var(--border-base))]">
              {approvals.map((a) => {
                const state = approvalState[a.id];
                return (
                  <div key={a.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[rgb(var(--bg-hover))] transition-colors">
                    <div className="h-9 w-9 rounded-lg bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-accent-700 dark:text-accent-300">
                        {a.name.split(' ').map((n) => n[0]).join('')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-primary">{a.name}</div>
                      <div className="text-xs text-secondary">
                        {a.type} · {a.detail}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted hidden sm:block">{a.date}</div>
                    {state ? (
                      <Badge tone={state === 'approved' ? 'success' : 'error'}>{state === 'approved' ? 'Approved' : 'Rejected'}</Badge>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setApprovalState((s) => ({ ...s, [a.id]: 'approved' }))}
                          className="h-7 w-7 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 hover:bg-success-100 dark:hover:bg-success-900/60 flex items-center justify-center transition-colors"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setApprovalState((s) => ({ ...s, [a.id]: 'rejected' }))}
                          className="h-7 w-7 rounded-lg bg-error-50 dark:bg-error-950/40 text-error-600 dark:text-error-400 hover:bg-error-100 dark:hover:bg-error-900/60 flex items-center justify-center transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Upcoming</CardTitle>
            <div className="flex items-center gap-1">
              <Badge tone="neutral">Contracts</Badge>
              <Badge tone="neutral">Probation</Badge>
              <Badge tone="neutral">Events</Badge>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-[rgb(var(--border-base))]">
              {upcoming.map((u) => {
                const Icon = u.icon;
                return (
                  <div key={u.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[rgb(var(--bg-hover))] transition-colors cursor-pointer group">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      u.tone === 'error' ? 'bg-error-50 dark:bg-error-950/40 text-error-600 dark:text-error-400' :
                      u.tone === 'warning' ? 'bg-warning-50 dark:bg-warning-950/40 text-warning-600 dark:text-warning-400' :
                      u.tone === 'success' ? 'bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400' :
                      'bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-primary leading-snug">{u.text}</div>
                      <div className="text-[11px] text-muted mt-0.5">{u.date}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted group-hover:text-primary transition-colors" />
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
