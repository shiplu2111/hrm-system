import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight, Calendar, Clock, Tag, User } from 'lucide-react';
import { BlogShareLinks } from '../../../../components/blog/BlogShareLinks';
import { SafeHtmlContent } from '../../../../components/cms/SafeHtmlContent';
import { HelpBreadcrumbs } from '../../../../components/help/HelpBreadcrumbs';
import { Container, Section, TranslationFallbackNotice } from '../../../../components/marketing';

const BlogSubscribeBox = nextDynamic(() =>
  import('../../../../components/blog/BlogSubscribeBox').then((m) => m.BlogSubscribeBox),
);
import { env } from '../../../../env';
import { formatDate, formatNumber, getDictionary, interpolate, localizePath, resolveWebsiteLocale } from '../../../../i18n';
import { getBlogContentProvider } from '../../../../lib/blog';
import { buildPageMetadata } from '../../../../lib/seo';

export const revalidate = 10;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const post = await getBlogContentProvider(locale).getPostBySlug(slug);
  if (!post) {
    return buildPageMetadata({
      title: 'Post Not Found',
      description: 'Requested blog article could not be found.',
      path: `/blog/${slug}`,
      locale,
      noIndex: true,
    });
  }
  const baseMeta = buildPageMetadata({
    title: post.seoTitle || `${post.title} — Blog`,
    description: post.seoDescription || post.excerpt,
    path: `/blog/${slug}`,
    locale,
    eyebrow: post.category,
    type: 'article',
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt ?? post.publishedAt,
  });

  if (post.coverImage) {
    const coverImages = [
      {
        url: post.coverImage,
        width: 1200,
        height: 630,
        alt: post.coverAlt || post.title,
      },
    ];
    return {
      ...baseMeta,
      openGraph: {
        ...(baseMeta.openGraph ?? {}),
        images: coverImages,
      },
      twitter: {
        ...(baseMeta.twitter ?? {}),
        images: [post.coverImage],
      },
    };
  }
  return baseMeta;
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale).blog;
  const provider = getBlogContentProvider(locale);
  const post = await provider.getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const related = await provider.getRelatedPosts(post, 3);
  const canonicalUrl = `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}${localizePath(`/blog/${post.slug}`, locale)}`;

  return (
    <Section surface="tinted" rhythm="default" className="relative overflow-hidden">
      <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
      <Container>
        <article data-testid="blog-article-page" className="max-w-3xl mx-auto space-y-8">
          <HelpBreadcrumbs
            locale={locale}
            items={[
              { label: dict.breadcrumbs.home, href: '/' },
              { label: dict.breadcrumbs.blog, href: '/blog' },
              { label: post.category, href: `/blog?category=${post.categorySlug}` },
              { label: post.title },
            ]}
          />

          {locale === 'bn' && post.fallbackUsed && (
            <TranslationFallbackNotice
              locale={locale}
              reason="blog_article"
              basePath={`/blog/${post.slug}`}
            />
          )}

          <header className="space-y-4 border-b border-[rgb(var(--border-base))] pb-6">
            <Link
              href={localizePath(`/blog?category=${post.categorySlug}`, locale)}
              className="inline-flex items-center px-3 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200 text-xs font-semibold hover:bg-primary-100 transition-colors"
            >
              {post.category}
            </Link>

            <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {post.title}
            </h1>

            <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed">
              {post.excerpt}
            </p>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[rgb(var(--text-muted))] pt-1">
              <span className="inline-flex items-center gap-1.5 font-medium text-[rgb(var(--text-primary))]">
                {post.authorAvatarUrl ? (
                  <img
                    src={post.authorAvatarUrl}
                    alt={post.author}
                    width={24}
                    height={24}
                    className="w-6 h-6 rounded-full object-cover border border-[rgb(var(--border-base))]"
                  />
                ) : (
                  <User className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                )}
                {post.author}
                {post.authorRole ? ` (${post.authorRole})` : ''}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                {formatDate(post.publishedAt, locale)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                {interpolate(dict.readTimeLabel, {
                  minutes: formatNumber(post.readingTimeMinutes, locale),
                })}
              </span>
            </div>

            <BlogShareLinks url={canonicalUrl} title={post.title} />
          </header>

          {post.coverImage && (
            <figure className="overflow-hidden rounded-2xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]">
              <img
                src={post.coverImage}
                alt={post.coverAlt || post.title}
                width={1200}
                height={630}
                decoding="async"
                className="w-full h-auto block object-cover"
              />
            </figure>
          )}

          <div className="surface rounded-2xl border border-[rgb(var(--border-base))] p-6 sm:p-8 shadow-card">
            <SafeHtmlContent
              html={post.contentHtml}
              className="prose prose-slate dark:prose-invert max-w-none leading-relaxed prose-headings:font-bold prose-a:text-primary-600 prose-img:rounded-xl"
            />

            {post.tags.length > 0 && (
              <div className="mt-8 pt-5 border-t border-[rgb(var(--border-base))] flex flex-wrap items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-[rgb(var(--text-muted))]" aria-hidden="true" />
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-0.5 rounded-full bg-[rgb(var(--bg-muted))] text-xs font-medium text-[rgb(var(--text-secondary))]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {related.length > 0 && (
            <section
              aria-labelledby="blog-related-heading"
              data-testid="blog-related-posts"
              className="space-y-4 pt-2"
            >
              <h2
                id="blog-related-heading"
                className="text-lg sm:text-xl font-bold text-[rgb(var(--text-primary))]"
              >
                {dict.relatedHeading}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {related.map((rel) => (
                  <Link
                    key={rel.slug}
                    href={localizePath(`/blog/${rel.slug}`, locale)}
                    className="group surface rounded-xl border border-[rgb(var(--border-base))] p-4 space-y-2 hover:border-primary-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <span className="text-[11px] font-semibold text-primary-600">
                      {rel.category}
                    </span>
                    <h3 className="text-sm font-bold text-[rgb(var(--text-primary))] group-hover:text-primary-600 transition-colors">
                      {rel.title}
                    </h3>
                    <p className="text-xs text-[rgb(var(--text-secondary))] line-clamp-2">
                      {rel.excerpt}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 pt-1">
                      {dict.readMoreLabel}
                      <ArrowRight className="w-3 h-3" aria-hidden="true" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <BlogSubscribeBox channel="blog" />
        </article>
      </Container>
    </Section>
  );
}
