import { Check, Minus } from 'lucide-react';
import { ButtonLink, type ButtonVariant } from './Button';

export interface PricingFeatureItem {
  label: string;
  included: boolean;
}

export interface PricingCardProps {
  name: string;
  description: string;
  priceDisplay: string;
  priceUnit?: string;
  limitNote?: string;
  badge?: string;
  highlighted?: boolean;
  ctaLabel: string;
  ctaHref: string;
  ctaVariant?: ButtonVariant;
  features: readonly PricingFeatureItem[];
  className?: string;
}

export function PricingCard({
  name,
  description,
  priceDisplay,
  priceUnit,
  limitNote,
  badge,
  highlighted = false,
  ctaLabel,
  ctaHref,
  ctaVariant,
  features,
  className = '',
}: PricingCardProps) {
  const resolvedVariant: ButtonVariant = ctaVariant ?? (highlighted ? 'primary' : 'outline');

  return (
    <article
      className={`rounded-xl p-6 sm:p-8 flex flex-col justify-between bg-[rgb(var(--bg-surface))] transition-shadow duration-200 ${
        highlighted
          ? 'border-2 border-primary-600 shadow-elevated relative'
          : 'border border-[rgb(var(--border-base))] shadow-card hover:shadow-card-hover'
      } ${className}`.trim()}
    >
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-xl font-semibold text-[rgb(var(--text-primary))]">{name}</h3>
          {badge && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-semibold bg-primary-600 text-white">
              {badge}
            </span>
          )}
        </div>

        <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed min-h-[42px]">{description}</p>

        <div className="mt-6 pb-6 border-b border-[rgb(var(--border-base))]">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {priceDisplay}
            </span>
            {priceUnit && <span className="text-sm text-[rgb(var(--text-muted))]">{priceUnit}</span>}
          </div>
          {limitNote && <p className="mt-2 text-xs font-medium text-primary-700">{limitNote}</p>}
        </div>

        <ul className="mt-6 space-y-3">
          {features.map((feature) => (
            <li
              key={feature.label}
              className={`flex items-start gap-2.5 text-sm ${
                feature.included ? 'text-[rgb(var(--text-primary))]' : 'text-[rgb(var(--text-muted))]'
              }`}
            >
              {feature.included ? (
                <Check className="w-4 h-4 text-success-600 shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <Minus className="w-4 h-4 text-secondary-400 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <span>{feature.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 pt-2">
        <ButtonLink href={ctaHref} variant={resolvedVariant} size="md" className="w-full">
          {ctaLabel}
        </ButtonLink>
      </div>
    </article>
  );
}
