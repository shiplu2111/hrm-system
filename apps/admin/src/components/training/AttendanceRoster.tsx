import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Clock, Search, UserMinus, UserPlus, UserX, Undo2 } from 'lucide-react';
import type {
  TrainingAttendanceMarkStatus,
  TrainingAttendanceRecord,
  TrainingSessionRecord,
} from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Select } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { Avatar } from '@/components/ui/Toggle';
import { errorMessage } from '@/components/performance/performance-ui';
import {
  ATTENDANCE_STATUS_LABELS,
  markTrainingAttendance,
  updateTrainingAttendance,
  withdrawTrainingAttendance,
} from '@/lib/training-api';
import { ATTENDANCE_STATUS_TONE, formatDateTime, hasStarted, isSessionOpen } from './training-ui';

const MARK_STATUSES: TrainingAttendanceMarkStatus[] = ['registered', 'attended', 'completed', 'no_show'];

function ScoreCell({
  row,
  disabled,
  onSave,
}: {
  row: TrainingAttendanceRecord;
  disabled: boolean;
  onSave: (score: number | null) => Promise<void>;
}) {
  const [value, setValue] = useState(row.score == null ? '' : String(row.score));
  useEffect(() => setValue(row.score == null ? '' : String(row.score)), [row.score]);

  const parsed = value.trim() === '' ? null : Number(value);
  const invalid = parsed !== null && (!Number.isFinite(parsed) || parsed < 0 || parsed > 100);

  const commit = () => {
    if (invalid || parsed === row.score) return;
    void onSave(parsed).catch(() => setValue(row.score == null ? '' : String(row.score)));
  };

  return (
    <Input
      type="number"
      min={0}
      max={100}
      step={1}
      value={value}
      disabled={disabled}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      placeholder="—"
      aria-label={`Score for ${row.employeeName}`}
      aria-invalid={invalid}
      title={disabled ? 'Scores are recorded for people who attended' : 'Score out of 100'}
      className={`h-8 w-20 px-2 py-1 text-right ${invalid ? 'border-error-500' : ''}`}
    />
  );
}

