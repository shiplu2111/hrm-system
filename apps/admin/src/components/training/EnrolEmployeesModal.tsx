import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Loader2, Search } from 'lucide-react';
import type { EmployeeRecord, TrainingEnrollmentResult, TrainingSessionRecord } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Toggle';
import { Banner, errorMessage } from '@/components/performance/performance-ui';
import { listEmployees } from '@/lib/employees-api';
import { MAX_ENROLMENTS_PER_REQUEST, registerTrainingAttendance } from '@/lib/training-api';

const ENROLLABLE_STATUSES = new Set(['active', 'on_leave']);

export function EnrolEmployeesModal({
  open,
  companyId,
  session,
  enrolledEmployeeIds,
  withdrawnEmployeeIds,
  onClose,
  onEnrolled,
}: {
  open: boolean;
  companyId: string;
  session: TrainingSessionRecord;
  enrolledEmployeeIds: Set<string>;
  withdrawnEmployeeIds: Set<string>;
  onClose: () => void;
  onEnrolled: (result: TrainingEnrollmentResult) => void;
}) {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrainingEnrollmentResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setDepartmentId('');
    setSelected(new Set());
    setError(null);
    setResult(null);
    setLoading(true);
    listEmployees(companyId)
      .then(setEmployees)
      .catch((err) => setError(errorMessage(err, 'Couldn’t load employees')))
      .finally(() => setLoading(false));
  }, [open, companyId]);

  const available = useMemo(
    () =>
      employees
        .filter((row) => ENROLLABLE_STATUSES.has(row.employmentStatus) && !enrolledEmployeeIds.has(row.id))
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [employees, enrolledEmployeeIds],
  );

  const departments = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of available) {
      if (row.department) map.set(row.department.id, row.department.name);
    }
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [available]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return available.filter(
      (row) =>
        (!departmentId || row.departmentId === departmentId) &&
        (!term ||
          `${row.fullName} ${row.employeeNumber} ${row.designation?.name ?? ''}`.toLowerCase().includes(term)),
    );
  }, [available, departmentId, search]);

  const overLimit = selected.size > MAX_ENROLMENTS_PER_REQUEST;
  const allVisibleSelected = visible.length > 0 && visible.every((row) => selected.has(row.id));

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleVisible = () =>
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visible.forEach((row) => next.delete(row.id));
      else visible.forEach((row) => next.add(row.id));
      return next;
    });

  const enrol = async () => {
    if (selected.size === 0 || overLimit || saving) return;
    setSaving(true);
    setError(null);
    try {
      const outcome = await registerTrainingAttendance(session.id, [...selected]);
      onEnrolled(outcome);
      if (outcome.skipped.length > 0) setResult(outcome);
      else onClose();
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t enrol the selected employees'));
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Enrolment finished"
        description={session.displayTitle}
        footer={<Button onClick={onClose}>Done</Button>}
      >
        <div className="space-y-3">
          <p className="text-sm text-primary">
            {result.enrolledCount} enrolled
            {result.restoredCount > 0 ? ` (${result.restoredCount} re-enrolled after withdrawing)` : ''}.
          </p>
          <Banner icon={AlertTriangle} tone="warning">
            {result.skipped.length} {result.skipped.length === 1 ? 'person was' : 'people were'} not enrolled:
          </Banner>
          <ul className="divide-y divide-[rgb(var(--border-base))] rounded-lg border border-base">
            {result.skipped.map((row) => (
              <li key={row.employeeId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="font-medium text-primary">{row.employeeName}</span>
                <span className="text-xs text-secondary">{row.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      title="Enrol employees"
      description={`${session.displayTitle} · ${session.enrolledCount} already enrolled`}
      size="lg"
      footer={
        <>
          <span className={`mr-auto text-xs ${overLimit ? 'text-error-600' : 'text-muted'}`}>
            {overLimit
              ? `Enrol at most ${MAX_ENROLMENTS_PER_REQUEST} people at a time.`
              : `${selected.size} selected`}
          </span>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void enrol()} disabled={selected.size === 0 || overLimit || saving}>
            {saving ? 'Enrolling…' : `Enrol ${selected.size || ''}`.trim()}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? (
          <Banner icon={AlertCircle} tone="error">
            {error}
          </Banner>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              className="pl-9"
              placeholder="Search name, number or designation"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search employees"
            />
          </div>
          <Select
            className="sm:w-56"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            aria-label="Department"
          >
            <option value="">All departments</option>
            {departments.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-secondary">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading employees…
          </div>
        ) : available.length === 0 ? (
          <p className="rounded-lg border border-base px-4 py-8 text-center text-sm text-secondary">
            Every active employee is already enrolled in this session.
          </p>
        ) : (
          <div className="rounded-lg border border-base">
            <label className="flex items-center gap-3 border-b border-base bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs font-medium text-secondary">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} disabled={visible.length === 0} />
              Select all {visible.length} shown
            </label>
            <div className="max-h-80 divide-y divide-[rgb(var(--border-base))] overflow-y-auto">
              {visible.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-secondary">No employees match the filters.</p>
              ) : (
                visible.map((row) => (
                  <label
                    key={row.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[rgb(var(--bg-hover))]"
                  >
                    <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} />
                    <Avatar name={row.fullName} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-primary">{row.fullName}</span>
                      <span className="block truncate text-xs text-muted">
                        {row.employeeNumber}
                        {row.department ? ` · ${row.department.name}` : ''}
                        {row.designation ? ` · ${row.designation.name}` : ''}
                      </span>
                    </span>
                    {withdrawnEmployeeIds.has(row.id) ? (
                      <span className="text-xs text-muted">Withdrew earlier</span>
                    ) : row.employmentStatus === 'on_leave' ? (
                      <span className="text-xs text-warning-700 dark:text-warning-300">On leave</span>
                    ) : null}
                  </label>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
