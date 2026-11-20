import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  CalendarDays,
  CalendarRange,
  Clock,
  FileText,
  Home,
  LifeBuoy,
  Receipt,
  Timer,
  UserCircle,
  Users,
  Wallet,
} from 'lucide-react';
import type { PageKey } from '@/context/NavContext';

export interface EmployeeNavItem {
  page: PageKey;
  labelKey: string;
  fallbackLabel: string;
  icon: LucideIcon;
  section: 'primary' | 'secondary';
  /** Shown in the persistent `< lg` bottom tab bar (max 5 items per NAVIGATION.md §3). */
  mobileBottomTab?: boolean;
}

/**
 * Flat Employee Self-Service navigation (NAVIGATION.md §2–§3).
 */
export const EMPLOYEE_NAV_ITEMS: EmployeeNavItem[] = [
  {
    page: 'my-dashboard',
    labelKey: 'nav.home',
    fallbackLabel: 'Home',
    icon: Home,
    section: 'primary',
    mobileBottomTab: true,
  },
  {
    page: 'my-attendance',
    labelKey: 'nav.attendance',
    fallbackLabel: 'Attendance',
    icon: Clock,
    section: 'primary',
    mobileBottomTab: true,
  },
  {
    page: 'my-leave',
    labelKey: 'nav.leave',
    fallbackLabel: 'Leave',
    icon: CalendarDays,
    section: 'primary',
    mobileBottomTab: true,
  },
  {
    page: 'my-payslips',
    labelKey: 'nav.payslips',
    fallbackLabel: 'Payslips',
    icon: Wallet,
    section: 'primary',
    mobileBottomTab: true,
  },
  {
    page: 'my-profile',
    labelKey: 'nav.profile',
    fallbackLabel: 'Profile',
    icon: UserCircle,
    section: 'primary',
    mobileBottomTab: true,
  },
  {
    page: 'my-notifications',
    labelKey: 'nav.notifications',
    fallbackLabel: 'Notifications',
    icon: Bell,
    section: 'primary',
  },
  {
    page: 'my-roster',
    labelKey: 'nav.roster',
    fallbackLabel: 'Roster',
    icon: CalendarRange,
    section: 'secondary',
  },
  {
    page: 'my-timesheets',
    labelKey: 'nav.timesheets',
    fallbackLabel: 'Timesheets',
    icon: Timer,
    section: 'secondary',
  },
  {
    page: 'my-expenses',
    labelKey: 'nav.expenses',
    fallbackLabel: 'Expenses',
    icon: Receipt,
    section: 'secondary',
  },
  {
    page: 'my-documents',
    labelKey: 'nav.documents',
    fallbackLabel: 'Documents',
    icon: FileText,
    section: 'secondary',
  },
  {
    page: 'my-directory',
    labelKey: 'nav.directory',
    fallbackLabel: 'Directory',
    icon: Users,
    section: 'secondary',
  },
  {
    page: 'my-help',
    labelKey: 'nav.help',
    fallbackLabel: 'Support',
    icon: LifeBuoy,
    section: 'secondary',
  },
];

export const EMPLOYEE_BOTTOM_TABS = EMPLOYEE_NAV_ITEMS.filter(
  (item) => item.mobileBottomTab,
);

