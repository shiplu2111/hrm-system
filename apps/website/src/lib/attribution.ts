'use client';

export interface UtmAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
}

const ATTRIBUTION_STORAGE_KEY = 'cmsn_utm_attribution_v1';

/**
 * In-memory session attribution so UTM tags survive multi-page SPA navigation
 * cleanly without setting cookies or browser storage unless permitted.
 */
let memoryAttribution: UtmAttribution = {};

function cleanValue(raw: string | null | undefined, maxLen: number): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function sanitizeReferrer(raw: string | null | undefined): string | undefined {
  const cleaned = cleanValue(raw, 512);
  if (!cleaned) return undefined;
  // Strip query parameters/tokens from referrer URL so no PII or tokens leak
  try {
    const parsed = new URL(cleaned);
    return `${parsed.origin}${parsed.pathname}`.slice(0, 512);
  } catch {
    return cleaned.split('?')[0]?.slice(0, 512);
  }
}

export function extractUtmFromSearch(searchString?: string | null): UtmAttribution {
  if (!searchString) return {};
  const params = new URLSearchParams(
    searchString.startsWith('?') ? searchString : `?${searchString}`,
  );
  const utmSource = cleanValue(params.get('utm_source'), 120);
  const utmMedium = cleanValue(params.get('utm_medium'), 120);
  const utmCampaign = cleanValue(params.get('utm_campaign'), 120);
  const utmTerm = cleanValue(params.get('utm_term'), 120);
  const utmContent = cleanValue(params.get('utm_content'), 120);

  return {
    ...(utmSource ? { utmSource } : {}),
    ...(utmMedium ? { utmMedium } : {}),
    ...(utmCampaign ? { utmCampaign } : {}),
    ...(utmTerm ? { utmTerm } : {}),
    ...(utmContent ? { utmContent } : {}),
  };
}

export function clearStoredAttribution(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
  } catch {
    // Ignore storage unavailability
  }
}

/**
 * Captures UTM campaign parameters from the current landing URL and stores
 * them in memory (and sessionStorage only when browser consent allows).
 * Never sets any cookies.
 */
export function captureAttributionFromLocation(
  searchString: string,
  allowSessionStorage: boolean,
): UtmAttribution {
  const fromQuery = extractUtmFromSearch(searchString);
  const hasQueryUtm = Object.keys(fromQuery).length > 0;

  let persisted: UtmAttribution = {};
  if (allowSessionStorage && typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
      if (raw) {
        persisted = JSON.parse(raw) as UtmAttribution;
      }
    } catch {
      persisted = {};
    }
  } else if (!allowSessionStorage) {
    clearStoredAttribution();
  }

  let initialReferrer = memoryAttribution.referrer ?? persisted.referrer;
  if (!initialReferrer && typeof document !== 'undefined' && document.referrer) {
    const cleanedRef = sanitizeReferrer(document.referrer);
    if (cleanedRef) {
      try {
        const refOrigin = new URL(cleanedRef).origin;
        if (typeof window === 'undefined' || refOrigin !== window.location.origin) {
          initialReferrer = cleanedRef;
        }
      } catch {
        initialReferrer = cleanedRef;
      }
    }
  }

  const merged: UtmAttribution = {
    ...persisted,
    ...memoryAttribution,
    ...(hasQueryUtm ? fromQuery : {}),
    ...(initialReferrer ? { referrer: initialReferrer } : {}),
  };

  memoryAttribution = merged;

  if (allowSessionStorage && typeof window !== 'undefined' && Object.keys(merged).length > 0) {
    try {
      window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Best-effort storage
    }
  }

  return merged;
}

export function getEffectiveAttribution(
  currentSearchString?: string | null,
  allowSessionStorage = false,
): UtmAttribution {
  const captured = captureAttributionFromLocation(currentSearchString ?? '', allowSessionStorage);
  const directQuery = extractUtmFromSearch(currentSearchString);
  return {
    ...captured,
    ...directQuery,
  };
}
