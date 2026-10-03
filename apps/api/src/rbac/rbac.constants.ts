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
  'recruitment',
  'settings',
  'audit',
  'platform',
  'support',
  'performance',
  'training',
  'employee_relations',
  'engagement',
  'health_safety',
  'contractors',
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

type Action = (typeof PERMISSION_ACTIONS)[number];

/**
 * Actions each module actually checks (endpoint guards, service rules and admin page gates).
 * Not every module uses every action — ROLES_PERMISSIONS.md §3. Keep in step with new checks.
 */
export const MODULE_ACTIONS: Record<PermissionModule, readonly Action[]> = {
  tenant: ['view'],
  employee: ['view', 'create', 'edit', 'delete', 'approve'],
  leave: ['view', 'create', 'edit', 'approve'],
  payroll: ['view', 'create', 'edit', 'delete', 'approve', 'finalize'],
  attendance: ['view', 'create', 'edit', 'delete', 'approve'],
  recruitment: ['view', 'create', 'edit', 'approve'],
  settings: ['view', 'create', 'edit', 'delete'],
  audit: ['view'],
  platform: ['view', 'create', 'edit'],
  support: ['view', 'create', 'edit'],
  performance: ['view', 'create', 'edit', 'approve'],
  training: ['view', 'create', 'edit'],
  employee_relations: ['view', 'create', 'edit'],
  engagement: ['view', 'create', 'edit'],
  health_safety: ['view', 'create', 'edit'],
  contractors: ['view', 'create', 'edit', 'approve', 'finalize'],
};

/** Platform/billing modules reserved for Super Admin; tenant-defined roles may not grant them. */
export const NON_GRANTABLE_MODULES: ReadonlySet<string> = new Set(['platform', 'tenant']);

/** Actions that must be re-verified against DB at execution time (AUTH_FLOW.md §10). */
export const SENSITIVE_PERMISSION_ACTIONS = new Set(['approve', 'finalize']);
