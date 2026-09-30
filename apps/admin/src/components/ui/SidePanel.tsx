import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}

const sizeClasses = {
  md: 'max-w-md',
  lg: 'max-w-xl',
};

export function SidePanel({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  size = 'md',
}: SidePanelProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative surface border-l border-base shadow-elevated w-full ${sizeClasses[size]} h-full flex flex-col animate-slide-in-right`}
      >
        <div className="px-6 py-4 border-b border-base flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {icon ? <div className="shrink-0">{icon}</div> : null}
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold text-primary">{title}</h2>}
              {description && <p className="text-sm text-secondary mt-0.5">{description}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="text-muted hover:text-primary rounded-lg p-1 hover:bg-[rgb(var(--bg-hover))] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto scrollbar-thin px-6 py-5 flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-base flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
}
