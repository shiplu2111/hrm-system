import type { CmsMenuDto } from '@hrm/shared-types';
import { fetchCmsJsonWithFallback } from './cms-resilient-cache';

function getWebsiteApiBase(): string {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000'
  ).replace(/\/+$/, '');
}

export async function fetchPublicCmsMenus(): Promise<CmsMenuDto[]> {
  const apiBase = getWebsiteApiBase();
  const res = await fetchCmsJsonWithFallback<{ data?: CmsMenuDto[] }>({
    cacheKey: 'cms:menus:all',
    url: `${apiBase}/api/v1/public/content/menus`,
    revalidateSeconds: 60,
    tags: ['cms-menus'],
    timeoutMs: 2500,
    treat404AsAuthoritative: false,
  });

  return res.ok && Array.isArray(res.data?.data) ? res.data.data : [];
}
