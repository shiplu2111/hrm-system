import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  X,
  DollarSign,
  Clock,
  Plus,
  Search,
  Loader2,
} from 'lucide-react';
import type { TimesheetEntryRecord, TimesheetProjectRecord } from '@hrm/shared-types';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Toggle';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { listEmployees } from '@/lib/employees-api';
import {
  approveTimesheetEntry,
  createTimesheetEntry,
  listTimesheetEntries,
  listTimesheetProjects,
  rejectTimesheetEntry,
} from '@/lib/timesheets-api';
import { ApiError } from '@/lib/tenant-api-client';

const STATUS_FILTERS = [
  'All',
  'Draft',
  'Pending Manager',
  'Pending Approval',
  'Approved',
  'Rejected',
] as const;

function statusTone(
  displayStatus: string,
): 'success' | 'warning' | 'error' | 'neutral' {
  if (displayStatus === 'Approved') return 'success';
  if (displayStatus === 'Rejected') return 'error';
  if (displayStatus.startsWith('Pending') || displayStatus === 'Draft') {
    return 'warning';
  }
  return 'neutral';
}

function formatTimeRange(entry: TimesheetEntryRecord): string {
  const start = new Date(entry.startTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const end = new Date(entry.endTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${start} – ${end}`;
}

function TimesheetContent({ companyId }: { companyId: string }) {
  const [entries, setEntries] = useState<TimesheetEntryRecord[]>([]);
  const [projects, setProjects] = useState<TimesheetProjectRecord[]>([]);
  const [employees, setEmployees] = useState<
    { id: string; fullName: string; employeeNumber: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [taskName, setTaskName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [breakMinutes, setBreakMinutes] = useState(30);
  const [isBillable, setIsBillable] = useState(true);
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [entryRows, projectRows, employeeRows] = await Promise.all([
        listTimesheetEntries(companyId),
        listTimesheetProjects(companyId),
        listEmployees(companyId),
      ]);
      setEntries(entryRows);
      setProjects(projectRows.filter((p) => p.isActive));
      setEmployees(
        employeeRows.map((e) => ({
          id: e.id,
          fullName: `${e.firstName} ${e.lastName}`.trim(),
          employeeNumber: e.employeeNumber,
        })),
      );
      setEmployeeId((current) => current || employeeRows[0]?.id || '');
      setProjectId((current) => current || projectRows[0]?.id || '');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to load timesheet entries',
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredEntries = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) => {
      const matchesSearch =
        (e.employeeName ?? '').toLowerCase().includes(q) ||
        (e.employeeNumber ?? '').toLowerCase().includes(q) ||
        (e.projectName ?? '').toLowerCase().includes(q) ||
        e.taskName.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'All' || e.displayStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [entries, search, statusFilter]);

  const totalHours = entries.reduce((s, e) => s + e.totalHours, 0);
  const billableHours = entries.reduce((s, e) => s + e.billableHours, 0);
  const pendingCount = entries.filter((e) =>
    e.displayStatus.startsWith('Pending'),
  ).length;

  const toIsoDateTime = (date: string, time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, hours, minutes)).toISOString();
  };

  const handleCreateEntry = async () => {
    if (!employeeId || !projectId || !taskName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createTimesheetEntry(companyId, {
        employeeId,
        projectId,
        entryDate,
        taskName: taskName.trim(),
        startTime: toIsoDateTime(entryDate, startTime),
        endTime: toIsoDateTime(entryDate, endTime),
        breakMinutes,
        isBillable,
        notes: notes.trim() || undefined,
        submit: true,
      });
      setModalOpen(false);
      setTaskName('');
      setNotes('');
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to create timesheet entry',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (entryId: string) => {
    setActionId(entryId);
    setError(null);
    try {
      await approveTimesheetEntry(entryId);
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to approve entry',
      );
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (entryId: string) => {
    setActionId(entryId);
    setError(null);
    try {
      await rejectTimesheetEntry(entryId);
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to reject entry',
      );
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading timesheets…
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Timesheet Entries</h1>
          <p className="text-sm text-secondary mt-0.5">
            Log time by project and route entries through manager approval
          </p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Log Time
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Total Hours',
            value: `${totalHours.toFixed(1)}h`,
            icon: Clock,
            tone: 'bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400',
          },
          {
            label: 'Billable Hours',
            value: `${billableHours.toFixed(1)}h`,
            icon: DollarSign,
            tone: 'bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400',
          },
          {
            label: 'Pending Approval',
            value: String(pendingCount),
            icon: Clock,
            tone: 'bg-warning-50 dark:bg-warning-950/40 text-warning-600 dark:text-warning-400',
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="surface rounded-xl border shadow-card p-4">
              <div className={`h-9 w-9 rounded-lg ${s.tone} flex items-center justify-center mb-3`}>
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <div className="text-2xl font-bold text-primary">{s.value}</div>
              <div className="text-xs text-secondary mt-0.5">{s.label}</div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="search"
            placeholder="Search employee, project, or task…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm surface border border-base rounded-lg"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as (typeof STATUS_FILTERS)[number])
          }
          className="text-sm surface border border-base rounded-lg px-3 py-2"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Time Entries</CardTitle>
          <Badge tone="neutral">{filteredEntries.length} entries</Badge>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">
                    Date
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">
                    Project
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden lg:table-cell">
                    Task
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Hours
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Billable
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="w-20 px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filteredEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-[rgb(var(--bg-hover))] transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={entry.employeeName ?? 'Employee'} size="sm" />
                        <div>
                          <div className="text-sm font-medium text-primary">
                            {entry.employeeName}
                          </div>
                          <div className="text-xs text-muted">
                            {entry.employeeNumber}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-secondary hidden md:table-cell">
                      <div>{entry.entryDate}</div>
                      <div className="text-xs text-muted">{formatTimeRange(entry)}</div>
                    </td>
                    <td className="px-5 py-3 text-secondary hidden md:table-cell">
                      {entry.projectName}
                    </td>
                    <td className="px-5 py-3 text-secondary hidden lg:table-cell">
                      {entry.taskName}
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1 text-primary font-medium">
                        <Clock className="h-3.5 w-3.5 text-muted" />
                        {entry.totalHours}h
                      </span>
                      {entry.timeAnomaly && (
                        <span className="text-xs text-warning-600">Time anomaly</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={entry.isBillable ? 'success' : 'neutral'}>
                        {entry.isBillable
                          ? `${entry.billableHours}h billable`
                          : 'Non-billable'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone(entry.displayStatus)} dot>
                        {entry.displayStatus}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      {entry.displayStatus.startsWith('Pending') ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={actionId === entry.id}
                            onClick={() => void handleApprove(entry.id)}
                            className="h-7 w-7 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 hover:bg-success-100 flex items-center justify-center transition-colors disabled:opacity-50"
                          >
                            {actionId === entry.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={actionId === entry.id}
                            onClick={() => void handleReject(entry.id)}
                            className="h-7 w-7 rounded-lg bg-error-50 dark:bg-error-950/40 text-error-600 dark:text-error-400 hover:bg-error-100 flex items-center justify-center transition-colors disabled:opacity-50"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-secondary">
                      No timesheet entries match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Log Time Entry"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="ts-employee">Employee</Label>
            <Select
              id="ts-employee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
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
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ts-date">Date</Label>
              <Input
                id="ts-date"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ts-break">Break (minutes)</Label>
              <Input
                id="ts-break"
                type="number"
                min={0}
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(Number(e.target.value))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ts-task">Task</Label>
            <Input
              id="ts-task"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="What did you work on?"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ts-start">Start</Label>
              <Input
                id="ts-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ts-end">End</Label>
              <Input
                id="ts-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ts-billable">Billable</Label>
            <Select
              id="ts-billable"
              value={isBillable ? 'yes' : 'no'}
              onChange={(e) => setIsBillable(e.target.value === 'yes')}
            >
              <option value="yes">Billable</option>
              <option value="no">Non-billable</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="ts-notes">Notes (optional)</Label>
            <Textarea
              id="ts-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={saving || !taskName.trim()}
              onClick={() => void handleCreateEntry()}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                'Submit for Approval'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
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
