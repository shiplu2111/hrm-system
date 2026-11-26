import type { ReactNode } from 'react';
import { Container } from './Section';

export interface HeroProps {
  layout?: 'centered' | 'split';
  headingLevel?: 'h1' | 'h2';
  eyebrow?: string;
  eyebrowTag?: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  guarantees?: Array<{ label: string; icon?: ReactNode }>;
  visual?: ReactNode;
  showGrid?: boolean;
  className?: string;
}

export function Hero({
  layout = 'centered',
  headingLevel = 'h1',
  eyebrow,
  eyebrowTag,
  title,
  subtitle,
  actions,
  guarantees,
  visual,
  showGrid = true,
  className = '',
}: HeroProps) {
  const isSplit = layout === 'split' && Boolean(visual);
  const HeadingTag = headingLevel;

  return (
    <section
      className={`relative overflow-hidden pt-14 pb-16 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] ${className}`.trim()}
    >
      {showGrid && <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />}

      <Container>
        <div
          className={
            isSplit
              ? 'grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center'
              : 'max-w-4xl mx-auto text-center'
          }
        >
          <div className={isSplit ? 'lg:col-span-7 text-left' : ''}>
            {(eyebrow || eyebrowTag) && (
              <div
                className={`inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-full surface text-xs font-medium text-[rgb(var(--text-secondary))] mb-6 sm:mb-8 shadow-xs ${
                  isSplit ? '' : 'mx-auto'
                }`}
              >
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success-600" />
                </span>
                {eyebrow && <span>{eyebrow}</span>}
                {eyebrow && eyebrowTag && (
                  <span className="text-[rgb(var(--border-strong))]" aria-hidden="true">
                    |
                  </span>
                )}
                {eyebrowTag && <span className="text-primary-700 font-semibold">{eyebrowTag}</span>}
              </div>
            )}

            <HeadingTag
              className={`font-bold tracking-tight text-[rgb(var(--text-primary))] ${
                isSplit
                  ? 'text-display-sm sm:text-display-lg lg:text-display-xl'
                  : 'text-display-md sm:text-display-xl lg:text-display-2xl'
              }`}
            >
              {title}
            </HeadingTag>

            <p
              className={`mt-5 sm:mt-6 text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed ${
                isSplit ? 'max-w-2xl' : 'max-w-2xl mx-auto'
              }`}
            >
              {subtitle}
            </p>

            {actions && (
              <div
                className={`mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 ${
                  isSplit ? 'justify-start' : 'justify-center'
                }`}
              >
                {actions}
              </div>
            )}

            {guarantees && guarantees.length > 0 && (
              <div
                className={`mt-10 pt-8 border-t border-[rgb(var(--border-base))] grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs font-medium text-[rgb(var(--text-muted))] ${
                  isSplit ? '' : 'max-w-3xl mx-auto'
                }`}
              >
                {guarantees.map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-2 ${isSplit ? 'justify-start' : 'justify-center'}`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isSplit && visual && <div className="lg:col-span-5">{visual}</div>}
          {!isSplit && visual && <div className="mt-12 sm:mt-14">{visual}</div>}
        </div>
      </Container>
    </section>
  );
}
