import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CalendarRange,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  X,
} from 'lucide-react';
import {
  computeShiftDuration,
  type RosterRecord,
  type ShiftSwapRequestRecord,
  type ShiftSwapRequestStatus,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusPill, type StatusPillTone } from '@/components/ui/StatusPill';
import { MyPageLayout } from '@/components/my/MyPageLayout';
import { ShiftSwapRequestModal } from '@/components/my/roster/ShiftSwapRequestModal';
import { useMyEmployee } from '@/components/my/useMyEmployee';
import {
  cancelMyShiftSwap,
  formatAttendanceMinutes,
  listMyRosters,
  listMyShiftSwaps,
} from '@/lib/my-api';
import { ApiError } from '@/lib/tenant-api-client';

const SWAP_STATUS_TONE: Record<ShiftSwapRequestStatus, StatusPillTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  cancelled: 'neutral',
};

function parseDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function todayIsoLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function addDaysIso(baseIso: string, days: number): string {
  const dt = parseDate(baseIso);
  dt.setDate(dt.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function shiftRange(record: RosterRecord, emDash: string): string {
  if (record.display) return `${record.display.shiftStartTime} – ${record.display.shiftEndTime}`;
  if (record.shift) return `${record.shift.startTime} – ${record.shift.endTime}`;
  return emDash;
}

export function MyRosterPage() {
  const { t, i18n } = useAppTranslation();
  const locale = i18n.language?.startsWith('bn') ? 'bn-BD' : 'en-GB';
  const emDash = t('common.emDash');
  const { employeeId, companyId, loading: profileLoading, error: profileError } = useMyEmployee();

  const [daysWindow, setDaysWindow] = useState<14 | 30>(14);
  const [rosters, setRosters] = useState<RosterRecord[]>([]);
  const [swaps, setSwaps] = useState<ShiftSwapRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [presetRosterId, setPresetRosterId] = useState<string | null>(null);

  const today = useMemo(() => todayIsoLocal(), []);

  const loadData = useCallback(async () => {
    if (!employeeId || !companyId) {
      if (!profileLoading) setLoading(false);
      return;
    }
    const from = today;
    const to = addDaysIso(today, daysWindow);
    setLoading(true);
    setError(null);
    try {
      const [rosterRows, swapRows] = await Promise.all([
        listMyRosters(companyId, employeeId, { from, to }),
        listMyShiftSwaps(companyId, employeeId),
      ]);
      setRosters(rosterRows);
      setSwaps(swapRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.loadEmployeeData'));
    } finally {
      setLoading(false);
    }
  }, [employeeId, companyId, profileLoading, daysWindow, today, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    [locale],
  );

  const nextShift = rosters[0] ?? null;

  function openSwapModal(rosterId: string | null = null) {
    setNotice(null);
    setPresetRosterId(rosterId);
    setSwapModalOpen(true);
  }

  return (
    <MyPageLayout
      title={t('roster.title')}
      subtitle={t('roster.subtitle')}
      loading={profileLoading}
      error={profileError ?? error}
      actions={
        employeeId && companyId ? (
          <Button
            variant="primary"
            size="sm"
            className="min-h-[40px]"
            onClick={() => openSwapModal(null)}
          >
            <ArrowLeftRight className="h-4 w-4" />
            {t('shiftSwap.requestButton')}
          </Button>
        ) : undefined
      }
    >
      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-800 dark:bg-success-900/30 dark:text-success-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            className="opacity-70 hover:opacity-100"
            onClick={() => setNotice(null)}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {employeeId && companyId ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <Card>
                <CardBody className="py-3">
                  <div className="text-xs text-muted">{t('roster.scheduledCount')}</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-primary">
                    {loading ? '—' : rosters.length}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="py-3">
                  <div className="text-xs text-muted">{t('roster.nextShift')}</div>
                  <div className="mt-1 text-sm font-semibold text-primary">
                    {loading
                      ? '—'
                      : nextShift
                        ? `${dateFmt.format(parseDate(nextShift.date))} · ${nextShift.shift?.name ?? t('attendance.shiftFallback')} (${shiftRange(nextShift, emDash)})`
                        : t('roster.noneUpcoming')}
                  </div>
                </CardBody>
              </Card>
            </div>

            <div className="flex gap-1.5" role="tablist" aria-label={t('roster.title')}>
              {([14, 30] as const).map((win) => {
                const active = daysWindow === win;
                return (
                  <button
                    key={win}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setDaysWindow(win)}
                    className={`min-h-[40px] rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-accent-500 bg-accent-50 text-accent-700 dark:border-accent-700 dark:bg-accent-950/50 dark:text-accent-300'
                        : 'border-base text-secondary hover:bg-[rgb(var(--bg-muted))]'
                    }`}
                  >
                    {t(win === 14 ? 'roster.range14' : 'roster.range30')}
                  </button>
                );
              })}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('roster.title')}</CardTitle>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((idx) => (
                    <Skeleton key={idx} className="h-16 w-full" />
                  ))}
                </div>
              ) : rosters.length === 0 ? (
                <EmptyState
                  icon={CalendarRange}
                  title={t('roster.empty')}
                  description={t('roster.emptyHint')}
                  compact
                />
              ) : (
                <ul className="divide-y divide-[rgb(var(--border-base))]">
                  {rosters.map((r) => {
                    const isToday = r.date.slice(0, 10) === today;
                    const dur =
                      r.shift && r.shift.startTime && r.shift.endTime
                        ? computeShiftDuration(
                            r.shift.startTime,
                            r.shift.endTime,
                            r.shift.breakMinutes ?? 0,
                          )
                        : null;
                    return (
                      <li key={r.id} className="py-3.5 first:pt-1 last:pb-1">
                        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-primary">
                                {r.display?.date ?? dateFmt.format(parseDate(r.date))}
                              </span>
                              {isToday && <Badge tone="accent">{t('roster.today')}</Badge>}
                              {r.shift?.type && (
                                <Badge tone="neutral">
                                  {t(`roster.shiftTypes.${r.shift.type}`, {
                                    defaultValue: r.shift.type,
                                  })}
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                {r.location?.name ?? t('roster.noLocation')}
                                {r.location?.timezone ? ` (${r.location.timezone})` : ''}
                              </span>
                              {(r.shift?.breakMinutes ?? 0) > 0 && (
                                <span>
                                  {t('roster.breakMinutes', {
                                    minutes: r.shift?.breakMinutes ?? 0,
                                  })}
                                </span>
                              )}
                              {dur && (
                                <span>
                                  {t('roster.netHours', {
                                    hours: formatAttendanceMinutes(dur.netMinutes),
                                  })}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-sm font-medium tabular-nums text-primary">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 shrink-0 text-accent-600" />
                              <span>{r.shift?.name ?? t('attendance.shiftFallback')}</span>
                              <span className="text-secondary">({shiftRange(r, emDash)})</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openSwapModal(r.id)}
                            >
                              <ArrowLeftRight className="h-3.5 w-3.5" />
                              {t('shiftSwap.quickSwap')}
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>{t('shiftSwap.title')}</CardTitle>
              <Button variant="secondary" size="sm" onClick={() => openSwapModal(null)}>
                <ArrowLeftRight className="h-3.5 w-3.5" />
                {t('shiftSwap.requestButton')}
              </Button>
            </CardHeader>
            <CardBody>
              {swaps.length === 0 ? (
                <p className="py-2 text-sm text-muted">{t('shiftSwap.empty')}</p>
              ) : (
                <ul className="divide-y divide-[rgb(var(--border-base))]">
                  {swaps.map((swap) => (
                    <ShiftSwapRow
                      key={swap.id}
                      swap={swap}
                      ownEmployeeId={employeeId}
                      onCancelled={(updated) =>
                        setSwaps((rows) => rows.map((r) => (r.id === updated.id ? updated : r)))
                      }
                    />
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <ShiftSwapRequestModal
            open={swapModalOpen}
            employeeId={employeeId}
            companyId={companyId}
            rosters={rosters}
            presetRosterId={presetRosterId}
            onClose={() => {
              setSwapModalOpen(false);
              setPresetRosterId(null);
            }}
            onSubmitted={(created) => {
              setSwapModalOpen(false);
              setPresetRosterId(null);
              setSwaps((prev) => [created, ...prev]);
              setNotice(t('shiftSwap.submitted'));
            }}
          />
        </div>
      ) : null}
    </MyPageLayout>
  );
}

function ShiftSwapRow({
  swap,
  ownEmployeeId,
  onCancelled,
}: {
  swap: ShiftSwapRequestRecord;
  ownEmployeeId: string;
  onCancelled: (updated: ShiftSwapRequestRecord) => void;
}) {
  const { t } = useAppTranslation();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const canCancel = swap.status === 'pending' && swap.requesterEmployeeId === ownEmployeeId;
  const activeStep = swap.workflowInstance?.steps.find((s) => s.status === 'pending');

  async function handleCancel() {
    setCancelling(true);
    try {
      const updated = await cancelMyShiftSwap(swap.id);
      setConfirming(false);
      onCancelled(updated);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <li className="py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="font-medium text-primary">
            {t('shiftSwap.proposedBy', {
              requester: swap.requesterName,
              target: swap.targetName,
            })}
          </div>
          <div className="text-xs text-secondary">
            {swap.swapDate}
            {swap.requesterShiftName ? ` (${swap.requesterShiftName})` : ''} → {swap.targetDate}
            {swap.targetShiftName ? ` (${swap.targetShiftName})` : ''}
          </div>
          <div className="text-xs text-muted">{swap.reason}</div>
          {swap.status === 'pending' && activeStep && swap.workflowInstance && (
            <div className="text-xs text-warning-700 dark:text-warning-300">
              {t('shiftSwap.stepProgress', {
                current: activeStep.order,
                total: swap.workflowInstance.steps.length,
                role: activeStep.roleName,
              })}
            </div>
          )}
          {swap.reviewComment && (
            <div className="text-xs text-secondary">“{swap.reviewComment}”</div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusPill tone={SWAP_STATUS_TONE[swap.status]}>
            {t(`shiftSwap.status.${swap.status}`)}
          </StatusPill>
          {canCancel && !confirming && (
            <button
              type="button"
              className="text-xs font-medium text-secondary hover:text-error-600"
              onClick={() => setConfirming(true)}
            >
              {t('shiftSwap.cancel')}
            </button>
          )}
        </div>
      </div>

      {confirming && canCancel && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs">
          <span className="mr-auto text-secondary">{t('shiftSwap.confirmCancel')}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={cancelling}
            onClick={() => setConfirming(false)}
          >
            {t('shiftSwap.keep')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={cancelling}
            onClick={() => void handleCancel()}
          >
            {cancelling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('shiftSwap.yesCancel')}
          </Button>
        </div>
      )}
    </li>
  );
}
