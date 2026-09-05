import { createContext, useContext, useState, type ReactNode } from 'react';

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
  | 'payment-batches'
  | 'tax-profiles'
  | 'benefits'
  | 'loans'
  | 'expenses'
  | 'billing'
  | 'assets'
  | 'accounting'
  | 'help-center'
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
  | 'settings-integrations'
  | 'settings-backup'
  | 'settings-general'
  | 'ess'
  | 'self-service';

interface NavContextValue {
  current: PageKey;
  navigate: (p: PageKey) => void;
  selectedEmployeeId: string | null;
  selectedContractId: string | null;
  openEmployee: (id: string) => void;
  openLifecycle: (id: string) => void;
  openContract: (id: string) => void;
}

const NavContext = createContext<NavContextValue | undefined>(undefined);

export function NavProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<PageKey>('dashboard');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );
  const [selectedContractId, setSelectedContractId] = useState<string | null>(
    null,
  );

  const openEmployee = (id: string) => {
    setSelectedEmployeeId(id);
    setCurrent('emp-profile');
  };

  const openLifecycle = (id: string) => {
    setSelectedEmployeeId(id);
    setCurrent('emp-lifecycle');
  };

  const openContract = (id: string) => {
    setSelectedContractId(id);
    setCurrent('emp-contract-detail');
  };

  return (
    <NavContext.Provider
      value={{
        current,
        navigate: setCurrent,
        selectedEmployeeId,
        selectedContractId,
        openEmployee,
        openLifecycle,
        openContract,
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
