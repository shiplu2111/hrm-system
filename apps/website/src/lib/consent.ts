export type ConsentCategory = 'necessary' | 'analytics' | 'marketing';

export interface CookieConsentState {
  version: string;
  decided: boolean;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string | null;
}

export const CONSENT_STORAGE_KEY = 'cmsn_cookie_consent_v1';
export const CONSENT_COOKIE_NAME = 'cmsn_cookie_consent';
export const CURRENT_COOKIE_POLICY_VERSION = '2026-11';

export const DEFAULT_COOKIE_CONSENT: CookieConsentState = {
  version: CURRENT_COOKIE_POLICY_VERSION,
  decided: false,
  necessary: true,
  analytics: false,
  marketing: false,
  updatedAt: null,
};

function sanitizeConsentPayload(parsed: unknown): CookieConsentState | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.decided !== 'boolean') return null;
  return {
    version:
      typeof obj.version === 'string' && obj.version.trim()
        ? obj.version.trim()
        : CURRENT_COOKIE_POLICY_VERSION,
    decided: obj.decided,
    necessary: true,
    analytics: Boolean(obj.analytics),
    marketing: Boolean(obj.marketing),
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : null,
  };
}

export function readStoredConsent(): CookieConsentState {
  if (typeof window === 'undefined') return DEFAULT_COOKIE_CONSENT;

  try {
    const rawLs = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (rawLs) {
      const parsed = sanitizeConsentPayload(JSON.parse(rawLs));
      if (parsed) return parsed;
    }
  } catch {
    // Fallback to cookie below
  }

  try {
    const cookieMatch = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${CONSENT_COOKIE_NAME}=`));
    if (cookieMatch) {
      const encoded = cookieMatch.slice(CONSENT_COOKIE_NAME.length + 1);
      const parsed = sanitizeConsentPayload(JSON.parse(decodeURIComponent(encoded)));
      if (parsed) return parsed;
    }
  } catch {
    // Ignore malformed cookie
  }

  return DEFAULT_COOKIE_CONSENT;
}

export function persistConsent(next: {
  analytics: boolean;
  marketing: boolean;
  version?: string;
}): CookieConsentState {
  const payload: CookieConsentState = {
    version: next.version || CURRENT_COOKIE_POLICY_VERSION,
    decided: true,
    necessary: true,
    analytics: Boolean(next.analytics),
    marketing: Boolean(next.marketing),
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Best-effort storage
    }

    try {
      const encoded = encodeURIComponent(JSON.stringify(payload));
      const maxAge = 180 * 24 * 60 * 60;
      document.cookie = `${CONSENT_COOKIE_NAME}=${encoded}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    } catch {
      // Best-effort cookie
    }
  }

  return payload;
}
