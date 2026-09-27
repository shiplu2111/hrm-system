import {
  Building2,
  Briefcase,
  Layers,
  Users,
  CircleDollarSign,
  Network,
  Calendar,
  CalendarDays,
  ClipboardList,
  Clock,
  Palmtree,
  Wallet,
  Play,
  Receipt,
  Calculator,
  FileSpreadsheet,
  type LucideIcon,
} from 'lucide-react';
import type { PageKey } from '@/context/NavContext';

export interface ModuleHubItem {
  label: string;
  description: string;
  page: PageKey;
  icon: LucideIcon;
}

export interface ModuleHubConfig {
  title: string;
  description: string;
  items: ModuleHubItem[];
}

export const organizationHub: ModuleHubConfig = {
  title: 'Organization',
  description:
    'Configure company structure — departments, designations, job levels, teams, and cost centres.',
  items: [
    {
      label: 'Departments',
      description: 'Hierarchical department tree and headcount.',
      page: 'org-departments',
      icon: Building2,
    },
    {
      label: 'Designations',
      description: 'Job titles linked to departments and grades.',
      page: 'org-designations',
      icon: Briefcase,
    },
    {
      label: 'Job Levels',
      description: 'Company-configurable grade ladder (L1–L8).',
      page: 'org-job-levels',
      icon: Layers,
    },
    {
      label: 'Employment Types',
      description: 'Full-time, part-time, contractor, and custom types.',
      page: 'org-employment-types',
      icon: Users,
    },
    {
      label: 'Teams',
      description: 'Cross-functional and project teams.',
      page: 'org-teams',
      icon: Network,
    },
    {
      label: 'Cost Centres',
      description: 'Financial allocation codes for payroll and reporting.',
      page: 'org-cost-centres',
      icon: CircleDollarSign,
    },
  ],
};

export const leaveHub: ModuleHubConfig = {
  title: 'Leave',
  description: 'Manage leave requests, policies, balances, and public holidays.',
  items: [
    {
      label: 'Leave Requests',
      description: 'Review, approve, or reject employee leave applications.',
      page: 'leave-requests',
      icon: ClipboardList,
    },
    {
      label: 'Leave Types',
      description: 'Annual, sick, and custom leave categories.',
      page: 'leave-types',
      icon: Palmtree,
    },
    {
      label: 'Leave Balances',
      description: 'Entitlements and remaining balance by employee.',
      page: 'leave-balance',
      icon: Calendar,
    },
    {
      label: 'Holiday Calendar',
      description: 'Company and location public holidays.',
      page: 'holidays',
      icon: CalendarDays,
    },
  ],
};

export const attendanceHub: ModuleHubConfig = {
  title: 'Attendance',
  description: 'Daily attendance, timesheets, shifts, and time tracking.',
  items: [
    {
      label: 'Daily Attendance',
      description: 'Clock in/out and today’s status by employee.',
      page: 'attendance',
      icon: Clock,
    },
    {
      label: 'Timesheets',
      description: 'Working hours and period summaries.',
      page: 'timesheet',
      icon: ClipboardList,
    },
    {
      label: 'Shifts',
      description: 'Shift definitions and working windows.',
      page: 'shifts',
      icon: Calendar,
    },
  ],
};

export const payrollHub: ModuleHubConfig = {
  title: 'Payroll',
  description: 'Pay runs, salary structures, tax profiles, and payment batches.',
  items: [
    {
      label: 'Pay Runs',
      description: 'Calculate, review, and finalize payroll.',
      page: 'payroll-runs',
      icon: Play,
    },
    {
      label: 'Pay Schedules',
      description: 'Pay frequency and period calendars.',
      page: 'pay-schedules',
      icon: CalendarDays,
    },
    {
      label: 'Salary Components',
      description: 'Earnings, deductions, and employer contributions.',
      page: 'salary-components',
      icon: Layers,
    },
    {
      label: 'Salary Structures',
      description: 'Employee compensation templates.',
      page: 'salary-structures',
      icon: FileSpreadsheet,
    },
    {
      label: 'Payslips',
      description: 'Generated payslips and settlement records.',
      page: 'payslips',
      icon: Receipt,
    },
    {
      label: 'Tax Profiles',
      description: 'Withholding and statutory tax configuration.',
      page: 'tax-profiles',
      icon: Calculator,
    },
  ],
};

export type ModuleHubId = 'organization' | 'leave' | 'attendance' | 'payroll';

export const moduleHubs: Record<ModuleHubId, ModuleHubConfig> = {
  organization: organizationHub,
  leave: leaveHub,
  attendance: attendanceHub,
  payroll: payrollHub,
};
