import { useCallback, useEffect, useState } from 'react';
import {
  Users,
  CalendarClock,
  UserX,
  Briefcase,
  DollarSign,
  Clock,
  FileCheck,
  FileWarning,
  ChevronRight,
  FileText,
  Award,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LineChart, BarChart, DonutChart } from '@/components/charts/Charts';
import { useCompany } from '@/context/CompanyContext';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import {
  formatDashboardCurrency,
  formatRelativeTime,
} from '@/lib/dashboard-api';

const CHART_COLORS = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#64748b',
];

export function DashboardPage() {
  const { company, companyId } = useCompany();
  const { data, loading, error, refresh } = useAdminDashboard(companyId);
  const [chartMode, setChartMode] = useState<'line' | 'bar'>('line');

  const kpis: Array<{
    label: string;
    value: string;
    icon: LucideIcon;
    tone: 'accent' | 'success' | 'warning' | 'error';
  }> = data
    ? [
        {
          label: 'Total Headcount',
          value: String(data.kpis.headcount),
          icon: Users,
          tone: 'accent',
        },
        {
          label: 'On Leave Today',
          value: String(data.kpis.onLeaveToday),
          icon: CalendarClock,
          tone: 'warning',
        },
        {
          label: 'Absent / Late Today',
          value: String(data.kpis.absentLateToday),
          icon: UserX,
          tone: 'error',
        },
        {
          label: 'Working Now',
          value: String(data.kpis.workingNow),
          icon: Briefcase,
          tone: 'success',
        },
        {
          label: 'Payroll Cost (Month)',
          value: formatDashboardCurrency(
            data.kpis.payrollCostMonth,
            data.currency,
          ),
          icon: DollarSign,
          tone: 'accent',
        },
        {
          label: 'Pending Payroll',
          value: formatDashboardCurrency(
            data.kpis.pendingPayroll,
            data.currency,
          ),
          icon: Clock,
          tone: 'warning',
        },
        {
          label: 'Pending Approvals',
          value: String(data.kpis.pendingApprovals),
          icon: FileCheck,
          tone: 'warning',
        },
        {
          label: 'Doc / Contract Expiry',
          value: String(data.kpis.expiryAlerts),
          icon: FileWarning,
          tone: 'error',
        },
      ]
    : [];

  const attendanceData =
    data?.attendanceTrend.map((point) => ({
      label: new Date(`${point.date}T00:00:00Z`).toLocaleDateString(undefined, {
        weekday: 'short',
      }),
      value: point.presentCount,
    })) ?? [];

  const deptData =
    data?.departmentHeadcount.map((dept, index) => ({
      label: dept.departmentName,
      value: dept.count,
      color: CHART_COLORS[index % CHART_COLORS.length]!,
    })) ?? [];

  const totalDept = deptData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Dashboard</h1>
          <p className="text-sm text-secondary mt-0.5">
            {company?.name ?? 'Company overview'} — live metrics from HR, attendance, leave, and payroll.
          </p>
        </div>
        <Button
          variant="secondary"
          size="md"
          disabled={loading || !companyId}
          onClick={() => void refresh()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Attendance Trend</CardTitle>
                  <p className="text-xs text-muted mt-0.5">
                    Employees present — last 7 days
                  </p>
                </div>
                <div className="flex items-center gap-1 surface-muted rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setChartMode('line')}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${chartMode === 'line' ? 'surface shadow-sm text-primary font-medium' : 'text-muted'}`}
                  >
                    Line
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode('bar')}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${chartMode === 'bar' ? 'surface shadow-sm text-primary font-medium' : 'text-muted'}`}
                  >
                    Bar
                  </button>
                </div>
              </CardHeader>
              <CardBody>
                {attendanceData.length > 0 ? (
                  chartMode === 'line' ? (
                    <LineChart data={attendanceData} color="#2563eb" />
                  ) : (
                    <BarChart data={attendanceData} color="#2563eb" />
                  )
                ) : (
                  <p className="text-sm text-muted py-8 text-center">
                    No attendance records yet for this period.
                  </p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Department Headcount</CardTitle>
                <p className="text-xs text-muted mt-0.5">
                  Active employees by department
                </p>
              </CardHeader>
              <CardBody>
                {deptData.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <DonutChart data={deptData} size={180} />
                    <div className="mt-4 w-full space-y-2">
                      {deptData.map((d) => (
                        <div key={d.label} className="flex items-center gap-2 text-xs">
                          <span
                            className="h-2.5 w-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: d.color }}
                          />
                          <span className="flex-1 text-secondary">{d.label}</span>
                          <span className="text-primary font-medium">{d.value}</span>
                          <span className="text-muted w-10 text-right">
                            {totalDept > 0
                              ? `${Math.round((d.value / totalDept) * 100)}%`
                              : '0%'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted py-8 text-center">
                    No active employees to display.
                  </p>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Pending Approvals</CardTitle>
                <Badge tone="warning" dot>
                  {data?.pendingApprovals.length ?? 0} shown
                </Badge>
              </CardHeader>
              <CardBody className="p-0">
                {(data?.pendingApprovals.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted px-5 py-8 text-center">
                    No pending approvals right now.
                  </p>
                ) : (
                  <div className="divide-y divide-[rgb(var(--border-base))]">
                    {data!.pendingApprovals.map((item) => (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-[rgb(var(--bg-hover))] transition-colors"
                      >
                        <div className="h-9 w-9 rounded-lg bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-accent-700 dark:text-accent-300">
                            {(item.employeeName ?? item.title)
                              .split(' ')
                              .map((part) => part[0])
                              .join('')
                              .slice(0, 2)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-primary">
                            {item.employeeName ?? item.title}
                          </div>
                          <div className="text-xs text-secondary">
                            {item.title} · {item.detail}
                          </div>
                        </div>
                        <div className="text-[11px] text-muted hidden sm:block">
                          {formatRelativeTime(item.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Document & Contract Expiry</CardTitle>
                <Badge tone="error" dot>
                  Next {30} days
                </Badge>
              </CardHeader>
              <CardBody className="p-0">
                {(data?.expiryItems.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted px-5 py-8 text-center">
                    No documents or contracts expiring soon.
                  </p>
                ) : (
                  <div className="divide-y divide-[rgb(var(--border-base))]">
                    {data!.expiryItems.map((item) => {
                      const Icon =
                        item.type === 'document'
                          ? FileText
                          : item.type === 'probation'
                            ? Award
                            : FileText;
                      const tone =
                        item.daysUntil <= 7
                          ? 'error'
                          : item.daysUntil <= 14
                            ? 'warning'
                            : 'accent';
                      return (
                        <div
                          key={`${item.type}-${item.id}`}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-[rgb(var(--bg-hover))] transition-colors"
                        >
                          <div
                            className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                              tone === 'error'
                                ? 'bg-error-50 dark:bg-error-950/40 text-error-600 dark:text-error-400'
                                : tone === 'warning'
                                  ? 'bg-warning-50 dark:bg-warning-950/40 text-warning-600 dark:text-warning-400'
                                  : 'bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-primary leading-snug">
                              {item.employeeName} — {item.label}
                            </div>
                            <div className="text-[11px] text-muted mt-0.5">
                              {item.daysUntil === 0
                                ? 'Today'
                                : `In ${item.daysUntil} day${item.daysUntil === 1 ? '' : 's'}`}{' '}
                              · {item.expiryDate}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
