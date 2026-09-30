import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, Users } from 'lucide-react';
import type { EmployeeRecord } from '@hrm/shared-types';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Toggle';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgErrorBanner, OrgSearchInput, OrgTableSkeleton } from '@/components/org/OrgScreenParts';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import { EmployeeLeaveBalances } from '@/components/leave/EmployeeLeaveBalances';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
import { listEmployees } from '@/lib/employees-api';
import { formatIsoDate, todayIso } from '@/lib/leave-policy';
import { ApiError } from '@/lib/tenant-api-client';

type StatusFilter = 'current' | 'all';

export function LeaveBalancePage() {
  const { companyId, loading: companyLoading, error: companyError } = useCompany();

  if (companyLoading) return <PageLoadingState message="Loading company…" />;
  if (companyError) return <PageErrorState error={companyError} />;
  if (!companyId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">No company found for this tenant.</div>
    );
  }
  return <LeaveBalanceScreen key={companyId} companyId={companyId} />;
}

function LeaveBalanceScreen({ companyId }: { companyId: string }) {
  const { openEmployee } = useNav();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('employee');

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('current');

  const load = useCallback(async () => {
    setError(null);
    try {
      setEmployees(await listEmployees(companyId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees
      .filter((e) => statusFilter === 'all' || e.employmentStatus !== 'terminated')
      .filter(
        (e) =>
          !q ||
          e.fullName.toLowerCase().includes(q) ||
          e.employeeNumber.toLowerCase().includes(q) ||
          (e.department?.name ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [employees, search, statusFilter]);

  const selected = employees.find((e) => e.id === selectedId) ?? null;
  const select = (id: string) => setSearchParams({ employee: id }, { replace: true });
  const inProbation = Boolean(
    selected?.probationEndDate && selected.probationEndDate >= todayIso(),
  );

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">Leave</p>
          <h1 className="text-xl font-bold text-primary">Leave Balances</h1>
          <p className="text-sm text-secondary mt-0.5">
            Entitlement, usage and carry-forward for each employee in the current leave year.
          </p>
        </div>
        <CompanySelector />
      </div>

      {error ? <OrgErrorBanner message={error} onRetry={() => void load()} /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
        <Card className="lg:sticky lg:top-4">
          <CardHeader className="space-y-2">
            <OrgSearchInput value={search} onChange={setSearch} placeholder="Search employees" />
            <Select
              aria-label="Employee status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-9"
            >
              <option value="current">Current employees</option>
              <option value="all">Include terminated</option>
            </Select>
          </CardHeader>
          {loading ? (
            <OrgTableSkeleton columns={1} rows={6} />
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted text-center py-10 px-4">
              {employees.length === 0 ? 'No employees yet.' : 'No employees match your search.'}
            </p>
          ) : (
            <ul className="max-h-[32vh] lg:max-h-[65vh] overflow-y-auto scrollbar-thin divide-y divide-[rgb(var(--border-base))]">
              {visible.map((e) => {
                const active = e.id === selectedId;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => select(e.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        active
                          ? 'bg-accent-50 dark:bg-accent-950/40'
                          : 'hover:bg-[rgb(var(--bg-hover))]'
                      }`}
                    >
                      <Avatar name={e.fullName} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-sm truncate ${
                            active ? 'font-semibold text-accent-700 dark:text-accent-300' : 'font-medium text-primary'
                          }`}
                        >
                          {e.fullName}
                        </span>
                        <span className="block text-xs text-muted truncate">
                          {e.employeeNumber}
                          {e.department ? ` · ${e.department.name}` : ''}
                        </span>
                      </span>
                      {e.employmentStatus === 'terminated' ? <Badge>Left</Badge> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {!loading && employees.length > 0 ? (
            <p className="px-4 py-2 text-xs text-muted border-t border-base">
              {visible.length} employee{visible.length === 1 ? '' : 's'}
            </p>
          ) : null}
        </Card>

        <div className="space-y-4 min-w-0">
          {selected ? (
            <>
              <Card>
                <CardBody className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={selected.fullName} size="lg" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-primary truncate">
                          {selected.fullName}
                        </h2>
                        {inProbation ? <Badge tone="warning">On probation</Badge> : null}
                      </div>
                      <p className="text-xs text-muted">
                        {[
                          selected.employeeNumber,
                          selected.designation?.name,
                          selected.department?.name,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        Hired {formatIsoDate(selected.hireDate)}
                        {selected.probationEndDate
                          ? ` · Probation ${inProbation ? 'ends' : 'ended'} ${formatIsoDate(selected.probationEndDate)}`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => openEmployee(selected.id)}>
                    <ExternalLink className="h-3.5 w-3.5" /> Open profile
                  </Button>
                </CardBody>
              </Card>
              <EmployeeLeaveBalances
                key={selected.id}
                employeeId={selected.id}
                companyId={companyId}
                probationEndDate={selected.probationEndDate}
              />
            </>
          ) : (
            <Card>
              <EmptyState
                icon={Users}
                title={loading ? 'Loading employees…' : 'Select an employee'}
                description="Choose someone from the list to see their balance for each leave type, what's pending, and any carried-forward days."
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
