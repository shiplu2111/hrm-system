import { useCallback, useEffect, useState } from 'react';
import { Coffee, LogIn, LogOut } from 'lucide-react';
import type { AttendanceDayRecord } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { useAuth } from '@hrm/portal-ui';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { MyPageLayout } from '@/components/my/MyPageLayout';
import {
  formatAttendanceMinutes,
  getAttendanceToday,
  runAttendanceAction,
  type AttendanceAction,
} from '@/lib/my-api';
import { CheckoutConfirmationModal } from '@/components/attendance/CheckoutConfirmationModal';
import { ApiError } from '@/lib/tenant-api-client';

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

export function MyAttendancePage() {
  const { t } = useAppTranslation();
  const emDash = t('common.emDash');
  const { user } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const [attendance, setAttendance] = useState<AttendanceDayRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!employeeId) {
      setError(t('errors.notLinked'));
      setLoading(false);
      return;
    }
    try {
      setAttendance(await getAttendanceToday(employeeId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.loadEmployeeData'));
    } finally {
      setLoading(false);
    }
  }, [employeeId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (action: AttendanceAction) => {
    if (!employeeId) return;
    setActionLoading(true);
    setError(null);
    try {
      setAttendance(await runAttendanceAction(employeeId, action));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.attendanceAction'));
    } finally {
      setActionLoading(false);
    }
  };

  const phase = attendance?.metrics.phase;
  const statusLabel = attendance?.status
    ? t(`attendance.statusValue.${attendance.status}`, { defaultValue: attendance.status.replace('_', ' ') })
    : emDash;

  return (
    <MyPageLayout title={t('nav.attendance')} loading={loading} error={error}>
      {employeeId ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.clockInOut')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                {t('attendance.status')}{' '}
                <Badge tone="accent" className="capitalize">
                  {statusLabel}
                </Badge>
              </div>
              <div>
                {t('attendance.in')} {displayClock(attendance, 'clockInAt', emDash)}
              </div>
              <div>
                {t('attendance.out')} {displayClock(attendance, 'clockOutAt', emDash)}
              </div>
              <div>
                {t('attendance.worked')}{' '}
                {attendance ? formatAttendanceMinutes(attendance.metrics.netMinutes) : emDash}
              </div>
              <div>
                {t('attendance.break')}{' '}
                {attendance ? formatAttendanceMinutes(attendance.metrics.breakMinutes) : emDash}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={actionLoading || (phase !== undefined && phase !== 'not_started')}
                onClick={() => void runAction('clock-in')}
              >
                <LogIn className="h-4 w-4" /> {t('dashboard.clockInAction')}
              </Button>
              <Button
                variant="secondary"
                disabled={actionLoading || phase === 'not_started' || phase === 'completed'}
                onClick={() => setCheckoutModalOpen(true)}
              >
                <LogOut className="h-4 w-4" /> {t('dashboard.clockOutAction')}
              </Button>
              <Button
                variant="secondary"
                disabled={actionLoading || phase !== 'working'}
                onClick={() => void runAction('break-start')}
              >
                <Coffee className="h-4 w-4" /> {t('dashboard.breakStart')}
              </Button>
              <Button
                variant="secondary"
                disabled={actionLoading || phase !== 'on_break'}
                onClick={() => void runAction('break-end')}
              >
                <Coffee className="h-4 w-4" /> {t('dashboard.breakEnd')}
              </Button>
            </div>
          </CardBody>
        </Card>
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
