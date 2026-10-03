import type { PermissionRef } from './require-permission.decorator';

/**
 * Read-only org lookups (companies, departments, designations, …) are needed by every
 * admin screen that shows or filters people, so any module that lists employees may read them.
 * Mutations stay on settings:create/edit/delete.
 */
export const ORG_LOOKUP_READERS: PermissionRef[] = [
  { module: 'employee', action: 'view' },
  { module: 'payroll', action: 'view' },
  { module: 'recruitment', action: 'view' },
  { module: 'performance', action: 'view' },
  { module: 'attendance', action: 'view' },
  { module: 'leave', action: 'view' },
  { module: 'contractors', action: 'view' },
];
