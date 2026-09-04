import type { AttendanceDayRecord } from './attendance';
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
  type: 'document' | 'probation' | 'contract';
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
}
