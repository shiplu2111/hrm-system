import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
interface MyPageLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  loading?: boolean;
  error?: string | null;
  children?: ReactNode;
}

export function MyPageLayout({ title, subtitle, actions, loading, error, children }: MyPageLayoutProps) {
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
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-900/30 dark:text-error-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}
