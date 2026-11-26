'use client';

import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { localizePath } from '../../i18n';
import { useWebsiteI18n } from '../../i18n/client';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'inverse';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm border border-transparent',
  secondary:
    'bg-secondary-100 text-secondary-900 hover:bg-secondary-200 active:bg-secondary-300 border border-transparent',
  outline:
    'bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] border border-[rgb(var(--border-strong))] hover:bg-[rgb(var(--bg-hover))] shadow-xs',
  ghost:
    'bg-transparent text-primary-600 hover:bg-primary-50 active:bg-primary-100 border border-transparent',
  inverse:
    'bg-white text-primary-900 hover:bg-primary-50 active:bg-primary-100 shadow-sm border border-transparent',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-3.5 py-1.5 text-sm rounded-md gap-1.5',
  md: 'min-h-[44px] px-5 py-2.5 text-sm rounded-md gap-2',
  lg: 'min-h-[48px] px-6 py-3 text-base rounded-lg gap-2.5',
};

const BASE_CLASSES =
  'inline-flex items-center justify-center font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';

export function getButtonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className = '') {
  return `${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`.trim();
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={getButtonClasses(variant, size, className)} {...props}>
      {leadingIcon && <span className="shrink-0">{leadingIcon}</span>}
      <span>{children}</span>
      {trailingIcon && <span className="shrink-0">{trailingIcon}</span>}
    </button>
  );
}

export interface ButtonLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  external?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function ButtonLink({
  href,
  external = false,
  variant = 'primary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  className = '',
  children,
  ...props
}: ButtonLinkProps) {
  const { locale } = useWebsiteI18n();
  const classes = getButtonClasses(variant, size, className);

  if (external || href.startsWith('http') || href.startsWith('#')) {
    return (
      <a href={href} className={classes} {...props}>
        {leadingIcon && <span className="shrink-0">{leadingIcon}</span>}
        <span>{children}</span>
        {trailingIcon && <span className="shrink-0">{trailingIcon}</span>}
      </a>
    );
  }

  return (
    <Link href={localizePath(href, locale)} className={classes} {...props}>
      {leadingIcon && <span className="shrink-0">{leadingIcon}</span>}
      <span>{children}</span>
      {trailingIcon && <span className="shrink-0">{trailingIcon}</span>}
    </Link>
  );
}
