import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function PageLoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="p-8 flex items-center justify-center gap-2 text-secondary">
      <Loader2 className="h-5 w-5 animate-spin" />
      {message}
    </div>
  );
}

export function PageErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <div className="p-8 max-w-lg mx-auto text-center space-y-3">
      <AlertCircle className="h-8 w-8 text-error-500 mx-auto" />
      <p className="text-sm text-secondary">{error}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
