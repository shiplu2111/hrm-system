'use client';

import '../styles/globals.css';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { createTranslator, DEFAULT_LOCALE, getDictionary } from '../i18n';
import { ErrorState } from '../components/layout/ErrorState';
import { Button, ButtonLink } from '../components/marketing';

export default function GlobalErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const dict = getDictionary(DEFAULT_LOCALE);
  const t = createTranslator(dict);

  return (
    <html lang={DEFAULT_LOCALE}>
      <body className="min-h-screen flex flex-col justify-center font-sans antialiased bg-[rgb(var(--bg-base))] text-[rgb(var(--text-secondary))]">
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
      </body>
    </html>
  );
}
