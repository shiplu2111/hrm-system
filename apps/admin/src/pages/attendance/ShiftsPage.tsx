import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Copy, Plus } from 'lucide-react';
import { PermissionGate, usePermission } from '@hrm/portal-ui';
import {
  computeShiftDuration,
  type OvertimeRuleRecord,
  type ShiftRecord,
} from '@hrm/shared-types';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataTable, DataTableBody, DataTableHead } from '@/components/ui/DataTable';
import { DropdownItem } from '@/components/ui/Dropdown';
import { CompanySelector } from '@/components/org/CompanySelector';
import {
  OrgErrorBanner,
  OrgRowActions,
  OrgSearchInput,
  OrgTableSkeleton,
  UsageBadge,
} from '@/components/org/OrgScreenParts';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import { ShiftFormPanel, type ShiftPanelMode } from '@/components/roster/ShiftFormPanel';
import { useCompany } from '@/context/CompanyContext';
import { deleteShift, listOtRules, listShifts } from '@/lib/roster-api';
import {
  SHIFT_TYPE_META,
  buildShiftColors,
  formatMinutes,
  shiftRunsOnWeekends,
  shiftWeekendDays,
  WEEKDAY_SHORT,
} from '@/lib/shift-roster';
import { ApiError } from '@/lib/tenant-api-client';

export function ShiftsPage() {
  const { companyId, loading: companyLoading, error: companyError } = useCompany();

  if (companyLoading) return <PageLoadingState message="Loading company…" />;
  if (companyError) return <PageErrorState error={companyError} />;
  if (!companyId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">No company found for this tenant.</div>
    );
  }
  return <ShiftsScreen key={companyId} companyId={companyId} />;
}

