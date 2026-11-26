'use client';

import { ArrowLeft, RotateCcw } from 'lucide-react';
import { ErrorState } from '../../components/layout/ErrorState';
import { Button, ButtonLink } from '../../components/marketing';
import { useWebsiteI18n } from '../../i18n/client';

export default function RouteErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useWebsiteI18n();

  return (
    <ErrorState
      badge={t('errors.serverError.badge')}
      tone="error"
      title={t('errors.serverError.title')}
      description={t('errors.serverError.description')}
      actions={
        <>
          <Button
            variant="primary"
            size="md"
            onClick={() => reset()}
            leadingIcon={<RotateCcw className="w-4 h-4" aria-hidden="true" />}
          >
            {t('errors.serverError.retryCta')}
          </Button>
          <ButtonLink
            href="/"
            variant="outline"
            size="md"
            leadingIcon={<ArrowLeft className="w-4 h-4" aria-hidden="true" />}
          >
            {t('errors.serverError.homeCta')}
          </ButtonLink>
        </>
      }
    />
  );
}
