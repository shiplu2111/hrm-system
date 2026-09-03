import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCompany } from '@/context/CompanyContext';

export function OrgPageState({
  children,
}: {
  children: (companyId: string) => React.ReactNode;
}) {
  const { companyId, loading, error, refresh } = useCompany();

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-secondary">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading organization data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-error-500 mx-auto" />
        <p className="text-sm text-secondary">{error}</p>
        <Button variant="secondary" onClick={() => void refresh()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">
        No company found for this tenant.
      </div>
    );
  }

  return <>{children(companyId)}</>;
}
