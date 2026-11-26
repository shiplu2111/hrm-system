'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useWebsiteI18n } from '../../i18n/client';
import {
  canLoadAnalyticsScript,
  canTrackAnalytics,
  getAnalyticsConfig,
  sanitizeAnalyticsPath,
  trackAnalyticsEvent,
} from '../../lib/analytics';
import { captureAttributionFromLocation } from '../../lib/attribution';
import { useCookieConsent } from './CookieConsentProvider';

/**
 * Loads analytics or marketing telemetry strictly behind consent
 * (or in cookieless mode where permitted by regional law).
 * Before consent or when declined in consent mode, zero tracking requests or external scripts execute.
 */
export function ConsentGatedScripts() {
  const pathname = usePathname();
  const { locale } = useWebsiteI18n();
  const { consent, hydrated } = useCookieConsent();
  const lastTrackedRef = useRef<string | null>(null);

  const analyticsAllowed = hydrated && canTrackAnalytics(consent);
  const scriptAllowed = hydrated && canLoadAnalyticsScript(consent);
  const analyticsConfig = getAnalyticsConfig();

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') {
      return;
    }

    const allowSessionAttribution = Boolean(
      consent.decided && (consent.analytics || consent.marketing),
    );
    captureAttributionFromLocation(window.location.search, allowSessionAttribution);

    if (!analyticsAllowed) {
      lastTrackedRef.current = null;
      return;
    }

    const safePath = sanitizeAnalyticsPath(pathname);
    const isSignupCallback =
      safePath.includes('/signup/verify') || safePath.includes('/signup/setup');

    if (!isSignupCallback) {
      trackAnalyticsEvent('visit', {
        path: safePath,
        locale,
        consent,
        hydrated,
        dedupKey: 'funnel:visit',
        useSessionDedup: true,
      });
    }

    const trackingKey = `${safePath}:${analyticsConfig.mode}:${consent.updatedAt ?? 'cookieless'}`;
    if (lastTrackedRef.current === trackingKey) {
      return;
    }
    lastTrackedRef.current = trackingKey;

    trackAnalyticsEvent('pageview', {
      path: safePath,
      locale,
      consent,
      hydrated,
    });
  }, [
    hydrated,
    analyticsAllowed,
    analyticsConfig.mode,
    consent,
    locale,
    pathname,
  ]);

  const analyticsSrc = analyticsConfig.scriptUrl?.trim();
  const marketingSrc = process.env.NEXT_PUBLIC_MARKETING_SCRIPT_URL?.trim();

  if (!hydrated) {
    return null;
  }

  return (
    <>
      {scriptAllowed && analyticsSrc ? (
        <Script
          id="consent-analytics-script"
          strategy="lazyOnload"
          src={analyticsSrc}
          data-domain={analyticsConfig.plausibleDomain || undefined}
          data-testid="consent-analytics-script"
        />
      ) : null}
      {consent.decided && consent.marketing && marketingSrc ? (
        <Script
          id="consent-marketing-script"
          strategy="lazyOnload"
          src={marketingSrc}
          data-testid="consent-marketing-script"
        />
      ) : null}
    </>
  );
}
