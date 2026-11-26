'use client';

import { Calendar } from 'lucide-react';
import { useWebsiteI18n } from '../../i18n/client';
import { ButtonLink } from '../marketing';

/**
 * Single Integration Point for External Demo Scheduling Provider (Stage F.1).
 *
 * When a scheduling provider (e.g., Calendly, Cal.com, HubSpot Meetings) is selected:
 * 1) Configure NEXT_PUBLIC_SCHEDULING_URL (or wire an env flag here)
 * 2) Render either the provider embed iframe or direct booking CTA inside this component
 *    without touching page layouts elsewhere in the app.
 */
export function getConfiguredSchedulingUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SCHEDULING_URL?.trim();
  return url && /^https?:\/\//i.test(url) ? url : null;
}

export function DemoSchedulerSlot() {
  const { t } = useWebsiteI18n();
  const schedulingUrl = getConfiguredSchedulingUrl();

  return (
    <div
      data-testid="demo-scheduler-slot"
      className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/50 p-5 text-left space-y-3"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-[rgb(var(--text-primary))]">
        <Calendar className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
        <span>{t('leads.demo.thankYou.schedulerHeading')}</span>
      </div>

      {schedulingUrl ? (
        <div className="pt-1">
          <ButtonLink href={schedulingUrl} external variant="secondary" size="md">
            {t('leads.demo.thankYou.schedulerActiveCta')}
          </ButtonLink>
        </div>
      ) : (
        <p className="text-xs sm:text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
          {t('leads.demo.thankYou.schedulerPendingNotice')}
        </p>
      )}
    </div>
  );
}
