import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { pathForPage, resolveRoute } from '@/config/routes';

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
  | 'recruitment'
  | 'candidate-profile'
  | 'offer-letter'
  | 'onboarding'
  | 'offboarding'
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
  | 'loans'
  | 'expenses'
  | 'billing'
  | 'assets'
  | 'accounting'
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
  openLifecycle: (id: string) => void;
  openContract: (id: string) => void;
  openApplication: (id: string) => void;
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
    (id: string) => {
      setSelectedApplicationId(id);
      routerNavigate(pathForPage('candidate-profile', { applicationId: id }));
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
