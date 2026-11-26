import { readStoredConsent, DEFAULT_COOKIE_CONSENT, type CookieConsentState } from './consent';
import { getEffectiveAttribution } from './attribution';
import { env } from '../env';

export type AnalyticsEventName =
  | 'pageview'
  | 'visit'
  | 'pricing_view'
  | 'signup_start'
  | 'email_verified'
  | 'tenant_created'
  | 'demo_request'
  | 'contact_submit';

export type AnalyticsMode = 'consent' | 'cookieless';
export type AnalyticsProviderKind = 'plausible' | 'first-party' | 'none';

export interface AnalyticsConfig {
  mode: AnalyticsMode;
  provider: AnalyticsProviderKind;
  cookieless: boolean;
  plausibleDomain?: string;
  scriptUrl?: string;
}

export interface SanitizedAnalyticsPayload {
  event: AnalyticsEventName;
  path: string;
  locale?: string;
  cookieless: boolean;
  provider: AnalyticsProviderKind;
  props: Record<string, string | number | boolean>;
}

const ALLOWED_EVENTS = new Set<AnalyticsEventName>([
  'pageview',
  'visit',
  'pricing_view',
  'signup_start',
  'email_verified',
  'tenant_created',
  'demo_request',
  'contact_submit',
]);

/**
 * Explicit PII blocklist: neither client nor collector may ever emit these keys.
 */
const BLOCKED_PII_KEYS = new Set<string>([
  'email',
  'workemail',
  'owneremail',
  'useremail',
  'name',
  'ownername',
  'fullname',
  'firstname',
  'lastname',
  'username',
  'phone',
  'phonenumber',
  'mobile',
  'password',
  'token',
  'verificationtoken',
  'captchatoken',
  'message',
  'subject',
  'ip',
  'ipaddress',
  'address',
  'street',
  'company',
  'companyname',
  'owner',
  'user',
  'userid',
  'ownerid',
  'ssn',
  'taxid',
  'bankaccount',
]);

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const LONG_SECRET_PATTERN = /\b[a-f0-9]{32,}\b/i;

const DEDUP_STORAGE_PREFIX = 'cmsn_analytics_dedup_v1:';
const inMemoryDedup = new Set<string>();

declare global {
  interface Window {
    plausible?: (
      eventName: string,
      options?: {
        u?: string;
        props?: Record<string, string | number | boolean>;
      },
    ) => void;
  }
}

export function getAnalyticsConfig(): AnalyticsConfig {
  return {
    mode: env.NEXT_PUBLIC_ANALYTICS_MODE,
    provider: env.NEXT_PUBLIC_ANALYTICS_PROVIDER,
    cookieless: env.NEXT_PUBLIC_ANALYTICS_COOKIELESS,
    plausibleDomain: env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN,
    scriptUrl: env.NEXT_PUBLIC_ANALYTICS_SCRIPT_URL,
  };
}

/**
 * Determines whether analytics telemetry is allowed to emit right now.
 * - mode="consent" (default): strictly behind consent banner (decided && analytics === true)
 * - mode="cookieless": allowed without cookies where law permits, unless explicitly declined
 */
export function canTrackAnalytics(consent: CookieConsentState): boolean {
  const cfg = getAnalyticsConfig();
  if (cfg.provider === 'none') return false;
  if (cfg.mode === 'cookieless') {
    return consent.decided ? Boolean(consent.analytics) : true;
  }
  return Boolean(consent.decided && consent.analytics);
}

export function canLoadAnalyticsScript(consent: CookieConsentState): boolean {
  return canTrackAnalytics(consent);
}

/**
 * Strips query parameters, hashes, email addresses, and opaque hex tokens from analytics paths
 * so sensitive verification tokens (/signup/verify?token=...) or PII never reach providers.
 */
export function sanitizeAnalyticsPath(rawPath?: string | null): string {
  if (!rawPath || typeof rawPath !== 'string') return '/';
  const withoutHash = rawPath.split('#')[0] ?? '/';
  const pathname = (withoutHash.split('?')[0] ?? '/').trim() || '/';
  if (EMAIL_PATTERN.test(pathname) || LONG_SECRET_PATTERN.test(pathname)) {
    return '/';
  }
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return normalized.slice(0, 160);
}

export function sanitizeAnalyticsProps(
  rawProps?: Record<string, unknown>,
): Record<string, string | number | boolean> {
  if (!rawProps || typeof rawProps !== 'object') return {};

  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(rawProps)) {
    const cleanKey = key.trim().slice(0, 48);
    if (!cleanKey) continue;
    const normalizedKey = cleanKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (BLOCKED_PII_KEYS.has(normalizedKey)) continue;
    if (normalizedKey.includes('email') || normalizedKey.includes('token') || normalizedKey.includes('password')) {
      continue;
    }

    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      out[cleanKey] = value;
      continue;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (EMAIL_PATTERN.test(trimmed) || LONG_SECRET_PATTERN.test(trimmed)) continue;
      out[cleanKey] = trimmed.slice(0, 120);
    }
  }
  return out;
}

