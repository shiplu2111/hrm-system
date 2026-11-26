import type { ReactNode } from 'react';

export type ContainerSize = 'narrow' | 'default' | 'wide';

const CONTAINER_CLASSES: Record<ContainerSize, string> = {
  narrow: 'max-w-narrow',
  default: 'max-w-container',
  wide: 'max-w-wide',
};

export interface ContainerProps {
  size?: ContainerSize;
  className?: string;
  children: ReactNode;
}

export function Container({ size = 'default', className = '', children }: ContainerProps) {
  return (
    <div className={`${CONTAINER_CLASSES[size]} mx-auto w-full px-4 sm:px-6 lg:px-8 ${className}`.trim()}>
      {children}
    </div>
  );
}

export type SectionSurface = 'base' | 'surface' | 'muted' | 'tinted' | 'dark';
export type SectionRhythm = 'compact' | 'default' | 'spacious';

const SURFACE_CLASSES: Record<SectionSurface, string> = {
  base: 'bg-[rgb(var(--bg-base))] text-[rgb(var(--text-secondary))]',
  surface: 'bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-secondary))]',
  muted: 'bg-[rgb(var(--bg-muted))] text-[rgb(var(--text-secondary))]',
  tinted: 'bg-primary-50/70 text-[rgb(var(--text-secondary))]',
  dark: 'bg-primary-950 text-secondary-200',
};

const RHYTHM_CLASSES: Record<SectionRhythm, string> = {
  compact: 'py-12 md:py-16',
  default: 'py-16 md:py-24',
  spacious: 'py-20 md:py-28 lg:py-32',
};

export interface SectionProps {
  id?: string;
  surface?: SectionSurface;
  rhythm?: SectionRhythm;
  bordered?: boolean;
  className?: string;
  children: ReactNode;
}

export function Section({
  id,
  surface = 'base',
  rhythm = 'default',
  bordered = false,
  className = '',
  children,
}: SectionProps) {
  const borderClass = bordered
    ? surface === 'dark'
      ? 'border-b border-primary-900'
      : 'border-b border-[rgb(var(--border-base))]'
    : '';

  return (
    <section
      id={id}
      className={`${SURFACE_CLASSES[surface]} ${RHYTHM_CLASSES[rhythm]} ${borderClass} ${className}`.trim()}
    >
      {children}
    </section>
  );
}

export interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  inverted?: boolean;
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  inverted = false,
  className = '',
}: SectionHeaderProps) {
  const alignClass = align === 'center' ? 'text-center mx-auto' : 'text-left';

  return (
    <div className={`max-w-3xl mb-12 md:mb-16 ${alignClass} ${className}`.trim()}>
      {eyebrow && (
        <span
          className={`inline-block text-xs font-semibold tracking-wider uppercase mb-3 ${
            inverted ? 'text-primary-300' : 'text-primary-600'
          }`}
        >
          {eyebrow}
        </span>
      )}
      <h2
        className={`text-display-sm sm:text-display-md font-semibold tracking-tight ${
          inverted ? 'text-white' : 'text-[rgb(var(--text-primary))]'
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`mt-4 text-base sm:text-lead leading-relaxed ${
            inverted ? 'text-secondary-300' : 'text-[rgb(var(--text-secondary))]'
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
