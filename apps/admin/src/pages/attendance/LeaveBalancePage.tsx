import { useCallback, useEffect, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import type { EmployeeRecord, LeaveBalanceRecord } from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Toggle';
import { ProgressBar } from '@/components/ui/Progress';
import { CompanySelector } from '@/components/org/CompanySelector';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import { useCompany } from '@/context/CompanyContext';
import { listEmployees } from '@/lib/employees-api';
import { getEmployeeLeaveBalances } from '@/lib/leave-api';
import { ApiError } from '@/lib/tenant-api-client';

interface EmployeeBalances {
  employee: EmployeeRecord;
  balances: LeaveBalanceRecord[];
}

export function LeaveBalancePage() {
  const { companyId, loading: companyLoading, error: companyError } = useCompany();
  const [rows, setRows] = useState<EmployeeBalances[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const employees = await listEmployees(companyId);
      const withBalances = await Promise.all(
        employees.map(async (employee) => ({
          employee,
          balances: await getEmployeeLeaveBalances(employee.id),
        })),
      );
      setRows(withBalances);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load leave balances');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (companyLoading) return <PageLoadingState message="Loading company…" />;
  if (companyError) return <PageErrorState error={companyError} />;
  if (!companyId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">
        No company found for this tenant.
      </div>
    );
  }

  const filtered = rows.filter((row) => {
    const name = `${row.employee.firstName} ${row.employee.lastName}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Leave Balance Dashboard</h1>
          <p className="text-sm text-secondary mt-0.5">Per-employee leave entitlement and usage</p>
        </div>
        <CompanySelector />
      </div>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="relative w-64 max-w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employee..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(({ employee, balances }) => (
            <Card key={employee.id}>
              <CardBody>
                <div className="flex items-center gap-3 mb-4">
                  <Avatar name={`${employee.firstName} ${employee.lastName}`} size="md" />
                  <div>
                    <div className="text-sm font-semibold text-primary">
                      {employee.firstName} {employee.lastName}
                    </div>
                    <div className="text-xs text-muted">{employee.employeeNumber}</div>
                  </div>
                </div>
                <div className="space-y-3">
                  {balances.length === 0 ? (
                    <p className="text-xs text-muted">No leave balances accrued yet.</p>
                  ) : (
                    balances.map((bal) => {
                      const used = Math.max(0, bal.entitlementDays - bal.balanceDays);
                      const pct = bal.entitlementDays
                        ? Math.min(100, (used / bal.entitlementDays) * 100)
                        : 0;
                      return (
                        <div key={bal.id}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-primary">{bal.leaveTypeName ?? 'Leave'}</span>
                            <span className="text-muted">
                              {bal.balanceDays.toFixed(1)} / {bal.entitlementDays} days left
                            </span>
                          </div>
                          <ProgressBar value={pct} tone="accent" />
                        </div>
                      );
                    })
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
