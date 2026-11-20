import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Clock,
  Coffee,
  Download,
  LogIn,
  Smartphone,
  Wallet,
} from 'lucide-react';
import type {
  EmployeeDashboardView,
  InAppNotificationRecord,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { usePermissions } from '@hrm/portal-ui';
import { CheckoutConfirmationModal } from '@/components/attendance/CheckoutConfirmationModal';
import { EmployeeEngagementSection } from '@/components/my/EmployeeEngagementSection';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { useNav } from '@/context/NavContext';
import { usePageAccess } from '@/hooks/usePageAccess';
import { formatRelativeTime } from '@/lib/dashboard-api';
import {
  downloadMyPayslip,
  formatAttendanceMinutes,
} from '@/lib/my-api';
import {
  NOTIFICATION_TONE_DOT,
  notificationToneForEvent,
  resolveNotificationTargetPage,
} from '@/lib/notification-links';
import { LeaveStatusPill } from './leave/LeaveStatusPill';

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';

const PHASE_TONES: Record<EmployeeDashboardView['attendance']['metrics']['phase'], BadgeTone> = {
  not_started: 'neutral',
  working: 'success',
  on_break: 'warning',
  completed: 'info',
};

function attendanceStatusTone(status: string): BadgeTone {
  if (status === 'present' || status === 'on_time') return 'success';
  if (status === 'late' || status === 'half_day') return 'warning';
  if (status === 'absent') return 'error';
  return 'neutral';
}

function formatTime(iso: string | null, emDash: string): string {
  if (!iso) return emDash;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function displayClock(
  attendance: EmployeeDashboardView['attendance'],
  field: 'clockInAt' | 'clockOutAt',
  emDash: string,
): string {
  const display = attendance.display?.[field];
  if (display) return display;
  return formatTime(attendance[field], emDash);
}

function displayShiftRange(
  record: EmployeeDashboardView['todayShift'] | undefined,
  fallback: EmployeeDashboardView['attendance']['shift'] | undefined,
  emDash: string,
): string {
  if (record?.display) {
    return `${record.display.shiftStartTime} – ${record.display.shiftEndTime}`;
  }
  if (record?.shift) {
    return `${record.shift.startTime} – ${record.shift.endTime}`;
  }
  if (fallback) {
    return `${fallback.startTime} – ${fallback.endTime}`;
  }
  return emDash;
}

interface EmployeeDashboardHomeProps {
  dashboard: EmployeeDashboardView;
  employeeId: string;
  companyId: string;
  actionLoading: boolean;
  onClockIn: () => Promise<void> | void;
  onClockOut: () => Promise<void>;
  onBreakStart: () => Promise<void> | void;
  onBreakEnd: () => Promise<void> | void;
  onSurveySubmitted: () => void;
  onNotificationOpen: (notification: InAppNotificationRecord) => Promise<void> | void;
}

export function EmployeeDashboardHome({
  dashboard,
  employeeId,
  companyId,
  actionLoading,
  onClockIn,
  onClockOut,
  onBreakStart,
  onBreakEnd,
  onSurveySubmitted,
  onNotificationOpen,
}: EmployeeDashboardHomeProps) {
  const { t } = useAppTranslation();
  const { can } = usePermissions();
  const { navigate } = useNav();
  const { canView, selfServiceOnly } = usePageAccess();

  const emDash = t('common.emDash');
  const {
    asOf,
    attendance,
    todayShift,
    leaveBalances,
    upcomingLeave,
    latestPayslip,
    notifications,
    unreadNotificationCount,
    announcements,
    activeSurveys,
    kudosFeed,
  } = dashboard;
  const phase = attendance.metrics.phase;
  const canClockOnWeb = can('attendance', 'create');
  const canViewEngagement = can('engagement', 'view');

  const [payslipDownloading, setPayslipDownloading] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (phase !== 'working') return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [phase, asOf]);

  const elapsedExtraMinutes =
    phase === 'working'
      ? Math.max(0, Math.floor((nowMs - new Date(asOf).getTime()) / 60_000))
      : 0;
  const liveNetMinutes = attendance.metrics.netMinutes + elapsedExtraMinutes;
  const liveGrossMinutes = attendance.metrics.grossMinutes + elapsedExtraMinutes;

  const phaseLabel = t(`attendance.phase.${phase}`, {
    defaultValue: phase.replace(/_/g, ' '),
  });
  const attendanceStatusLabel = t(`attendance.statusValue.${attendance.status}`, {
    defaultValue: attendance.status.replace(/_/g, ' '),
  });

  const handlePayslipDownload = async () => {
    if (!latestPayslip?.downloadUrl) return;
    setPayslipDownloading(true);
    try {
      await downloadMyPayslip(latestPayslip.downloadUrl);
    } finally {
      setPayslipDownloading(false);
    }
  };

  const handleNotificationClick = async (note: InAppNotificationRecord) => {
    await onNotificationOpen(note);
    const target = resolveNotificationTargetPage(note.eventType, { selfServiceOnly });
    if (target && canView(target)) {
      navigate(target);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> {t('dashboard.todayShift')}
            </CardTitle>
            {canView('my-roster') && (
              <button
                type="button"
                onClick={() => navigate('my-roster')}
                className="text-xs font-medium text-accent-600 hover:text-accent-700 inline-flex items-center gap-1"
              >
                {t('dashboard.viewRoster')}
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </CardHeader>
          <CardBody className="text-sm space-y-1">
            {todayShift?.shift ? (
              <>
                <div className="font-medium text-primary">{todayShift.shift.name}</div>
                <div className="text-secondary">{displayShiftRange(todayShift, undefined, emDash)}</div>
                {todayShift.location?.name ? (
                  <div className="text-muted">{todayShift.location.name}</div>
                ) : null}
              </>
            ) : attendance.shift ? (
              <>
                <div className="font-medium text-primary">{attendance.shift.name}</div>
                <div className="text-secondary">
                  {displayShiftRange(undefined, attendance.shift, emDash)}
                </div>
              </>
            ) : (
              <p className="text-muted">{t('dashboard.noShiftToday')}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-4 w-4" /> {t('dashboard.clockInOut')}
            </CardTitle>
            <Badge tone={PHASE_TONES[phase]} dot>
              {phaseLabel}
            </Badge>
          </CardHeader>
          <CardBody className="text-sm space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-muted text-xs">{t('dashboard.clockIn')}</div>
                <div className="font-medium text-primary">
                  {displayClock(attendance, 'clockInAt', emDash)}
                </div>
              </div>
              <div>
                <div className="text-muted text-xs">{t('dashboard.clockOut')}</div>
                <div className="font-medium text-primary">
                  {displayClock(attendance, 'clockOutAt', emDash)}
                </div>
              </div>
            </div>
            {canClockOnWeb ? (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="min-h-[44px]"
                  disabled={actionLoading || phase !== 'not_started'}
                  onClick={() => void onClockIn()}
                >
                  {t('dashboard.clockInAction')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-h-[44px]"
                  disabled={actionLoading || phase === 'not_started' || phase === 'completed'}
                  onClick={() => setCheckoutModalOpen(true)}
                >
                  {t('dashboard.clockOutAction')}
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-base bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs text-secondary flex items-start gap-2">
                <Smartphone className="h-4 w-4 text-accent-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-primary">
                    {t('dashboard.useMobileAppToClockIn')}
                  </div>
                  <div className="text-muted">{t('dashboard.mobileClockInHint')}</div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle>{t('dashboard.workingHours')}</CardTitle>
            <Badge
              tone={attendanceStatusTone(attendance.status)}
              dot
              className="capitalize"
            >
              {attendanceStatusLabel}
            </Badge>
          </CardHeader>
          <CardBody className="text-sm space-y-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-primary">
                {formatAttendanceMinutes(liveNetMinutes)}
              </span>
              {phase === 'working' && (
                <Badge tone="success">{t('dashboard.liveTimer')}</Badge>
              )}
            </div>
            <div className="text-secondary">
              {t('dashboard.gross', {
                minutes: formatAttendanceMinutes(liveGrossMinutes),
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coffee className="h-4 w-4" /> {t('dashboard.break')}
            </CardTitle>
          </CardHeader>
          <CardBody className="text-sm space-y-3">
            <div>
              <div className="text-muted text-xs">{t('dashboard.breakTime')}</div>
              <div className="font-medium text-primary">
                {formatAttendanceMinutes(attendance.metrics.breakMinutes)}
              </div>
            </div>
            {canClockOnWeb && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-h-[44px]"
                  disabled={actionLoading || phase !== 'working'}
                  onClick={() => void onBreakStart()}
                >
                  {t('dashboard.startBreak')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-h-[44px]"
                  disabled={actionLoading || phase !== 'on_break'}
                  onClick={() => void onBreakEnd()}
                >
                  {t('dashboard.endBreak')}
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> {t('dashboard.leaveBalance')}
            </CardTitle>
            {canView('my-leave') && (
              <button
                type="button"
                onClick={() => navigate('my-leave')}
                className="text-xs font-medium text-accent-600 hover:text-accent-700 inline-flex items-center gap-1"
              >
                {t('dashboard.requestLeave')}
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </CardHeader>
          <CardBody className="grid sm:grid-cols-2 gap-3">
            {leaveBalances.length === 0 ? (
              <p className="text-sm text-muted sm:col-span-2">{t('dashboard.noLeaveBalances')}</p>
            ) : (
              leaveBalances.map((bal) => (
                <div
                  key={bal.id}
                  className="rounded-lg border border-base px-3 py-2"
                >
                  <div className="text-sm font-medium text-primary">
                    {bal.leaveTypeName ?? t('dashboard.leaveFallback')}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {bal.entitlementDays > 0
                      ? t('common.daysRemaining', {
                          balance: bal.balanceDays.toFixed(1),
                          entitlement: bal.entitlementDays.toFixed(1),
                        })
                      : t('common.daysRemainingShort', {
                          balance: bal.balanceDays.toFixed(1),
                        })}
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>{t('dashboard.upcomingLeave')}</CardTitle>
            {canView('my-leave') && (
              <button
                type="button"
                onClick={() => navigate('my-leave')}
                className="text-xs font-medium text-accent-600 hover:text-accent-700 inline-flex items-center gap-1"
              >
                {t('dashboard.viewAll')}
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            {upcomingLeave.length === 0 ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted">{t('dashboard.noUpcomingLeave')}</p>
                {canView('my-leave') && (
                  <Button variant="secondary" size="sm" onClick={() => navigate('my-leave')}>
                    {t('dashboard.requestLeave')}
                  </Button>
                )}
              </div>
            ) : (
              upcomingLeave.map((req) => (
                <div key={req.id} className="py-2 first:pt-0 last:pb-0 flex justify-between items-center gap-3 text-sm">
                  <div>
                    <div className="font-medium text-primary">
                      {req.leaveTypeName ?? t('dashboard.leaveFallback')}
                    </div>
                    <div className="text-muted text-xs">
                      {t('common.dateRange', { start: req.startDate, end: req.endDate })}
                    </div>
                  </div>
                  <LeaveStatusPill status={req.status} />
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      {canViewEngagement && (
        <EmployeeEngagementSection
          employeeId={employeeId}
          companyId={companyId}
          announcements={announcements}
          activeSurveys={activeSurveys}
          kudosFeed={kudosFeed}
          onSubmitted={onSurveySubmitted}
        />
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4" /> {t('dashboard.latestPayslip')}
            </CardTitle>
            {canView('my-payslips') && (
              <button
                type="button"
                onClick={() => navigate('my-payslips')}
                className="text-xs font-medium text-accent-600 hover:text-accent-700 inline-flex items-center gap-1"
              >
                {t('dashboard.viewPayslips')}
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </CardHeader>
          <CardBody className="text-sm">
            {latestPayslip ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {latestPayslip.netPay !== undefined ? (
                      <div className="text-lg font-bold text-primary">
                        {t('dashboard.netPay')}:{' '}
                        {latestPayslip.payCurrency ? `${latestPayslip.payCurrency} ` : ''}
                        {latestPayslip.netPay}
                      </div>
                    ) : (
                      <div className="font-medium text-primary">
                        {t('dashboard.generated', {
                          date: new Date(latestPayslip.generatedAt).toLocaleDateString(),
                        })}
                      </div>
                    )}
                    <div className="text-muted text-xs mt-0.5">
                      {latestPayslip.periodStartDate && latestPayslip.periodEndDate
                        ? t('dashboard.payPeriod', {
                            start: latestPayslip.periodStartDate,
                            end: latestPayslip.periodEndDate,
                          })
                        : t('dashboard.payrollRun', {
                            id: latestPayslip.payrollRunId.slice(0, 8),
                          })}
                    </div>
                  </div>
                  {latestPayslip.downloadUrl ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={payslipDownloading}
                      onClick={() => void handlePayslipDownload()}
                    >
                      <Download className="h-4 w-4" />
                      {payslipDownloading ? t('common.downloading') : t('common.download')}
                    </Button>
                  ) : null}
                </div>
                {(latestPayslip.grossPay !== undefined ||
                  latestPayslip.totalDeductions !== undefined) && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-base text-xs">
                    <div>
                      <span className="text-muted">{t('dashboard.grossLabel')}: </span>
                      <span className="font-medium text-primary">
                        {latestPayslip.payCurrency ? `${latestPayslip.payCurrency} ` : ''}
                        {latestPayslip.grossPay}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted">{t('dashboard.deductions')}: </span>
                      <span className="font-medium text-primary">
                        {latestPayslip.payCurrency ? `${latestPayslip.payCurrency} ` : ''}
                        {latestPayslip.totalDeductions}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted">{t('dashboard.noPayslips')}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" /> {t('dashboard.notifications')}
            </CardTitle>
            <div className="flex items-center gap-2">
              {unreadNotificationCount > 0 ? (
                <Badge tone="warning">
                  {t('dashboard.unread', { count: unreadNotificationCount })}
                </Badge>
              ) : null}
              {canView('my-notifications') && (
                <button
                  type="button"
                  onClick={() => navigate('my-notifications')}
                  className="text-xs font-medium text-accent-600 hover:text-accent-700 inline-flex items-center gap-1"
                >
                  {t('dashboard.viewAll')}
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted">{t('dashboard.allCaughtUp')}</p>
            ) : (
              notifications.map((note) => {
                const tone = notificationToneForEvent(note.eventType);
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => void handleNotificationClick(note)}
                    className={`w-full py-2.5 first:pt-0 last:pb-0 text-left text-sm flex items-start gap-2.5 hover:bg-[rgb(var(--bg-hover))] rounded-md px-1.5 -mx-1.5 transition-colors ${
                      note.readAt ? 'opacity-75' : ''
                    }`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${NOTIFICATION_TONE_DOT[tone]}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-primary truncate">{note.title}</div>
                        {!note.readAt ? <Badge tone="accent">{t('common.new')}</Badge> : null}
                      </div>
                      {note.body ? (
                        <div className="text-secondary text-xs mt-0.5 line-clamp-2">
                          {note.body}
                        </div>
                      ) : null}
                      <div className="text-[11px] text-muted mt-0.5">
                        {formatRelativeTime(note.createdAt)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </CardBody>
        </Card>
      </div>

      <CheckoutConfirmationModal
        open={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        onConfirm={async () => {
          await onClockOut();
          setCheckoutModalOpen(false);
        }}
        record={attendance}
        loading={actionLoading}
      />
    </div>
  );
}
