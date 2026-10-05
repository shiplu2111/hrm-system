import { useCallback, useEffect, useState } from 'react';
import type { EmployeeDashboardView } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { EmployeeDashboardHome } from '@/components/my/EmployeeDashboardHome';
import { MyPageLayout } from '@/components/my/MyPageLayout';
import { useMyEmployee } from '@/components/my/useMyEmployee';
import { getMyDashboard, runAttendanceAction, type AttendanceAction } from '@/lib/my-api';
import { ApiError } from '@/lib/tenant-api-client';

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
      setDashboard((current) => (current ? { ...current, attendance } : current));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.attendanceAction'));
    } finally {
      setActionLoading(false);
    }
  };

  const greetingName = profile ? `${profile.firstName} ${profile.lastName}` : t('portal.employeeFallback');
  const shownError = profileError ?? error;

  return (
    <MyPageLayout
      title={greetingName}
      subtitle={t('nav.mySpace')}
      loading={loading || profileLoading}
      error={shownError}
    >
      {dashboard && employeeId ? (
        <EmployeeDashboardHome
          dashboard={dashboard}
          employeeId={employeeId}
          companyId={companyId ?? ''}
          actionLoading={actionLoading}
          onClockIn={() => void runAction('clock-in')}
          onClockOut={() => void runAction('clock-out')}
          onBreakStart={() => void runAction('break-start')}
          onBreakEnd={() => void runAction('break-end')}
          onSurveySubmitted={() => void load()}
        />
      ) : !shownError ? (
        <p className="text-sm text-muted">{t('dashboard.unavailable')}</p>
      ) : null}
    </MyPageLayout>
  );
}
