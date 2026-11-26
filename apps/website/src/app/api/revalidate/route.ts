import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { evictCmsLastGoodCache } from '@/lib/cms-resilient-cache';

const ALL_SCOPES = [
  'pricing',
  'countries',
  'help',
  'cms-pages',
  'cms-menus',
  'cms-settings',
  'cms-posts',
  'cms-changelog',
  'cms-careers',
  'cms-faqs',
  'cms-redirects',
] as const;

type ConcreteScope = (typeof ALL_SCOPES)[number];

const SCOPE_TAGS: Record<ConcreteScope, readonly string[]> = {
  pricing: ['public-plans', 'public-currencies', 'public-signup-config'],
  countries: ['public-countries'],
  help: ['public-kb'],
  'cms-pages': ['cms-pages'],
  'cms-menus': ['cms-menus'],
  'cms-settings': ['cms-settings'],
  'cms-posts': ['cms-posts'],
  'cms-changelog': ['cms-changelog'],
  'cms-careers': ['cms-careers'],
  'cms-faqs': ['cms-faqs'],
  'cms-redirects': ['cms-redirects'],
};

const SCOPE_PATHS: Record<ConcreteScope, readonly string[]> = {
  pricing: ['/en/pricing', '/bn/pricing', '/pricing', '/bn/signup', '/en/signup', '/signup'],
  countries: ['/en/solutions/countries', '/bn/solutions/countries', '/solutions/countries'],
  help: ['/en/help', '/bn/help', '/help'],
  'cms-pages': ['/sitemap.xml', '/en', '/bn', '/'],
  'cms-menus': ['/en', '/bn', '/'],
  'cms-settings': ['/en', '/bn', '/'],
  'cms-posts': ['/blog', '/en/blog', '/bn/blog', '/blog/rss.xml', '/sitemap.xml'],
  'cms-changelog': ['/changelog', '/en/changelog', '/bn/changelog', '/changelog/rss.xml'],
  'cms-careers': ['/careers', '/en/careers', '/bn/careers', '/sitemap.xml'],
  'cms-faqs': ['/en', '/bn', '/', '/en/pricing', '/bn/pricing', '/pricing'],
  'cms-redirects': [],
};

const SCOPE_CACHE_PREFIXES: Record<ConcreteScope, readonly string[]> = {
  pricing: [],
  countries: [],
  help: [],
  'cms-pages': ['cms:page:', 'cms:pages:'],
  'cms-menus': ['cms:menus:'],
  'cms-settings': ['cms:settings:'],
  'cms-posts': ['cms:posts:', 'cms:post:'],
  'cms-changelog': ['cms:changelog:'],
  'cms-careers': ['cms:careers:', 'cms:career:'],
  'cms-faqs': ['cms:faqs:'],
  'cms-redirects': [],
};

const requestSchema = z.object({
  scopes: z
    .array(z.enum([...ALL_SCOPES, 'all']))
    .optional()
    .default(['all']),
  slugs: z.array(z.string().max(180)).max(50).optional(),
  tags: z.array(z.string().max(180)).max(50).optional(),
  paths: z.array(z.string().max(240)).max(50).optional(),
});

