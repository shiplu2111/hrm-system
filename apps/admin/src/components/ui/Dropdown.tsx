import {
  cloneElement,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
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

const MENU_GAP = 8;
const VIEWPORT_MARGIN = 8;

interface MenuPosition {
  top: number;
  left?: number;
  right?: number;
  maxHeight: number;
  placement: 'below' | 'above';
}

export function Dropdown({
  trigger,
  children,
  align = 'right',
  width = 'w-64',
  onOpenChange,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const setOpenState = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setPosition(null);
    onOpenChangeRef.current?.(next);
  }, []);

  const toggle = () => setOpenState(!open);

  /** Portaled + fixed so scroll containers (e.g. tables with overflow) cannot clip the menu. */
  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const rect = anchor.getBoundingClientRect();
    const menuHeight = menu.scrollHeight;
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - MENU_GAP - VIEWPORT_MARGIN;
    const placement = menuHeight > spaceBelow && spaceAbove > spaceBelow ? 'above' : 'below';
    const maxHeight = Math.max(120, placement === 'below' ? spaceBelow : spaceAbove);
    const height = Math.min(menuHeight, maxHeight);
    setPosition({
      top: placement === 'below' ? rect.bottom + MENU_GAP : rect.top - MENU_GAP - height,
      ...(align === 'right'
        ? { right: Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.right) }
        : { left: Math.max(VIEWPORT_MARGIN, rect.left) }),
      maxHeight,
      placement,
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenState(false);
    };
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, updatePosition, setOpenState]);

  return (
    <div
      ref={anchorRef}
      className="relative inline-block"
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (!e.currentTarget.contains(next) && !menuRef.current?.contains(next)) {
          setOpenState(false);
        }
      }}
    >
      {renderTrigger(trigger, open, toggle)}
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setOpenState(false)} />
            <div
              ref={menuRef}
              role="menu"
              style={{
                top: position?.top ?? 0,
                left: position?.left,
                right: position?.right,
                maxHeight: position?.maxHeight,
                visibility: position ? 'visible' : 'hidden',
              }}
              className={`fixed z-[61] ${width} surface rounded-xl border shadow-elevated py-1.5 overflow-y-auto scrollbar-thin animate-scale-in ${
                position?.placement === 'above' ? 'origin-bottom' : 'origin-top'
              }`}
            >
              <div onClick={() => setOpenState(false)}>{children}</div>
            </div>
          </>,
          document.body,
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