export function AttendanceRoster({
  session,
  attendance,
  canEdit,
  onEnrol,
  onChanged,
  onError,
}: {
  session: TrainingSessionRecord;
  attendance: TrainingAttendanceRecord[];
  canEdit: boolean;
  onEnrol: () => void;
  onChanged: (message: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [withdrawing, setWithdrawing] = useState<TrainingAttendanceRecord[] | null>(null);

  useEffect(() => setSelected(new Set()), [session.id]);

  const open = isSessionOpen(session.status);
  const started = hasStarted(session);
  const canMark = canEdit && session.status !== 'cancelled' && started;
  const canEnrol = canEdit && open && session.courseStatus === 'active';
  const withdrawnCount = attendance.filter((row) => row.status === 'cancelled').length;

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return attendance.filter(
      (row) =>
        (showWithdrawn || row.status !== 'cancelled') &&
        (!term || `${row.employeeName} ${row.employeeNumber} ${row.departmentName ?? ''}`.toLowerCase().includes(term)),
    );
  }, [attendance, search, showWithdrawn]);

  const selectable = rows.filter((row) => row.status !== 'cancelled');
  const selectedRows = attendance.filter((row) => selected.has(row.id));
  const allSelected = selectable.length > 0 && selectable.every((row) => selected.has(row.id));
  const withdrawable = selectedRows.filter((row) => row.status === 'registered');

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(selectable.map((row) => row.id)));

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const markSelected = async (status: TrainingAttendanceMarkStatus) => {
    const ids = selectedRows.filter((row) => row.status !== status).map((row) => row.id);
    if (ids.length === 0) {
      setSelected(new Set());
      return;
    }
    setBusy(true);
    try {
      await markTrainingAttendance(session.id, ids, status);
      setSelected(new Set());
      await onChanged(
        `${ids.length} ${ids.length === 1 ? 'person' : 'people'} marked ${ATTENDANCE_STATUS_LABELS[status].toLowerCase()}.`,
      );
    } catch (err) {
      onError(errorMessage(err, 'Couldn’t update attendance'));
    } finally {
      setBusy(false);
    }
  };

  const updateRow = async (
    row: TrainingAttendanceRecord,
    input: { status?: TrainingAttendanceMarkStatus; score?: number | null },
    message: string,
  ) => {
    setBusy(true);
    try {
      await updateTrainingAttendance(row.id, input);
      await onChanged(message);
    } catch (err) {
      onError(errorMessage(err, 'Couldn’t update attendance'));
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const statusOptions = (row: TrainingAttendanceRecord) =>
    MARK_STATUSES.filter((status) => status !== 'registered' || session.status !== 'completed' || row.status === 'registered');

  return (
    <section className="surface rounded-xl border border-base shadow-card">
      <div className="flex flex-col gap-3 border-b border-base px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-primary">Attendance</h3>
          <p className="mt-0.5 text-xs text-secondary">
            {session.status === 'cancelled'
              ? 'This session was cancelled.'
              : !started
                ? `Attendance can be marked once the session starts on ${formatDateTime(session.scheduledStart)}.`
                : session.unmarkedCount > 0
                  ? `${session.unmarkedCount} still to mark.`
                  : 'Everyone is marked.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              className="h-8 pl-9 sm:w-56"
              placeholder="Search attendees"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search attendees"
            />
          </div>
          {canEnrol ? (
            <Button size="sm" onClick={onEnrol}>
              <UserPlus className="h-3.5 w-3.5" /> Enrol employees
            </Button>
          ) : null}
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-base bg-accent-50 px-5 py-2 dark:bg-accent-950/30">
          <span className="mr-2 text-xs font-medium text-accent-700 dark:text-accent-300">{selected.size} selected</span>
          {canMark ? (
            <>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void markSelected('attended')}>
                <CheckCheck className="h-3.5 w-3.5" /> Attended
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void markSelected('completed')}>
                <CheckCheck className="h-3.5 w-3.5" /> Completed
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void markSelected('no_show')}>
                <UserX className="h-3.5 w-3.5" /> No-show
              </Button>
              {session.status !== 'completed' ? (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void markSelected('registered')}>
                  <Undo2 className="h-3.5 w-3.5" /> Reset
                </Button>
              ) : null}
            </>
          ) : null}
          {canEdit && open ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || withdrawable.length === 0}
              title={withdrawable.length === 0 ? 'Only unmarked enrolments can be withdrawn' : undefined}
              onClick={() => setWithdrawing(withdrawable)}
            >
              <UserMinus className="h-3.5 w-3.5" /> Withdraw{withdrawable.length > 0 ? ` ${withdrawable.length}` : ''}
            </Button>
          ) : null}
          <button
            type="button"
            className="ml-auto text-xs text-secondary hover:text-primary"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      ) : null}

      {attendance.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <Clock className="h-6 w-6 text-muted" />
          <p className="text-sm text-secondary">No one is enrolled yet.</p>
          {canEnrol ? (
            <Button size="sm" variant="secondary" onClick={onEnrol}>
              <UserPlus className="h-3.5 w-3.5" /> Enrol employees
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
              <tr>
                <th className="w-10 px-4 py-2">
                  {canEdit ? (
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={selectable.length === 0}
                      aria-label="Select all attendees"
                    />
                  ) : null}
                </th>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Score</th>
                <th className="px-3 py-2">Marked</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-base))]">
              {rows.map((row) => {
                const withdrawn = row.status === 'cancelled';
                const present = row.status === 'attended' || row.status === 'completed';
                return (
                  <tr key={row.id} className={withdrawn ? 'opacity-60' : 'hover:bg-[rgb(var(--bg-hover))]'}>
                    <td className="px-4 py-2">
                      {canEdit && !withdrawn ? (
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggle(row.id)}
                          aria-label={`Select ${row.employeeName}`}
                        />
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.employeeName} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-primary">{row.employeeName}</div>
                          <div className="truncate text-xs text-muted">
                            {row.employeeNumber}
                            {row.departmentName ? ` · ${row.departmentName}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {canMark && !withdrawn ? (
                        <Select
                          className="h-8 w-36 py-1 text-xs"
                          value={row.status}
                          disabled={busy}
                          aria-label={`Attendance for ${row.employeeName}`}
                          onChange={(e) => {
                            const status = e.target.value as TrainingAttendanceMarkStatus;
                            void updateRow(
                              row,
                              { status },
                              `${row.employeeName} marked ${ATTENDANCE_STATUS_LABELS[status].toLowerCase()}.`,
                            ).catch(() => undefined);
                          }}
                        >
                          {statusOptions(row).map((status) => (
                            <option key={status} value={status}>
                              {ATTENDANCE_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <StatusPill tone={ATTENDANCE_STATUS_TONE[row.status]}>
                          {ATTENDANCE_STATUS_LABELS[row.status]}
                        </StatusPill>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canMark && !withdrawn ? (
                        <div className="flex justify-end">
                          <ScoreCell
                            row={row}
                            disabled={!present || busy}
                            onSave={(score) =>
                              updateRow(row, { score }, `Score saved for ${row.employeeName}.`)
                            }
                          />
                        </div>
                      ) : (
                        <span className="font-mono text-secondary">{row.score ?? '—'}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                      {row.completedAt
                        ? formatDateTime(row.completedAt)
                        : row.attendedAt
                          ? formatDateTime(row.attendedAt)
                          : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {canEdit && open && row.status === 'registered' ? (
                        <button
                          type="button"
                          onClick={() => setWithdrawing([row])}
                          className="rounded p-1 text-muted hover:bg-[rgb(var(--bg-hover))] hover:text-error-600"
                          aria-label={`Withdraw ${row.employeeName}`}
                          title="Withdraw enrolment"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-secondary">No attendees match the search.</p>
          ) : null}
        </div>
      )}

      {withdrawnCount > 0 ? (
        <div className="border-t border-base px-5 py-2">
          <label className="flex items-center gap-2 text-xs text-secondary">
            <input type="checkbox" checked={showWithdrawn} onChange={(e) => setShowWithdrawn(e.target.checked)} />
            Show {withdrawnCount} withdrawn
          </label>
        </div>
      ) : null}

      <ConfirmDialog
        open={withdrawing != null}
        title={withdrawing && withdrawing.length > 1 ? `Withdraw ${withdrawing.length} enrolments?` : 'Withdraw enrolment?'}
        description={
          withdrawing?.length === 1
            ? `${withdrawing[0].employeeName} will be removed from this session. You can enrol them again while it’s open.`
            : 'They will be removed from this session. You can enrol them again while it’s open.'
        }
        confirmLabel="Withdraw"
        onConfirm={async () => {
          if (!withdrawing) return;
          const failed: TrainingAttendanceRecord[] = [];
          const reasons: string[] = [];
          for (const row of withdrawing) {
            await withdrawTrainingAttendance(row.id).catch((err) => {
              failed.push(row);
              reasons.push(`${row.employeeName}: ${errorMessage(err, 'failed')}`);
            });
          }
          setSelected(new Set());
          const done = withdrawing.length - failed.length;
          await onChanged(done > 0 ? `${done} ${done === 1 ? 'enrolment' : 'enrolments'} withdrawn.` : '');
          if (failed.length > 0) {
            setWithdrawing(failed);
            throw new Error(reasons.join('; '));
          }
        }}
        onClose={() => setWithdrawing(null)}
      />
    </section>
  );
}
