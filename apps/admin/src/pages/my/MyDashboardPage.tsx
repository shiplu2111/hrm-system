import { useCallback, useEffect, useState } from 'react';
import type {
  EmployeeDashboardView,
  InAppNotificationRecord,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { EmployeeDashboardHome } from '@/components/my/EmployeeDashboardHome';
import { MyPageLayout } from '@/components/my/MyPageLayout';
import { useMyEmployee } from '@/components/my/useMyEmployee';
import { Card, CardBody } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { getMyDashboard, runAttendanceAction, type AttendanceAction } from '@/lib/my-api';
import { markNotificationRead } from '@/lib/notifications-api';
import { ApiError } from '@/lib/tenant-api-client';

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardBody className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-9 w-full" />
            </CardBody>
          </Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardBody className="space-y-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function MyDashboardPage() {
  const { t } = useAppTranslation();
  const { employeeId, profile, companyId, loading: profileLoading, error: profileError } = useMyEmployee();
  const [dashboard, setDashboard] = useState<EmployeeDashboardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDashboard(await getMyDashboard(employeeId));
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
      const attendance = await runAttendanceAction(employeeId, action);
      setDashboard((current) =>
        current
          ? { ...current, asOf: new Date().toISOString(), attendance }
          : current,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.attendanceAction'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleNotificationOpen = async (note: InAppNotificationRecord) => {
    if (note.readAt) return;
    await markNotificationRead(note.id);
    const readAt = new Date().toISOString();
    setDashboard((current) =>
      current
        ? {
            ...current,
            unreadNotificationCount: Math.max(0, current.unreadNotificationCount - 1),
            notifications: current.notifications.map((item) =>
              item.id === note.id ? { ...item, readAt } : item,
            ),
          }
        : current,
    );
  };

  const greetingName = profile ? `${profile.firstName} ${profile.lastName}` : t('portal.employeeFallback');
  const shownError = profileError ?? error;

  return (
    <MyPageLayout
      title={greetingName}
      subtitle={t('nav.mySpace')}
      loading={loading || profileLoading}
      loadingFallback={<DashboardSkeleton />}
      error={shownError}
      onRetry={() => void load()}
    >
      {dashboard && employeeId ? (
        <EmployeeDashboardHome
          dashboard={dashboard}
          employeeId={employeeId}
          companyId={companyId ?? ''}
          actionLoading={actionLoading}
          onClockIn={() => runAction('clock-in')}
          onClockOut={() => runAction('clock-out')}
          onBreakStart={() => runAction('break-start')}
          onBreakEnd={() => runAction('break-end')}
          onSurveySubmitted={() => void load()}
          onNotificationOpen={handleNotificationOpen}
        />
      ) : !shownError ? (
        <p className="text-sm text-muted">{t('dashboard.unavailable')}</p>
      ) : null}
    </MyPageLayout>
  );
}
