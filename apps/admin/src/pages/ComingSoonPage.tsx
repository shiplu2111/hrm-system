import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useNav } from '@/context/NavContext';

interface ComingSoonPageProps {
  title: string;
}

export function ComingSoonPage({ title }: ComingSoonPageProps) {
  const { navigate } = useNav();

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center min-h-[60vh]">
      <div className="h-16 w-16 rounded-2xl bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center mb-4">
        <Sparkles className="h-8 w-8 text-accent-600 dark:text-accent-400" />
      </div>
      <h2 className="text-lg font-semibold text-primary">{title}</h2>
      <p className="text-sm text-secondary mt-1 max-w-sm">Coming soon</p>
      <p className="text-xs text-muted mt-2 max-w-md">
        This module will be available in a future release. Use the sidebar to explore other areas
        you have access to.
      </p>
      <Button variant="primary" className="mt-6" onClick={() => navigate('dashboard')}>
        Back to Dashboard
      </Button>
    </div>
  );
}
