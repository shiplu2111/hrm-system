import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { CompanySummary } from '@hrm/shared-types';
import { listCompanies } from '@/lib/organization-api';
import { ApiError } from '@/lib/tenant-api-client';

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

const CompanyContext = createContext<CompanyContextValue | undefined>(
  undefined,
);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [companyId, setCompanyIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listCompanies();
      setCompanies(list);
      const saved = localStorage.getItem(COMPANY_KEY);
      const nextId =
        saved && list.some((c) => c.id === saved)
          ? saved
          : (list[0]?.id ?? null);
      setCompanyIdState(nextId);
      if (nextId) localStorage.setItem(COMPANY_KEY, nextId);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load company context';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setCompanyId = useCallback((id: string) => {
    setCompanyIdState(id);
    localStorage.setItem(COMPANY_KEY, id);
  }, []);

  const company = companies.find((c) => c.id === companyId) ?? null;

  return (
    <CompanyContext.Provider
      value={{
        companies,
        companyId,
        company,
        loading,
        error,
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
