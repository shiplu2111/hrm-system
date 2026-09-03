import type { ReactNode } from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: 'sm' | 'md';
}

export function Toggle({ checked, onChange, size = 'md' }: ToggleProps) {
  const dims = size === 'sm' ? { w: 'w-8', h: 'h-4', knob: 'h-3 w-3', translate: 'translate-x-4' } : { w: 'w-9', h: 'h-5', knob: 'h-4 w-4', translate: 'translate-x-4' };
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex ${dims.h} ${dims.w} shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-accent-600' : 'bg-slate-300 dark:bg-slate-600'
      }`}
    >
      <span
        className={`pointer-events-none inline-block ${dims.knob} transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ${
          checked ? dims.translate : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export function Checkbox({
  checked,
  onChange,
  indeterminate = false,
  className = '',
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  indeterminate?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={() => onChange?.(!checked)}
      className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
        checked || indeterminate
          ? 'bg-accent-600 border-accent-600'
          : 'border-strong hover:border-accent-500 bg-transparent'
      } ${className}`}
    >
      {indeterminate ? <span className="h-0.5 w-2 bg-white rounded-full" /> : checked ? (
        <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" fill="none">
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </button>
  );
}

export function Avatar({ name, src, size = 'md', className = '' }: { name: string; src?: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-11 w-11 text-base' };
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  if (src) {
    return <img src={src} alt={name} className={`${sizes[size]} rounded-full object-cover ${className}`} />;
  }

  const colors = ['bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300'];
  return (
    <div className={`${sizes[size]} ${colors[0]} rounded-full flex items-center justify-center font-semibold shrink-0 ${className}`}>
      {initials}
    </div>
  );
}

export function Tooltip({ children, label }: { children: ReactNode; label: string }) {
  return (
    <span className="relative group">
      {children}
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs rounded-md bg-slate-900 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity dark:bg-slate-700 z-50">
        {label}
      </span>
    </span>
  );
}
