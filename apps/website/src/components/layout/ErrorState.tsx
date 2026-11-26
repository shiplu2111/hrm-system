import type { ReactNode } from 'react';
import { Container, Section } from '../marketing';

export interface ErrorStateProps {
  badge: string;
  tone?: 'neutral' | 'error';
  title: string;
  description: string;
  actions: ReactNode;
  helpfulLinks?: Array<{ label: string; href: string }>;
  helpfulHeading?: string;
}

export function ErrorState({
  badge,
  tone = 'neutral',
  title,
  description,
  actions,
  helpfulLinks,
  helpfulHeading,
}: ErrorStateProps) {
  const badgeClasses =
    tone === 'error'
      ? 'bg-error-50 text-error-700 border-error-200'
      : 'bg-secondary-100 text-secondary-700 border-secondary-200';

  return (
    <Section surface="base" rhythm="spacious">
      <Container size="narrow">
        <div className="surface rounded-2xl p-8 sm:p-12 text-center">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-sm text-xs font-mono font-semibold border mb-6 ${badgeClasses}`}
          >
            {badge}
          </span>

          <h1 className="text-display-sm sm:text-display-md font-semibold tracking-tight text-[rgb(var(--text-primary))]">
            {title}
          </h1>

          <p className="mt-4 text-base sm:text-lead text-[rgb(var(--text-secondary))] max-w-xl mx-auto leading-relaxed">
            {description}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            {actions}
          </div>

          {helpfulLinks && helpfulLinks.length > 0 && helpfulHeading && (
            <div className="mt-10 pt-8 border-t border-[rgb(var(--border-base))] text-left max-w-md mx-auto">
              <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-muted))] mb-3 text-center">
                {helpfulHeading}
              </p>
              <ul className="space-y-2 text-sm text-center">
                {helpfulLinks.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="font-medium text-primary-600 hover:text-primary-700 hover:underline rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
