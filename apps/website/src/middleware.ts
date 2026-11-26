import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, isWebsiteLocale, SUPPORTED_LOCALES } from './i18n/types';

const PUBLIC_FILE_EXT_RE = /\.[a-z0-9]+$/i;

const BYPASS_EXACT = new Set([
  '/robots.txt',
  '/sitemap.xml',
  '/opengraph-image',
  '/icon.svg',
  '/blog/rss.xml',
  '/changelog/rss.xml',
]);

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/images/') ||
    BYPASS_EXACT.has(pathname) ||
    PUBLIC_FILE_EXT_RE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const isSearchQueryOnHelp =
    (pathname === '/help' || pathname === '/bn/help' || pathname === '/en/help') &&
    searchParams.has('q');

  const applyNoStoreForSearch = (response: NextResponse) => {
    if (isSearchQueryOnHelp) {
      response.headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');
      response.headers.set('CDN-Cache-Control', 'private, no-store');
    }
    return response;
  };

  const segments = pathname.split('/');
  const firstSegment = segments[1];

  // Canonicalize explicit default `/en/...` to unprefixed `/...`
  if (firstSegment === DEFAULT_LOCALE) {
    const rest = `/${segments.slice(2).join('/')}`;
    const canonicalPath = rest === '/' ? '/' : rest.replace(/\/+$/, '') || '/';
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = canonicalPath;
    return NextResponse.redirect(redirectUrl, 308);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-cms-pathname', pathname);

  // Known non-default locale prefix (e.g. `/bn` or `/bn/pricing`)
  if (firstSegment && isWebsiteLocale(firstSegment) && SUPPORTED_LOCALES.includes(firstSegment)) {
    return applyNoStoreForSearch(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  // Internally rewrite unprefixed routes (e.g. `/`, `/pricing`) to `/en/...`
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = pathname === '/' ? `/${DEFAULT_LOCALE}` : `/${DEFAULT_LOCALE}${pathname}`;
  return applyNoStoreForSearch(
    NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } }),
  );
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
