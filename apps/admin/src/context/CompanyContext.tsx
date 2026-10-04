import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { CompanySummary } from '@hrm/shared-types';
import { listCompanies } from '@/lib/organization-api';
import { ApiError } from '@/lib/tenant-api-client';
import { useTenant } from '@/context/TenantContext';

const COMPANY_KEY = 'hrm_selected_company_id';

interface CompanyContextValue {
  companies: CompanySummary[];
  companyId: string | null;
  company: CompanySummary | null;
  loading: boolean;
  error: string | null;
  setCompanyId: (id: string) => void;
  refresh: () => Promise<void>;
}

interface CompanyState {
  /** Organization session the companies were loaded for. */
  tenantKey: string | null;
  companies: CompanySummary[];
  companyId: string | null;
  error: string | null;
}

const EMPTY_STATE: CompanyState = { tenantKey: null, companies: [], companyId: null, error: null };

const CompanyContext = createContext<CompanyContextValue | undefined>(
  undefined,
);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { tenantKey } = useTenant();
  const [state, setState] = useState<CompanyState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const activeKey = useRef(tenantKey);
  activeKey.current = tenantKey;

  const refresh = useCallback(async () => {
    const requestKey = activeKey.current;
    setLoading(true);
    try {
      const list = await listCompanies();
      if (activeKey.current !== requestKey) return;
      const saved = localStorage.getItem(COMPANY_KEY);
      const nextId =
        saved && list.some((c) => c.id === saved)
          ? saved
          : (list[0]?.id ?? null);
      setState({ tenantKey: requestKey, companies: list, companyId: nextId, error: null });
      if (nextId) localStorage.setItem(COMPANY_KEY, nextId);
    } catch (err) {
      if (activeKey.current !== requestKey) return;
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load company context';
      setState({ tenantKey: requestKey, companies: [], companyId: null, error: message });
    } finally {
      if (activeKey.current === requestKey) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, tenantKey]);

  const setCompanyId = useCallback((id: string) => {
    setState((prev) => ({ ...prev, companyId: id }));
    localStorage.setItem(COMPANY_KEY, id);
  }, []);

  // Never expose companies loaded for a previous organization, even for the render
  // between the switch and the reload effect.
  const current = state.tenantKey === tenantKey ? state : EMPTY_STATE;
  const company = current.companies.find((c) => c.id === current.companyId) ?? null;

  return (
    <CompanyContext.Provider
      value={{
        companies: current.companies,
        companyId: current.companyId,
        company,
        loading: loading || state.tenantKey !== tenantKey,
        error: current.error,
        setCompanyId,
        refresh,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error('useCompany must be used within CompanyProvider');
  }
  return ctx;
}
