import { useAppTranslation } from '@hrm/i18n';
import { EssLeaveView } from '@/components/my/leave/EssLeaveView';
import { MyPageLayout } from '@/components/my/MyPageLayout';
import { useMyEmployee } from '@/components/my/useMyEmployee';

export function MyLeavePage() {
  const { t } = useAppTranslation();
  const { employeeId, companyId, loading, error } = useMyEmployee();

  return (
    <MyPageLayout title={t('nav.leave')} loading={loading} error={error}>
      {employeeId && companyId ? <EssLeaveView employeeId={employeeId} companyId={companyId} /> : null}
    </MyPageLayout>
  );
}
