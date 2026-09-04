import { useCallback, useEffect, useState } from 'react';
import type { AdminDashboardView } from '@hrm/shared-types';
import { ApiError } from '@/lib/tenant-api-client';
import { getAdminDashboard } from '@/lib/dashboard-api';

export function useAdminDashboard(companyId: string | null) {
  const [data, setData] = useState<AdminDashboardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await getAdminDashboard(companyId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
