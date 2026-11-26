import assert from 'node:assert/strict';
import {
  evictCmsLastGoodCache,
  fetchCmsJsonWithFallback,
} from './cms-resilient-cache';
import {
  getBundledSystemPageDefault,
  isCmsSystemSlug,
  listBundledSystemSitemapPages,
} from './cms-system-defaults';

async function runCacheAndFallbackTests(): Promise<void> {
  evictCmsLastGoodCache({ clearAll: true });

  const originalFetch = globalThis.fetch;

  try {
    // 1. Live fetch succeeds -> saves into last-good cache
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: { hello: 'live-v1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    const liveRes = await fetchCmsJsonWithFallback<{ data: { hello: string } }>({
      cacheKey: 'test:cms:custom',
      url: 'http://cms.invalid/api/v1/public/content/pages/promo',
      revalidateSeconds: 60,
      tags: ['cms-pages'],
    });
    assert.equal(liveRes.ok, true);
    assert.equal(liveRes.source, 'live');
    assert.equal(liveRes.data?.data.hello, 'live-v1');

    // 2. Content API becomes unreachable -> serves last-good cached copy instead of failing
    globalThis.fetch = (async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:4000');
    }) as typeof fetch;

    const staleRes = await fetchCmsJsonWithFallback<{ data: { hello: string } }>({
      cacheKey: 'test:cms:custom',
      url: 'http://cms.invalid/api/v1/public/content/pages/promo',
      revalidateSeconds: 60,
      tags: ['cms-pages'],
    });
    assert.equal(staleRes.ok, true);
    assert.equal(staleRes.source, 'last_good_cache');
    assert.equal(staleRes.data?.data.hello, 'live-v1');

    // 3. Content API returns 503 -> still serves last-good cached copy
    globalThis.fetch = (async () =>
      new Response('Service Unavailable', { status: 503 })) as typeof fetch;

    const degradedRes = await fetchCmsJsonWithFallback<{ data: { hello: string } }>({
      cacheKey: 'test:cms:custom',
      url: 'http://cms.invalid/api/v1/public/content/pages/promo',
      revalidateSeconds: 60,
      tags: ['cms-pages'],
    });
    assert.equal(degradedRes.ok, true);
    assert.equal(degradedRes.source, 'last_good_cache');

    // 4. Authoritative 404 (unpublished or deleted page when API is healthy) evicts cache immediately
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    const notFoundRes = await fetchCmsJsonWithFallback<{ data: { hello: string } }>({
      cacheKey: 'test:cms:custom',
      url: 'http://cms.invalid/api/v1/public/content/pages/promo',
      revalidateSeconds: 60,
      tags: ['cms-pages'],
      treat404AsAuthoritative: true,
    });
    assert.equal(notFoundRes.ok, false);
    assert.equal(notFoundRes.source, 'not_found');
    assert.equal(notFoundRes.data, null);

    // 5. Cold cache + API down for Stage A.4 system pages builds bundled default content
    assert.equal(isCmsSystemSlug('home'), true);
    assert.equal(isCmsSystemSlug('features-payroll'), true);
    assert.equal(isCmsSystemSlug('pricing'), true);
    assert.equal(isCmsSystemSlug('terms'), true);
    assert.equal(isCmsSystemSlug('nonexistent-custom-promo'), false);

    const homeEn = getBundledSystemPageDefault('home', 'en');
    assert.ok(homeEn && homeEn.version.blocks.length >= 2);
    assert.equal(homeEn.kind, 'system');

    const pricingBn = getBundledSystemPageDefault('pricing', 'bn');
    assert.ok(pricingBn);
    assert.ok(
      pricingBn.version.blocks.some(
        (b) => b.type === 'dynamic_block' && b.props.widget === 'pricing_table',
      ),
    );

    const termsFallback = getBundledSystemPageDefault('terms', 'bn');
    assert.ok(termsFallback);
    assert.equal(termsFallback.fallbackUsed, true);

    const securityDefault = getBundledSystemPageDefault('security', 'en');
    assert.ok(securityDefault && securityDefault.version.blocks.length >= 2);
    const aboutDefault = getBundledSystemPageDefault('about', 'bn');
    assert.ok(aboutDefault && aboutDefault.version.blocks.length >= 2);

    const sitemapSystemDefaults = listBundledSystemSitemapPages();
    assert.ok(sitemapSystemDefaults.some((p) => p.slug === 'home'));
    assert.ok(!sitemapSystemDefaults.some((p) => p.slug === 'not-found'));

    console.log('All cms-resilient-cache and system fallback tests passed.');
  } finally {
    globalThis.fetch = originalFetch;
    evictCmsLastGoodCache({ clearAll: true });
  }
}

void runCacheAndFallbackTests();
