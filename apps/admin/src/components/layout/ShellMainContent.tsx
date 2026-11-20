import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { Loader2, ShieldOff } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCompany } from '@/context/CompanyContext';
import { useNav } from '@/context/NavContext';
import { useTenant } from '@/context/TenantContext';
import { usePageAccess } from '@/hooks/usePageAccess';

interface ShellMainContentProps {
  children: ReactNode;
  fallbackFooterLabel: string;
  homeActionLabel: string;
  className?: string;
}

/**
 * Shared guarded workspace container used by both Admin and Employee shells.
 */
export function ShellMainContent({
  children,
  fallbackFooterLabel,
  homeActionLabel,
  className = '',
}: ShellMainContentProps) {
  const { current: currentTenant, switching, tenantKey } = useTenant();
  const { company } = useCompany();
  const { current, navigate } = useNav();
  const { canView, homePage } = usePageAccess();

  const pageAllowed = canView(current);
  const footerLabel =
    currentTenant?.tenantName ?? company?.name ?? fallbackFooterLabel;

  return (
    <main className={`flex-1 overflow-y-auto scrollbar-thin ${className}`}>
      {switching ? (
        <div
          className="p-8 flex items-center justify-center gap-2 text-secondary"
          role="status"
        >
          <Loader2 className="h-5 w-5 animate-spin" />
          Switching organization…
        </div>
      ) : pageAllowed ? (
        // Remount every page per organization session so no screen keeps the previous tenant's state.
        <Fragment key={tenantKey}>{children}</Fragment>
      ) : current === 'dashboard' && canView(homePage) ? null : (
        <EmptyState
          icon={ShieldOff}
          title="You don't have access to this page"
          description="Your role doesn't include the permission this screen needs. Ask a Company Owner if you think this is a mistake."
          action={
            current !== homePage && canView(homePage)
              ? {
                  label: homeActionLabel,
                  onClick: () => navigate(homePage),
                }
              : undefined
          }
        />
      )}
      <footer className="px-6 py-4 text-center text-[10px] text-muted border-t border-base">
        {footerLabel} · Powered by{' '}
        <span className="font-semibold text-accent-600">CMSN-HR</span>
      </footer>
    </main>
  );
}

