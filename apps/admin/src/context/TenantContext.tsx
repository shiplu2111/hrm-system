import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { TenantMembershipView } from '@hrm/shared-types';
import {
  applyPortalAuthBundle,
  listPortalTenants,
  switchPortalTenant,
} from '@hrm/portal-ui';
import { useAuth } from '@hrm/portal-ui';
import { ApiError } from '@/lib/tenant-api-client';

const COMPANY_KEY = 'hrm_selected_company_id';

interface TenantContextValue {
  memberships: TenantMembershipView[];
  current: TenantMembershipView | null;
  loading: boolean;
  switching: boolean;
  error: string | null;
  sessionVersion: number;
  /** Changes whenever the active organization session changes; key tenant-scoped state on it. */
  tenantKey: string;
  switchOrganization: (tenantId: string) => Promise<void>;
  refreshMemberships: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, refreshSession } = useAuth();
  const [memberships, setMemberships] = useState<TenantMembershipView[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionVersion, setSessionVersion] = useState(0);

  const refreshMemberships = useCallback(async () => {
    if (!user) {
      setMemberships([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listPortalTenants('admin');
      setMemberships(list);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load organizations';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.tenantId]);

  useEffect(() => {
    void refreshMemberships();
  }, [refreshMemberships, user?.tenantId, sessionVersion]);

  const switchOrganization = useCallback(
    async (tenantId: string) => {
      if (switching || user?.tenantId === tenantId) return;
      setSwitching(true);
      setError(null);
      try {
        const bundle = await switchPortalTenant('admin', tenantId);
        applyPortalAuthBundle('admin', bundle);
        refreshSession();
        localStorage.removeItem(COMPANY_KEY);
        setSessionVersion((v) => v + 1);
        await refreshMemberships();
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to switch organization';
        setError(message);
        throw err;
      } finally {
        setSwitching(false);
      }
    },
    [refreshMemberships, refreshSession, switching, user?.tenantId],
  );

  const current = useMemo(
    () =>
      memberships.find((m) => m.tenantId === user?.tenantId) ??
      memberships.find((m) => m.isCurrent) ??
      null,
    [memberships, user?.tenantId],
  );

  const tenantKey = `${user?.tenantId ?? 'none'}:${sessionVersion}`;

  const value = useMemo(
    () => ({
      memberships,
      current,
      loading,
      switching,
      error,
      sessionVersion,
      tenantKey,
      switchOrganization,
      refreshMemberships,
    }),
    [
      memberships,
      current,
      loading,
      switching,
      error,
      sessionVersion,
      tenantKey,
      switchOrganization,
      refreshMemberships,
    ],
  );

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return ctx;
}
