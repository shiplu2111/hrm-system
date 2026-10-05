import { useCallback, useEffect, useState } from 'react';
import type { EmployeeRecord } from '@hrm/shared-types';
import { useAuth } from '@hrm/portal-ui';
import { useAppTranslation } from '@hrm/i18n';
import { getMyProfile } from '@/lib/my-api';
import { ApiError } from '@/lib/tenant-api-client';

/** The signed-in user's own employee record; `employeeId` is null for accounts with no employee link. */
export function useMyEmployee() {
  const { t } = useAppTranslation();
  const { user } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const [profile, setProfile] = useState<EmployeeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!employeeId) {
      setProfile(null);
      setError(t('errors.notLinked'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setProfile(await getMyProfile(employeeId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.loadEmployeeData'));
    } finally {
      setLoading(false);
    }
  }, [employeeId, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { employeeId, profile, companyId: profile?.companyId ?? null, loading, error, reload };
}
