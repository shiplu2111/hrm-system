import { useCallback, useEffect, useState } from 'react';
import { Clock, Coffee, Loader2, LogIn, LogOut, PencilLine, Smartphone } from 'lucide-react';
import type {
  AttendanceDayRecord,
  AttendanceRegisterDay,
  EmployeeAttendanceHistoryView,
  OvertimeRequestRecord,
  OvertimeRequestStatus,
  SubmitAttendanceCorrectionInput,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { usePermissions } from '@hrm/portal-ui';
import { CheckoutConfirmationModal } from '@/components/attendance/CheckoutConfirmationModal';
import {
  attendanceDayBadgeTone,
  correctionStatusTone,
} from '@/components/attendance/attendance-status';
import { AttendanceHistorySection } from '@/components/my/attendance/AttendanceHistorySection';
import { MyAttendanceCorrectionModal } from '@/components/my/attendance/MyAttendanceCorrectionModal';
import { OvertimeRequestModal } from '@/components/my/attendance/OvertimeRequestModal';
import { MyPageLayout } from '@/components/my/MyPageLayout';
import { useMyEmployee } from '@/components/my/useMyEmployee';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusPill, type StatusPillTone } from '@/components/ui/StatusPill';
import type { AttendanceCorrectionRecord } from '@/lib/attendance-api';
import {
  cancelMyOvertimeRequest,
  formatAttendanceMinutes,
  getAttendanceToday,
  getMyAttendanceCorrections,
  getMyAttendanceHistory,
  listMyOvertimeRequests,
  runAttendanceAction,
  submitMyAttendanceCorrection,
  type AttendanceAction,
} from '@/lib/my-api';
import { ApiError } from '@/lib/tenant-api-client';

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthRange(monthKey: string): { from: string; to: string } {
  const [y, m] = monthKey.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${monthKey}-01`,
    to: `${monthKey}-${String(lastDay).padStart(2, '0')}`,
  };
}

function shiftMonth(monthKey: string, delta: -1 | 1): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function displayClock(
  attendance: AttendanceDayRecord | null,
  field: 'clockInAt' | 'clockOutAt',
  emDash: string,
): string {
  const display = attendance?.display?.[field];
  if (display) return display;
  const iso = attendance?.[field];
  return iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : emDash;
}

function formatIsoTime(iso: string | null | undefined, emDash: string): string {
  if (!iso) return emDash;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const OT_STATUS_TONE: Record<OvertimeRequestStatus, StatusPillTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  cancelled: 'neutral',
};

export function MyAttendancePage() {
  const { t } = useAppTranslation();
  const emDash = t('common.emDash');
  const { employeeId, companyId, loading: profileLoading, error: profileError } = useMyEmployee();
  const { can } = usePermissions();
  const canCreateAttendance = can('attendance', 'create');

  const [attendance, setAttendance] = useState<AttendanceDayRecord | null>(null);
  const [monthKey, setMonthKey] = useState<string>(() => currentMonthKey());
  const [history, setHistory] = useState<EmployeeAttendanceHistoryView | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [corrections, setCorrections] = useState<AttendanceCorrectionRecord[]>([]);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [overtimeModalOpen, setOvertimeModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<AttendanceRegisterDay | null>(null);

  const loadMonthHistory = useCallback(
    async (targetMonth: string) => {
      if (!employeeId) return;
      setHistoryLoading(true);
      try {
        const { from, to } = monthRange(targetMonth);
        setHistory(await getMyAttendanceHistory(employeeId, from, to));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('errors.loadEmployeeData'));
      } finally {
        setHistoryLoading(false);
      }
    },
    [employeeId, t],
  );

  const loadAll = useCallback(async () => {
    if (profileLoading) return;
    if (!employeeId) {
      setError(profileError ?? t('errors.notLinked'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { from, to } = monthRange(monthKey);
      const [todayData, historyData, correctionData, otData] = await Promise.all([
        getAttendanceToday(employeeId),
        getMyAttendanceHistory(employeeId, from, to),
        getMyAttendanceCorrections(employeeId),
        companyId ? listMyOvertimeRequests(companyId, employeeId) : Promise.resolve([]),
      ]);
      setAttendance(todayData);
      setHistory(historyData);
      setCorrections(correctionData);
      setOvertimeRequests(otData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.loadEmployeeData'));
    } finally {
      setLoading(false);
    }
  }, [employeeId, companyId, monthKey, profileError, profileLoading, t]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const runAction = async (action: AttendanceAction) => {
    if (!employeeId) return;
    setActionLoading(true);
    setError(null);
    try {
      const updated = await runAttendanceAction(employeeId, action);
      setAttendance(updated);
      await loadMonthHistory(monthKey);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.attendanceAction'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitCorrection = async (input: SubmitAttendanceCorrectionInput) => {
    if (!employeeId) return;
    await submitMyAttendanceCorrection(employeeId, input);
    setNotice(t('attendance.myPage.correctionSubmitted'));
    const [correctionData] = await Promise.all([
      getMyAttendanceCorrections(employeeId),
      loadMonthHistory(monthKey),
    ]);
    setCorrections(correctionData);
  };

  const openCorrectionForDay = (day: AttendanceRegisterDay | null) => {
    setSelectedDay(day);
    setCorrectionModalOpen(true);
  };

  const phase = attendance?.metrics.phase;
  const statusLabel = attendance?.status
    ? t(`attendance.statusValue.${attendance.status}`, {
        defaultValue: attendance.status.replace('_', ' '),
      })
    : emDash;
  const todayKey = history?.today ?? new Date().toISOString().slice(0, 10);
  const canNextMonth = monthKey < todayKey.slice(0, 7);

  return (
    <MyPageLayout
      title={t('nav.attendance')}
      subtitle={t('attendance.myPage.subtitle')}
      loading={loading}
      error={error}
      onRetry={() => void loadAll()}
      actions={
        canCreateAttendance && employeeId ? (
          <div className="flex flex-wrap items-center gap-2">
            {companyId && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setNotice(null);
                  setOvertimeModalOpen(true);
                }}
              >
                <Clock className="h-4 w-4" />
                {t('overtime.requestButton')}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openCorrectionForDay(null)}
            >
              <PencilLine className="h-4 w-4" />
              {t('attendance.myPage.newCorrectionRequest')}
            </Button>
          </div>
        ) : undefined
      }
    >
      {notice ? (
        <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-2.5 text-sm text-success-700 dark:border-success-800 dark:bg-success-950/30 dark:text-success-300">
          {notice}
        </div>
      ) : null}

      {employeeId ? (
        <>
          <Card>
            <CardHeader className="flex items-center justify-between gap-2">
              <CardTitle>{t('dashboard.clockInOut')}</CardTitle>
              {attendance ? (
                <Badge
                  tone={attendanceDayBadgeTone(attendance.status)}
                  dot
                  className="capitalize"
                >
                  {statusLabel}
                </Badge>
              ) : null}
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid gap-3 text-sm sm:grid-cols-4">
                <div>
                  <div className="text-xs text-muted">{t('attendance.myPage.colIn')}</div>
                  <div className="font-medium text-primary">
                    {displayClock(attendance, 'clockInAt', emDash)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">{t('attendance.myPage.colOut')}</div>
                  <div className="font-medium text-primary">
                    {displayClock(attendance, 'clockOutAt', emDash)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">{t('attendance.myPage.colWorked')}</div>
                  <div className="font-medium text-primary">
                    {attendance ? formatAttendanceMinutes(attendance.metrics.netMinutes) : emDash}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">{t('dashboard.breakTime')}</div>
                  <div className="font-medium text-primary">
                    {attendance ? formatAttendanceMinutes(attendance.metrics.breakMinutes) : emDash}
                  </div>
                </div>
              </div>

              {canCreateAttendance ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    className="min-h-[44px]"
                    disabled={actionLoading || (phase !== undefined && phase !== 'not_started')}
                    onClick={() => void runAction('clock-in')}
                  >
                    <LogIn className="h-4 w-4" /> {t('dashboard.clockInAction')}
                  </Button>
                  <Button
                    variant="secondary"
                    className="min-h-[44px]"
                    disabled={actionLoading || phase === 'not_started' || phase === 'completed'}
                    onClick={() => setCheckoutModalOpen(true)}
                  >
                    <LogOut className="h-4 w-4" /> {t('dashboard.clockOutAction')}
                  </Button>
                  <Button
                    variant="secondary"
                    className="min-h-[44px]"
                    disabled={actionLoading || phase !== 'working'}
                    onClick={() => void runAction('break-start')}
                  >
                    <Coffee className="h-4 w-4" /> {t('dashboard.breakStart')}
                  </Button>
                  <Button
                    variant="secondary"
                    className="min-h-[44px]"
                    disabled={actionLoading || phase !== 'on_break'}
                    onClick={() => void runAction('break-end')}
                  >
                    <Coffee className="h-4 w-4" /> {t('dashboard.breakEnd')}
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-base bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs text-secondary flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-accent-600 shrink-0" />
                  <span>{t('dashboard.useMobileAppToClockIn')}</span>
                </div>
              )}
            </CardBody>
          </Card>

          <AttendanceHistorySection
            monthKey={monthKey}
            canNextMonth={canNextMonth}
            onChangeMonth={(delta) => {
              const next = shiftMonth(monthKey, delta);
              setMonthKey(next);
            }}
            history={history}
            loading={historyLoading}
            canRequestCorrection={canCreateAttendance}
            onRequestCorrection={(day) => openCorrectionForDay(day)}
          />

          <Card>
            <CardHeader className="flex items-center justify-between gap-2">
              <CardTitle>{t('attendance.myPage.correctionHistoryTitle')}</CardTitle>
              {canCreateAttendance && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openCorrectionForDay(null)}
                >
                  <PencilLine className="h-3.5 w-3.5" />
                  {t('attendance.myPage.requestCorrection')}
                </Button>
              )}
            </CardHeader>
            <CardBody className="divide-y divide-[rgb(var(--border-base))]">
              {corrections.length === 0 ? (
                <p className="text-sm text-muted py-2">
                  {t('attendance.myPage.correctionHistoryEmpty')}
                </p>
              ) : (
                corrections.map((c) => (
                  <div
                    key={c.id}
                    className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-start justify-between gap-3 text-sm"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-primary">{c.date}</span>
                        <Badge tone={correctionStatusTone(c.status)} dot>
                          {t(`attendance.myPage.correctionStatus.${c.status}`, {
                            defaultValue: c.status,
                          })}
                        </Badge>
                      </div>
                      <div className="text-xs text-secondary">{c.reason}</div>
                      <div className="text-xs text-muted flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          {t('attendance.myPage.correctionBefore')}:{' '}
                          {formatIsoTime(c.originalValues?.clockInAt, emDash)} –{' '}
                          {formatIsoTime(c.originalValues?.clockOutAt, emDash)}
                        </span>
                        <span>
                          {t('attendance.myPage.correctionRequested')}:{' '}
                          <span className="text-primary font-medium">
                            {formatIsoTime(c.requestedClockInAt, emDash)} –{' '}
                            {formatIsoTime(c.requestedClockOutAt, emDash)}
                          </span>
                        </span>
                      </div>
                      {c.reviewComment ? (
                        <div className="text-xs text-secondary">
                          {t('attendance.myPage.correctionReviewerNote', {
                            note: c.reviewComment,
                          })}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-muted shrink-0">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between gap-2">
              <CardTitle>{t('overtime.title')}</CardTitle>
              {canCreateAttendance && companyId && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setNotice(null);
                    setOvertimeModalOpen(true);
                  }}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {t('overtime.requestButton')}
                </Button>
              )}
            </CardHeader>
            <CardBody className="divide-y divide-[rgb(var(--border-base))]">
              {overtimeRequests.length === 0 ? (
                <p className="text-sm text-muted py-2">{t('overtime.empty')}</p>
              ) : (
                overtimeRequests.map((ot) => (
                  <MyOvertimeRequestRow
                    key={ot.id}
                    request={ot}
                    onCancelled={(updated) =>
                      setOvertimeRequests((rows) =>
                        rows.map((r) => (r.id === updated.id ? updated : r)),
                      )
                    }
                  />
                ))
              )}
            </CardBody>
          </Card>
        </>
      ) : null}

      <MyAttendanceCorrectionModal
        open={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        initialDay={selectedDay}
        days={history?.days ?? []}
        todayKey={todayKey}
        onSubmit={handleSubmitCorrection}
      />

      {employeeId && companyId ? (
        <OvertimeRequestModal
          open={overtimeModalOpen}
          employeeId={employeeId}
          companyId={companyId}
          onClose={() => setOvertimeModalOpen(false)}
          onSubmitted={(created) => {
            setOvertimeModalOpen(false);
            setOvertimeRequests((prev) => [created, ...prev]);
            setNotice(t('overtime.submitted'));
          }}
        />
      ) : null}

      <CheckoutConfirmationModal
        open={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        onConfirm={async () => {
          await runAction('clock-out');
          setCheckoutModalOpen(false);
        }}
        record={attendance}
        loading={actionLoading}
      />
    </MyPageLayout>
  );
}

function MyOvertimeRequestRow({
  request,
  onCancelled,
}: {
  request: OvertimeRequestRecord;
  onCancelled: (updated: OvertimeRequestRecord) => void;
}) {
  const { t } = useAppTranslation();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const activeStep = request.workflowInstance?.steps.find((s) => s.status === 'pending');

  async function handleCancel() {
    setCancelling(true);
    try {
      const updated = await cancelMyOvertimeRequest(request.id);
      setConfirming(false);
      onCancelled(updated);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="py-3 first:pt-0 last:pb-0 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-primary">{request.date}</span>
            <Badge tone="neutral">{t('overtime.hoursLabel', { hours: request.hours })}</Badge>
            <Badge tone="accent">{t(`overtime.rateTypes.${request.rateType}`)}</Badge>
          </div>
          {request.startTime && request.endTime && (
            <div className="text-xs text-muted">
              {request.startTime} – {request.endTime}
            </div>
          )}
          <div className="text-xs text-secondary">{request.reason}</div>
          {request.status === 'pending' && activeStep && request.workflowInstance && (
            <div className="text-xs text-warning-700 dark:text-warning-300">
              {t('overtime.stepProgress', {
                current: activeStep.order,
                total: request.workflowInstance.steps.length,
                role: activeStep.roleName,
              })}
            </div>
          )}
          {request.reviewComment && (
            <div className="text-xs text-secondary">“{request.reviewComment}”</div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusPill tone={OT_STATUS_TONE[request.status]}>
            {t(`overtime.status.${request.status}`)}
          </StatusPill>
          {request.status === 'pending' && !confirming && (
            <button
              type="button"
              className="text-xs font-medium text-secondary hover:text-error-600"
              onClick={() => setConfirming(true)}
            >
              {t('overtime.cancel')}
            </button>
          )}
        </div>
      </div>

      {confirming && request.status === 'pending' && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs">
          <span className="mr-auto text-secondary">{t('overtime.confirmCancel')}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={cancelling}
            onClick={() => setConfirming(false)}
          >
            {t('overtime.keep')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={cancelling}
            onClick={() => void handleCancel()}
          >
            {cancelling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('overtime.yesCancel')}
          </Button>
        </div>
      )}
    </div>
  );
}
