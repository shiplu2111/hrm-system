import { useEffect, useState } from 'react';
import { Download, Wallet } from 'lucide-react';
import type { PayslipRecord } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { useAuth } from '@hrm/portal-ui';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MyPageLayout } from '@/components/my/MyPageLayout';
import { downloadMyPayslip, listMyPayslips } from '@/lib/my-api';
import { ApiError } from '@/lib/tenant-api-client';

export function MyPayslipsPage() {
  const { t } = useAppTranslation();
  const { user } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const [payslips, setPayslips] = useState<PayslipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) {
      setError(t('errors.notLinked'));
      setLoading(false);
      return;
    }
    let cancelled = false;
    listMyPayslips(employeeId)
      .then((rows) => {
        if (!cancelled) setPayslips(rows);
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
  }, [employeeId, t]);

  const download = async (payslip: PayslipRecord) => {
    if (!payslip.downloadUrl) return;
    setDownloadingId(payslip.id);
    setError(null);
    try {
      await downloadMyPayslip(payslip.downloadUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.unknownError'));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <MyPageLayout title={t('payslips.title')} subtitle={t('payslips.subtitle')} loading={loading} error={error}>
      {employeeId ? (
        <Card>
          {payslips.length === 0 ? (
            <EmptyState icon={Wallet} title={t('payslips.empty')} compact />
          ) : (
            <CardBody className="divide-y divide-[rgb(var(--border-base))] py-1">
              {payslips.map((payslip) => (
                <div key={payslip.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <div className="font-medium text-primary">
                      {t('payslips.generated', { date: new Date(payslip.generatedAt).toLocaleDateString() })}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {t('payslips.run', { id: payslip.payrollRunId.slice(0, 8) })}
                    </div>
                  </div>
                  {payslip.downloadUrl ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={downloadingId === payslip.id}
                      onClick={() => void download(payslip)}
                    >
                      <Download className="h-4 w-4" />
                      {downloadingId === payslip.id ? t('common.downloading') : t('common.download')}
                    </Button>
                  ) : null}
                </div>
              ))}
            </CardBody>
          )}
        </Card>
      ) : null}
    </MyPageLayout>
  );
}
