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
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [{ label: 'Overview', page: 'dashboard' }],
  },
  {
    label: 'Organization',
    icon: Building2,
    items: [
      { label: 'Company Profile', page: 'org-profile' },
      { label: 'Departments', page: 'org-departments' },
      { label: 'Designations & Levels', page: 'org-designations' },
      { label: 'Employment Types', page: 'org-employment-types' },
      { label: 'Org Chart', page: 'org-chart' },
    ],
  },
  {
    label: 'People',
    icon: Users,
    items: [
      { label: 'Employee Directory', page: 'emp-directory' },
      { label: 'Lifecycle Events', page: 'emp-lifecycle' },
      { label: 'Contracts', page: 'emp-contracts' },
      { label: 'Recruitment / ATS', page: 'recruitment' },
      { label: 'Onboarding', page: 'onboarding' },
      { label: 'Offboarding', page: 'offboarding' },
      { label: 'Document Types', page: 'doc-types' },
      { label: 'Employee Documents', page: 'emp-documents' },
      { label: 'Custom Fields', page: 'field-builder' },
    ],
  },
  {
    label: 'Time & Attendance',
    icon: Clock,
    items: [
      { label: 'Attendance', page: 'attendance' },
      { label: 'Regularization', page: 'attendance-regularization' },
      { label: 'Shifts', page: 'shifts' },
      { label: 'Roster Calendar', page: 'roster' },
      { label: 'Shift Swap Requests', page: 'shift-swap' },
      { label: 'Leave Types', page: 'leave-types' },
      { label: 'Leave Requests', page: 'leave-requests' },
      { label: 'Leave Balance', page: 'leave-balance' },
      { label: 'Holiday Calendar', page: 'holidays' },
      { label: 'Overtime', page: 'overtime' },
      { label: 'OT Rules', page: 'ot-rules' },
      { label: 'Timesheet', page: 'timesheet' },
      { label: 'Geofence', page: 'geofence' },
      { label: 'Devices', page: 'devices' },
      { label: 'Attendance Methods', page: 'attendance-methods' },
    ],
  },
  {
    label: 'Payroll',
    icon: Wallet,
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
    items: [{ label: 'Plans & Tenant Invoicing', page: 'billing' }],
  },
  {
    label: 'Talent & Culture',
    icon: Target,
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
    items: [
      { label: 'Asset Management', page: 'assets', badge: 'Phase 2' },
      { label: 'Accounting / GL', page: 'accounting', badge: 'Phase 2' },
      { label: 'Help Center', page: 'help-center' },
    ],
  },
  {
    label: 'Employee Self-Service',
    icon: UserCog,
    items: [
      { label: 'Employee Portal (ESS)', page: 'ess', badge: 'Portal' },
    ],
  },
  {
    label: 'Reports & Analytics',
    icon: BarChart3,
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
