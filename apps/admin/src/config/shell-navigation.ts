/**
 * Admin app shell navigation (NAVIGATION.md §1) with expandable submenus.
 */
import {
  LayoutDashboard,
  Building2,
  Users,
  Clock,
  CalendarDays,
  Palmtree,
  Wallet,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { PageKey } from '@/context/NavContext';
import type { PagePermission } from '@/config/page-permissions';

export interface AdminNavChild {
  label: string;
  page: PageKey;
}

export interface AdminNavItem {
  label: string;
  /** Landing page when clicking the parent row */
  page: PageKey;
  icon: LucideIcon;
  permission: PagePermission;
  children?: AdminNavChild[];
  /** Nested routes that should highlight this group (e.g. emp-profile under Employees). */
  relatedPages?: PageKey[];
}

/** Primary sidebar navigation with working submenus. */
export const adminNavItems: AdminNavItem[] = [
  {
    label: 'Dashboard',
    page: 'dashboard',
    icon: LayoutDashboard,
    permission: { module: 'employee', action: 'view' },
  },
  {
    label: 'Employees',
    page: 'emp-directory',
    icon: Users,
    permission: { module: 'employee', action: 'view' },
    relatedPages: [
      'emp-profile',
      'emp-onboarding',
      'emp-offboarding',
      'candidate-profile',
      'offer-letter',
      'emp-contract-detail',
    ],
    children: [
      { label: 'Directory', page: 'emp-directory' },
      { label: 'Lifecycle Events', page: 'emp-lifecycle' },
      { label: 'Contracts', page: 'emp-contracts' },
      { label: 'Contract Expiry', page: 'emp-contract-expiry' },
      { label: 'Onboarding', page: 'onboarding' },
      { label: 'Onboarding Templates', page: 'onboarding-templates' },
      { label: 'Offboarding', page: 'offboarding' },
      { label: 'Job Requisitions', page: 'recruitment-requisitions' },
      { label: 'Candidate Pipeline', page: 'recruitment' },
      { label: 'Interviews', page: 'recruitment-interviews' },
      { label: 'Document Types', page: 'doc-types' },
      { label: 'Employee Documents', page: 'emp-documents' },
      { label: 'Custom Fields', page: 'field-builder' },
    ],
  },
  {
    label: 'Organization',
    page: 'org-departments',
    icon: Building2,
    permission: { module: 'settings', action: 'view' },
    children: [
      { label: 'Departments', page: 'org-departments' },
      { label: 'Designations', page: 'org-designations' },
      { label: 'Job Levels', page: 'org-job-levels' },
      { label: 'Employment Types', page: 'org-employment-types' },
      { label: 'Teams', page: 'org-teams' },
      { label: 'Cost Centres', page: 'org-cost-centres' },
    ],
  },
  {
    label: 'Attendance',
    page: 'attendance',
    icon: Clock,
    permission: { module: 'attendance', action: 'view' },
    children: [
      { label: 'Daily Attendance', page: 'attendance' },
      { label: 'Timesheets', page: 'timesheet' },
      { label: 'Timesheet Approvals', page: 'timesheet-approvals' },
      { label: 'Shifts', page: 'shifts' },
      { label: 'Holiday Calendar', page: 'holidays' },
    ],
  },
  {
    label: 'Roster',
    page: 'roster',
    icon: CalendarDays,
    permission: { module: 'attendance', action: 'view' },
    children: [{ label: 'Roster Calendar', page: 'roster' }],
  },
  {
    label: 'Leave',
    page: 'leave-requests',
    icon: Palmtree,
    permission: { module: 'leave', action: 'view' },
    children: [
      { label: 'Leave Requests', page: 'leave-requests' },
      { label: 'Leave Types & Policies', page: 'leave-types' },
      { label: 'Leave Balances', page: 'leave-balance' },
    ],
  },
  {
    label: 'Payroll',
    page: 'payroll-runs',
    icon: Wallet,
    permission: { module: 'payroll', action: 'view' },
    relatedPages: ['loan-detail', 'expense-detail'],
    children: [
      { label: 'Pay Runs', page: 'payroll-runs' },
      { label: 'Pay Schedules', page: 'pay-schedules' },
      { label: 'Salary Components', page: 'salary-components' },
      { label: 'Salary Structures', page: 'salary-structures' },
      { label: 'Payslips', page: 'payslips' },
      { label: 'Payroll Simulator', page: 'payroll-simulation' },
      { label: 'Payment Batches', page: 'payment-batches' },
      { label: 'Tax Profiles', page: 'tax-profiles' },
      { label: 'Benefits', page: 'benefits' },
      { label: 'Benefit Plans', page: 'benefit-plans' },
      { label: 'Benefit Enrollments', page: 'benefit-enrollments' },
      { label: 'Superannuation', page: 'superannuation' },
      { label: 'Loans & Advances', page: 'loans' },
      { label: 'Expense Claims', page: 'expenses' },
      { label: 'Expense Categories', page: 'expense-categories' },
    ],
  },
  {
    label: 'Reports',
    page: 'reports-hub',
    icon: BarChart3,
    permission: { module: 'employee', action: 'view' },
    children: [
      { label: 'Reports', page: 'reports-hub' },
      { label: 'Scheduled Reports', page: 'reports-scheduled' },
      { label: 'Data Import', page: 'data-import' },
      { label: 'Data Export', page: 'data-export' },
    ],
  },
  {
    label: 'Settings',
    page: 'settings-hub',
    icon: Settings,
    permission: { module: 'settings', action: 'view' },
    relatedPages: ['settings-workflow-builder'],
    children: [
      { label: 'Settings Hub', page: 'settings-hub' },
      { label: 'Roles', page: 'rbac-roles' },
      { label: 'Permission Matrix', page: 'rbac-matrix' },
      { label: 'Workflows', page: 'settings-workflows' },
      { label: 'Notifications', page: 'settings-notifications' },
      { label: 'Integrations', page: 'settings-integrations' },
      { label: 'Security', page: 'settings-security' },
      { label: 'Audit Log', page: 'audit-log' },
      { label: 'Plan & Usage', page: 'billing' },
    ],
  },
];

/** Whether `page` belongs to a nav item (parent, child, or related route). */
export function navItemContainsPage(item: AdminNavItem, page: PageKey): boolean {
  if (item.page === page) return true;
  if (item.relatedPages?.includes(page)) return true;
  return item.children?.some((child) => child.page === page) ?? false;
}
