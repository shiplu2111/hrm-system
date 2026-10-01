import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Eraser,
  Loader2,
  MousePointerClick,
  Users,
  X,
} from 'lucide-react';
import { usePermission } from '@hrm/portal-ui';
import {
  ROSTER_BULK_MAX_CELLS,
  type EmployeeRecord,
  type LocationOption,
  type RosterRecord,
  type ShiftRecord,
} from '@hrm/shared-types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Label, Select } from '@/components/ui/Form';
import { Skeleton } from '@/components/ui/Skeleton';
import { Toggle } from '@/components/ui/Toggle';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgErrorBanner, OrgSearchInput } from '@/components/org/OrgScreenParts';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import { RosterGrid } from '@/components/roster/RosterGrid';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
import { listEmployees } from '@/lib/employees-api';
import {
  bulkAssignRoster,
  bulkClearRoster,
  listRosterLocations,
  listRostersInRange,
  listShifts,
  resolveHolidayCalendar,
} from '@/lib/roster-api';
import {
  WEEKDAY_SHORT,
  addDaysIso,
  buildShiftColors,
  cellKey,
  eachIsoDay,
  endOfMonthIso,
  formatRangeLabel,
  parseCellKey,
  planRosterBatches,
  shiftRunsOnWeekends,
  shiftWeekendDays,
  startOfMonthIso,
  startOfWeekIso,
  todayIso,
  weekdayOfIso,
} from '@/lib/shift-roster';
import { ApiError } from '@/lib/tenant-api-client';

type ViewMode = 'week' | 'month';

const ROSTERABLE_STATUSES = new Set(['active', 'on_leave']);

export function RosterPage() {
  const { companyId, loading: companyLoading, error: companyError } = useCompany();

  if (companyLoading) return <PageLoadingState message="Loading company…" />;
  if (companyError) return <PageErrorState error={companyError} />;
  if (!companyId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">No company found for this tenant.</div>
    );
  }
  return <RosterScreen key={companyId} companyId={companyId} />;
}

