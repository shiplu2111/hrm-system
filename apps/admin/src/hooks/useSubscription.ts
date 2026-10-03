import { useCallback, useEffect, useState } from 'react';
import type { TenantSubscriptionView } from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { getSubscription } from '@/lib/billing-api';
import { billingCopy } from '@/lib/billing-copy';
import { ApiError } from '@/lib/tenant-api-client';

/**
 * Current plan and usage. `view` stays null when the user can't view settings;
 * the API still enforces plan limits for them.
 */
export function useSubscription() {
  const canView = usePermission('settings', 'view');
  const [view, setView] = useState<TenantSubscriptionView | null>(null);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!canView) {
      setView(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setView(await getSubscription());
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : billingCopy.loadError);
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { view, loading, error, reload, canView };
}
