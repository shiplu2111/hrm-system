import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Primary call-to-action (rendered as primary button). */
  action?: EmptyStateAction;
  /** Optional secondary action. */
  secondaryAction?: EmptyStateAction;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-10 px-6' : 'py-16 px-6 min-h-[320px]'
      } ${className}`}
    >
      <div
        className={`rounded-2xl bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center mb-4 ${
          compact ? 'h-12 w-12' : 'h-16 w-16'
        }`}
      >
        <Icon
          className={`text-accent-600 dark:text-accent-400 ${
            compact ? 'h-6 w-6' : 'h-8 w-8'
          }`}
        />
      </div>
      <h2 className={`font-semibold text-primary ${compact ? 'text-base' : 'text-lg'}`}>
        {title}
      </h2>
      {description ? (
        <p
          className={`text-secondary mt-1 max-w-md ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          {description}
        </p>
      ) : null}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-2 mt-6">
          {action ? (
            <Button variant={action.variant ?? 'primary'} onClick={action.onClick}>
              {action.icon ? <action.icon className="h-4 w-4" /> : null}
              {action.label}
            </Button>
          ) : null}
          {secondaryAction ? (
            <Button
              variant={secondaryAction.variant ?? 'secondary'}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.icon ? <secondaryAction.icon className="h-4 w-4" /> : null}
              {secondaryAction.label}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
