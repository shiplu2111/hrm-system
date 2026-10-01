import { ArrowRight, FlaskConical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { simulationCopy } from '@/lib/payroll-simulation-copy';

const copy = simulationCopy.banner;

/** Stays pinned while scrolling so a projection is never read without this context. */
export function SimulationBanner() {
  const navigate = useNavigate();
  return (
    <div
      role="note"
      aria-label={copy.label}
      className="sticky top-0 z-20 rounded-xl border-2 border-dashed border-warning-400 dark:border-warning-600 bg-warning-50 dark:bg-warning-950/40 simulation-hatch shadow-card"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-600 text-white">
            <FlaskConical className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-warning-700 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-white">
                {copy.label}
              </span>
              <span className="text-sm font-semibold text-warning-900 dark:text-warning-100">{copy.title}</span>
            </div>
            <p className="text-xs text-warning-800 dark:text-warning-200 mt-0.5">{copy.body}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/payroll/runs')} className="shrink-0">
          {copy.goToRuns} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
