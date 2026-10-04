import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronRight,
  ListChecks,
  Loader2,
  PlayCircle,
  Search,
} from 'lucide-react';
import type { EmployeeOnboardingRecord, EmployeeRecord } from '@hrm/shared-types';
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
import { listEmployeeOnboardings } from '@/lib/onboarding-api';
import { formatShortDate, onboardingStatusBadge } from '@/lib/onboarding-display';
import { ApiError } from '@/lib/tenant-api-client';

type StatusTab = 'in_progress' | 'completed' | 'all';

const TABS: { key: StatusTab; label: string }[] = [
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All' },
];

export function OnboardingPage() {
  const { companyId } = useCompany();
  const { navigate, openEmployeeOnboarding } = useNav();
  const canCreate = usePermission('employee', 'create');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onboardings, setOnboardings] = useState<EmployeeOnboardingRecord[]>([]);
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
      setOnboardings(await listEmployeeOnboardings(companyId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load onboardings');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      in_progress: onboardings.filter((o) => o.status === 'in_progress').length,
      completed: onboardings.filter((o) => o.status === 'completed').length,
      all: onboardings.length,
    }),
    [onboardings],
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return onboardings.filter(
      (o) =>
        (tab === 'all' || o.status === tab) &&
        (!term ||
          o.employeeName.toLowerCase().includes(term) ||
          o.employeeNumber.toLowerCase().includes(term)),
    );
  }, [onboardings, tab, search]);

  const attention = useMemo(
    () => ({
      overdue: onboardings
        .filter((o) => o.status === 'in_progress')
        .reduce((sum, o) => sum + o.overdueTaskCount, 0),
      verification: onboardings
        .filter((o) => o.status === 'in_progress')
        .reduce((sum, o) => sum + o.documentsPendingVerificationCount, 0),
    }),
    [onboardings],
  );

  const openStart = async () => {
    if (!companyId) return;
    setStartOpen(true);
    setEmployeesLoading(true);
    try {
      const all = await listEmployees(companyId);
      const withOnboarding = new Set(onboardings.map((o) => o.employeeId));
      const eligible = all.filter(
        (e) => !withOnboarding.has(e.id) && e.employmentStatus !== 'terminated',
      );
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
          Select a company to manage onboarding.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-primary">Onboarding</h1>
          <p className="text-sm text-secondary mt-0.5">
            Track each new employee’s checklist, document collection and verification
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CompanySelector />
          <Button variant="secondary" onClick={() => navigate('onboarding-templates')}>
            <ListChecks className="h-4 w-4" /> Checklist templates
          </Button>
          {canCreate ? (
            <Button onClick={() => void openStart()}>
              <PlayCircle className="h-4 w-4" /> Start onboarding
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
          { label: 'Completed', value: counts.completed },
          { label: 'Overdue tasks', value: attention.overdue, alert: attention.overdue > 0 },
          {
            label: 'Documents awaiting verification',
            value: attention.verification,
            alert: attention.verification > 0,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody>
              <div className="text-xs text-muted">{stat.label}</div>
              <div
                className={`text-2xl font-bold mt-1 ${
                  stat.alert ? 'text-warning-600' : 'text-primary'
                }`}
              >
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
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading onboardings…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-strong px-6 py-12 text-center text-sm text-secondary">
          {onboardings.length === 0
            ? 'No onboardings yet. Onboarding starts automatically when a candidate is converted to an employee.'
            : 'No onboardings match this view.'}
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
                    Checklist
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
                  const status = onboardingStatusBadge(row.status);
                  const flags = [
                    row.overdueTaskCount > 0
                      ? { label: `${row.overdueTaskCount} overdue`, tone: 'error' as const }
                      : null,
                    row.documentsMissingCount > 0
                      ? {
                          label: `${row.documentsMissingCount} doc${row.documentsMissingCount === 1 ? '' : 's'} missing`,
                          tone: 'neutral' as const,
                        }
                      : null,
                    row.documentsPendingVerificationCount > 0
                      ? {
                          label: `${row.documentsPendingVerificationCount} to verify`,
                          tone: 'warning' as const,
                        }
                      : null,
                  ].filter((flag) => flag !== null);
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-[rgb(var(--bg-hover))] cursor-pointer"
                      onClick={() => openEmployeeOnboarding(row.employeeId)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={row.employeeName} size="sm" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-primary truncate">
                              {row.employeeName}
                            </div>
                            <div className="text-xs text-muted truncate">
                              {row.employeeNumber}
                              {row.designationName ? ` · ${row.designationName}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <div className="text-sm text-primary">{row.templateName ?? '—'}</div>
                        <div className="text-xs text-muted">
                          Started {formatShortDate(row.startedAt)}
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
        title="Start onboarding"
        description="Pick the employee; you choose the checklist and start date on their tracker."
        footer={
          <>
            <Button variant="secondary" onClick={() => setStartOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!startEmployeeId}
              onClick={() => {
                setStartOpen(false);
                openEmployeeOnboarding(startEmployeeId);
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
          <p className="text-sm text-secondary">Every employee already has an onboarding record.</p>
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
