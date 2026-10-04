import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  DollarSign,
  Hourglass,
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { PermissionGate, usePermission } from '@hrm/portal-ui';
import type {
  TimesheetEntryRecord,
  TimesheetEntryStatus,
  TimesheetProjectRecord,
  WorkflowApprovalRoute,
} from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Toggle';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { TimesheetReviewModal } from '@/components/timesheets/TimesheetReviewModal';
import { WorkflowApprovalTimeline } from '@/components/workflow/WorkflowApprovalTimeline';
import { useNav } from '@/context/NavContext';
import { listEmployees } from '@/lib/employees-api';
import {
  createTimesheetEntry,
  getTimesheetApprovalRoute,
  listTimesheetEntries,
  listTimesheetProjects,
} from '@/lib/timesheets-api';
import {
  DATE_RANGE_PRESETS,
  TIMESHEET_STATUS_OPTIONS,
  currentStepLabel,
  detectPreset,
  formatEntryDate,
  formatHours,
  formatRangeLabel,
  formatTimeRange,
  localDateTimeIso,
  presetRange,
  timesheetStatusTone,
  toLocalIsoDate,
  type DateRangePreset,
} from '@/lib/timesheet-display';
import { ApiError } from '@/lib/tenant-api-client';

type View = 'entries' | 'employee' | 'project';

const VIEWS: Array<{ key: View; label: string }> = [
  { key: 'entries', label: 'Entries' },
  { key: 'employee', label: 'By employee' },
  { key: 'project', label: 'By project' },
];

interface GroupRow {
  key: string;
  label: string;
  sublabel: string;
  entries: number;
  people: number;
  total: number;
  billable: number;
  nonBillable: number;
  approved: number;
  pending: number;
}

function summarize(
  entries: TimesheetEntryRecord[],
  keyOf: (e: TimesheetEntryRecord) => string,
  labelOf: (e: TimesheetEntryRecord) => { label: string; sublabel: string },
): GroupRow[] {
  const groups = new Map<string, GroupRow & { employeeIds: Set<string> }>();
  for (const entry of entries) {
    const key = keyOf(entry);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        ...labelOf(entry),
        entries: 0,
        people: 0,
        total: 0,
        billable: 0,
        nonBillable: 0,
        approved: 0,
        pending: 0,
        employeeIds: new Set(),
      };
      groups.set(key, group);
    }
    group.entries += 1;
    group.total += entry.totalHours;
    group.billable += entry.billableHours;
    group.nonBillable += entry.nonBillableHours;
    if (entry.status === 'approved') group.approved += entry.totalHours;
    if (entry.status === 'pending_approval') group.pending += 1;
    group.employeeIds.add(entry.employeeId);
  }
  return [...groups.values()]
    .map(({ employeeIds, ...row }) => ({ ...row, people: employeeIds.size }))
    .sort((a, b) => b.total - a.total);
}

const thClass = 'text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider';

