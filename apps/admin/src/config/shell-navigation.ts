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
  UserCircle,
  LifeBuoy,
  Target,
  GraduationCap,
  type LucideIcon,
} from 'lucide-react';
import type { PageKey } from '@/context/NavContext';
import type { PagePermission } from '@/config/page-permissions';

export interface AdminNavChild {
  label: string;
  /** i18n key; falls back to label when missing. */
  labelKey?: string;
  page: PageKey;
}

export interface AdminNavItem {
  label: string;
  /** i18n key; falls back to label when missing. */
  labelKey?: string;
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
    labelKey: 'shell.nav.dashboard',
    page: 'dashboard',
    icon: LayoutDashboard,
    permission: { module: 'employee', action: 'view' },
  },
  {
    label: 'My Space',
    labelKey: 'shell.nav.mySpace',
    page: 'my-dashboard',
    icon: UserCircle,
    permission: { module: 'employee', action: 'view' },
    children: [
      { label: 'Home', labelKey: 'shell.nav.myHome', page: 'my-dashboard' },
      { label: 'My Profile', labelKey: 'shell.nav.myProfile', page: 'my-profile' },
      { label: 'My Attendance', labelKey: 'shell.nav.myAttendance', page: 'my-attendance' },
      { label: 'My Leave', labelKey: 'shell.nav.myLeave', page: 'my-leave' },
      { label: 'My Roster', labelKey: 'shell.nav.myRoster', page: 'my-roster' },
      { label: 'My Payslips', labelKey: 'shell.nav.myPayslips', page: 'my-payslips' },
      { label: 'Help & Support', labelKey: 'shell.nav.myHelp', page: 'my-help' },
    ],
  },
  {
    label: 'Employees',
    labelKey: 'shell.nav.employees',
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
    labelKey: 'shell.nav.organization',
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
    labelKey: 'shell.nav.attendance',
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
    labelKey: 'shell.nav.roster',
    page: 'roster',
    icon: CalendarDays,
    permission: { module: 'attendance', action: 'view' },
    children: [{ label: 'Roster Calendar', page: 'roster' }],
  },
  {
    label: 'Leave',
    labelKey: 'shell.nav.leave',
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
    label: 'Performance',
    labelKey: 'shell.nav.performance',
    page: 'performance-goals',
    icon: Target,
    permission: { module: 'performance', action: 'view' },
    children: [
      { label: 'KPIs & Goals', labelKey: 'shell.nav.kpiGoals', page: 'performance-goals' },
      { label: 'Review cycles', labelKey: 'shell.nav.reviewCycles', page: 'performance-cycles' },
      { label: 'Assessments', labelKey: 'shell.nav.assessments', page: 'performance-assessments' },
      { label: '360° feedback', labelKey: 'shell.nav.feedback360', page: 'performance-feedback' },
      { label: 'Results', labelKey: 'shell.nav.performanceReviews', page: 'performance' },
    ],
  },
  {
    label: 'Training',
    labelKey: 'shell.nav.training',
    page: 'training-catalog',
    icon: GraduationCap,
    permission: { module: 'training', action: 'view' },
    children: [
      { label: 'Course catalog', labelKey: 'shell.nav.trainingCatalog', page: 'training-catalog' },
      { label: 'Attendance & costs', labelKey: 'shell.nav.trainingSessions', page: 'training-sessions' },
      { label: 'Certifications & skills', labelKey: 'shell.nav.trainingCertifications', page: 'training' },
    ],
  },
  {
    label: 'Payroll',
    labelKey: 'shell.nav.payroll',
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
      { label: 'Chart of Accounts', page: 'accounting-mapping' },
      { label: 'GL Export & Sync', page: 'accounting-exports' },
      { label: 'Accounting Connections', page: 'accounting-connections' },
      { label: 'Payroll Journal', page: 'accounting' },
    ],
  },
  {
    label: 'Reports',
    labelKey: 'shell.nav.reports',
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
    label: 'Support',
    labelKey: 'shell.nav.support',
    page: 'support-tickets',
    icon: LifeBuoy,
    permission: { module: 'support', action: 'edit' },
    children: [
      { label: 'Support Tickets', page: 'support-tickets' },
      { label: 'Knowledge Base', page: 'support-kb-admin' },
      { label: 'Help Center', page: 'help-center' },
    ],
  },
  {
    label: 'Settings',
    labelKey: 'shell.nav.settings',
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
      { label: 'API Keys', page: 'settings-api-keys' },
      { label: 'Webhooks', page: 'settings-webhooks' },
      { label: 'Currency & Exchange Rates', page: 'settings-currency' },
      { label: 'Localization', page: 'settings-localization' },
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