export function sanitizeAnalyticsEventPayload(input: {
  event: AnalyticsEventName;
  path?: string;
  locale?: string;
  props?: Record<string, unknown>;
}): SanitizedAnalyticsPayload {
  const cfg = getAnalyticsConfig();
  const safeEvent = ALLOWED_EVENTS.has(input.event) ? input.event : 'pageview';
  const safeLocale =
    typeof input.locale === 'string' && /^[a-z]{2}(-[A-Z]{2})?$/.test(input.locale.trim())
      ? input.locale.trim()
      : undefined;

  return {
    event: safeEvent,
    path: sanitizeAnalyticsPath(input.path),
    ...(safeLocale ? { locale: safeLocale } : {}),
    cookieless: cfg.cookieless,
    provider: cfg.provider,
    props: sanitizeAnalyticsProps(input.props),
  };
}

function hasDeduped(dedupKey: string, useSessionStorage: boolean): boolean {
  if (inMemoryDedup.has(dedupKey)) return true;
  if (useSessionStorage && typeof window !== 'undefined') {
    try {
      return window.sessionStorage.getItem(`${DEDUP_STORAGE_PREFIX}${dedupKey}`) === '1';
    } catch {
      return false;
    }
  }
  return false;
}

function markDeduped(dedupKey: string, useSessionStorage: boolean): void {
  inMemoryDedup.add(dedupKey);
  if (useSessionStorage && typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(`${DEDUP_STORAGE_PREFIX}${dedupKey}`, '1');
    } catch {
      // Ignore storage failures
    }
  }
}

export function clearAnalyticsDedup(): void {
  inMemoryDedup.clear();
  if (typeof window !== 'undefined') {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i += 1) {
        const key = window.sessionStorage.key(i);
        if (key && key.startsWith(DEDUP_STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        window.sessionStorage.removeItem(key);
      }
    } catch {
      // Ignore
    }
  }
}

export function trackAnalyticsEvent(
  event: AnalyticsEventName,
  options?: {
    path?: string;
    locale?: string;
    props?: Record<string, unknown>;
    consent?: CookieConsentState;
    hydrated?: boolean;
    dedupKey?: string;
    useSessionDedup?: boolean;
  },
): boolean {
  if (typeof window === 'undefined') return false;

  const effectiveConsent =
    options?.hydrated === false
      ? readStoredConsent()
      : (options?.consent ?? readStoredConsent() ?? DEFAULT_COOKIE_CONSENT);

  if (!canTrackAnalytics(effectiveConsent)) {
    return false;
  }

  // Only touch sessionStorage for dedup when consent is explicitly granted (never in strict zero-storage cookieless mode)
  const allowStorage = Boolean(effectiveConsent.decided && effectiveConsent.analytics);
  const useSessionStorage = Boolean(options?.useSessionDedup && allowStorage);

  if (options?.dedupKey) {
    if (hasDeduped(options.dedupKey, useSessionStorage)) {
      return false;
    }
    markDeduped(options.dedupKey, useSessionStorage);
  }

  const attribution =
    effectiveConsent.marketing || effectiveConsent.analytics
      ? getEffectiveAttribution(window.location.search, allowStorage)
      : {};

  const utmProps = effectiveConsent.marketing
    ? {
        ...(attribution.utmSource ? { utm_source: attribution.utmSource } : {}),
        ...(attribution.utmMedium ? { utm_medium: attribution.utmMedium } : {}),
        ...(attribution.utmCampaign ? { utm_campaign: attribution.utmCampaign } : {}),
      }
    : {};

  const payload = sanitizeAnalyticsEventPayload({
    event,
    path: options?.path ?? window.location.pathname,
    locale: options?.locale,
    props: {
      ...utmProps,
      ...options?.props,
    },
  });

  // 1. Dispatch to Plausible script if loaded (Plausible operates cookie-free)
  try {
    if (typeof window.plausible === 'function') {
      const origin = window.location.origin;
      window.plausible(payload.event, {
        u: `${origin}${payload.path}`,
        props: {
          ...(payload.locale ? { locale: payload.locale } : {}),
          ...payload.props,
        },
      });
    }
  } catch {
    // Non-blocking provider dispatch
  }

  // 2. Dispatch to first-party privacy-filtered endpoint
  try {
    void fetch('/api/analytics/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Ignore route-navigation abort
    });
  } catch {
    // Non-blocking telemetry
  }

  return true;
}
