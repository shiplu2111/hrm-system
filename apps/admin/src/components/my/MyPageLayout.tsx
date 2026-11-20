import type { ReactNode } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useAppTranslation } from '@hrm/i18n';
import { Button } from '@/components/ui/Button';

interface MyPageLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  loading?: boolean;
  loadingFallback?: ReactNode;
  error?: string | null;
  onRetry?: () => void;
  children?: ReactNode;
}

export function MyPageLayout({
  title,
  subtitle,
  actions,
  loading,
  loadingFallback,
  error,
  onRetry,
  children,
}: MyPageLayoutProps) {
  const { t } = useAppTranslation();

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 lg:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-primary">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-secondary">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </header>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-900/30 dark:text-error-300">
          <span>{error}</span>
          {onRetry ? (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5" />
              {t('common.retry')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        loadingFallback ?? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted" />
          </div>
        )
      ) : (
        children
      )}
    </div>
  );
}
