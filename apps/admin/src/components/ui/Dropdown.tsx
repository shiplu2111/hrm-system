import {
  cloneElement,
  isValidElement,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { ChevronDown } from 'lucide-react';

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  width?: string;
  onOpenChange?: (open: boolean) => void;
}

function renderTrigger(
  trigger: ReactNode,
  open: boolean,
  toggle: () => void,
): ReactNode {
  if (isValidElement(trigger) && trigger.type === 'button') {
    const button = trigger as ReactElement<{
      onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
      type?: 'button' | 'submit' | 'reset';
      'aria-expanded'?: boolean;
      'aria-haspopup'?: 'menu';
    }>;

    return cloneElement(button, {
      type: button.props.type ?? 'button',
      'aria-expanded': open,
      'aria-haspopup': 'menu',
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        button.props.onClick?.(event);
        if (!event.defaultPrevented) toggle();
      },
    });
  }

  return (
    <button
      type="button"
      aria-expanded={open}
      aria-haspopup="menu"
      onClick={toggle}
      className="block text-left"
    >
      {trigger}
    </button>
  );
}

export function Dropdown({
  trigger,
  children,
  align = 'right',
  width = 'w-64',
  onOpenChange,
}: DropdownProps) {
  const [open, setOpen] = useState(false);

  const setOpenState = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const toggle = () => setOpenState(!open);

  return (
    <div
      className="relative inline-block"
      onBlur={(e) =>
        !e.currentTarget.contains(e.relatedTarget as Node | null) && setOpenState(false)
      }
    >
      {renderTrigger(trigger, open, toggle)}
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpenState(false)} />
          <div
            role="menu"
            className={`absolute z-40 mt-2 ${width} surface rounded-xl border shadow-elevated py-1.5 animate-scale-in origin-top ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            <div onClick={() => setOpenState(false)}>{children}</div>
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
  disabled,
  description,
  title,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  description?: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      title={title}
      className={`w-full flex gap-2.5 px-3 py-2 text-sm text-left rounded-lg transition-colors ${
        description ? 'items-start' : 'items-center'
      } ${
        disabled
          ? 'text-muted cursor-not-allowed opacity-60'
          : active
            ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300'
            : 'text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'
      }`}
    >
      {icon && <span className={`shrink-0 ${description ? 'mt-0.5' : ''}`}>{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className="block">{children}</span>
        {description ? (
          <span className="block text-xs text-muted mt-0.5">{description}</span>
        ) : null}
      </span>
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
