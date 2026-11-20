import type { AttendanceDayRecord } from './attendance';
import type { CompanyAnnouncementRecord, EmployeeKudosRecord, EngagementSurveyListItem } from './engagement';
import type { InAppNotificationRecord } from './notifications';
import type { LeaveBalanceRecord, LeaveRequestRecord } from './leave';
import type { PayslipRecord } from './payroll';
import type { RosterRecord } from './roster';

export interface AdminDashboardKpis {
  headcount: number;
  onLeaveToday: number;
  absentLateToday: number;
  workingNow: number;
  payrollCostMonth: number;
  pendingPayroll: number;
  pendingApprovals: number;
  expiryAlerts: number;
}

export interface AdminDepartmentHeadcount {
  departmentId: string | null;
  departmentName: string;
  count: number;
}

export interface AdminAttendanceTrendPoint {
  date: string;
  presentCount: number;
}

export interface AdminPendingApprovalItem {
  id: string;
  type: 'leave_request' | 'payroll_adjustment' | 'payroll_run' | 'attendance_review';
  title: string;
  detail: string;
  employeeName: string | null;
  createdAt: string;
}

export interface AdminExpiryItem {
  id: string;
  type: 'document' | 'probation' | 'contract' | 'certification';
  employeeId: string;
  employeeName: string;
  label: string;
  expiryDate: string;
  daysUntil: number;
}

export interface AdminDashboardView {
  asOf: string;
  currency: string;
  kpis: AdminDashboardKpis;
  departmentHeadcount: AdminDepartmentHeadcount[];
  attendanceTrend: AdminAttendanceTrendPoint[];
  pendingApprovals: AdminPendingApprovalItem[];
  expiryItems: AdminExpiryItem[];
  /** Company's contract expiry window; documents, certifications and probation use 30 days. */
  contractExpiryWindowDays: number;
}

export interface EmployeeDashboardView {
  asOf: string;
  todayShift: RosterRecord | null;
  attendance: AttendanceDayRecord;
  leaveBalances: LeaveBalanceRecord[];
  upcomingLeave: LeaveRequestRecord[];
  latestPayslip: PayslipRecord | null;
  notifications: InAppNotificationRecord[];
  unreadNotificationCount: number;
  announcements: CompanyAnnouncementRecord[];
  activeSurveys: EngagementSurveyListItem[];
  kudosFeed: EmployeeKudosRecord[];
}

export interface PlatformTenantsByStatus {
  trial: number;
  active: number;
  suspended: number;
  cancelled: number;
  total: number;
}

export interface PlatformNewTenantsPerWeek {
  weekStart: string;
  weekEnd: string;
  count: number;
  weekLabel: string;
}

export interface PlatformTenantApproachingLimit {
  tenantId: string;
  name: string;
  subdomain: string;
  plan: string;
  employeeCount: number;
  limit: number;
  usagePercentage: number;
}

export type PlatformNeedsAttentionType = 'failed_payment' | 'over_limit' | 'expiring_trial';

export interface PlatformNeedsAttentionItem {
  id: string;
  type: PlatformNeedsAttentionType;
  tenantId: string;
  tenantName: string;
  subdomain: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  metric?: string;
  dueDate?: string;
  actionLabel?: string;
}

export interface PlatformDashboardView {
  asOf: string;
  tenantsByStatus: PlatformTenantsByStatus;
  totalActiveEmployees: number;
  mrr: number;
  arr: number;
  newTenantsPerWeek: PlatformNewTenantsPerWeek[];
  tenantsApproachingLimits: PlatformTenantApproachingLimit[];
  needsAttention: PlatformNeedsAttentionItem[];
  failedPaymentsCount: number;
  openSupportTicketsCount: number;
  last24hErrorRate: number;
  cached?: boolean;
  cachedAt?: string;
  cacheTtlSeconds?: number;
}

