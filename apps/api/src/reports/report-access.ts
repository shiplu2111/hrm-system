import type { PermissionAction, ReportCategory } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';

interface CategoryAccess {
  module: string;
  /**
   * Actions that show the holder manages the module company-wide. A user linked to an
   * employee record with only `view` (or self-service actions such as clocking in or editing
   * their own profile) is scoped to their own data, so company reports stay closed to them.
   */
  managementActions: PermissionAction[];
}

export const REPORT_CATEGORY_ACCESS: Record<ReportCategory, CategoryAccess> = {
  payroll: { module: 'payroll', managementActions: ['create', 'edit', 'approve', 'finalize'] },
  attendance: { module: 'attendance', managementActions: ['edit', 'approve', 'delete'] },
  hr: { module: 'employee', managementActions: ['create', 'delete'] },
};

export function canRunReportCategory(user: AuthenticatedUser, category: ReportCategory): boolean {
  const { module, managementActions } = REPORT_CATEGORY_ACCESS[category];
  const held = new Set(
    user.permissions.filter((permission) => permission.module === module).map((permission) => permission.action),
  );
  if (!held.has('view')) return false;
  if (!user.employeeId) return true;
  return managementActions.some((action) => held.has(action));
}
