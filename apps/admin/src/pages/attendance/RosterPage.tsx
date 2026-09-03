import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react';
import type { EmployeeRecord, RosterRecord, ShiftRecord } from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Label, Select } from '@/components/ui/Form';
import { CompanySelector } from '@/components/org/CompanySelector';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import { useCompany } from '@/context/CompanyContext';
import { listEmployees } from '@/lib/employees-api';
import { createRoster, deleteRoster, listRosters, listShifts } from '@/lib/roster-api';
import { ApiError } from '@/lib/tenant-api-client';

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export function RosterPage() {
  const { companyId, loading: companyLoading, error: companyError } = useCompany();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [rosters, setRosters] = useState<RosterRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [assignShiftId, setAssignShiftId] = useState('');
  const [assignDate, setAssignDate] = useState('');
  const [saving, setSaving] = useState(false);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const from = formatIso(weekStart);
  const to = formatIso(addDays(weekStart, 6));

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [empRows, shiftRows, rosterRows] = await Promise.all([
        listEmployees(companyId),
        listShifts(companyId),
        listRosters(companyId, { from, to }),
      ]);
      setEmployees(empRows);
      setShifts(shiftRows);
      setRosters(rosterRows);
      if (!assignEmployeeId && empRows[0]) setAssignEmployeeId(empRows[0].id);
      if (!assignShiftId && shiftRows[0]) setAssignShiftId(shiftRows[0].id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load roster');
    } finally {
      setLoading(false);
    }
  }, [companyId, from, to, assignEmployeeId, assignShiftId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rosterMap = useMemo(() => {
    const map = new Map<string, RosterRecord>();
    for (const row of rosters) {
      map.set(`${row.employeeId}:${row.date}`, row);
    }
    return map;
  }, [rosters]);

  async function handleAssign() {
    if (!companyId || !assignEmployeeId || !assignShiftId || !assignDate) return;
    setSaving(true);
    setError(null);
    try {
      await createRoster(companyId, {
        employeeId: assignEmployeeId,
        shiftId: assignShiftId,
        date: assignDate,
      });
      setModalOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to assign roster');
    } finally {
      setSaving(false);
    }
  }

  async function handleClear(employeeId: string, date: string) {
    if (!companyId) return;
    const row = rosterMap.get(`${employeeId}:${date}`);
    if (!row) return;
    setError(null);
    try {
      await deleteRoster(companyId, row.id);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to remove assignment');
    }
  }

  if (companyLoading) return <PageLoadingState message="Loading company…" />;
  if (companyError) return <PageErrorState error={companyError} />;
  if (!companyId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">
        No company found for this tenant.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Roster Calendar</h1>
          <p className="text-sm text-secondary mt-0.5">
            Week of {from} — {to}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CompanySelector />
          <div className="flex items-center surface border border-base rounded-lg overflow-hidden">
            <button
              type="button"
              className="p-2 text-secondary hover:bg-[rgb(var(--bg-hover))]"
              onClick={() => setWeekStart((d) => addDays(d, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-xs text-secondary">{from} – {to}</span>
            <button
              type="button"
              className="p-2 text-secondary hover:bg-[rgb(var(--bg-hover))]"
              onClick={() => setWeekStart((d) => addDays(d, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Button variant="primary" onClick={() => {
            setAssignDate(from);
            setModalOpen(true);
          }}>
            <Plus className="h-4 w-4" /> Assign Shift
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {shifts.map((shift) => (
          <Badge key={shift.id} tone="accent">{shift.name}</Badge>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </div>
      ) : (
        <Card>
          <CardBody className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-secondary">Employee</th>
                  {weekDays.map((day) => (
                    <th key={day.toISOString()} className="text-center px-2 py-2.5 text-xs font-semibold text-secondary">
                      {day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    <td className="px-4 py-2 font-medium text-primary whitespace-nowrap">
                      {emp.firstName} {emp.lastName}
                    </td>
                    {weekDays.map((day) => {
                      const date = formatIso(day);
                      const row = rosterMap.get(`${emp.id}:${date}`);
                      return (
                        <td key={date} className="px-2 py-2 text-center">
                          {row ? (
                            <button
                              type="button"
                              onClick={() => void handleClear(emp.id, date)}
                              className="inline-flex px-2 py-1 rounded-md bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300 text-xs hover:opacity-80"
                              title="Click to remove"
                            >
                              {row.shift?.name ?? 'Shift'}
                            </button>
                          ) : (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Assign Shift"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void handleAssign()} disabled={saving}>
              {saving ? 'Saving…' : 'Assign'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Employee</Label>
            <Select value={assignEmployeeId} onChange={(e) => setAssignEmployeeId(e.target.value)}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Shift</Label>
            <Select value={assignShiftId} onChange={(e) => setAssignShiftId(e.target.value)}>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Select value={assignDate} onChange={(e) => setAssignDate(e.target.value)}>
              {weekDays.map((d) => {
                const iso = formatIso(d);
                return (
                  <option key={iso} value={iso}>
                    {d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </option>
                );
              })}
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