function verifyRevalidateSecret(provided: string | null): boolean {
  const configured = process.env.REVALIDATE_SECRET?.trim();
  if (!configured || !provided) return false;
  const a = Buffer.from(provided.trim(), 'utf8');
  const b = Buffer.from(configured, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function expandLocalizedSlugPaths(rawSlug: string): string[] {
  const clean = rawSlug.trim().replace(/^\/+|\/+$/g, '');
  if (!clean || clean === 'home') {
    return ['/', '/en', '/bn'];
  }
  return [`/${clean}`, `/en/${clean}`, `/bn/${clean}`];
}

/**
 * Secret-authenticated on-demand ISR/CDN cache invalidation endpoint
 * (called after CMS page publish/unpublish/delete, menu/settings/content edits,
 * or platform pricing/country/KB edits).
 */
export async function POST(request: Request) {
  if (!process.env.REVALIDATE_SECRET?.trim()) {
    return NextResponse.json(
      { error: { code: 'REVALIDATE_UNCONFIGURED', message: 'Revalidation secret is not configured.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const secretHeader =
    request.headers.get('x-revalidate-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    null;

  if (!verifyRevalidateSecret(secretHeader)) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid revalidation token.' } },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const rawBody = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_PAYLOAD', message: 'Invalid revalidation payload.' } },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const expandedScopes = new Set<ConcreteScope>();
  for (const s of parsed.data.scopes) {
    if (s === 'all') {
      for (const scope of ALL_SCOPES) {
        expandedScopes.add(scope);
      }
    } else {
      expandedScopes.add(s);
    }
  }

  const invalidatedTags = new Set<string>();
  const invalidatedPaths = new Set<string>();
  const cachePrefixes = new Set<string>();

  for (const scope of expandedScopes) {
    for (const tag of SCOPE_TAGS[scope]) {
      revalidateTag(tag, { expire: 0 });
      invalidatedTags.add(tag);
    }
    for (const path of SCOPE_PATHS[scope]) {
      revalidatePath(path, 'page');
      invalidatedPaths.add(path);
    }
    for (const prefix of SCOPE_CACHE_PREFIXES[scope]) {
      cachePrefixes.add(prefix);
    }
  }

  if (parsed.data.tags) {
    for (const rawTag of parsed.data.tags) {
      const tag = rawTag.trim();
      if (tag) {
        revalidateTag(tag, { expire: 0 });
        invalidatedTags.add(tag);
      }
    }
  }

  if (parsed.data.slugs) {
    for (const rawSlug of parsed.data.slugs) {
      const clean = rawSlug.trim().replace(/^\/+|\/+$/g, '').toLowerCase();
      if (!clean) continue;
      for (const tag of [`cms-page:${clean}`, `cms-post:${clean}`, `cms-career:${clean}`]) {
        revalidateTag(tag, { expire: 0 });
        invalidatedTags.add(tag);
      }
      for (const p of expandLocalizedSlugPaths(clean)) {
        revalidatePath(p, 'page');
        invalidatedPaths.add(p);
      }
      cachePrefixes.add(`cms:page:en:${clean}`);
      cachePrefixes.add(`cms:page:bn:${clean}`);
      cachePrefixes.add(`cms:post:en:${clean}`);
      cachePrefixes.add(`cms:post:bn:${clean}`);
      cachePrefixes.add(`cms:career:en:${clean}`);
      cachePrefixes.add(`cms:career:bn:${clean}`);
    }
  }

  if (parsed.data.paths) {
    for (const p of parsed.data.paths) {
      if (p.startsWith('/') && !p.startsWith('//')) {
        revalidatePath(p, 'page');
        invalidatedPaths.add(p);
        const stripped = p.replace(/^\/(en|bn)(?=\/|$)/, '').replace(/^\/+|\/+$/g, '');
        if (stripped) {
          for (const locPath of expandLocalizedSlugPaths(stripped)) {
            revalidatePath(locPath, 'page');
            invalidatedPaths.add(locPath);
          }
        }
      }
    }
  }

  if (expandedScopes.has('cms-pages') || parsed.data.slugs?.length) {
    revalidatePath('/[locale]/[...slug]', 'page');
    invalidatedPaths.add('/[locale]/[...slug]');
  }

  evictCmsLastGoodCache({
    clearAll: parsed.data.scopes.includes('all'),
    prefixes: Array.from(cachePrefixes),
  });

  revalidatePath('/', 'layout');

  return NextResponse.json(
    {
      data: {
        revalidated: true,
        tags: Array.from(invalidatedTags),
        paths: Array.from(invalidatedPaths),
        timestamp: new Date().toISOString(),
      },
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
