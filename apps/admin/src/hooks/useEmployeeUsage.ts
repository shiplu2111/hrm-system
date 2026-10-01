import { useCallback, useEffect, useState } from 'react';
import { usePermission } from '@hrm/portal-ui';
import { listEmployees } from '@/lib/employees-api';

export type UsageField = 'designationId' | 'employmentTypeId' | 'costCentreId';

/**
 * Employee counts per org entity (any status, matching the API's delete guard),
 * used to show usage and pre-empt delete conflicts.
 * Returns null counts when the user can't list employees; the API still enforces the rule.
 */
export function useEmployeeUsage(companyId: string, field: UsageField | null) {
  const canViewEmployees = usePermission('employee', 'view');
  const [counts, setCounts] = useState<Map<string, number> | null>(null);

  const reload = useCallback(async () => {
    if (!canViewEmployees || !field) {
      setCounts(null);
      return;
    }
    try {
      const employees = await listEmployees(companyId);
      const next = new Map<string, number>();
      for (const employee of employees) {
        const id = employee[field];
        if (id) next.set(id, (next.get(id) ?? 0) + 1);
      }
      setCounts(next);
    } catch {
      setCounts(null);
    }
  }, [canViewEmployees, companyId, field]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const countFor = useCallback(
    (id: string): number | null => (counts ? (counts.get(id) ?? 0) : null),
    [counts],
  );

  return { countFor, reload };
}
