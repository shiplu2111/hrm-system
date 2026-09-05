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

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  const { attendance, todayShift, leaveBalances, upcomingLeave, latestPayslip, notifications, unreadNotificationCount } =
    dashboard;
  const phase = attendance.metrics.phase;
  const [payslipDownloading, setPayslipDownloading] = useState(false);

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
              <Clock className="h-4 w-4" /> Today&apos;s shift
            </CardTitle>
          </CardHeader>
          <CardBody className="text-sm space-y-1">
            {todayShift?.shift ? (
              <>
                <div className="font-medium text-primary">{todayShift.shift.name}</div>
                <div className="text-secondary">
                  {todayShift.shift.startTime} – {todayShift.shift.endTime}
                </div>
                {todayShift.location?.name ? (
                  <div className="text-muted">{todayShift.location.name}</div>
                ) : null}
              </>
            ) : attendance.shift ? (
              <>
                <div className="font-medium text-primary">{attendance.shift.name}</div>
                <div className="text-secondary">
                  {attendance.shift.startTime} – {attendance.shift.endTime}
                </div>
              </>
            ) : (
              <p className="text-muted">No shift assigned for today.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-4 w-4" /> Clock in / out
            </CardTitle>
          </CardHeader>
          <CardBody className="text-sm space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-muted text-xs">Clock in</div>
                <div>{formatTime(attendance.clockInAt)}</div>
              </div>
              <div>
                <div className="text-muted text-xs">Clock out</div>
                <div>{formatTime(attendance.clockOutAt)}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={actionLoading || phase !== 'not_started'}
                onClick={onClockIn}
              >
                Clock In
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={actionLoading || phase === 'not_started' || phase === 'completed'}
                onClick={onClockOut}
              >
                Clock Out
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Working hours</CardTitle>
          </CardHeader>
          <CardBody className="text-sm space-y-1">
            <div className="text-2xl font-bold text-primary">
              {formatAttendanceMinutes(attendance.metrics.netMinutes)}
            </div>
            <div className="text-muted capitalize">Status: {attendance.status.replace('_', ' ')}</div>
            <div className="text-secondary">
              Gross {formatAttendanceMinutes(attendance.metrics.grossMinutes)}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coffee className="h-4 w-4" /> Break
            </CardTitle>
          </CardHeader>
          <CardBody className="text-sm space-y-3">
            <div>
              <div className="text-muted text-xs">Break time</div>
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
                Start Break
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={actionLoading || phase !== 'on_break'}
                onClick={onBreakEnd}
              >
                End Break
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> Leave balance
            </CardTitle>
          </CardHeader>
          <CardBody className="grid sm:grid-cols-2 gap-3">
            {leaveBalances.length === 0 ? (
              <p className="text-sm text-muted">No leave balances configured.</p>
            ) : (
              leaveBalances.map((bal) => (
                <div
                  key={bal.id}
                  className="rounded-lg border border-[rgb(var(--border-base))] px-3 py-2"
                >
                  <div className="text-sm font-medium">{bal.leaveTypeName ?? 'Leave'}</div>
                  <div className="text-xs text-muted mt-1">
                    {bal.balanceDays.toFixed(1)} days remaining
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming leave</CardTitle>
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            {upcomingLeave.length === 0 ? (
              <p className="text-sm text-muted">No upcoming leave scheduled.</p>
            ) : (
              upcomingLeave.map((req) => (
                <div key={req.id} className="py-2 flex justify-between gap-3 text-sm">
                  <div>
                    <div className="font-medium">{req.leaveTypeName ?? 'Leave'}</div>
                    <div className="text-muted">
                      {req.startDate} → {req.endDate}
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
                    {req.status}
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
              <Wallet className="h-4 w-4" /> Latest payslip
            </CardTitle>
          </CardHeader>
          <CardBody className="text-sm">
            {latestPayslip ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-primary">
                    Generated {new Date(latestPayslip.generatedAt).toLocaleDateString()}
                  </div>
                  <div className="text-muted text-xs mt-1">
                    Payroll run {latestPayslip.payrollRunId.slice(0, 8)}…
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
                    {payslipDownloading ? 'Downloading…' : 'Download'}
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-muted">No payslips available yet.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" /> Notifications
            </CardTitle>
            {unreadNotificationCount > 0 ? (
              <Badge tone="warning">{unreadNotificationCount} unread</Badge>
            ) : null}
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted">You&apos;re all caught up.</p>
            ) : (
              notifications.map((note) => (
                <div key={note.id} className="py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-primary">{note.title}</div>
                    {!note.readAt ? <Badge tone="accent">New</Badge> : null}
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
