import {
  BarChart3,
  Briefcase,
  CalendarDays,
  Clock,
  Globe2,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

export interface FeatureCategory {
  id: string;
  icon: LucideIcon;
  title: string;
  summary: string;
  points: string[];
}

export const featureCategories: FeatureCategory[] = [
  {
    id: 'core-hr',
    icon: Users,
    title: 'Core HR',
    summary: 'One accurate record for every employee, from offer letter to final settlement.',
    points: [
      'Employee profiles, documents and expiry alerts',
      'Companies, branches, departments and positions',
      'Live org chart and vacancy tracking',
      'Promotions, transfers, confirmations and exits',
      'Employment contracts with renewal reminders',
    ],
  },
  {
    id: 'attendance',
    icon: Clock,
    title: 'Attendance & time',
    summary: 'Capture time where work happens and keep it tamper-proof.',
    points: [
      'Clock in from web, mobile or kiosk',
      'Geofencing, device binding and biometric sync',
      'Late, early-out and missed punch rules',
      'Regularization requests with approvals',
      'Timesheets against projects and cost centres',
    ],
  },
  {
    id: 'leave-roster',
    icon: CalendarDays,
    title: 'Leave & rosters',
    summary: 'Policies that calculate themselves and schedules people can see.',
    points: [
      'Leave types with accrual, carry-forward and encashment',
      'Holiday calendars per country and company',
      'Shift templates, rosters and shift swaps',
      'Overtime rules with automatic calculation',
      'Team calendar for managers',
    ],
  },
  {
    id: 'payroll',
    icon: Wallet,
    title: 'Payroll',
    summary: 'Run payroll in hours, not days — with every number explained.',
    points: [
      'Salary structures and pay components',
      'Formula engine for allowances and deductions',
      'Tax, provident fund and benefits',
      'Loans, salary advances and expense reimbursements',
      'Payslips by email and in the employee app',
      'GL journal export to your accounting system',
    ],
  },
  {
    id: 'talent',
    icon: Briefcase,
    title: 'Talent',
    summary: 'Hire, onboard and grow people in the same system that pays them.',
    points: [
      'Job requisitions, postings and candidate pipeline',
      'Interview rounds and offer letters',
      'Onboarding and offboarding checklists with asset tracking',
      'Performance cycles, KPIs and reviews',
      'Training records, certifications and kudos',
    ],
  },
  {
    id: 'self-service',
    icon: Smartphone,
    title: 'Employee self-service',
    summary: 'Give every employee answers without a trip to HR.',
    points: [
      'My Space dashboard on web, Android and iOS',
      'Apply for leave and track approvals',
      'View rosters, attendance and payslips',
      'Help centre and support tickets',
      'English and Bangla interface',
    ],
  },
  {
    id: 'workflow',
    icon: Workflow,
    title: 'Workflows & notifications',
    summary: 'Approvals that route themselves and reminders that are never forgotten.',
    points: [
      'Visual multi-step approval builder',
      'Email, push and in-app notifications',
      'Escalations and delegation',
      'Templates for leave, expense, overtime and more',
    ],
  },
  {
    id: 'reports',
    icon: BarChart3,
    title: 'Reports & analytics',
    summary: 'Headcount, cost and attendance insight for every level of the business.',
    points: [
      'Role-aware dashboards',
      'Headcount, turnover and attendance reports',
      'Payroll cost by department and cost centre',
      'Export to Excel, CSV and PDF',
    ],
  },
  {
    id: 'security',
    icon: ShieldCheck,
    title: 'Security & control',
    summary: 'Enterprise-grade access control from your very first user.',
    points: [
      'Role-based permissions with data scopes',
      'Full audit log of every change',
      'Encrypted sensitive fields and backups',
      'Two-factor authentication and SSO (Enterprise)',
    ],
  },
  {
    id: 'global',
    icon: Globe2,
    title: 'Multi-country ready',
    summary: 'Built for groups that operate across companies, currencies and time zones.',
    points: [
      'Multiple companies under one account',
      'Country rule packs for tax, leave and holidays',
      'Multi-currency and exchange rates',
      'Time zone aware attendance',
    ],
  },
];