function RosterScreen({ companyId }: { companyId: string }) {
  const { navigate } = useNav();
  const canAssign = usePermission('attendance', 'create');
  const canClear = usePermission('attendance', 'delete');
  const canManageShifts = usePermission('settings', 'create');

  const [view, setView] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState(todayIso);
  const from = view === 'week' ? startOfWeekIso(anchor) : startOfMonthIso(anchor);
  const to = view === 'week' ? addDaysIso(from, 6) : endOfMonthIso(anchor);
  const days = useMemo(() => eachIsoDay(from, to), [from, to]);
  const today = todayIso();

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [baseLoading, setBaseLoading] = useState(true);
  const [baseError, setBaseError] = useState<string | null>(null);

  const [rosters, setRosters] = useState<RosterRecord[]>([]);
  const [holidays, setHolidays] = useState<Map<string, string[]>>(new Map());
  const [rangeLoading, setRangeLoading] = useState(true);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const [shiftId, setShiftId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [overwrite, setOverwrite] = useState(false);
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmCopy, setConfirmCopy] = useState(false);

  const loadBase = useCallback(async () => {
    setBaseError(null);
    try {
      const [employeeRows, shiftRows, locationRows] = await Promise.all([
        listEmployees(companyId),
        listShifts(companyId),
        listRosterLocations(companyId).catch(() => [] as LocationOption[]),
      ]);
      setEmployees(
        employeeRows
          .filter((e) => ROSTERABLE_STATUSES.has(e.employmentStatus))
          .sort((a, b) => a.fullName.localeCompare(b.fullName)),
      );
      setShifts(shiftRows);
      setLocations(locationRows);
      setShiftId((current) => current || shiftRows[0]?.id || '');
    } catch (err) {
      setBaseError(err instanceof ApiError ? err.message : 'Failed to load the roster');
    } finally {
      setBaseLoading(false);
    }
  }, [companyId]);

  const loadRange = useCallback(async () => {
    setRangeError(null);
    try {
      const [rows, calendar] = await Promise.all([
        listRostersInRange(companyId, from, to),
        resolveHolidayCalendar(companyId, { from, to }).catch(() => null),
      ]);
      setRosters(rows);
      const map = new Map<string, string[]>();
      for (const entry of calendar?.entries ?? []) {
        map.set(entry.date, [...(map.get(entry.date) ?? []), entry.name]);
      }
      setHolidays(map);
    } catch (err) {
      setRangeError(err instanceof ApiError ? err.message : 'Failed to load roster entries');
    } finally {
      setRangeLoading(false);
    }
  }, [companyId, from, to]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    setRangeLoading(true);
    setSelection(new Set());
    void loadRange();
  }, [loadRange]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (selection.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmClear) setSelection(new Set());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection.size, confirmClear]);

  const shiftById = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);
  const colors = useMemo(() => buildShiftColors(shifts), [shifts]);
  const rosterMap = useMemo(
    () => new Map(rosters.map((r) => [cellKey(r.employeeId, r.date), r])),
    [rosters],
  );

  const departments = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) if (e.department) map.set(e.department.id, e.department.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [employees]);

  const visibleEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter(
      (e) =>
        (!departmentId || e.departmentId === departmentId) &&
        (!q || e.fullName.toLowerCase().includes(q) || e.employeeNumber.toLowerCase().includes(q)),
    );
  }, [employees, search, departmentId]);

  const selectedShift = shiftById.get(shiftId) ?? null;
  const weekendDaysOfShift = selectedShift ? shiftWeekendDays(selectedShift) : [];
  const shiftSkipsWeekends =
    selectedShift !== null && !shiftRunsOnWeekends(selectedShift) && weekendDaysOfShift.length > 0;

  const selectionStats = useMemo(() => {
    const employeeIds = new Set<string>();
    const dates = new Set<string>();
    let filled = 0;
    let onShiftWeekend = 0;
    for (const key of selection) {
      const { employeeId, date } = parseCellKey(key);
      employeeIds.add(employeeId);
      dates.add(date);
      if (rosterMap.has(key)) filled += 1;
      if (weekendDaysOfShift.includes(weekdayOfIso(date))) onShiftWeekend += 1;
    }
    return { employees: employeeIds.size, dates: dates.size, filled, onShiftWeekend };
  }, [selection, rosterMap, weekendDaysOfShift]);

  const shiftRange = (direction: -1 | 1) =>
    setAnchor((current) =>
      view === 'week'
        ? addDaysIso(startOfWeekIso(current), direction * 7)
        : direction < 0
          ? addDaysIso(startOfMonthIso(current), -1)
          : addDaysIso(endOfMonthIso(current), 1),
    );

  const runBatches = async <T,>(
    keys: string[],
    call: (batch: { employeeIds: string[]; dates: string[] }) => Promise<T>,
  ): Promise<T[]> => {
    const results: T[] = [];
    for (const batch of planRosterBatches(keys, ROSTER_BULK_MAX_CELLS)) {
      results.push(await call(batch));
    }
    return results;
  };

  const handleAssign = async () => {
    if (!selectedShift || selection.size === 0) return;
    const keys = [...selection].filter(
      (key) =>
        !(shiftSkipsWeekends && skipWeekends && weekendDaysOfShift.includes(weekdayOfIso(parseCellKey(key).date))),
    );
    if (keys.length === 0) {
      setActionError(`Every selected day is a weekend day for ${selectedShift.name}.`);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const results = await runBatches(keys, (batch) =>
        bulkAssignRoster(companyId, {
          ...batch,
          shiftId: selectedShift.id,
          locationId: locationId || null,
          overwrite,
        }),
      );
      const created = results.reduce((n, r) => n + r.created, 0);
      const updated = results.reduce((n, r) => n + r.updated, 0);
      const skipped = results.reduce((n, r) => n + r.skipped, 0);
      const weekendSkipped = selection.size - keys.length;
      setNotice(
        [
          `${selectedShift.name}: ${created} assigned`,
          updated ? `${updated} replaced` : null,
          skipped ? `${skipped} kept (already rostered)` : null,
          weekendSkipped ? `${weekendSkipped} weekend day${weekendSkipped === 1 ? '' : 's'} skipped` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      );
      setSelection(new Set());
      await loadRange();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not assign the shift');
      await loadRange();
    } finally {
      setBusy(false);
    }
  };

  const clearSelected = async () => {
    const keys = [...selection].filter((k) => rosterMap.has(k));
    if (keys.length === 0) return;
    const results = await runBatches(keys, (batch) => bulkClearRoster(companyId, batch));
    const deleted = results.reduce((n, r) => n + r.deleted, 0);
    setNotice(`${deleted} assignment${deleted === 1 ? '' : 's'} cleared`);
    setSelection(new Set());
    await loadRange();
  };

  const prevWeekFrom = addDaysIso(from, -7);
  const copyPreviousWeek = async () => {
    const previous = await listRostersInRange(companyId, prevWeekFrom, addDaysIso(from, -1));
    const visibleIds = new Set(visibleEmployees.map((e) => e.id));
    const groups = new Map<string, { shiftId: string; locationId: string | null; keys: string[] }>();
    for (const row of previous) {
      if (!visibleIds.has(row.employeeId) || !shiftById.has(row.shiftId)) continue;
      const groupKey = `${row.shiftId}|${row.locationId ?? ''}`;
      const group = groups.get(groupKey) ?? { shiftId: row.shiftId, locationId: row.locationId, keys: [] };
      group.keys.push(cellKey(row.employeeId, addDaysIso(row.date, 7)));
      groups.set(groupKey, group);
    }
    if (groups.size === 0) {
      throw new Error('Nobody shown here was rostered in the previous week.');
    }
    let created = 0;
    let skipped = 0;
    for (const group of groups.values()) {
      const results = await runBatches(group.keys, (batch) =>
        bulkAssignRoster(companyId, {
          ...batch,
          shiftId: group.shiftId,
          locationId: group.locationId,
          overwrite: false,
        }),
      );
      created += results.reduce((n, r) => n + r.created, 0);
      skipped += results.reduce((n, r) => n + r.skipped, 0);
    }
    setNotice(
      `Copied ${created} assignment${created === 1 ? '' : 's'} from last week` +
        (skipped ? ` · ${skipped} kept (already rostered)` : ''),
    );
    await loadRange();
  };

  const loading = baseLoading || rangeLoading;
  const selectable = canAssign || canClear;
  const filledInView = visibleEmployees.reduce(
    (n, e) => n + days.filter((d) => rosterMap.has(cellKey(e.id, d))).length,
    0,
  );

  return (
    <div className={`p-4 lg:p-6 space-y-5 max-w-[1600px] mx-auto ${selection.size > 0 ? 'pb-40' : ''}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">Roster</p>
          <h1 className="text-xl font-bold text-primary">Roster calendar</h1>
          <p className="text-sm text-secondary mt-0.5">
            {selectable
              ? 'Select cells — drag, Shift+click a range, or click a name or date — then pick a shift.'
              : 'Who works which shift on each day.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CompanySelector />
          {view === 'week' && canAssign ? (
            <Button variant="secondary" onClick={() => setConfirmCopy(true)} disabled={loading || shifts.length === 0}>
              <Copy className="h-4 w-4" /> Copy last week
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-base p-0.5 surface" role="group" aria-label="Range">
            {(['week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={view === mode}
                onClick={() => setView(mode)}
                className={`px-3 h-8 rounded-md text-xs font-medium capitalize transition-colors ${
                  view === mode ? 'bg-accent-600 text-white' : 'text-secondary hover:text-primary'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center rounded-lg border border-base surface">
            <button
              type="button"
              aria-label={`Previous ${view}`}
              onClick={() => shiftRange(-1)}
              className="h-9 w-9 inline-flex items-center justify-center text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))] rounded-l-lg"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-sm font-medium text-primary tabular-nums min-w-[11rem] text-center">
              {view === 'week'
                ? formatRangeLabel(from, to)
                : new Date(`${from}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              aria-label={`Next ${view}`}
              onClick={() => shiftRange(1)}
              className="h-9 w-9 inline-flex items-center justify-center text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))] rounded-r-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(todayIso())} disabled={today >= from && today <= to}>
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <OrgSearchInput value={search} onChange={setSearch} placeholder="Search employees" />
          {departments.length > 1 ? (
            <div className="w-full sm:w-52">
              <Select
                aria-label="Department"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="h-9 py-1.5"
              >
                <option value="">All departments</option>
                {departments.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>
      </div>

      {baseError ? <OrgErrorBanner message={baseError} onRetry={() => void loadBase()} /> : null}
      {rangeError ? <OrgErrorBanner message={rangeError} onRetry={() => void loadRange()} /> : null}
      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-success-800 dark:text-success-200 bg-success-50 dark:bg-success-950/30 border border-success-200 dark:border-success-800/60 rounded-lg px-4 py-2.5"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="text-success-700 hover:text-success-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {shifts.length > 0 ? (
        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap text-xs">
          {shifts.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={!canAssign}
              onClick={() => setShiftId(s.id)}
              title={canAssign ? `Use ${s.name} for the next assignment` : undefined}
              className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors ${
                canAssign && s.id === shiftId && selection.size > 0
                  ? 'bg-[rgb(var(--bg-muted))] text-primary'
                  : 'text-secondary enabled:hover:text-primary'
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-sm ${colors.get(s.id)?.dot}`} />
              <span className="font-medium">{s.name}</span>
              <span className="text-muted tabular-nums">
                {s.startTime}–{s.endTime}
              </span>
            </button>
          ))}
          {holidays.size > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-error-500" /> Public holiday
            </span>
          ) : null}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3" aria-busy="true" aria-label="Loading roster">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-10 w-52" />
                <Skeleton className="h-10 flex-1" />
              </div>
            ))}
          </div>
        ) : shifts.length === 0 ? (
          <EmptyState
            compact
            icon={Clock}
            title="Define a shift first"
            description="The roster assigns employees to shifts, so create at least one shift with its working hours."
            action={canManageShifts ? { label: 'Go to Shifts', onClick: () => navigate('shifts'), icon: Clock } : undefined}
          />
        ) : employees.length === 0 ? (
          <EmptyState
            compact
            icon={Users}
            title="No active employees"
            description="Active employees of this company appear here for rostering."
          />
        ) : visibleEmployees.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">No employees match the current filters.</p>
        ) : (
          <>
            <div className="overflow-auto max-h-[calc(100vh-17rem)] min-h-[16rem] scrollbar-thin">
              <RosterGrid
                employees={visibleEmployees}
                days={days}
                dense={view === 'month'}
                rosterMap={rosterMap}
                shiftById={shiftById}
                colors={colors}
                holidays={holidays}
                today={today}
                selection={selection}
                selectable={selectable}
                onSelectionChange={(next) => {
                  setSelection(next);
                  setActionError(null);
                }}
              />
            </div>
            <p className="px-5 py-2.5 text-xs text-muted border-t border-base flex items-center gap-2">
              {rangeLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5" />}
              {visibleEmployees.length} employee{visibleEmployees.length === 1 ? '' : 's'} ·{' '}
              {filledInView} of {visibleEmployees.length * days.length} shift days filled
            </p>
          </>
        )}
      </Card>

      {selection.size > 0 && selectable ? (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pointer-events-none">
          <div
            role="region"
            aria-label="Assign selected cells"
            className="pointer-events-auto surface border border-base shadow-elevated rounded-xl w-full max-w-4xl px-4 py-3 animate-fade-in"
          >
            {actionError ? (
              <div className="mb-3">
                <OrgErrorBanner message={actionError} />
              </div>
            ) : null}
            <div className="flex flex-col lg:flex-row lg:items-end gap-3">
              <div className="flex items-center gap-2 lg:w-44 shrink-0">
                <MousePointerClick className="h-4 w-4 text-accent-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary tabular-nums">
                    {selection.size} cell{selection.size === 1 ? '' : 's'}
                  </p>
                  <p className="text-xs text-muted tabular-nums truncate">
                    {selectionStats.employees} employee{selectionStats.employees === 1 ? '' : 's'} ·{' '}
                    {selectionStats.dates} day{selectionStats.dates === 1 ? '' : 's'}
                    {selectionStats.filled ? ` · ${selectionStats.filled} rostered` : ''}
                  </p>
                </div>
              </div>

              {canAssign ? (
                <>
                  <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="assign-shift">Shift</Label>
                      <Select id="assign-shift" value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
                        {shifts.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.startTime}–{s.endTime})
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="assign-location">Location</Label>
                      <Select
                        id="assign-location"
                        value={locationId}
                        onChange={(e) => setLocationId(e.target.value)}
                        disabled={locations.length === 0}
                      >
                        <option value="">{locations.length === 0 ? 'No locations set up' : 'No specific location'}</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0 text-xs text-secondary">
                    {selectionStats.filled > 0 ? (
                      <label className="flex items-center gap-2">
                        <Toggle size="sm" checked={overwrite} onChange={setOverwrite} label="Replace existing shifts" />
                        Replace {selectionStats.filled} existing
                      </label>
                    ) : null}
                    {shiftSkipsWeekends && selectionStats.onShiftWeekend > 0 ? (
                      <label className="flex items-center gap-2">
                        <Toggle size="sm" checked={skipWeekends} onChange={setSkipWeekends} label="Skip weekend days" />
                        Skip {weekendDaysOfShift.map((d) => WEEKDAY_SHORT[d]).join('/')} ({selectionStats.onShiftWeekend})
                      </label>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="flex-1" />
              )}

              <div className="flex items-center gap-2 shrink-0">
                {canClear && selectionStats.filled > 0 ? (
                  <Button variant="secondary" onClick={() => setConfirmClear(true)} disabled={busy}>
                    <Eraser className="h-4 w-4" /> Clear
                  </Button>
                ) : null}
                {canAssign ? (
                  <Button variant="primary" onClick={() => void handleAssign()} disabled={busy || !selectedShift}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {busy ? 'Assigning…' : 'Assign shift'}
                  </Button>
                ) : null}
                <button
                  type="button"
                  aria-label="Clear selection"
                  title="Clear selection (Esc)"
                  onClick={() => setSelection(new Set())}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-muted hover:text-primary hover:bg-[rgb(var(--bg-hover))]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmClear}
        title="Clear rostered shifts?"
        confirmLabel="Clear shifts"
        description={
          <>
            {selectionStats.filled} assignment{selectionStats.filled === 1 ? '' : 's'} across{' '}
            {selectionStats.employees} employee{selectionStats.employees === 1 ? '' : 's'} will be
            removed. Attendance already recorded on those days is not changed.
          </>
        }
        onConfirm={clearSelected}
        onClose={() => setConfirmClear(false)}
      />

      <ConfirmDialog
        open={confirmCopy}
        tone="primary"
        title="Copy last week’s roster?"
        confirmLabel="Copy roster"
        description={
          <>
            Shifts from {formatRangeLabel(prevWeekFrom, addDaysIso(from, -1))} are copied onto the same
            weekdays of this week for the {visibleEmployees.length} employee
            {visibleEmployees.length === 1 ? '' : 's'} shown. Days that already have a shift are kept.
          </>
        }
        onConfirm={copyPreviousWeek}
        onClose={() => setConfirmCopy(false)}
      />
    </div>
  );
}
