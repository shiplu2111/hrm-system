import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { CmsBlockRenderer } from '@/components/cms/CmsBlockRenderer';
import { TranslationFallbackNotice } from '@/components/marketing';
import { DEFAULT_LOCALE, localizePath, resolveWebsiteLocale } from '@/i18n';
import { resolveCmsAssetUrl } from '@/lib/blog/cms-provider';
import { resolveDynamicBlockData } from '@/lib/cms-dynamic-data';
import { resolveFaqBlocksForPage } from '@/lib/cms-faqs';
import { fetchPublishedCmsPageBySlug } from '@/lib/cms-pages';
import { lookupCmsRedirect } from '@/lib/cms-redirects';
import { fetchPublicSiteSettingsBundle } from '@/lib/cms-site-settings';
import { buildPageMetadata } from '@/lib/seo';

export const revalidate = 60;

function joinCatchAllSlug(segments?: string[]): string {
  if (!segments || segments.length === 0) return '';
  return segments
    .map((s) => decodeURIComponent(s).trim())
    .filter(Boolean)
    .join('/');
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug?: string[] }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const slugPath = joinCatchAllSlug(slug);
  if (!slugPath) return {};

  const [page, siteSettings] = await Promise.all([
    fetchPublishedCmsPageBySlug(slugPath, locale),
    fetchPublicSiteSettingsBundle(),
  ]);

  if (!page) {
    return buildPageMetadata({
      title: 'Page Not Found',
      description: 'Requested CMS page could not be found.',
      path: `/${slugPath}`,
      locale,
      noIndex: true,
    });
  }

  const canonicalPath = page.version.canonicalPath || `/${slugPath}`;
  const ogImageUrl =
    resolveCmsAssetUrl(page.version.ogImageUrl) ||
    resolveCmsAssetUrl(siteSettings.seo.defaultOgImageUrl) ||
    undefined;

  return buildPageMetadata({
    title: page.version.seoTitle || page.version.title,
    description:
      page.version.seoDescription ||
      (locale === 'bn'
        ? siteSettings.seo.defaultDescription.bn || siteSettings.seo.defaultDescription.en
        : siteSettings.seo.defaultDescription.en) ||
      page.version.title,
    path: canonicalPath,
    locale,
    ogImageUrl,
    noIndex: Boolean(page.version.noIndex || page.status !== 'published'),
  });
}

export default async function CmsCustomCatchAllPage({
  params,
}: {
  params: Promise<{ locale: string; slug?: string[] }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const slugPath = joinCatchAllSlug(slug);
  if (!slugPath) {
    notFound();
  }

  const page = await fetchPublishedCmsPageBySlug(slugPath, locale);

  if (!page) {
    const candidatePath = `/${slugPath}`;
    const rule = await lookupCmsRedirect(candidatePath);
    if (rule) {
      const target =
        rule.destinationUrl.startsWith('/') && locale !== DEFAULT_LOCALE
          ? localizePath(rule.destinationUrl, locale)
          : rule.destinationUrl;
      if (
        rule.redirectType === 'permanent_301' ||
        rule.redirectType === 'permanent_308'
      ) {
        permanentRedirect(target);
      }
      redirect(target);
    }
    notFound();
  }

  const [faqByBlockId, dynamicData] = await Promise.all([
    resolveFaqBlocksForPage(page.version.blocks, page.slug, page.resolvedLocale),
    resolveDynamicBlockData(page.version.blocks),
  ]);

  return (
    <div className="min-h-[60vh]">
      {page.fallbackUsed && (
        <TranslationFallbackNotice
          locale={locale}
          reason="untranslated_page"
          basePath={page.version.canonicalPath || `/${slugPath}`}
        />
      )}
      <CmsBlockRenderer
        blocks={page.version.blocks}
        locale={locale}
        faqByBlockId={faqByBlockId}
        plans={dynamicData.plans}
        countries={dynamicData.countries}
        emitFaqStructuredData={page.status === 'published' && !page.version.noIndex}
      />
    </div>
  );
}
