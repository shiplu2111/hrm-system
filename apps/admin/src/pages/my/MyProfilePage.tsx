import { useAppTranslation } from '@hrm/i18n';
import { useAuth } from '@hrm/portal-ui';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { MyPageLayout } from '@/components/my/MyPageLayout';
import { useMyEmployee } from '@/components/my/useMyEmployee';

export function MyProfilePage() {
  const { t } = useAppTranslation();
  const { user } = useAuth();
  const { profile, loading, error } = useMyEmployee();
  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : user?.email ?? '';
  const initials = profile ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase() : '?';

  return (
    <MyPageLayout title={t('nav.profile')} loading={loading} error={error}>
      {profile ? (
        <Card>
          <CardBody className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-100 text-lg font-semibold text-accent-700 dark:bg-accent-950/50 dark:text-accent-300">
              {initials}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold text-primary">{displayName}</span>
                {user?.roleName ? <Badge tone="neutral">{user.roleName}</Badge> : null}
              </div>
              <div className="text-muted">{profile.employeeNumber}</div>
              <div>
                {t('profile.status')} <span className="capitalize">{profile.employmentStatus}</span>
              </div>
              <div>
                {t('profile.hireDate')} {profile.hireDate}
              </div>
              {profile.personalInfo?.contact?.email ? (
                <div>
                  {t('profile.email')} {profile.personalInfo.contact.email}
                </div>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : null}
    </MyPageLayout>
  );
}
