import type { ReactNode } from 'react';
import { Container } from './Section';

export interface CtaBandProps {
  tone?: 'dark' | 'tinted';
  eyebrow?: string;
  title: string;
  description: string;
  actions: ReactNode;
  footnote?: string;
  className?: string;
}

export function CtaBand({
  tone = 'dark',
  eyebrow,
  title,
  description,
  actions,
  footnote,
  className = '',
}: CtaBandProps) {
  const isDark = tone === 'dark';

  return (
    <section className={`py-14 sm:py-20 ${className}`.trim()}>
      <Container>
        <div
          className={`rounded-2xl p-8 sm:p-12 lg:p-14 ${
            isDark
              ? 'bg-gradient-to-br from-primary-950 via-primary-900 to-secondary-900 text-white shadow-elevated'
              : 'bg-primary-50 border border-primary-200 text-[rgb(var(--text-primary))] shadow-card'
          }`}
        >
          <div className="max-w-3xl mx-auto text-center">
            {eyebrow && (
              <span
                className={`inline-block text-xs font-semibold tracking-wider uppercase mb-3 ${
                  isDark ? 'text-primary-200' : 'text-primary-700'
                }`}
              >
                {eyebrow}
              </span>
            )}
            <h2
              className={`text-display-sm sm:text-display-md font-semibold tracking-tight ${
                isDark ? 'text-white' : 'text-[rgb(var(--text-primary))]'
              }`}
            >
              {title}
            </h2>
            <p
              className={`mt-4 text-base sm:text-lead leading-relaxed ${
                isDark ? 'text-secondary-200' : 'text-[rgb(var(--text-secondary))]'
              }`}
            >
              {description}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
              {actions}
            </div>
            {footnote && (
              <p
                className={`mt-6 text-xs font-medium ${
                  isDark ? 'text-primary-200/90' : 'text-[rgb(var(--text-muted))]'
                }`}
              >
                {footnote}
              </p>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
