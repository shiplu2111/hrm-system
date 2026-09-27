import { Check } from 'lucide-react';

export interface StepProgressItem {
  key: string;
  label: string;
}

interface StepProgressProps {
  steps: StepProgressItem[];
  currentIndex: number;
}

export function StepProgress({ steps, currentIndex }: StepProgressProps) {
  return (
    <nav aria-label="Form progress" className="w-full">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.key}
              className={`flex items-center ${isLast ? 'shrink-0' : 'flex-1 min-w-0'}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div className="flex flex-col items-center gap-1.5 min-w-[4.5rem]">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold border-2 transition-colors ${
                    isComplete
                      ? 'bg-accent-600 border-accent-600 text-white'
                      : isCurrent
                        ? 'border-accent-600 text-accent-600 bg-[rgb(var(--bg-surface))]'
                        : 'border-base text-muted bg-[rgb(var(--bg-muted))]'
                  }`}
                >
                  {isComplete ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
                </span>
                <span
                  className={`text-xs font-medium text-center leading-tight ${
                    isCurrent ? 'text-accent-600' : isComplete ? 'text-primary' : 'text-muted'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {!isLast ? (
                <div
                  className={`h-0.5 flex-1 mx-2 mb-5 rounded-full transition-colors ${
                    isComplete ? 'bg-accent-600' : 'bg-[rgb(var(--border-base))]'
                  }`}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
