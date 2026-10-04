import type { PermissionAction } from '@hrm/shared-types';
import type { PageKey } from '@/context/NavContext';

export interface PagePermission {
  module: string;
  action: PermissionAction;
}

/**
 * Minimum permission to view a page (aligned with API @RequirePermission on list/read endpoints).
 */
export const PAGE_VIEW_PERMISSIONS: Partial<Record<PageKey, PagePermission>> = {
  dashboard: { module: 'employee', action: 'view' },
  'org-profile': { module: 'settings', action: 'view' },
  'org-departments': { module: 'settings', action: 'view' },
  'org-designations': { module: 'settings', action: 'view' },
  'org-job-levels': { module: 'settings', action: 'view' },
  'org-employment-types': { module: 'settings', action: 'view' },
  'org-teams': { module: 'settings', action: 'view' },
  'org-cost-centres': { module: 'settings', action: 'view' },
  'org-chart': { module: 'settings', action: 'view' },
  'rbac-roles': { module: 'settings', action: 'view' },
  'rbac-matrix': { module: 'settings', action: 'view' },
  'emp-directory': { module: 'employee', action: 'view' },
  'emp-profile': { module: 'employee', action: 'view' },
  'emp-lifecycle': { module: 'employee', action: 'view' },
  'emp-contracts': { module: 'employee', action: 'view' },
  'emp-contract-detail': { module: 'employee', action: 'view' },
  'emp-contract-expiry': { module: 'employee', action: 'view' },
  recruitment: { module: 'recruitment', action: 'view' },
  'recruitment-requisitions': { module: 'recruitment', action: 'view' },
  // Interviewers (e.g. managers) see their own rounds without recruitment access.
  'recruitment-interviews': { module: 'employee', action: 'view' },
  'candidate-profile': { module: 'recruitment', action: 'view' },
  'offer-letter': { module: 'recruitment', action: 'view' },
  onboarding: { module: 'employee', action: 'view' },
  'onboarding-templates': { module: 'employee', action: 'view' },
  'emp-onboarding': { module: 'employee', action: 'view' },
  offboarding: { module: 'employee', action: 'view' },
  'emp-offboarding': { module: 'employee', action: 'view' },
  'doc-types': { module: 'settings', action: 'view' },
  'emp-documents': { module: 'employee', action: 'view' },
  'field-builder': { module: 'settings', action: 'view' },
  attendance: { module: 'attendance', action: 'view' },
  'attendance-regularization': { module: 'attendance', action: 'view' },
  shifts: { module: 'attendance', action: 'view' },
  roster: { module: 'attendance', action: 'view' },
  'shift-swap': { module: 'attendance', action: 'view' },
  'leave-types': { module: 'leave', action: 'view' },
  'leave-requests': { module: 'leave', action: 'view' },
  'leave-balance': { module: 'leave', action: 'view' },
  holidays: { module: 'attendance', action: 'view' },
  overtime: { module: 'attendance', action: 'view' },
  'ot-rules': { module: 'attendance', action: 'view' },
  timesheet: { module: 'attendance', action: 'view' },
  geofence: { module: 'attendance', action: 'view' },
  devices: { module: 'attendance', action: 'view' },
  'attendance-methods': { module: 'attendance', action: 'view' },
  'payroll-runs': { module: 'payroll', action: 'view' },
  'pay-schedules': { module: 'payroll', action: 'view' },
  'salary-components': { module: 'payroll', action: 'view' },
  'salary-structures': { module: 'payroll', action: 'view' },
  'payroll-formulas': { module: 'payroll', action: 'view' },
  payslips: { module: 'payroll', action: 'view' },
  'payroll-simulation': { module: 'payroll', action: 'view' },
  'payment-batches': { module: 'payroll', action: 'view' },
  'tax-profiles': { module: 'payroll', action: 'view' },
  benefits: { module: 'payroll', action: 'view' },
  loans: { module: 'payroll', action: 'view' },
  expenses: { module: 'payroll', action: 'view' },
  billing: { module: 'settings', action: 'view' },
  assets: { module: 'employee', action: 'view' },
  accounting: { module: 'payroll', action: 'view' },
  'help-center': { module: 'support', action: 'view' },
  'support-kb-admin': { module: 'support', action: 'edit' },
  'support-tickets': { module: 'support', action: 'view' },
  performance: { module: 'performance', action: 'view' },
  training: { module: 'training', action: 'view' },
  'employee-relations': { module: 'employee_relations', action: 'view' },
  engagement: { module: 'engagement', action: 'view' },
  'health-safety': { module: 'health_safety', action: 'view' },
  'vendors-contractors': { module: 'contractors', action: 'view' },
  'reports-hub': { module: 'employee', action: 'view' },
  'reports-scheduled': { module: 'employee', action: 'view' },
  'data-import': { module: 'employee', action: 'create' },
  'data-export': { module: 'employee', action: 'view' },
  'settings-hub': { module: 'settings', action: 'view' },
  'settings-notifications': { module: 'settings', action: 'view' },
  'settings-workflows': { module: 'settings', action: 'view' },
  'settings-security': { module: 'settings', action: 'view' },
  'audit-log': { module: 'audit', action: 'view' },
  'settings-integrations': { module: 'settings', action: 'view' },
  'settings-backup': { module: 'settings', action: 'view' },
  'settings-general': { module: 'settings', action: 'view' },
  'shell-employees': { module: 'employee', action: 'view' },
  'shell-organization': { module: 'settings', action: 'view' },
  'shell-recruitment': { module: 'recruitment', action: 'view' },
  'shell-attendance': { module: 'attendance', action: 'view' },
  'shell-roster': { module: 'attendance', action: 'view' },
  'shell-leave': { module: 'leave', action: 'view' },
  'shell-payroll': { module: 'payroll', action: 'view' },
  'shell-reports': { module: 'employee', action: 'view' },
  'shell-settings': { module: 'settings', action: 'view' },
};

export function getPageViewPermission(page: PageKey): PagePermission | null {
  return PAGE_VIEW_PERMISSIONS[page] ?? null;
}

export function canViewPage(
  page: PageKey,
  can: (module: string, action: PermissionAction) => boolean,
): boolean {
  const required = getPageViewPermission(page);
  if (!required) return true;
  return can(required.module, required.action);
}
