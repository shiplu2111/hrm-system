import type { Metadata } from 'next';
import { Eye } from 'lucide-react';
import { CmsBlockRenderer } from '@/components/cms/CmsBlockRenderer';
import { Container, TranslationFallbackNotice } from '@/components/marketing';
import { resolveWebsiteLocale } from '@/i18n';
import { resolveDynamicBlockData } from '@/lib/cms-dynamic-data';
import { resolveFaqBlocksForPage } from '@/lib/cms-faqs';
import { fetchCmsPreviewByToken } from '@/lib/cms-pages';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Draft Preview | CMSN-HR',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default async function CmsPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const resolvedSearchParams = await searchParams;
  const locale = resolveWebsiteLocale(rawLocale);
  const token = resolvedSearchParams.token?.trim() ?? '';
  const data = token ? await fetchCmsPreviewByToken(token, locale) : null;

  if (!data) {
    return (
      <Container className="py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <Eye className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-[rgb(var(--text-primary))]">
          Preview link invalid or expired
        </h1>
        <p className="text-sm text-[rgb(var(--text-muted))] max-w-md mx-auto">
          Request a fresh signed draft preview URL from Platform Admin -&gt; Website CMS and reload
          this page. Draft previews are never indexed by search engines.
        </p>
      </Container>
    );
  }

  const [faqByBlockId, dynamicData] = await Promise.all([
    resolveFaqBlocksForPage(data.version.blocks, data.slug, data.resolvedLocale),
    resolveDynamicBlockData(data.version.blocks),
  ]);

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))]">
      {/* Signed Preview Banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-amber-950">
        <Container className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-700" aria-hidden="true" />
            <span>
              <strong>CMS Draft Preview</strong> · Page: <code>/{data.slug}</code> · Version{' '}
              <code>v{data.version.versionNumber}</code> ({data.version.locale.toUpperCase()})
            </span>
          </div>
          {data.previewExpiresAt && (
            <span className="text-amber-800">
              Expires {new Date(data.previewExpiresAt).toLocaleString()}
            </span>
          )}
        </Container>
      </div>

      {data.fallbackUsed && (
        <TranslationFallbackNotice
          locale={locale}
          reason="untranslated_page"
          basePath={data.version.canonicalPath || `/${data.slug}`}
        />
      )}

      <CmsBlockRenderer
        blocks={data.version.blocks}
        locale={locale}
        faqByBlockId={faqByBlockId}
        plans={dynamicData.plans}
        countries={dynamicData.countries}
        emitFaqStructuredData={false}
      />
    </div>
  );
}
