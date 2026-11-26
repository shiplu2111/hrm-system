'use client';

import { useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { useWebsiteI18n } from '../../i18n/client';
import { ButtonLink } from '../marketing';
import { DemoSchedulerSlot } from './DemoSchedulerSlot';

export function DemoThankYouClient() {
  const searchParams = useSearchParams();
  const { t } = useWebsiteI18n();
  const company = searchParams.get('company')?.trim();

  const bodyCopy = company
    ? t('leads.demo.thankYou.bodyWithCompany', { company })
    : t('leads.demo.thankYou.bodyDefault');

  return (
    <div
      data-testid="demo-thank-you-card"
      className="max-w-xl mx-auto surface rounded-2xl border border-[rgb(var(--border-base))] p-6 sm:p-10 space-y-6 text-center shadow-card"
    >
      <div className="mx-auto w-14 h-14 rounded-2xl bg-success-50 border border-success-200 flex items-center justify-center text-success-700">
        <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
      </div>

      <div className="space-y-2">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-success-50 text-success-700 border border-success-200">
          {t('leads.demo.thankYou.badge')}
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-[rgb(var(--text-primary))]">
          {t('leads.demo.thankYou.title')}
        </h1>
        <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed">
          {bodyCopy}
        </p>
        <p className="text-xs sm:text-sm text-[rgb(var(--text-muted))] leading-relaxed">
          {t('leads.demo.thankYou.neutralNote')}
        </p>
      </div>

      <DemoSchedulerSlot />

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <ButtonLink href="/features" variant="primary" size="md">
          {t('leads.demo.thankYou.exploreFeaturesCta')}
        </ButtonLink>
        <ButtonLink href="/pricing" variant="secondary" size="md">
          {t('leads.demo.thankYou.viewPricingCta')}
        </ButtonLink>
      </div>
    </div>
  );
}
