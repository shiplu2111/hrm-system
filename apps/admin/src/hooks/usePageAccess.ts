import { useCallback, useMemo } from 'react';
import { isSelfServiceOnlyUser, useAuth, usePermissions } from '@hrm/portal-ui';
import type { PageKey } from '@/context/NavContext';
import { canViewPage, type PageAccessContext } from '@/config/page-permissions';

/** Page visibility for the signed-in user: role permissions plus data scope. */
export function usePageAccess() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const selfServiceOnly = user ? isSelfServiceOnlyUser(user) : false;
  const hasEmployeeRecord = !!user?.employeeId;

  const access = useMemo<PageAccessContext>(
    () => ({ selfServiceOnly, hasEmployeeRecord }),
    [selfServiceOnly, hasEmployeeRecord],
  );

  const canView = useCallback((page: PageKey) => canViewPage(page, can, access), [can, access]);

  /** Where to send users who open a page they can't see. */
  const homePage: PageKey = canView('dashboard') ? 'dashboard' : 'my-dashboard';

  return { canView, access, selfServiceOnly, homePage };
}
