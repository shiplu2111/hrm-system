import fs from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';

function stripQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function assertLegalDocsApprovedForProductionBuild() {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV?.trim();
  const isProdBuild =
    appEnv === 'production' ||
    (!appEnv && process.env.NODE_ENV === 'production');

  if (!isProdBuild) return;

  const legalDir = path.join(process.cwd(), 'src', 'content', 'legal');
  const requiredFiles = ['terms.md', 'privacy.md', 'cookies.md'];
  const violations: string[] = [];

  for (const fileName of requiredFiles) {
    const fullPath = path.join(legalDir, fileName);
    if (!fs.existsSync(fullPath)) {
      violations.push(`${fileName}: missing legal content file`);
      continue;
    }

    const raw = fs.readFileSync(fullPath, 'utf-8');
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) {
      violations.push(`${fileName}: missing frontmatter header`);
      continue;
    }

    const meta: Record<string, string> = {};
    for (const line of fmMatch[1].split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const sep = trimmed.indexOf(':');
      const eq = trimmed.indexOf('=');
      const splitAt = sep > 0 && (eq < 0 || sep < eq) ? sep : eq;
      if (splitAt <= 0) continue;
      meta[trimmed.slice(0, splitAt).trim()] = stripQuotes(trimmed.slice(splitAt + 1));
    }

    const approved = meta.LEGAL_APPROVED?.toLowerCase() === 'true';
    const reviewedOn = meta.reviewedOn?.trim() || '';
    const hasValidReviewedDate = /^\d{4}-\d{2}-\d{2}$/.test(reviewedOn);

    if (!approved || !hasValidReviewedDate) {
      violations.push(
        `${fileName} (status: "${meta.draftNotice || 'DRAFT, pending legal review'}", LEGAL_APPROVED=${meta.LEGAL_APPROVED || 'false'}, reviewedOn="${reviewedOn}")`,
      );
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `[LEGAL_GATE] Production build blocked. All legal documents must have LEGAL_APPROVED=true and a valid reviewedOn date (YYYY-MM-DD):\n- ${violations.join('\n- ')}`,
    );
  }
}

function toOrigin(rawUrl?: string): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function buildContentSecurityPolicy(siteUrl?: string): string {
  const apiOrigin = toOrigin(process.env.NEXT_PUBLIC_API_URL) ?? 'http://localhost:3000';
  const analyticsOrigin = toOrigin(process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT_URL);
  const marketingOrigin = toOrigin(process.env.NEXT_PUBLIC_MARKETING_SCRIPT_URL);
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    ...(analyticsOrigin ? [analyticsOrigin] : []),
    ...(marketingOrigin ? [marketingOrigin] : []),
    ...(turnstileEnabled ? ['https://challenges.cloudflare.com'] : []),
  ];

  const connectSrc = [
    "'self'",
    apiOrigin,
    ...(analyticsOrigin ? [analyticsOrigin] : []),
    ...(marketingOrigin ? [marketingOrigin] : []),
    ...(turnstileEnabled ? ['https://challenges.cloudflare.com'] : []),
  ];

  const frameSrc = turnstileEnabled ? ['https://challenges.cloudflare.com'] : ["'none'"];

  const directives = [
    "default-src 'self'",
    `script-src ${Array.from(new Set(scriptSrc)).join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${Array.from(new Set(connectSrc)).join(' ')}`,
    `frame-src ${frameSrc.join(' ')}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  if (siteUrl?.trim().startsWith('https://')) {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ');
}

export default function nextConfig(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) {
    assertLegalDocsApprovedForProductionBuild();
  }

  const isIndexableProduction =
    process.env.NEXT_PUBLIC_APP_ENV === 'production' &&
    process.env.SITE_IS_STAGING !== 'true' &&
    process.env.NEXT_PUBLIC_NOINDEX !== 'true';

  const cspHeader = buildContentSecurityPolicy(process.env.NEXT_PUBLIC_SITE_URL);

  const baseSecurityHeaders = [
    {
      key: 'Content-Security-Policy',
      value: cspHeader,
    },
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    },
    {
      key: 'X-Permitted-Cross-Domain-Policies',
      value: 'none',
    },
    {
      key: 'Cross-Origin-Opener-Policy',
      value: 'same-origin',
    },
  ];

  return {
    reactStrictMode: true,
    poweredByHeader: false,
    images: {
      formats: ['image/avif', 'image/webp'],
      deviceSizes: [640, 750, 828, 1080, 1200, 1920],
      imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
      remotePatterns: [
        {
          protocol: 'https',
          hostname: '**',
        },
      ],
    },
    async headers() {
      const cdnCacheHeaders = [
        {
          key: 'CDN-Cache-Control',
          value: 'public, s-maxage=30, stale-while-revalidate=300',
        },
        {
          key: 'Cache-Control',
          value: 'public, max-age=0, s-maxage=30, stale-while-revalidate=300',
        },
      ];

      const noStoreHeaders = [
        {
          key: 'CDN-Cache-Control',
          value: 'private, no-store',
        },
        {
          key: 'Cache-Control',
          value: 'private, no-cache, no-store, max-age=0, must-revalidate',
        },
      ];

      const headersList = isIndexableProduction
        ? baseSecurityHeaders
        : [
          ...baseSecurityHeaders,
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow',
          },
        ];
      return [
        {
          source: '/:path*',
          headers: headersList,
        },
        {
          source: '/((?!_next|api|preview|en/preview|bn/preview|signup/setup|signup/verify).*)',
          headers: cdnCacheHeaders,
        },
        {
          source: '/preview',
          headers: noStoreHeaders,
        },
        {
          source: '/:locale(en|bn)/preview',
          headers: noStoreHeaders,
        },
        {
          source: '/pricing',
          headers: cdnCacheHeaders,
        },
        {
          source: '/:locale(en|bn)/pricing',
          headers: cdnCacheHeaders,
        },
        {
          source: '/solutions/countries/:path*',
          headers: cdnCacheHeaders,
        },
        {
          source: '/:locale(en|bn)/solutions/countries/:path*',
          headers: cdnCacheHeaders,
        },
        {
          source: '/help',
          headers: cdnCacheHeaders,
        },
        {
          source: '/:locale(en|bn)/help',
          headers: cdnCacheHeaders,
        },
        {
          source: '/help/:path*',
          headers: cdnCacheHeaders,
        },
        {
          source: '/:locale(en|bn)/help/:path*',
          headers: cdnCacheHeaders,
        },
      ];
    },
    async redirects() {
      return [
        { source: '/updates', destination: '/changelog', permanent: true },
        { source: '/changelog/feed', destination: '/changelog/rss.xml', permanent: true },
        { source: '/blog/feed', destination: '/blog/rss.xml', permanent: true },
        { source: '/countries', destination: '/solutions/countries', permanent: true },
        { source: '/countries/:slug', destination: '/solutions/countries/:slug', permanent: true },
        { source: '/help-center', destination: '/help', permanent: true },
        { source: '/contact-sales', destination: '/contact?topic=sales', permanent: true },
        { source: '/start-trial', destination: '/signup', permanent: true },
        { source: '/book-demo', destination: '/demo', permanent: true },
        { source: '/privacy-policy', destination: '/privacy', permanent: true },
        { source: '/terms-of-service', destination: '/terms', permanent: true },
        { source: '/cookie-policy', destination: '/cookies', permanent: true },
      ];
    },
  };
}
