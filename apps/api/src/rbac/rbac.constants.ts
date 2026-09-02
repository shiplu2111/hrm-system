/** Default system roles — ROLES_PERMISSIONS.md §1. Cannot be edited or deleted. */
export const SYSTEM_ROLE_NAMES = new Set([
  'Super Admin',
  'Company Owner',
  'HR Admin',
  'Payroll Admin',
  'Manager',
  'Employee',
  'Accountant',
  'Recruiter',
]);

/** Valid permission modules (matches seed + DATABASE_SCHEMA). */
export const PERMISSION_MODULES = [
  'tenant',
  'employee',
  'leave',
  'payroll',
  'attendance',
  'settings',
  'audit',
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const PERMISSION_ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'approve',
  'finalize',
] as const;

/** Actions that must be re-verified against DB at execution time (AUTH_FLOW.md §10). */
export const SENSITIVE_PERMISSION_ACTIONS = new Set(['approve', 'finalize']);
