import type { CmsRedirectRuleDto } from '@hrm/shared-types';

function getWebsiteApiBaseUrl(): string {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000'
  ).replace(/\/+$/, '');
}

export async function lookupCmsRedirect(rawPath: string): Promise<CmsRedirectRuleDto | null> {
  if (!rawPath || rawPath === '/') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const res = await fetch(
      `${getWebsiteApiBaseUrl()}/api/v1/public/content/redirects?path=${encodeURIComponent(rawPath)}`,
      { cache: 'no-store', signal: controller.signal },
    );
    if (!res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { data?: CmsRedirectRuleDto };
    return body.data ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
