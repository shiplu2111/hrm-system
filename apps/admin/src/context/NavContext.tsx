import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePermissions } from '@hrm/portal-ui';
import { canViewPage } from '@/config/page-permissions';
import { pathForPage, recordFreePath, resolveRoute } from '@/config/routes';
import { useTenant } from '@/context/TenantContext';

export type PageKey =
  | 'dashboard'
  | 'auth'
  | 'platform-admin'
  | 'org-profile'
  | 'org-departments'
  | 'org-designations'
  | 'org-job-levels'
  | 'org-employment-types'
  | 'org-teams'
  | 'org-cost-centres'
  | 'org-chart'
  | 'rbac-roles'
  | 'rbac-matrix'
  | 'emp-directory'
  | 'emp-profile'
  | 'emp-lifecycle'
  | 'emp-contracts'
  | 'emp-contract-detail'
  | 'emp-contract-expiry'
  | 'recruitment'
  | 'recruitment-requisitions'
  | 'recruitment-interviews'
  | 'candidate-profile'
  | 'offer-letter'
  | 'onboarding'
  | 'onboarding-templates'
  | 'emp-onboarding'
  | 'offboarding'
  | 'emp-offboarding'
  | 'doc-types'
  | 'emp-documents'
  | 'field-builder'
  | 'attendance'
  | 'attendance-regularization'
  | 'shifts'
  | 'roster'
  | 'shift-swap'
  | 'leave-types'
  | 'leave-requests'
  | 'leave-balance'
  | 'holidays'
  | 'overtime'
  | 'ot-rules'
  | 'timesheet'
  | 'timesheet-approvals'
  | 'geofence'
  | 'devices'
  | 'attendance-methods'
  | 'payroll-runs'
  | 'pay-schedules'
  | 'salary-components'
  | 'salary-structures'
  | 'payroll-formulas'
  | 'payslips'
  | 'payroll-simulation'
  | 'payment-batches'
  | 'tax-profiles'
  | 'benefits'
  | 'benefit-plans'
  | 'benefit-enrollments'
  | 'superannuation'
  | 'loans'
  | 'loan-detail'
  | 'expenses'
  | 'expense-detail'
  | 'expense-categories'
  | 'billing'
  | 'assets'
  | 'accounting'
  | 'accounting-mapping'
  | 'accounting-exports'
  | 'help-center'
  | 'support-kb-admin'
  | 'support-tickets'
  | 'performance'
  | 'training'
  | 'employee-relations'
  | 'engagement'
  | 'health-safety'
  | 'vendors-contractors'
  | 'reports-hub'
  | 'reports-scheduled'
  | 'data-import'
  | 'data-export'
  | 'settings-hub'
  | 'settings-notifications'
  | 'settings-workflows'
  | 'settings-workflow-builder'
  | 'settings-security'
  | 'audit-log'
  | 'settings-integrations'
  | 'settings-backup'
  | 'settings-general'
  | 'ess'
  | 'self-service'
  | 'shell-employees'
  | 'shell-organization'
  | 'shell-recruitment'
  | 'shell-attendance'
  | 'shell-roster'
  | 'shell-leave'
  | 'shell-payroll'
  | 'shell-reports'
  | 'shell-settings';

interface NavContextValue {
  current: PageKey;
  navigate: (p: PageKey) => void;
  selectedEmployeeId: string | null;
  selectedContractId: string | null;
  selectedApplicationId: string | null;
  openEmployee: (id: string) => void;
  openEmployeeOnboarding: (id: string) => void;
  openEmployeeOffboarding: (id: string) => void;
  openLifecycle: (id: string) => void;
  openContract: (id: string) => void;
  /** `convert` opens the Convert to Employee form once the page loads. */
  openApplication: (id: string, options?: { convert?: boolean }) => void;
  openOfferLetter: (applicationId: string) => void;
}

const NavContext = createContext<NavContextValue | undefined>(undefined);

export function NavProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const routerNavigate = useNavigate();

  const resolved = useMemo(
    () => resolveRoute(location.pathname),
    [location.pathname],
  );

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(
    null,
  );

  const { tenantKey } = useTenant();
  const { can } = usePermissions();
  const previousTenantKey = useRef(tenantKey);

  // Record IDs, query strings and route state belong to the previous organization.
  useEffect(() => {
    if (previousTenantKey.current === tenantKey) return;
    previousTenantKey.current = tenantKey;
    setSelectedEmployeeId(null);
    setSelectedContractId(null);
    setSelectedApplicationId(null);

    const listPath = recordFreePath(location.pathname);
    if (listPath !== null) {
      routerNavigate(listPath, { replace: true });
    } else if (!canViewPage(resolved.page, can)) {
      routerNavigate(pathForPage('dashboard'), { replace: true });
    } else if (location.search || location.state) {
      routerNavigate(location.pathname, { replace: true });
    }
  }, [tenantKey, location.pathname, location.search, location.state, resolved.page, can, routerNavigate]);

  useEffect(() => {
    if (resolved.employeeId) setSelectedEmployeeId(resolved.employeeId);
    if (resolved.contractId) setSelectedContractId(resolved.contractId);
    if (resolved.applicationId) setSelectedApplicationId(resolved.applicationId);
  }, [resolved.employeeId, resolved.contractId, resolved.applicationId]);

  const navigate = useCallback(
    (page: PageKey) => {
      routerNavigate(pathForPage(page));
    },
    [routerNavigate],
  );

  const openEmployee = useCallback(
    (id: string) => {
      setSelectedEmployeeId(id);
      routerNavigate(pathForPage('emp-profile', { employeeId: id }));
    },
    [routerNavigate],
  );

  const openEmployeeOnboarding = useCallback(
    (id: string) => {
      setSelectedEmployeeId(id);
      routerNavigate(pathForPage('emp-onboarding', { employeeId: id }));
    },
    [routerNavigate],
  );

  const openEmployeeOffboarding = useCallback(
    (id: string) => {
      setSelectedEmployeeId(id);
      routerNavigate(pathForPage('emp-offboarding', { employeeId: id }));
    },
    [routerNavigate],
  );

  const openLifecycle = useCallback(
    (id: string) => {
      setSelectedEmployeeId(id);
      routerNavigate(pathForPage('emp-lifecycle'));
    },
    [routerNavigate],
  );

  const openContract = useCallback(
    (id: string) => {
      setSelectedContractId(id);
      routerNavigate(pathForPage('emp-contract-detail', { contractId: id }));
    },
    [routerNavigate],
  );

  const openApplication = useCallback(
    (id: string, options?: { convert?: boolean }) => {
      setSelectedApplicationId(id);
      const path = pathForPage('candidate-profile', { applicationId: id });
      routerNavigate(options?.convert ? `${path}?convert=1` : path);
    },
    [routerNavigate],
  );

  const openOfferLetter = useCallback(
    (applicationId: string) => {
      setSelectedApplicationId(applicationId);
      routerNavigate(pathForPage('offer-letter', { applicationId }));
    },
    [routerNavigate],
  );

  return (
    <NavContext.Provider
      value={{
        current: resolved.page,
        navigate,
        selectedEmployeeId: resolved.employeeId ?? selectedEmployeeId,
        selectedContractId: resolved.contractId ?? selectedContractId,
        selectedApplicationId: resolved.applicationId ?? selectedApplicationId,
        openEmployee,
        openEmployeeOnboarding,
        openEmployeeOffboarding,
        openLifecycle,
        openContract,
        openApplication,
        openOfferLetter,
      }}
    >
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}
