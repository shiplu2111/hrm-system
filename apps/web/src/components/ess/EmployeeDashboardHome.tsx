import {
  Bell,
  CalendarDays,
  Clock,
  Coffee,
  Download,
  LogIn,
  Wallet,
} from 'lucide-react';
import type { EmployeeDashboardView } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  portalDownload,
} from '@hrm/portal-ui';
import { formatAttendanceMinutes } from '@/lib/ess-api';
import { useState } from 'react';

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
  actionLoading: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
  onBreakStart: () => void;
  onBreakEnd: () => void;
}

export function EmployeeDashboardHome({
  dashboard,
  actionLoading,
  onClockIn,
  onClockOut,
  onBreakStart,
  onBreakEnd,
}: EmployeeDashboardHomeProps) {
  const { t } = useAppTranslation();
  const emDash = t('common.emDash');
  const { attendance, todayShift, leaveBalances, upcomingLeave, latestPayslip, notifications, unreadNotificationCount } =
    dashboard;
  const phase = attendance.metrics.phase;
  const [payslipDownloading, setPayslipDownloading] = useState(false);

  const attendanceStatusLabel = t(`attendance.statusValue.${attendance.status}`, {
    defaultValue: attendance.status.replace('_', ' '),
  });

  const handlePayslipDownload = async () => {
    if (!latestPayslip?.downloadUrl) return;
    setPayslipDownloading(true);
    try {
      await portalDownload('employee', latestPayslip.downloadUrl, 'payslip.pdf');
    } finally {
      setPayslipDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> {t('dashboard.todayShift')}
            </CardTitle>
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-4 w-4" /> {t('dashboard.clockInOut')}
            </CardTitle>
          </CardHeader>
          <CardBody className="text-sm space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-muted text-xs">{t('dashboard.clockIn')}</div>
                <div>{displayClock(attendance, 'clockInAt', emDash)}</div>
              </div>
              <div>
                <div className="text-muted text-xs">{t('dashboard.clockOut')}</div>
                <div>{displayClock(attendance, 'clockOutAt', emDash)}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={actionLoading || phase !== 'not_started'}
                onClick={onClockIn}
              >
                {t('dashboard.clockInAction')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={actionLoading || phase === 'not_started' || phase === 'completed'}
                onClick={onClockOut}
              >
                {t('dashboard.clockOutAction')}
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.workingHours')}</CardTitle>
          </CardHeader>
          <CardBody className="text-sm space-y-1">
            <div className="text-2xl font-bold text-primary">
              {formatAttendanceMinutes(attendance.metrics.netMinutes)}
            </div>
            <div className="text-muted capitalize">
              {t('dashboard.status', { status: attendanceStatusLabel })}
            </div>
            <div className="text-secondary">
              {t('dashboard.gross', {
                minutes: formatAttendanceMinutes(attendance.metrics.grossMinutes),
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
              <div className="font-medium">
                {formatAttendanceMinutes(attendance.metrics.breakMinutes)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={actionLoading || phase !== 'working'}
                onClick={onBreakStart}
              >
                {t('dashboard.startBreak')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={actionLoading || phase !== 'on_break'}
                onClick={onBreakEnd}
              >
                {t('dashboard.endBreak')}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> {t('dashboard.leaveBalance')}
            </CardTitle>
          </CardHeader>
          <CardBody className="grid sm:grid-cols-2 gap-3">
            {leaveBalances.length === 0 ? (
              <p className="text-sm text-muted">{t('dashboard.noLeaveBalances')}</p>
            ) : (
              leaveBalances.map((bal) => (
                <div
                  key={bal.id}
                  className="rounded-lg border border-[rgb(var(--border-base))] px-3 py-2"
                >
                  <div className="text-sm font-medium">
                    {bal.leaveTypeName ?? t('dashboard.leaveFallback')}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {t('common.daysRemainingShort', {
                      balance: bal.balanceDays.toFixed(1),
                    })}
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.upcomingLeave')}</CardTitle>
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            {upcomingLeave.length === 0 ? (
              <p className="text-sm text-muted">{t('dashboard.noUpcomingLeave')}</p>
            ) : (
              upcomingLeave.map((req) => (
                <div key={req.id} className="py-2 flex justify-between gap-3 text-sm">
                  <div>
                    <div className="font-medium">
                      {req.leaveTypeName ?? t('dashboard.leaveFallback')}
                    </div>
                    <div className="text-muted">
                      {t('common.dateRange', { start: req.startDate, end: req.endDate })}
                    </div>
                  </div>
                  <Badge
                    tone={
                      req.status === 'approved'
                        ? 'success'
                        : req.status === 'rejected'
                          ? 'error'
                          : 'warning'
                    }
                    className="capitalize shrink-0"
                  >
                    {t(`leave.status.${req.status}`, { defaultValue: req.status })}
                  </Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4" /> {t('dashboard.latestPayslip')}
            </CardTitle>
          </CardHeader>
          <CardBody className="text-sm">
            {latestPayslip ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-primary">
                    {t('dashboard.generated', {
                      date: new Date(latestPayslip.generatedAt).toLocaleDateString(),
                    })}
                  </div>
                  <div className="text-muted text-xs mt-1">
                    {t('dashboard.payrollRun', {
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
                    <Download className="h-4 w-4" />{' '}
                    {payslipDownloading ? t('common.downloading') : t('common.download')}
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-muted">{t('dashboard.noPayslips')}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" /> {t('dashboard.notifications')}
            </CardTitle>
            {unreadNotificationCount > 0 ? (
              <Badge tone="warning">
                {t('dashboard.unread', { count: unreadNotificationCount })}
              </Badge>
            ) : null}
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted">{t('dashboard.allCaughtUp')}</p>
            ) : (
              notifications.map((note) => (
                <div key={note.id} className="py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-primary">{note.title}</div>
                    {!note.readAt ? <Badge tone="accent">{t('common.new')}</Badge> : null}
                  </div>
                  <div className="text-secondary mt-0.5">{note.body}</div>
                  <div className="text-[11px] text-muted mt-1">
                    {new Date(note.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