function TimesheetContent({ companyId }: { companyId: string }) {
  const { navigate } = useNav();
  const canApprove = usePermission('attendance', 'approve');
  const [params, setParams] = useSearchParams();

  const defaultRange = useMemo(() => presetRange('this_month'), []);
  const fromDate = params.get('from') ?? defaultRange.from;
  const toDate = params.get('to') ?? defaultRange.to;
  const employeeFilter = params.get('employee') ?? '';
  const projectFilter = params.get('project') ?? '';
  const statusFilter = (params.get('status') ?? 'all') as TimesheetEntryStatus | 'all';
  const view = (VIEWS.some((v) => v.key === params.get('view')) ? params.get('view') : 'entries') as View;
  const [preset, setPreset] = useState<DateRangePreset>(() => detectPreset(fromDate, toDate));

  const [entries, setEntries] = useState<TimesheetEntryRecord[]>([]);
  const [projects, setProjects] = useState<TimesheetProjectRecord[]>([]);
  const [employees, setEmployees] = useState<{ id: string; fullName: string; employeeNumber: string }[]>([]);
  const [route, setRoute] = useState<WorkflowApprovalRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reviewing, setReviewing] = useState<TimesheetEntryRecord | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [projectRows, employeeRows, routeRow] = await Promise.all([
          listTimesheetProjects(companyId),
          listEmployees(companyId),
          getTimesheetApprovalRoute(companyId),
        ]);
        if (cancelled) return;
        setProjects(projectRows);
        setEmployees(
          employeeRows
            .map((e) => ({
              id: e.id,
              fullName: `${e.firstName} ${e.lastName}`.trim(),
              employeeNumber: e.employeeNumber,
            }))
            .sort((a, b) => a.fullName.localeCompare(b.fullName)),
        );
        setRoute(routeRow);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load timesheet settings');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(
        await listTimesheetEntries(companyId, {
          employeeId: employeeFilter || undefined,
          projectId: projectFilter || undefined,
          fromDate,
          toDate,
          status: statusFilter === 'all' ? undefined : statusFilter,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load timesheet entries');
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeFilter, projectFilter, fromDate, toDate, statusFilter]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.employeeName, e.employeeNumber, e.projectName, e.taskName, e.notes]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [entries, search]);

  const totals = useMemo(() => {
    const total = visible.reduce((s, e) => s + e.totalHours, 0);
    const billable = visible.reduce((s, e) => s + e.billableHours, 0);
    return {
      total,
      billable,
      nonBillable: visible.reduce((s, e) => s + e.nonBillableHours, 0),
      billablePct: total > 0 ? Math.round((billable / total) * 100) : 0,
      pending: visible.filter((e) => e.status === 'pending_approval').length,
      awaitingMe: visible.filter((e) => e.canAct).length,
      anomalies: visible.filter((e) => e.timeAnomaly).length,
    };
  }, [visible]);

  const byEmployee = useMemo(
    () =>
      summarize(
        visible,
        (e) => e.employeeId,
        (e) => ({ label: e.employeeName ?? 'Employee', sublabel: e.employeeNumber ?? '' }),
      ),
    [visible],
  );
  const byProject = useMemo(
    () =>
      summarize(
        visible,
        (e) => e.projectId,
        (e) => ({
          label: e.projectName ?? 'Project',
          sublabel: projects.find((p) => p.id === e.projectId)?.code ?? '',
        }),
      ),
    [visible, projects],
  );

  const choosePreset = (value: DateRangePreset) => {
    setPreset(value);
    if (value !== 'custom') {
      const range = presetRange(value);
      updateParams({ from: range.from, to: range.to });
    }
  };

  const setDate = (key: 'from' | 'to', value: string) => {
    if (!value) return;
    setPreset('custom');
    updateParams({ [key]: value });
  };

  const employeeName = employees.find((e) => e.id === employeeFilter)?.fullName;
  const projectName = projects.find((p) => p.id === projectFilter)?.name;
  const hasFilters = !!(employeeFilter || projectFilter || statusFilter !== 'all' || search);

  const tiles = [
    {
      label: 'Total hours',
      value: formatHours(totals.total),
      hint: `${visible.length} ${visible.length === 1 ? 'entry' : 'entries'}`,
      icon: Clock,
      tone: 'bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400',
    },
    {
      label: 'Billable',
      value: formatHours(totals.billable),
      hint: `${totals.billablePct}% of logged time`,
      icon: DollarSign,
      tone: 'bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400',
    },
    {
      label: 'Non-billable',
      value: formatHours(totals.nonBillable),
      hint: totals.anomalies ? `${totals.anomalies} with clock anomalies` : 'Internal and admin time',
      icon: Hourglass,
      tone: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    },
    {
      label: 'Pending approval',
      value: String(totals.pending),
      hint: canApprove ? `${totals.awaitingMe} waiting on you` : 'In the approval workflow',
      icon: ClipboardCheck,
      tone: 'bg-warning-50 dark:bg-warning-950/40 text-warning-600 dark:text-warning-400',
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Timesheets</h1>
          <p className="text-sm text-secondary mt-0.5">
            Hours by employee and project for {formatRangeLabel(fromDate, toDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canApprove ? (
            <Button variant="secondary" onClick={() => navigate('timesheet-approvals')}>
              <ClipboardCheck className="h-4 w-4" /> Approval queue
              {totals.awaitingMe > 0 ? <Badge tone="warning">{totals.awaitingMe}</Badge> : null}
            </Button>
          ) : null}
          <PermissionGate module="attendance" action="create">
            <Button variant="primary" onClick={() => setLogOpen(true)}>
              <Plus className="h-4 w-4" /> Log time
            </Button>
          </PermissionGate>
        </div>
      </div>

      {notice ? (
        <div className="flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 dark:bg-success-950/30 px-4 py-2.5 text-sm text-success-700 dark:text-success-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      ) : null}

      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[180px_150px_150px_1fr_1fr_170px]">
          <div>
            <Label htmlFor="ts-range">Date range</Label>
            <Select id="ts-range" value={preset} onChange={(e) => choosePreset(e.target.value as DateRangePreset)}>
              {DATE_RANGE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ts-from">From</Label>
            <Input id="ts-from" type="date" value={fromDate} max={toDate} onChange={(e) => setDate('from', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ts-to">To</Label>
            <Input id="ts-to" type="date" value={toDate} min={fromDate} onChange={(e) => setDate('to', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ts-employee-filter">Employee</Label>
            <Select
              id="ts-employee-filter"
              value={employeeFilter}
              onChange={(e) => updateParams({ employee: e.target.value || null })}
            >
              <option value="">All employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName} ({e.employeeNumber})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ts-project-filter">Project</Label>
            <Select
              id="ts-project-filter"
              value={projectFilter}
              onChange={(e) => updateParams({ project: e.target.value || null })}
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.code ? ` · ${p.code}` : ''}
                  {p.isActive ? '' : ' (inactive)'}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ts-status-filter">Status</Label>
            <Select
              id="ts-status-filter"
              value={statusFilter}
              onChange={(e) => updateParams({ status: e.target.value === 'all' ? null : e.target.value })}
            >
              {TIMESHEET_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className="surface rounded-xl border shadow-card p-4">
              <div className={`h-9 w-9 rounded-lg ${tile.tone} flex items-center justify-center mb-3`}>
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <div className="text-2xl font-bold text-primary">{tile.value}</div>
              <div className="text-xs text-secondary mt-0.5">{tile.label}</div>
              <div className="text-xs text-muted mt-0.5">{tile.hint}</div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 border-b border-base lg:flex-row lg:items-end lg:justify-between">
        <div className="flex gap-1 overflow-x-auto overflow-y-hidden">
          {VIEWS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => updateParams({ view: key === 'entries' ? null : key })}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                view === key
                  ? 'border-accent-600 text-accent-700 dark:text-accent-400'
                  : 'border-transparent text-secondary hover:text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative pb-2 lg:w-72">
          <Search className="absolute left-3 top-[calc(50%-4px)] -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="search"
            placeholder="Search employee, project, task…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm surface border border-base rounded-lg"
          />
        </div>
      </div>

      {employeeName || projectName ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Showing</span>
          {employeeName ? (
            <button
              type="button"
              onClick={() => updateParams({ employee: null })}
              className="inline-flex items-center gap-1 rounded-full border border-base px-2.5 py-0.5 text-primary hover:bg-[rgb(var(--bg-hover))]"
            >
              {employeeName} <X className="h-3 w-3" />
            </button>
          ) : null}
          {projectName ? (
            <button
              type="button"
              onClick={() => updateParams({ project: null })}
              className="inline-flex items-center gap-1 rounded-full border border-base px-2.5 py-0.5 text-primary hover:bg-[rgb(var(--bg-hover))]"
            >
              {projectName} <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      ) : null}

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-secondary">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading timesheets…
            </div>
          ) : visible.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-primary">No time logged for these filters</p>
              <p className="text-xs text-muted mt-1">
                {hasFilters ? 'Try clearing a filter or widening the date range.' : 'Try a wider date range.'}
              </p>
            </div>
          ) : view === 'entries' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                    <th className={thClass}>Employee</th>
                    <th className={thClass}>Date</th>
                    <th className={`${thClass} hidden md:table-cell`}>Project · Task</th>
                    <th className={thClass}>Hours</th>
                    <th className={`${thClass} hidden xl:table-cell`}>Billable</th>
                    <th className={thClass}>Status</th>
                    <th className="w-20 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {visible.map((entry) => (
                    <tr
                      key={entry.id}
                      onClick={() => setReviewing(entry)}
                      className="cursor-pointer hover:bg-[rgb(var(--bg-hover))] transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={entry.employeeName ?? 'Employee'} size="sm" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-primary truncate">{entry.employeeName}</div>
                            <div className="text-xs text-muted">{entry.employeeNumber}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-secondary whitespace-nowrap">
                        <div>{formatEntryDate(entry.entryDate)}</div>
                        <div className="text-xs text-muted">{formatTimeRange(entry)}</div>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <div className="text-primary">{entry.projectName}</div>
                        <div className="text-xs text-muted truncate max-w-[260px]">{entry.taskName}</div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="font-medium text-primary">{formatHours(entry.totalHours)}</span>
                        {entry.timeAnomaly ? (
                          <span className="ml-1.5 inline-flex items-center text-warning-600" title="Clock anomaly">
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                        <div className="text-xs text-muted xl:hidden">
                          {entry.isBillable ? 'Billable' : 'Non-billable'}
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden xl:table-cell">
                        <Badge tone={entry.isBillable ? 'success' : 'neutral'}>
                          {entry.isBillable ? 'Billable' : 'Non-billable'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <span className="whitespace-nowrap">
                          <Badge tone={timesheetStatusTone(entry)} dot>
                            {entry.displayStatus}
                          </Badge>
                        </span>
                        {currentStepLabel(entry) ? (
                          <div className="text-xs text-muted mt-1 max-w-[200px]">{currentStepLabel(entry)}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {entry.canAct ? (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReviewing(entry);
                            }}
                          >
                            Review
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <GroupTable
              rows={view === 'employee' ? byEmployee : byProject}
              kind={view}
              grandTotal={totals.total}
              onSelect={(key) =>
                updateParams(view === 'employee' ? { employee: key, view: null } : { project: key, view: null })
              }
            />
          )}
        </CardBody>
      </Card>

      <TimesheetReviewModal
        entry={reviewing}
        defaultRoute={route}
        onClose={() => setReviewing(null)}
        onDecided={async (_record, message) => {
          setNotice(message);
          await loadEntries();
        }}
      />

      <LogTimeModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        companyId={companyId}
        employees={employees}
        projects={projects.filter((p) => p.isActive)}
        defaultEmployeeId={employeeFilter}
        defaultProjectId={projectFilter}
        route={route}
        onLogged={async (record) => {
          setNotice(
            record.status === 'pending_approval'
              ? `Logged ${formatHours(record.totalHours)} for ${record.employeeName} and sent it for approval.`
              : `Saved a ${formatHours(record.totalHours)} draft for ${record.employeeName}.`,
          );
          await loadEntries();
        }}
      />
    </div>
  );
}

function GroupTable({
  rows,
  kind,
  grandTotal,
  onSelect,
}: {
  rows: GroupRow[];
  kind: 'employee' | 'project';
  grandTotal: number;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
            <th className={thClass}>{kind === 'employee' ? 'Employee' : 'Project'}</th>
            {kind === 'project' ? <th className={`${thClass} hidden md:table-cell`}>People</th> : null}
            <th className={`${thClass} hidden md:table-cell`}>Entries</th>
            <th className={thClass}>Total</th>
            <th className={thClass}>Billable</th>
            <th className={`${thClass} hidden lg:table-cell`}>Non-billable</th>
            <th className={`${thClass} hidden lg:table-cell`}>Approved</th>
            <th className={thClass}>Pending</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgb(var(--border-base))]">
          {rows.map((row) => {
            const share = grandTotal > 0 ? (row.total / grandTotal) * 100 : 0;
            const billablePct = row.total > 0 ? Math.round((row.billable / row.total) * 100) : 0;
            return (
              <tr
                key={row.key}
                onClick={() => onSelect(row.key)}
                className="cursor-pointer hover:bg-[rgb(var(--bg-hover))] transition-colors"
                title={`Show ${row.label}'s entries`}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    {kind === 'employee' ? <Avatar name={row.label} size="sm" /> : null}
                    <div className="min-w-0">
                      <div className="font-medium text-primary truncate">{row.label}</div>
                      {row.sublabel ? <div className="text-xs text-muted">{row.sublabel}</div> : null}
                    </div>
                  </div>
                </td>
                {kind === 'project' ? (
                  <td className="px-5 py-3 text-secondary hidden md:table-cell">{row.people}</td>
                ) : null}
                <td className="px-5 py-3 text-secondary hidden md:table-cell">{row.entries}</td>
                <td className="px-5 py-3">
                  <div className="font-medium text-primary">{formatHours(row.total)}</div>
                  <div className="mt-1 h-1.5 w-24 rounded-full bg-[rgb(var(--bg-muted))]">
                    <div className="h-1.5 rounded-full bg-accent-500" style={{ width: `${share}%` }} />
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="text-primary">{formatHours(row.billable)}</div>
                  <div className="text-xs text-muted">{billablePct}%</div>
                </td>
                <td className="px-5 py-3 text-secondary hidden lg:table-cell">{formatHours(row.nonBillable)}</td>
                <td className="px-5 py-3 text-secondary hidden lg:table-cell">{formatHours(row.approved)}</td>
                <td className="px-5 py-3">
                  {row.pending > 0 ? <Badge tone="warning">{row.pending}</Badge> : <span className="text-muted">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LogTimeModal({
  open,
  onClose,
  companyId,
  employees,
  projects,
  defaultEmployeeId,
  defaultProjectId,
  route,
  onLogged,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  employees: { id: string; fullName: string; employeeNumber: string }[];
  projects: TimesheetProjectRecord[];
  defaultEmployeeId: string;
  defaultProjectId: string;
  route: WorkflowApprovalRoute | null;
  onLogged: (record: TimesheetEntryRecord) => void | Promise<void>;
}) {
  const [form, setForm] = useState({
    employeeId: '',
    projectId: '',
    entryDate: toLocalIsoDate(new Date()),
    taskName: '',
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: 30,
    isBillable: true,
    notes: '',
  });
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm((current) => ({
      ...current,
      employeeId: defaultEmployeeId || current.employeeId || employees[0]?.id || '',
      projectId: defaultProjectId || current.projectId || projects[0]?.id || '',
      taskName: '',
      notes: '',
    }));
  }, [open, defaultEmployeeId, defaultProjectId, employees, projects]);

  const hours = (() => {
    const [sh, sm] = form.startTime.split(':').map(Number);
    const [eh, em] = form.endTime.split(':').map(Number);
    const minutes = eh * 60 + em - (sh * 60 + sm) - (form.breakMinutes || 0);
    return Math.max(0, Math.round((minutes / 60) * 100) / 100);
  })();

  const save = async (submit: boolean) => {
    if (!form.employeeId || !form.projectId) {
      setError('Pick an employee and a project.');
      return;
    }
    if (!form.taskName.trim()) {
      setError('Describe the task.');
      return;
    }
    if (form.endTime <= form.startTime) {
      setError('End time must be after start time.');
      return;
    }
    if (form.entryDate > toLocalIsoDate(new Date())) {
      setError('Time can only be logged for today or earlier.');
      return;
    }
    setSaving(submit ? 'submit' : 'draft');
    setError(null);
    try {
      const record = await createTimesheetEntry(companyId, {
        employeeId: form.employeeId,
        projectId: form.projectId,
        entryDate: form.entryDate,
        taskName: form.taskName.trim(),
        startTime: localDateTimeIso(form.entryDate, form.startTime),
        endTime: localDateTimeIso(form.entryDate, form.endTime),
        breakMinutes: form.breakMinutes || 0,
        isBillable: form.isBillable,
        notes: form.notes.trim() || undefined,
        submit,
      });
      onClose();
      await onLogged(record);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to log time');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Log time"
      description="Submitted entries go through the approval workflow shown on the right."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving !== null}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => void save(false)} disabled={saving !== null}>
            {saving === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save draft
          </Button>
          <Button variant="primary" onClick={() => void save(true)} disabled={saving !== null}>
            {saving === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Submit for approval
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_240px]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ts-employee">Employee</Label>
              <Select
                id="ts-employee"
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} ({e.employeeNumber})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ts-project">Project</Label>
              <Select
                id="ts-project"
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="ts-task">Task</Label>
            <Input
              id="ts-task"
              value={form.taskName}
              maxLength={200}
              onChange={(e) => setForm({ ...form, taskName: e.target.value })}
              placeholder="What was worked on?"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="ts-date">Date</Label>
              <Input
                id="ts-date"
                type="date"
                value={form.entryDate}
                max={toLocalIsoDate(new Date())}
                onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ts-start">Start</Label>
              <Input
                id="ts-start"
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ts-end">End</Label>
              <Input
                id="ts-end"
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ts-break">Break (min)</Label>
              <Input
                id="ts-break"
                type="number"
                min={0}
                value={form.breakMinutes}
                onChange={(e) => setForm({ ...form, breakMinutes: Math.max(0, Number(e.target.value)) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ts-billable">Billing</Label>
              <Select
                id="ts-billable"
                value={form.isBillable ? 'yes' : 'no'}
                onChange={(e) => setForm({ ...form, isBillable: e.target.value === 'yes' })}
              >
                <option value="yes">Billable</option>
                <option value="no">Non-billable</option>
              </Select>
            </div>
            <div className="flex items-end">
              <p className="text-sm text-secondary pb-2">
                Total <span className="font-semibold text-primary">{formatHours(hours)}</span>
              </p>
            </div>
          </div>
          <div>
            <Label htmlFor="ts-notes">Notes (optional)</Label>
            <Textarea
              id="ts-notes"
              rows={2}
              maxLength={1000}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          {error ? <p className="text-sm text-error-600">{error}</p> : null}
        </div>
        <div className="rounded-lg border border-base p-4 h-fit">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Approval workflow</p>
          {route ? (
            <WorkflowApprovalTimeline route={route} workflow={null} entityLabel="timesheet" />
          ) : (
            <p className="text-sm text-secondary">Loading…</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function TimesheetPage() {
  return (
    <OrgPageState>
      {(companyId) => (
        <>
          <div className="px-4 lg:px-6 pt-4">
            <CompanySelector />
          </div>
          <TimesheetContent companyId={companyId} />
        </>
      )}
    </OrgPageState>
  );
}
