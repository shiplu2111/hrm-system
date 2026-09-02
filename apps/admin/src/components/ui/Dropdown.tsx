import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  width?: string;
}

export function Dropdown({ trigger, children, align = 'right', width = 'w-64' }: DropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <button onClick={() => setOpen((o) => !o)} className="block">
        {trigger}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className={`absolute z-40 mt-2 ${width} surface rounded-xl border shadow-elevated py-1.5 animate-scale-in origin-top ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            <div onClick={() => setOpen(false)}>{children}</div>
          </div>
        </>
      )}
    </div>
  );
}

export function DropdownItem({
  children,
  icon,
  onClick,
  active,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left rounded-lg transition-colors ${
        active ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300' : 'text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'
      }`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="flex-1">{children}</span>
    </button>
  );
}

export function DropdownSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-1.5">
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      {children}
    </div>
  );
}

export function DropdownDivider() {
  return <div className="my-1.5 border-t border-base" />;
}

export function DropdownHeader({ children }: { children: ReactNode }) {
  return <div className="px-3 py-2">{children}</div>;
}

export { ChevronDown };
