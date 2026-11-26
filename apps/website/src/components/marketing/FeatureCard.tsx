import { ArrowRight, Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { LocaleLink } from './LocaleLink';

export type FeatureBadgeTone = 'primary' | 'warning' | 'secondary' | 'success';

const BADGE_CLASSES: Record<FeatureBadgeTone, string> = {
  primary: 'bg-primary-50 text-primary-700 border-primary-200',
  warning: 'bg-warning-50 text-warning-700 border-warning-200',
  secondary: 'bg-secondary-100 text-secondary-700 border-secondary-200',
  success: 'bg-success-50 text-success-700 border-success-200',
};

export interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  badge?: {
    label: string;
    tone?: FeatureBadgeTone;
  };
  bullets?: readonly string[];
  href?: string;
  ctaLabel?: string;
  featured?: boolean;
  className?: string;
}

export function FeatureCard({
  icon,
  title,
  description,
  badge,
  bullets,
  href,
  ctaLabel,
  featured = false,
  className = '',
}: FeatureCardProps) {
  return (
    <article
      className={`surface rounded-xl p-6 sm:p-8 flex flex-col justify-between transition-shadow duration-200 hover:shadow-card-hover ${
        featured ? 'border-primary-300 ring-1 ring-primary-200/70' : ''
      } ${className}`.trim()}
    >
      <div>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="w-12 h-12 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 border border-primary-100">
            {icon}
          </div>
          {badge && (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-semibold border ${
                BADGE_CLASSES[badge.tone ?? 'secondary']
              }`}
            >
              {badge.label}
            </span>
          )}
        </div>

        <h3 className="text-xl font-semibold text-[rgb(var(--text-primary))] mb-2.5">{title}</h3>
        <p className="text-sm sm:text-base leading-relaxed text-[rgb(var(--text-secondary))]">{description}</p>

        {bullets && bullets.length > 0 && (
          <ul className="mt-5 space-y-2 border-t border-[rgb(var(--border-base))] pt-4">
            {bullets.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-[rgb(var(--text-secondary))]">
                <Check className="w-4 h-4 text-success-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {href && ctaLabel && (
        <div className="mt-6 pt-2">
          <LocaleLink
            href={href}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded"
          >
            <span>{ctaLabel}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </LocaleLink>
        </div>
      )}
    </article>
  );
}
