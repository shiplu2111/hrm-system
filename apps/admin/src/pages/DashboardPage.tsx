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
  ChevronRight,
  FileText,
  Award,
  RefreshCw,
  AlertCircle,
  BellRing,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { DashboardOnboardingEmpty } from '@/components/dashboard/DashboardOnboardingEmpty';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LineChart, BarChart, DonutChart } from '@/components/charts/Charts';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import {
  formatDashboardCurrency,
  formatRelativeTime,
} from '@/lib/dashboard-api';
import {
  expiryItemTypeLabel,
  expiryUrgencyBadge,
  pendingApprovalBadge,
} from '@/lib/dashboard-status';

const CHART_COLORS = [
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#8b5cf6',
  '#dc2626',
  '#06b6d4',
  '#ec4899',
  '#64748b',
];

const KPI_CONFIG: Array<{
  key: keyof import('@hrm/shared-types').AdminDashboardKpis;
  label: string;
  icon: LucideIcon;
  tone: 'accent' | 'success' | 'warning' | 'error';
  format: 'number' | 'currency';
}> = [
  { key: 'headcount', label: 'Total Headcount', icon: Users, tone: 'accent', format: 'number' },
  { key: 'onLeaveToday', label: 'On Leave Today', icon: CalendarClock, tone: 'warning', format: 'number' },
  { key: 'absentLateToday', label: 'Absent / Late Today', icon: UserX, tone: 'error', format: 'number' },
  { key: 'workingNow', label: 'Working Now', icon: Briefcase, tone: 'success', format: 'number' },
  { key: 'payrollCostMonth', label: 'Payroll Cost (Month)', icon: DollarSign, tone: 'accent', format: 'currency' },
  { key: 'pendingPayroll', label: 'Pending Payroll', icon: Clock, tone: 'warning', format: 'currency' },
  { key: 'pendingApprovals', label: 'Pending Approvals', icon: FileCheck, tone: 'warning', format: 'number' },
  { key: 'expiryAlerts', label: 'Doc / Contract Expiry', icon: FileWarning, tone: 'error', format: 'number' },
];

function formatKpiValue(
  value: number,
  format: 'number' | 'currency',
  currency: string,
): string {
  if (format === 'currency') {
    return formatDashboardCurrency(value, currency);
  }
  return value.toLocaleString();
}

