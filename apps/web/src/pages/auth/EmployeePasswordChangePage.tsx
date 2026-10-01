import { useMemo } from 'react';
import { useAppTranslation } from '@hrm/i18n';
import {
  ApiError,
  ForcedPasswordChangePage,
  type ForcedPasswordChangeCopy,
} from '@hrm/portal-ui';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';

export function EmployeePasswordChangePage({
  email,
  onSubmit,
  onSignOut,
}: {
  email: string;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
  onSignOut: () => void;
}) {
  const { t } = useAppTranslation();

  const copy = useMemo<ForcedPasswordChangeCopy>(
    () => ({
      title: t('auth.changePassword.title'),
      subtitle: (value) => t('auth.changePassword.subtitle', { email: value }),
      currentPassword: t('auth.changePassword.current'),
      currentPasswordHint: t('auth.changePassword.currentHint'),
      newPassword: t('auth.changePassword.new'),
      confirmPassword: t('auth.changePassword.confirm'),
      rules: {
        length: t('auth.changePassword.rules.length'),
        lowercase: t('auth.changePassword.rules.lowercase'),
        uppercase: t('auth.changePassword.rules.uppercase'),
        number: t('auth.changePassword.rules.number'),
        special: t('auth.changePassword.rules.special'),
        differs: t('auth.changePassword.rules.differs'),
        matches: t('auth.changePassword.rules.matches'),
      },
      submit: t('auth.changePassword.submit'),
      submitting: t('auth.changePassword.submitting'),
      signOut: t('common.signOut'),
      showPasswords: t('auth.changePassword.show'),
      errorMessage: (error) => {
        if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
          return t('auth.changePassword.currentIncorrect');
        }
        return t('auth.changePassword.failed');
      },
    }),
    [t],
  );

  return (
    <ForcedPasswordChangePage
      email={email}
      onSubmit={onSubmit}
      onSignOut={onSignOut}
      copy={copy}
      headerStart={<LanguageSwitcher />}
    />
  );
}
