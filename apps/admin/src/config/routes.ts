import type { PageKey } from '@/context/NavContext';

export interface ResolvedRoute {
  page: PageKey;
  employeeId?: string | null;
  contractId?: string | null;
  applicationId?: string | null;
}
export const PAGE_PATHS: Partial<Record<PageKey, string>> = {
  dashboard: '/',
  'emp-directory': '/employees/directory',
  'emp-profile': '/employees/:employeeId',
  'emp-lifecycle': '/employees/lifecycle',
  'emp-contracts': '/employees/contracts',
  'emp-contract-detail': '/employees/contracts/:contractId',
  'emp-contract-expiry': '/employees/contracts/expiry-alerts',
  recruitment: '/employees/recruitment',
  'recruitment-requisitions': '/employees/recruitment/requisitions',
  'recruitment-interviews': '/employees/recruitment/interviews',
  'candidate-profile': '/employees/recruitment/candidates/:applicationId',
  'offer-letter': '/employees/recruitment/offer-letter/:applicationId',
  onboarding: '/employees/onboarding',
  'onboarding-templates': '/employees/onboarding/templates',
  'emp-onboarding': '/employees/:employeeId/onboarding',
  offboarding: '/employees/offboarding',
  'emp-offboarding': '/employees/:employeeId/offboarding',
  'doc-types': '/employees/document-types',
  'emp-documents': '/employees/documents',
  'field-builder': '/employees/custom-fields',
  'org-profile': '/organization/profile',
  'org-departments': '/organization/departments',
  'org-designations': '/organization/designations',
  'org-job-levels': '/organization/job-levels',
  'org-employment-types': '/organization/employment-types',
  'org-teams': '/organization/teams',
  'org-cost-centres': '/organization/cost-centres',
  'org-chart': '/organization/chart',
  attendance: '/attendance/daily',
  'attendance-regularization': '/attendance/regularization',
  shifts: '/attendance/shifts',
  roster: '/attendance/roster',
  'shift-swap': '/attendance/shift-swap',
  'leave-types': '/leave/types',
  'leave-requests': '/leave/requests',
  'leave-balance': '/leave/balances',
  holidays: '/leave/holidays',
  overtime: '/attendance/overtime',
  'ot-rules': '/attendance/ot-rules',
  timesheet: '/attendance/timesheets',
  'timesheet-approvals': '/attendance/timesheets/approvals',
  geofence: '/attendance/geofence',
  devices: '/attendance/devices',
  'attendance-methods': '/attendance/methods',
  'payroll-runs': '/payroll/runs',
  'pay-schedules': '/payroll/schedules',
  'salary-components': '/payroll/salary-components',
  'salary-structures': '/payroll/salary-structures',
  'payroll-formulas': '/payroll/formulas',
  payslips: '/payroll/payslips',
  'payroll-simulation': '/payroll/simulation',
  'payment-batches': '/payroll/payment-batches',
  'tax-profiles': '/payroll/tax-profiles',
  benefits: '/payroll/benefits',
  'benefit-plans': '/payroll/benefits/plans',
  'benefit-enrollments': '/payroll/benefits/enrollments',
  superannuation: '/payroll/superannuation',
  loans: '/payroll/loans',
  'loan-detail': '/payroll/loans/:loanId',
  expenses: '/payroll/expenses',
  'expense-detail': '/payroll/expenses/:claimId',
  'expense-categories': '/payroll/expenses/categories',
  billing: '/billing',
  assets: '/operations/assets',
  accounting: '/operations/accounting',
  'accounting-mapping': '/operations/accounting/mapping',
  'accounting-exports': '/operations/accounting/exports',
  'help-center': '/support/help',
  'support-kb-admin': '/support/knowledge-base',
  'support-tickets': '/support/tickets',
  performance: '/talent/performance',
  training: '/talent/training',
  'employee-relations': '/talent/employee-relations',
  engagement: '/talent/engagement',
  'health-safety': '/talent/health-safety',
  'vendors-contractors': '/talent/vendors-contractors',
  'reports-hub': '/reports',
  'reports-scheduled': '/reports/scheduled',
  'data-import': '/reports/import',
  'data-export': '/reports/export',
  'settings-hub': '/settings',
  'settings-notifications': '/settings/notifications',
  'settings-workflows': '/settings/workflows',
  'settings-workflow-builder': '/settings/workflows/new',
  'settings-security': '/settings/security',
  'audit-log': '/settings/audit-log',
  'settings-integrations': '/settings/integrations',
  'settings-backup': '/settings/backup',
  'settings-general': '/settings/general',
  'rbac-roles': '/settings/roles',
  'rbac-matrix': '/settings/permission-matrix',
  'shell-employees': '/employees/directory',
  'shell-organization': '/organization/departments',
  'shell-attendance': '/attendance/daily',
  'shell-roster': '/attendance/roster',
  'shell-leave': '/leave/requests',
  'shell-payroll': '/payroll/runs',
  'shell-reports': '/reports',
  'shell-settings': '/settings',
  'shell-recruitment': '/employees/recruitment',
};

