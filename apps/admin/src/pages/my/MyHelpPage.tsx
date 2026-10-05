import { useAppTranslation } from '@hrm/i18n';
import { HelpSupportView } from '@/components/my/HelpSupportView';
import { MyPageLayout } from '@/components/my/MyPageLayout';

export function MyHelpPage() {
  const { t } = useAppTranslation();

  return (
    <MyPageLayout title={t('support.helpSupport')} subtitle={t('support.helpSupportSubtitle')}>
      <HelpSupportView />
    </MyPageLayout>
  );
}
