import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronRight, Loader2, PlayCircle, Search } from 'lucide-react';
import type { EmployeeOffboardingRecord, EmployeeRecord } from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { CompanySelector } from '@/components/org/CompanySelector';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/Progress';
import { Avatar } from '@/components/ui/Toggle';
import { Input, Label, Select } from '@/components/ui/Form';
import { DataTable, DataTableBody, DataTableHead } from '@/components/ui/DataTable';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
import { listEmployees } from '@/lib/employees-api';
import { listEmployeeOffboardings } from '@/lib/offboarding-api';
import { offboardingStatusBadge } from '@/lib/offboarding-display';
import { formatShortDate } from '@/lib/onboarding-display';
import { ApiError } from '@/lib/tenant-api-client';

type StatusTab = 'in_progress' | 'completed' | 'all';

const TABS: { key: StatusTab; label: string }[] = [
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All' },
];

function daysUntil(date: string): number {
  const target = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function lastDayHint(date: string | null, status: EmployeeOffboardingRecord['status']): string | null {
  if (!date || status !== 'in_progress') return null;
  const days = daysUntil(date);
  if (days === 0) return 'Today';
  if (days > 0) return `In ${days} day${days === 1 ? '' : 's'}`;
  return `${-days} day${days === -1 ? '' : 's'} ago`;
}

export function OffboardingPage() {
  const { companyId } = useCompany();
  const { openEmployeeOffboarding } = useNav();
  const canCreate = usePermission('employee', 'create');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offboardings, setOffboardings] = useState<EmployeeOffboardingRecord[]>([]);
  const [tab, setTab] = useState<StatusTab>('in_progress');
  const [search, setSearch] = useState('');

  const [startOpen, setStartOpen] = useState(false);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [startEmployeeId, setStartEmployeeId] = useState('');
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      setOffboardings(await listEmployeeOffboardings(companyId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load offboardings');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = useMemo(() => offboardings.filter((o) => o.status === 'in_progress'), [offboardings]);

  const counts = useMemo(
    () => ({
      in_progress: active.length,
      completed: offboardings.filter((o) => o.status === 'completed').length,
      all: offboardings.length,
    }),
    [offboardings, active],
  );

  const attention = useMemo(
    () => ({
      overdue: active.reduce((sum, o) => sum + o.overdueTaskCount, 0),
      assets: active.reduce((sum, o) => sum + o.assetsOutstandingCount, 0),
      accessActive: active.filter((o) => !o.accessRevokedAt).length,
    }),
    [active],
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return offboardings
      .filter(
        (o) =>
          (tab === 'all' || o.status === tab) &&
          (!term ||
            o.employeeName.toLowerCase().includes(term) ||
            o.employeeNumber.toLowerCase().includes(term)),
      )
      .sort((a, b) => (a.lastWorkingDate ?? '9999').localeCompare(b.lastWorkingDate ?? '9999'));
  }, [offboardings, tab, search]);

  const openStart = async () => {
    if (!companyId) return;
    setStartOpen(true);
    setEmployeesLoading(true);
    try {
      const all = await listEmployees(companyId);
      const withOffboarding = new Set(offboardings.map((o) => o.employeeId));
      const eligible = all
        .filter((e) => !withOffboarding.has(e.id) && e.employmentStatus !== 'terminated')
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
      setEmployees(eligible);
      setStartEmployeeId(eligible[0]?.id ?? '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load employees');
      setStartOpen(false);
    } finally {
      setEmployeesLoading(false);
    }
  };

  if (!companyId) {
    return (
      <div className="p-4 lg:p-6">
        <CompanySelector />
        <div className="mt-6 rounded-xl border border-dashed border-strong px-6 py-12 text-center text-sm text-secondary">
          Select a company to manage offboarding.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-primary">Offboarding</h1>
          <p className="text-sm text-secondary mt-0.5">
            Clearance, asset return, access revocation, exit interviews and final settlement
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CompanySelector />
          {canCreate ? (
            <Button onClick={() => void openStart()}>
              <PlayCircle className="h-4 w-4" /> Start offboarding
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'In progress', value: counts.in_progress },
          { label: 'Overdue steps', value: attention.overdue, alert: attention.overdue > 0 },
          { label: 'Assets still out', value: attention.assets, alert: attention.assets > 0 },
          {
            label: 'Access not yet revoked',
            value: attention.accessActive,
            alert: attention.accessActive > 0,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody>
              <div className="text-xs text-muted">{stat.label}</div>
              <div className={`text-2xl font-bold mt-1 ${stat.alert ? 'text-warning-600' : 'text-primary'}`}>
                {stat.value}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-base">
        <div className="flex gap-1 overflow-x-auto scrollbar-thin">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                tab === key
                  ? 'border-accent-600 text-accent-600'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              {label} <span className="text-xs text-muted">({counts[key]})</span>
            </button>
          ))}
        </div>
        <div className="relative pb-2 sm:w-64">
          <Search className="absolute left-3 top-[9px] h-4 w-4 text-muted" />
          <Input
            className="pl-9"
            value={search}
            placeholder="Search employee"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-secondary">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading offboardings…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-strong px-6 py-12 text-center text-sm text-secondary">
          {offboardings.length === 0
            ? 'No offboardings yet. Offboarding starts automatically when a resignation or termination is recorded under Lifecycle Events.'
            : 'No offboardings match this view.'}
        </div>
      ) : (
        <Card>
          <CardBody className="p-0">
            <DataTable>
              <DataTableHead>
                <tr>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase">
                    Employee
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase hidden md:table-cell">
                    Last working day
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase w-48">
                    Progress
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase hidden lg:table-cell">
                    Needs attention
                  </th>
                  <th className="w-10" />
                </tr>
              </DataTableHead>
              <DataTableBody>
                {rows.map((row) => {
                  const status = offboardingStatusBadge(row.status);
                  const hint = lastDayHint(row.lastWorkingDate, row.status);
                  const flags =
                    row.status === 'in_progress'
                      ? [
                          row.overdueTaskCount > 0
                            ? { label: `${row.overdueTaskCount} overdue`, tone: 'error' as const }
                            : null,
                          row.assetsOutstandingCount > 0
                            ? {
                                label: `${row.assetsOutstandingCount} asset${row.assetsOutstandingCount === 1 ? '' : 's'} out`,
                                tone: 'warning' as const,
                              }
                            : null,
                          !row.accessRevokedAt ? { label: 'Access active', tone: 'neutral' as const } : null,
                        ].filter((flag) => flag !== null)
                      : [];
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-[rgb(var(--bg-hover))] cursor-pointer"
                      onClick={() => openEmployeeOffboarding(row.employeeId)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={row.employeeName} size="sm" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-primary truncate">{row.employeeName}</div>
                            <div className="text-xs text-muted truncate">
                              {row.employeeNumber}
                              {row.departmentName ? ` · ${row.departmentName}` : ''}
                              {row.designationName ? ` · ${row.designationName}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <div className="text-sm text-primary">
                          {row.lastWorkingDate ? formatShortDate(row.lastWorkingDate) : 'Not set'}
                        </div>
                        <div
                          className={`text-xs ${hint?.endsWith('ago') ? 'text-warning-700' : 'text-muted'}`}
                        >
                          {hint ?? (row.templateName ? row.templateName : '')}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <Badge tone={status.tone}>{status.label}</Badge>
                          <span className="font-semibold text-primary">{row.progressPercent}%</span>
                        </div>
                        <ProgressBar
                          value={row.progressPercent}
                          tone={row.progressPercent === 100 ? 'success' : 'accent'}
                        />
                        <div className="text-xs text-muted mt-1">
                          {row.requiredCompletedCount}/{row.requiredTaskCount} required
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        {flags.length === 0 ? (
                          <span className="text-xs text-muted">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {flags.map((flag) => (
                              <Badge key={flag.label} tone={flag.tone}>
                                {flag.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted">
                        <ChevronRight className="h-4 w-4" />
                      </td>
                    </tr>
                  );
                })}
              </DataTableBody>
            </DataTable>
          </CardBody>
        </Card>
      )}

      <Modal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        title="Start offboarding"
        description="Pick the employee; you choose the checklist and last working day on their tracker. Recording a resignation or termination under Lifecycle Events starts it automatically."
        footer={
          <>
            <Button variant="secondary" onClick={() => setStartOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!startEmployeeId}
              onClick={() => {
                setStartOpen(false);
                openEmployeeOffboarding(startEmployeeId);
              }}
            >
              Continue
            </Button>
          </>
        }
      >
        {employeesLoading ? (
          <div className="flex items-center text-sm text-secondary">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading employees…
          </div>
        ) : employees.length === 0 ? (
          <p className="text-sm text-secondary">Every active employee already has an offboarding record.</p>
        ) : (
          <div>
            <Label>Employee</Label>
            <Select value={startEmployeeId} onChange={(e) => setStartEmployeeId(e.target.value)}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName} ({e.employeeNumber})
                </option>
              ))}
            </Select>
          </div>
        )}
      </Modal>
    </div>
  );
}
