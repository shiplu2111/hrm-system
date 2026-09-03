import {
  LayoutDashboard,
  Building2,
  Users,
  Clock,
  Wallet,
  UserCog,
  BarChart3,
  Settings,
  ShieldCheck,
  CreditCard,
  Package,
  Landmark,
  CircleHelp,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { PageKey } from '@/context/NavContext';

export interface NavItem {
  label: string;
  page: PageKey;
  badge?: string;
  /** Hide until the page is wired to the API. Remove or set false to show. */
  hidden?: boolean;
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  /** Hide entire section until any module in the group is ready. */
  hidden?: boolean;
}

export const navGroups: NavGroup[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      { label: 'Overview', page: 'dashboard' },
    ],
  },
  {
    label: 'Organization',
    icon: Building2,
    items: [
      { label: 'Company Profile', page: 'org-profile', hidden: true },
      { label: 'Departments', page: 'org-departments' },
      { label: 'Designations', page: 'org-designations' },
      { label: 'Job Levels', page: 'org-job-levels' },
      { label: 'Employment Types', page: 'org-employment-types' },
      { label: 'Teams', page: 'org-teams' },
      { label: 'Cost Centres', page: 'org-cost-centres' },
      { label: 'Org Chart', page: 'org-chart', hidden: true },
    ],
  },
  {
    label: 'People',
    icon: Users,
    items: [
      { label: 'Employee Directory', page: 'emp-directory' },
      { label: 'Lifecycle Events', page: 'emp-lifecycle' },
      { label: 'Contracts', page: 'emp-contracts', hidden: true },
      { label: 'Recruitment / ATS', page: 'recruitment', hidden: true },
      { label: 'Onboarding', page: 'onboarding', hidden: true },
      { label: 'Offboarding', page: 'offboarding', hidden: true },
      { label: 'Document Types', page: 'doc-types' },
      { label: 'Employee Documents', page: 'emp-documents' },
      { label: 'Custom Fields', page: 'field-builder' },
    ],
  },
  {
    label: 'Time & Attendance',
    icon: Clock,
    items: [
      { label: 'Attendance Clock', page: 'attendance' },
      { label: 'Regularization', page: 'attendance-regularization', hidden: true },
      { label: 'Shifts', page: 'shifts' },
      { label: 'Roster Calendar', page: 'roster' },
      { label: 'Shift Swap Requests', page: 'shift-swap', hidden: true },
      { label: 'Leave Types', page: 'leave-types' },
      { label: 'Leave Requests', page: 'leave-requests' },
      { label: 'Leave Balance', page: 'leave-balance' },
      { label: 'Holiday Calendar', page: 'holidays' },
      { label: 'Overtime', page: 'overtime', hidden: true },
      { label: 'OT Rules', page: 'ot-rules', hidden: true },
      { label: 'Timesheet', page: 'timesheet', hidden: true },
      { label: 'Geofence', page: 'geofence', hidden: true },
      { label: 'Devices', page: 'devices', hidden: true },
      { label: 'Attendance Methods', page: 'attendance-methods', hidden: true },
    ],
  },
  {
    label: 'Payroll',
    icon: Wallet,
    hidden: true,
    items: [
      { label: 'Pay Runs & Processing', page: 'payroll-runs' },
      { label: 'Pay Schedules', page: 'pay-schedules' },
      { label: 'Salary Components', page: 'salary-components' },
      { label: 'Salary Structures', page: 'salary-structures' },
      { label: 'Formula & Rules Engine', page: 'payroll-formulas' },
      { label: 'Payslips & Settlement', page: 'payslips' },
      { label: 'Payment Batches', page: 'payment-batches' },
      { label: 'Tax Profiles', page: 'tax-profiles' },
      { label: 'Benefits & Superannuation', page: 'benefits' },
      { label: 'Loans & Advances', page: 'loans' },
      { label: 'Expense Claims', page: 'expenses' },
    ],
  },
  {
    label: 'Subscription & Billing',
    icon: CreditCard,
    hidden: true,
    items: [{ label: 'Plans & Tenant Invoicing', page: 'billing' }],
  },
  {
    label: 'Talent & Culture',
    icon: Target,
    hidden: true,
    items: [
      { label: 'Performance Management', page: 'performance', badge: 'Phase 3' },
      { label: 'Training & Certification', page: 'training', badge: 'Phase 3' },
      { label: 'Employee Relations', page: 'employee-relations', badge: 'Phase 3' },
      { label: 'Employee Engagement', page: 'engagement', badge: 'Phase 3' },
      { label: 'Health & Safety', page: 'health-safety', badge: 'Phase 3' },
      { label: 'Vendors & Contractors', page: 'vendors-contractors', badge: 'Phase 3' },
    ],
  },
  {
    label: 'Operations & Integrations',
    icon: Package,
    hidden: true,
    items: [
      { label: 'Asset Management', page: 'assets', badge: 'Phase 2' },
      { label: 'Accounting / GL', page: 'accounting', badge: 'Phase 2' },
      { label: 'Help Center', page: 'help-center' },
    ],
  },
  {
    label: 'Employee Self-Service',
    icon: UserCog,
    hidden: true,
    items: [
      { label: 'Employee Portal (ESS)', page: 'ess', badge: 'Portal' },
    ],
  },
  {
    label: 'Reports & Analytics',
    icon: BarChart3,
    hidden: true,
    items: [
      { label: 'Reports Hub', page: 'reports-hub' },
      { label: 'Scheduled Deliveries', page: 'reports-scheduled' },
      { label: 'Data Import Wizard', page: 'data-import' },
      { label: 'Export Templates', page: 'data-export' },
    ],
  },
  {
    label: 'System & Settings',
    icon: Settings,
    hidden: true,
    items: [
      { label: 'Authentication Flow', page: 'auth', badge: 'Demo' },
      { label: 'Platform Admin Portal', page: 'platform-admin', badge: 'Platform' },
      { label: 'Settings Hub', page: 'settings-hub' },
      { label: 'Roles & Permissions', page: 'rbac-roles' },
      { label: 'Permission Matrix', page: 'rbac-matrix' },
      { label: 'Notification Engine', page: 'settings-notifications' },
      { label: 'Approval Workflows', page: 'settings-workflows' },
      { label: 'Security & Audit Logs', page: 'settings-security' },
      { label: 'API Keys & Webhooks', page: 'settings-integrations' },
      { label: 'Backups & Multi-Currency', page: 'settings-backup' },
    ],
  },
];

/** Sidebar-ready nav: drops hidden groups/items. Pages remain routable via App.tsx. */
export function getVisibleNavGroups(): NavGroup[] {
  return navGroups
    .filter((group) => !group.hidden)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.hidden),
    }))
    .filter((group) => group.items.length > 0);
}

export const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Building2,
  Users,
  Clock,
  Wallet,
  UserCog,
  BarChart3,
  Settings,
  ShieldCheck,
  CreditCard,
  Package,
  Landmark,
  CircleHelp,
  Target,
};
