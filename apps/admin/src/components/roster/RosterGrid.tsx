import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { Plus } from 'lucide-react';
import type { EmployeeRecord, RosterRecord, ShiftRecord } from '@hrm/shared-types';
import {
  WEEKDAY_SHORT,
  cellKey,
  shiftAbbreviation,
  weekdayOfIso,
  type ShiftColor,
} from '@/lib/shift-roster';

interface Point {
  row: number;
  col: number;
}

function rectKeys(employees: EmployeeRecord[], days: string[], a: Point, b: Point): string[] {
  const keys: string[] = [];
  for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r += 1) {
    for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c += 1) {
      keys.push(cellKey(employees[r].id, days[c]));
    }
  }
  return keys;
}

export function RosterGrid({
  employees,
  days,
  dense,
  rosterMap,
  shiftById,
  colors,
  holidays,
  today,
  selection,
  selectable,
  onSelectionChange,
}: {
  employees: EmployeeRecord[];
  days: string[];
  /** Month view: narrow cells showing shift abbreviations. */
  dense: boolean;
  rosterMap: Map<string, RosterRecord>;
  shiftById: Map<string, ShiftRecord>;
  colors: Map<string, ShiftColor>;
  holidays: Map<string, string[]>;
  today: string;
  selection: Set<string>;
  selectable: boolean;
  onSelectionChange: (next: Set<string>) => void;
}) {
  const anchor = useRef<Point | null>(null);
  const drag = useRef<{ base: Set<string>; origin: Point } | null>(null);

  useEffect(() => {
    const stop = () => {
      drag.current = null;
    };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  const additive = (e: MouseEvent | KeyboardEvent) => e.ctrlKey || e.metaKey;

  const handleCellMouseDown = (e: MouseEvent, point: Point) => {
    if (!selectable || e.button !== 0) return;
    e.preventDefault();
    const key = cellKey(employees[point.row].id, days[point.col]);
    if (e.shiftKey && anchor.current) {
      const next = additive(e) ? new Set(selection) : new Set<string>();
      for (const k of rectKeys(employees, days, anchor.current, point)) next.add(k);
      onSelectionChange(next);
      return;
    }
    if (additive(e)) {
      const next = new Set(selection);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      anchor.current = point;
      drag.current = { base: next, origin: point };
      onSelectionChange(next);
      return;
    }
    anchor.current = point;
    drag.current = { base: new Set(), origin: point };
    onSelectionChange(new Set([key]));
  };

  const handleCellMouseEnter = (point: Point) => {
    if (!drag.current) return;
    const next = new Set(drag.current.base);
    for (const k of rectKeys(employees, days, drag.current.origin, point)) next.add(k);
    onSelectionChange(next);
  };

  const handleCellKeyDown = (e: KeyboardEvent, point: Point) => {
    if (!selectable || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    const key = cellKey(employees[point.row].id, days[point.col]);
    const next = new Set(selection);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    anchor.current = point;
    onSelectionChange(next);
  };

  const selectKeys = (e: MouseEvent, keys: string[]) => {
    if (!selectable) return;
    const next = additive(e) ? new Set(selection) : new Set<string>();
    const allSelected = additive(e) && keys.every((k) => next.has(k));
    for (const k of keys) {
      if (allSelected) next.delete(k);
      else next.add(k);
    }
    onSelectionChange(next);
  };

  const cellWidth = dense ? 'min-w-[2.75rem] w-11' : 'min-w-[7.5rem]';

  return (
    <table className="border-separate border-spacing-0 text-sm select-none">
      <thead>
        <tr>
          <th className="sticky left-0 top-0 z-30 surface border-b border-r border-base px-4 py-2 text-left text-xs font-semibold text-secondary min-w-[14rem]">
            Employee
          </th>
          {days.map((day) => {
            const weekday = weekdayOfIso(day);
            const isWeekend = weekday === 0 || weekday === 6;
            const holidayNames = holidays.get(day);
            const isToday = day === today;
            return (
              <th
                key={day}
                scope="col"
                className={`sticky top-0 z-20 border-b border-base p-0 font-normal ${cellWidth} ${
                  isWeekend ? 'bg-[rgb(var(--bg-muted))]' : 'surface'
                }`}
              >
                <button
                  type="button"
                  disabled={!selectable}
                  onClick={(e) => selectKeys(e, employees.map((emp) => cellKey(emp.id, day)))}
                  title={[
                    new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    }),
                    ...(holidayNames ?? []),
                    selectable ? 'Click to select the whole day' : '',
                  ]
                    .filter(Boolean)
                    .join('\n')}
                  className="w-full px-1 py-1.5 flex flex-col items-center gap-0.5 enabled:hover:bg-[rgb(var(--bg-hover))] transition-colors"
                >
                  <span className={`text-2xs uppercase tracking-wide ${isToday ? 'text-accent-700 dark:text-accent-300 font-semibold' : 'text-muted'}`}>
                    {dense ? WEEKDAY_SHORT[weekday].slice(0, 2) : WEEKDAY_SHORT[weekday]}
                  </span>
                  <span
                    className={`text-xs font-semibold tabular-nums h-6 min-w-6 px-1 inline-flex items-center justify-center rounded-full ${
                      isToday ? 'bg-accent-600 text-white' : 'text-primary'
                    }`}
                  >
                    {Number(day.slice(8))}
                  </span>
                  <span
                    className={`h-1 w-1 rounded-full ${holidayNames ? 'bg-error-500' : 'bg-transparent'}`}
                    aria-label={holidayNames ? `Holiday: ${holidayNames.join(', ')}` : undefined}
                  />
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {employees.map((emp, row) => {
          const rostered = days.reduce((n, d) => n + (rosterMap.has(cellKey(emp.id, d)) ? 1 : 0), 0);
          return (
            <tr key={emp.id} className="group/row">
              <th
                scope="row"
                className="sticky left-0 z-10 surface border-b border-r border-base p-0 text-left font-normal"
              >
                <button
                  type="button"
                  disabled={!selectable}
                  onClick={(e) => selectKeys(e, days.map((d) => cellKey(emp.id, d)))}
                  title={selectable ? 'Click to select every day for this employee' : undefined}
                  className="w-full px-4 py-2 flex items-center justify-between gap-3 text-left enabled:hover:bg-[rgb(var(--bg-hover))] transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-primary">{emp.fullName}</span>
                    <span className="block truncate text-xs text-muted">
                      {emp.employeeNumber}
                      {emp.department?.name ? ` · ${emp.department.name}` : ''}
                    </span>
                  </span>
                  <span className="text-2xs text-muted tabular-nums shrink-0">
                    {rostered}/{days.length}
                  </span>
                </button>
              </th>
              {days.map((day, col) => {
                const key = cellKey(emp.id, day);
                const entry = rosterMap.get(key);
                const shift = entry ? shiftById.get(entry.shiftId) : undefined;
                const color = entry ? colors.get(entry.shiftId) : undefined;
                const selected = selection.has(key);
                const weekday = weekdayOfIso(day);
                const isWeekend = weekday === 0 || weekday === 6;
                const shiftName = shift?.name ?? entry?.shift?.name ?? 'Shift';
                const label = entry
                  ? `${emp.fullName}, ${day}: ${shiftName} ${entry.shift?.startTime ?? ''}–${entry.shift?.endTime ?? ''}${entry.location ? `, ${entry.location.name}` : ''}`
                  : `${emp.fullName}, ${day}: not rostered`;
                return (
                  <td
                    key={day}
                    className={`border-b border-base p-0.5 ${cellWidth} ${
                      isWeekend ? 'bg-[rgb(var(--bg-muted)/0.6)]' : ''
                    }`}
                  >
                    <div
                      role="gridcell"
                      tabIndex={selectable ? 0 : -1}
                      aria-selected={selected}
                      aria-label={label}
                      title={label}
                      onMouseDown={(e) => handleCellMouseDown(e, { row, col })}
                      onMouseEnter={() => handleCellMouseEnter({ row, col })}
                      onKeyDown={(e) => handleCellKeyDown(e, { row, col })}
                      className={`relative h-11 rounded-md flex items-center justify-center outline-none transition-shadow ${
                        selectable ? 'cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-500' : ''
                      } ${selected ? 'ring-2 ring-accent-500 ring-offset-1 ring-offset-[rgb(var(--bg-surface))] z-[1]' : ''}`}
                    >
                      {entry ? (
                        <span
                          className={`w-full h-full rounded-md border flex flex-col items-center justify-center leading-tight overflow-hidden ${
                            color?.chip ?? 'bg-slate-100 text-slate-800 border-slate-300'
                          }`}
                        >
                          {dense ? (
                            <span className="text-2xs font-semibold">{shiftAbbreviation(shiftName)}</span>
                          ) : (
                            <>
                              <span className="text-xs font-semibold truncate max-w-full px-1.5">{shiftName}</span>
                              <span className="text-2xs opacity-80 tabular-nums truncate max-w-full px-1.5">
                                {entry.shift?.startTime}–{entry.shift?.endTime}
                                {entry.location ? ` · ${entry.location.name}` : ''}
                              </span>
                            </>
                          )}
                        </span>
                      ) : selected ? (
                        <span className="w-full h-full rounded-md bg-accent-50 dark:bg-accent-950/40" />
                      ) : selectable ? (
                        <Plus className="h-3.5 w-3.5 text-muted opacity-0 group-hover/row:opacity-40 hover:!opacity-100 transition-opacity" />
                      ) : null}
                    </div>
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <th className="sticky left-0 bottom-0 z-10 surface border-r border-t border-base px-4 py-2 text-left text-xs font-semibold text-secondary">
            Rostered
          </th>
          {days.map((day) => {
            const count = employees.reduce(
              (n, emp) => n + (rosterMap.has(cellKey(emp.id, day)) ? 1 : 0),
              0,
            );
            return (
              <td
                key={day}
                className="sticky bottom-0 surface border-t border-base px-1 py-2 text-center text-xs tabular-nums"
              >
                <span className={count === 0 ? 'text-muted' : 'text-primary font-medium'}>{count}</span>
                {!dense ? <span className="text-muted">/{employees.length}</span> : null}
              </td>
            );
          })}
        </tr>
      </tfoot>
    </table>
  );
}