function ShiftsScreen({ companyId }: { companyId: string }) {
  const canCreate = usePermission('settings', 'create');
  const canEdit = usePermission('settings', 'edit');
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  /** null = could not be loaded (e.g. no settings access) */
  const [otRules, setOtRules] = useState<OvertimeRuleRecord[] | null>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState<ShiftPanelMode | null>(null);
  const [deleting, setDeleting] = useState<ShiftRecord | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [shiftRows, ruleRows] = await Promise.all([
        listShifts(companyId),
        listOtRules(companyId).catch(() => null),
      ]);
      setShifts(shiftRows);
      setOtRules(ruleRows);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const colors = useMemo(() => buildShiftColors(shifts), [shifts]);
  const rulesById = useMemo(() => new Map((otRules ?? []).map((r) => [r.id, r])), [otRules]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shifts.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        SHIFT_TYPE_META[s.shiftType].label.toLowerCase().includes(q),
    );
  }, [shifts, search]);

  const openCreate = () => setPanel({ kind: 'create' });

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">Attendance</p>
          <h1 className="text-xl font-bold text-primary">Shifts</h1>
          <p className="text-sm text-secondary mt-0.5">
            Working windows, grace periods and overtime rules used when rostering employees.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CompanySelector />
          <PermissionGate module="settings" action="create">
            <Button variant="primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add shift
            </Button>
          </PermissionGate>
        </div>
      </div>

      {loadError ? <OrgErrorBanner message={loadError} onRetry={() => void load()} /> : null}

      <Card>
        <CardHeader>
          <OrgSearchInput value={search} onChange={setSearch} placeholder="Search shifts" />
        </CardHeader>
        {loading ? (
          <OrgTableSkeleton columns={6} />
        ) : shifts.length === 0 ? (
          <EmptyState
            compact
            icon={Clock}
            title="No shifts yet"
            description="Define each working window once — start and end, break, grace period and overtime — then roster employees onto it."
            action={canCreate ? { label: 'Add first shift', onClick: openCreate, icon: Plus } : undefined}
          />
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">No shifts match “{search}”.</p>
        ) : (
          <DataTable>
            <DataTableHead>
              <tr className="text-left text-xs font-semibold text-secondary uppercase tracking-wide">
                <th className="px-5 py-2.5">Shift</th>
                <th className="px-5 py-2.5">Hours</th>
                <th className="px-5 py-2.5 hidden md:table-cell">Working time</th>
                <th className="px-5 py-2.5 hidden lg:table-cell">Grace</th>
                <th className="px-5 py-2.5 hidden lg:table-cell">Weekend</th>
                <th className="px-5 py-2.5 hidden xl:table-cell">Overtime</th>
                <th className="px-5 py-2.5 hidden sm:table-cell">Rostered</th>
                <th className="w-12" />
              </tr>
            </DataTableHead>
            <DataTableBody>
              {visible.map((shift) => {
                const duration = computeShiftDuration(shift.startTime, shift.endTime, shift.breakMinutes);
                const rule = shift.otRuleId ? rulesById.get(shift.otRuleId) : undefined;
                const assigned = shift.assignmentCount ?? 0;
                const weekend = shiftWeekendDays(shift);
                return (
                  <tr
                    key={shift.id}
                    onClick={canEdit ? () => setPanel({ kind: 'edit', shift }) : undefined}
                    className={canEdit ? 'hover:bg-[rgb(var(--bg-hover))] cursor-pointer' : undefined}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${colors.get(shift.id)?.dot}`} />
                        <span className="font-medium text-primary">{shift.name}</span>
                        <Badge>{SHIFT_TYPE_META[shift.shiftType].label}</Badge>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-secondary tabular-nums whitespace-nowrap">
                      {shift.startTime} – {shift.endTime}
                      {duration?.crossesMidnight ? (
                        <span className="ml-1.5 text-2xs font-medium text-muted align-top">+1 day</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell whitespace-nowrap">
                      <span className="text-primary tabular-nums">
                        {duration ? formatMinutes(duration.netMinutes) : '—'}
                      </span>
                      {shift.breakMinutes > 0 ? (
                        <span className="text-xs text-muted"> · {formatMinutes(shift.breakMinutes)} break</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-secondary hidden lg:table-cell tabular-nums">
                      {shift.graceMinutes > 0 ? `${shift.graceMinutes} min` : 'None'}
                    </td>
                    <td className="px-5 py-3 text-secondary hidden lg:table-cell">
                      {weekend.length === 0 ? (
                        <span className="text-muted">None</span>
                      ) : (
                        <span className="whitespace-nowrap">
                          {[...weekend]
                            .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
                            .map((d) => WEEKDAY_SHORT[d])
                            .join(', ')}
                          {shiftRunsOnWeekends(shift) ? (
                            <span className="text-xs text-muted"> · worked</span>
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 hidden xl:table-cell">
                      {!shift.otRuleId ? (
                        <span className="text-muted">—</span>
                      ) : rule ? (
                        <span className="text-secondary">{rule.name}</span>
                      ) : otRules === null ? (
                        <span className="text-secondary">Rule set</span>
                      ) : (
                        <Badge tone="warning">Rule ended</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell tabular-nums">
                      <UsageBadge count={assigned} noun="day" />
                    </td>
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <OrgRowActions
                        label={shift.name}
                        onEdit={() => setPanel({ kind: 'edit', shift })}
                        onDelete={() => setDeleting(shift)}
                        deleteBlockedReason={
                          assigned > 0
                            ? `Rostered on ${assigned} day${assigned === 1 ? '' : 's'} — clear those first`
                            : null
                        }
                        extra={
                          canCreate ? (
                            <DropdownItem
                              icon={<Copy className="h-4 w-4" />}
                              onClick={() => setPanel({ kind: 'duplicate', source: shift })}
                            >
                              Duplicate
                            </DropdownItem>
                          ) : null
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </DataTableBody>
          </DataTable>
        )}
        {!loading && shifts.length > 0 ? (
          <p className="px-5 py-2.5 text-xs text-muted border-t border-base">
            {visible.length === shifts.length
              ? `${shifts.length} shift${shifts.length === 1 ? '' : 's'}`
              : `Showing ${visible.length} of ${shifts.length}`}
          </p>
        ) : null}
      </Card>

      {panel ? (
        <ShiftFormPanel
          open
          mode={panel}
          companyId={companyId}
          shifts={shifts}
          otRules={otRules}
          color={panel.kind === 'edit' ? colors.get(panel.shift.id) : undefined}
          onOtRuleCreated={(rule) => setOtRules((prev) => [...(prev ?? []), rule])}
          onClose={() => setPanel(null)}
          onSaved={() => {
            setPanel(null);
            void load();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete shift?"
        confirmLabel="Delete shift"
        description={
          deleting ? (
            <>
              <span className="font-medium text-primary">{deleting.name}</span> will be permanently
              removed.
            </>
          ) : null
        }
        onConfirm={async () => {
          if (!deleting) return;
          await deleteShift(companyId, deleting.id);
          await load();
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