const PATH_TO_PAGE = Object.fromEntries(
  Object.entries(PAGE_PATHS)
    .filter(([, path]) => path && !path.includes(':'))
    .map(([page, path]) => [path, page as PageKey]),
) as Record<string, PageKey>;

const DYNAMIC_ROUTES: Array<{
  pattern: RegExp;
  resolve: (match: RegExpMatchArray) => ResolvedRoute;
}> = [
  {
    pattern: /^\/employees\/contracts\/([0-9a-f-]{36})$/i,
    resolve: (m) => ({ page: 'emp-contract-detail', contractId: m[1] }),
  },
  {
    pattern: /^\/employees\/recruitment\/offer-letter\/([0-9a-f-]{36})$/i,
    resolve: (m) => ({ page: 'offer-letter', applicationId: m[1] }),
  },
  {
    pattern: /^\/employees\/recruitment\/candidates\/([0-9a-f-]{36})$/i,
    resolve: (m) => ({ page: 'candidate-profile', applicationId: m[1] }),
  },
  {
    pattern: /^\/employees\/([0-9a-f-]{36})\/onboarding$/i,
    resolve: (m) => ({ page: 'emp-onboarding', employeeId: m[1] }),
  },
  {
    pattern: /^\/employees\/([0-9a-f-]{36})\/offboarding$/i,
    resolve: (m) => ({ page: 'emp-offboarding', employeeId: m[1] }),
  },
  {
    pattern: /^\/employees\/([0-9a-f-]{36})$/i,
    resolve: (m) => ({ page: 'emp-profile', employeeId: m[1] }),
  },
  {
    pattern: /^\/payroll\/runs\/([0-9a-f-]{36})$/i,
    resolve: () => ({ page: 'payroll-runs' }),
  },
  {
    pattern: /^\/payroll\/loans\/([0-9a-f-]{36})$/i,
    resolve: () => ({ page: 'loan-detail' }),
  },
  {
    pattern: /^\/payroll\/expenses\/([0-9a-f-]{36})$/i,
    resolve: () => ({ page: 'expense-detail' }),
  },
  {
    pattern: /^\/settings\/workflows\/([0-9a-f-]{36})$/i,
    resolve: () => ({ page: 'settings-workflow-builder' }),
  },
];

export function pathForPage(
  page: PageKey,
  params?: {
    employeeId?: string | null;
    contractId?: string | null;
    applicationId?: string | null;
    loanId?: string | null;
    claimId?: string | null;
    definitionId?: string | null;
  },
): string {
  const template = PAGE_PATHS[page];
  if (!template) return '/';

  if (page === 'emp-profile' && params?.employeeId) {
    return `/employees/${params.employeeId}`;
  }
  if (page === 'emp-onboarding' && params?.employeeId) {
    return `/employees/${params.employeeId}/onboarding`;
  }
  if (page === 'emp-offboarding' && params?.employeeId) {
    return `/employees/${params.employeeId}/offboarding`;
  }
  if (page === 'emp-contract-detail' && params?.contractId) {
    return `/employees/contracts/${params.contractId}`;
  }
  if (page === 'candidate-profile' && params?.applicationId) {
    return `/employees/recruitment/candidates/${params.applicationId}`;
  }
  if (page === 'offer-letter' && params?.applicationId) {
    return `/employees/recruitment/offer-letter/${params.applicationId}`;
  }
  if (page === 'loan-detail' && params?.loanId) {
    return `/payroll/loans/${params.loanId}`;
  }
  if (page === 'expense-detail' && params?.claimId) {
    return `/payroll/expenses/${params.claimId}`;
  }
  if (page === 'settings-workflow-builder' && params?.definitionId) {
    return `/settings/workflows/${params.definitionId}`;
  }

  return template;
}

export function resolveRoute(pathname: string): ResolvedRoute {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const exact = PATH_TO_PAGE[normalized];
  if (exact) {
    return { page: exact };
  }

  for (const route of DYNAMIC_ROUTES) {
    const match = normalized.match(route.pattern);
    if (match) return route.resolve(match);
  }

  return { page: 'dashboard' };
}

const RECORD_PARENT: Partial<Record<PageKey, PageKey>> = {
  'emp-profile': 'emp-directory',
  'emp-onboarding': 'onboarding',
  'emp-offboarding': 'offboarding',
  'emp-contract-detail': 'emp-contracts',
  'candidate-profile': 'recruitment',
  'offer-letter': 'recruitment',
  'loan-detail': 'loans',
  'expense-detail': 'expenses',
  'settings-workflow-builder': 'settings-workflows',
};

/** The list page for a URL that names a specific record; null when the URL names no record. */
export function recordFreePath(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (PATH_TO_PAGE[normalized]) return null;
  const { page } = resolveRoute(normalized);
  return pathForPage(RECORD_PARENT[page] ?? page);
}

export function pageFromPath(pathname: string): PageKey {
  return resolveRoute(pathname).page;
}