export function DashboardPage() {
  const {
    company,
    companyId,
    loading: companyLoading,
    error: companyError,
    refresh: refreshCompany,
  } = useCompany();
  const { navigate, openContract, openEmployee } = useNav();
  const { data, loading, error, refresh } = useAdminDashboard(companyId);
  const [chartMode, setChartMode] = useState<'line' | 'bar'>('line');

  const pageError = companyError ?? error;
  const retry = companyError ? refreshCompany : refresh;
  const noCompany = !companyLoading && !companyError && !companyId;
  const isInitialLoad = companyLoading || (loading && !data);
  const isRefreshing = loading && !!data;
  const isFreshTenant = data?.kpis.headcount === 0;

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
  const hasAttendanceData = attendanceData.some((point) => point.value > 0);

  const asOfLabel = data?.asOf
    ? new Date(data.asOf).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Dashboard</h1>
          <p className="text-sm text-secondary mt-0.5">
            {company?.name ?? 'Company overview'} — live metrics from HR, attendance, leave, and payroll.
          </p>
          {asOfLabel ? (
            <p className="text-xs text-muted mt-1">Last updated {asOfLabel}</p>
          ) : null}
        </div>
        <Button
          variant="secondary"
          size="md"
          disabled={loading || !companyId}
          onClick={() => void refresh()}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {pageError ? (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3"
        >
          <div className="flex items-start gap-2 flex-1">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{pageError}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void retry()}>
            Retry
          </Button>
        </div>
      ) : null}

      {isInitialLoad ? (
        <DashboardSkeleton />
      ) : noCompany ? (
        <EmptyState
          icon={Briefcase}
          title="No company found"
          description="No company is set up for this tenant yet."
        />
      ) : data ? (
        <div className={isRefreshing ? 'opacity-60 pointer-events-none transition-opacity' : undefined}>
          {isFreshTenant ? (
            <DashboardOnboardingEmpty />
          ) : (
            <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {KPI_CONFIG.map((kpi) => (
              <KpiCard
                key={kpi.key}
                label={kpi.label}
                value={formatKpiValue(data.kpis[kpi.key], kpi.format, data.currency)}
                icon={kpi.icon}
                tone={kpi.tone}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
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
                {hasAttendanceData ? (
                  chartMode === 'line' ? (
                    <LineChart data={attendanceData} color="rgb(37 99 235)" />
                  ) : (
                    <BarChart data={attendanceData} color="rgb(37 99 235)" />
                  )
                ) : (
                  <EmptyState
                    compact
                    icon={CalendarClock}
                    title="No attendance data yet"
                    description="Attendance trends appear once employees clock in or records are imported."
                  />
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
                  <EmptyState
                    compact
                    icon={Users}
                    title="No active employees"
                    description="Add employees to see headcount by department."
                    action={{
                      label: 'Go to Employee Directory',
                      onClick: () => navigate('emp-directory'),
                    }}
                  />
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Pending Approvals</CardTitle>
                <Badge tone="warning" dot>
                  {data.pendingApprovals.length} shown
                </Badge>
              </CardHeader>
              <CardBody className="p-0">
                {data.pendingApprovals.length === 0 ? (
                  <EmptyState
                    compact
                    icon={FileCheck}
                    title="No pending approvals"
                    description="Leave requests, payroll adjustments, and other items awaiting action will show up here."
                  />
                ) : (
                  <div className="divide-y divide-[rgb(var(--border-base))]">
                    {data.pendingApprovals.map((item) => {
                      const status = pendingApprovalBadge(item.type);
                      return (
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
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-primary">
                                {item.employeeName ?? item.title}
                              </span>
                              <Badge tone={status.tone} dot>
                                {status.label}
                              </Badge>
                            </div>
                            <div className="text-xs text-secondary mt-0.5">
                              {item.title} · {item.detail}
                            </div>
                          </div>
                          <div className="text-[11px] text-muted hidden sm:block shrink-0">
                            {formatRelativeTime(item.createdAt)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Document & Contract Expiry</CardTitle>
                  <p className="text-xs text-muted mt-0.5">
                    Next 30 days
                    {data.contractExpiryWindowDays !== 30
                      ? ` · contracts ${data.contractExpiryWindowDays} days`
                      : ''}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('emp-contract-expiry')}>
                  <BellRing className="h-4 w-4" /> Contract alerts
                </Button>
              </CardHeader>
              <CardBody className="p-0">
                {data.expiryItems.length === 0 ? (
                  <EmptyState
                    compact
                    icon={FileWarning}
                    title="Nothing expiring soon"
                    description="Documents, contracts, and certifications due in the next 30 days will appear here."
                  />
                ) : (
                  <div className="divide-y divide-[rgb(var(--border-base))]">
                    {data.expiryItems.map((item) => {
                      const Icon =
                        item.type === 'document'
                          ? FileText
                          : item.type === 'certification' || item.type === 'probation'
                            ? Award
                            : FileText;
                      const urgency = expiryUrgencyBadge(item.daysUntil);
                      const iconTone =
                        urgency.tone === 'error'
                          ? 'bg-error-50 dark:bg-error-950/40 text-error-600 dark:text-error-400'
                          : urgency.tone === 'warning'
                            ? 'bg-warning-50 dark:bg-warning-950/40 text-warning-600 dark:text-warning-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';

                      return (
                        <button
                          type="button"
                          key={`${item.type}-${item.id}`}
                          onClick={() =>
                            item.type === 'contract'
                              ? openContract(item.id)
                              : openEmployee(item.employeeId)
                          }
                          className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-[rgb(var(--bg-hover))] transition-colors"
                        >
                          <div
                            className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${iconTone}`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-primary leading-snug">
                                {item.employeeName} — {item.label}
                              </span>
                              <Badge tone={urgency.tone}>{urgency.label}</Badge>
                            </div>
                            <div className="text-[11px] text-muted mt-0.5">
                              {expiryItemTypeLabel(item.type)} · expires {item.expiryDate}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted shrink-0" />
                        </button>
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
      ) : null}
    </div>
  );
}
