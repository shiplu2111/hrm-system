import { useEffect, useState } from 'react';
import type { RosterRecord } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { MyPageLayout } from '@/components/my/MyPageLayout';
import { useMyEmployee } from '@/components/my/useMyEmployee';
import { listMyRosters } from '@/lib/my-api';
import { ApiError } from '@/lib/tenant-api-client';

const ROSTER_DAYS = 14;

function shiftRange(record: RosterRecord, emDash: string): string {
  if (record.display) return `${record.display.shiftStartTime} – ${record.display.shiftEndTime}`;
  if (record.shift) return `${record.shift.startTime} – ${record.shift.endTime}`;
  return emDash;
}

export function MyRosterPage() {
  const { t } = useAppTranslation();
  const emDash = t('common.emDash');
  const { employeeId, companyId, loading: profileLoading, error: profileError } = useMyEmployee();
  const [rosters, setRosters] = useState<RosterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId || !companyId) {
      if (!profileLoading) setLoading(false);
      return;
    }
    const from = new Date().toISOString().slice(0, 10);
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + ROSTER_DAYS);
    const to = toDate.toISOString().slice(0, 10);
    let cancelled = false;
    listMyRosters(companyId, employeeId, { from, to })
      .then((rows) => {
        if (!cancelled) setRosters(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t('errors.loadEmployeeData'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, companyId, profileLoading, t]);

  return (
    <MyPageLayout
      title={t('nav.roster')}
      loading={profileLoading || loading}
      error={profileError ?? error}
    >
      {employeeId && companyId ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('roster.title')}</CardTitle>
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            {rosters.length === 0 ? (
              <p className="text-sm text-muted">{t('roster.empty')}</p>
            ) : (
              rosters.map((r) => (
                <div key={r.id} className="flex justify-between py-3 text-sm">
                  <span className="font-medium">{r.date}</span>
                  <span className="text-secondary">
                    {r.shift?.name ?? t('attendance.shiftFallback')} ({shiftRange(r, emDash)})
                  </span>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      ) : null}
    </MyPageLayout>
  );
}
