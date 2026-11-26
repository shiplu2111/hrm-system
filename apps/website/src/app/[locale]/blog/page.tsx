import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, BookOpen, Calendar, ChevronLeft, ChevronRight, Clock, Rss } from 'lucide-react';
import { BlogSubscribeBox } from '../../../components/blog/BlogSubscribeBox';
import { ButtonLink, Container, Section } from '../../../components/marketing';
import {
  formatDate,
  formatNumber,
  getDictionary,
  interpolate,
  localizePath,
  resolveWebsiteLocale,
  type WebsiteLocale,
} from '../../../i18n';
import { getBlogContentProvider } from '../../../lib/blog';
import { buildPageMetadata } from '../../../lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const hasPosts = await getBlogContentProvider(locale).hasPublishedPosts();
  return buildPageMetadata({
    title: dict.blog.metaTitle,
    description: dict.blog.metaDescription,
    path: '/blog',
    locale,
    eyebrow: dict.blog.eyebrow,
    noIndex: !hasPosts,
    alternatesTypes: {
      'application/rss+xml': '/blog/rss.xml',
    },
  });
}

function buildBlogPageUrl(
  locale: WebsiteLocale,
  categorySlug?: string,
  page?: number,
): string {
  const params = new URLSearchParams();
  if (categorySlug && categorySlug !== 'all') params.set('category', categorySlug);
  if (page && page > 1) params.set('page', String(page));
  const qs = params.toString();
  return localizePath(qs ? `/blog?${qs}` : '/blog', locale);
}

export default async function BlogIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const copy = dict.blog;
  const sp = await searchParams;
  const activeCategory = sp.category?.trim().toLowerCase() || 'all';
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10) || 1);

  const result = await getBlogContentProvider(locale).listPublishedPosts({
    categorySlug: activeCategory === 'all' ? undefined : activeCategory,
    page: currentPage,
    pageSize: 6,
  });

  return (
    <>
      <Section surface="tinted" rhythm="default" className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
        <Container>
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface text-xs font-semibold text-[rgb(var(--text-secondary))]">
              <BookOpen className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              <span>{copy.eyebrow}</span>
            </span>

            <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {copy.title}
            </h1>

            <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed">
              {copy.subtitle}
            </p>

            <div className="pt-1">
              <a
                href="/blog/rss.xml"
                data-testid="blog-rss-link"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[rgb(var(--border-base))] surface text-xs font-semibold text-[rgb(var(--text-primary))] hover:border-primary-400 transition-colors"
              >
                <Rss className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                <span>{copy.rssLabel}</span>
              </a>
            </div>
          </div>
        </Container>
      </Section>

      <Section rhythm="default">
        <Container className="space-y-10">
          {/* Categories Filter Bar */}
          {result.categories.length > 0 && (
            <div
              data-testid="blog-category-filters"
              className="flex flex-wrap items-center gap-2"
            >
              <Link
                href={buildBlogPageUrl(locale, 'all', 1)}
                className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                  activeCategory === 'all'
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : 'border-[rgb(var(--border-base))] surface text-[rgb(var(--text-secondary))] hover:border-primary-400'
                }`}
              >
                {copy.allCategoriesLabel}
              </Link>
              {result.categories.map((cat) => {
                const active = activeCategory === cat.slug;
                return (
                  <Link
                    key={cat.slug}
                    href={buildBlogPageUrl(locale, cat.slug, 1)}
                    className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                      active
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-[rgb(var(--border-base))] surface text-[rgb(var(--text-secondary))] hover:border-primary-400'
                    }`}
                  >
                    {cat.name} ({formatNumber(cat.postCount, locale)})
                  </Link>
                );
              })}
            </div>
          )}

          {/* Articles Grid OR Honest Empty State */}
          {result.items.length === 0 ? (
            <div
              data-testid="blog-empty-state"
              className="max-w-2xl mx-auto surface rounded-2xl border border-[rgb(var(--border-base))] p-8 sm:p-10 text-center space-y-4 shadow-card"
            >
              <h2 className="text-xl font-bold text-[rgb(var(--text-primary))]">{copy.emptyTitle}</h2>
              <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                {copy.emptyBody}
              </p>
              <div className="pt-1">
                <ButtonLink href="/help" variant="outline" size="md">
                  {copy.emptyBrowseHelpCta}
                </ButtonLink>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div
                data-testid="blog-posts-grid"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {result.items.map((post) => (
                  <Link
                    key={post.slug}
                    href={localizePath(`/blog/${post.slug}`, locale)}
                    data-testid={`blog-card-${post.slug}`}
                    className="group flex flex-col justify-between surface rounded-2xl border border-[rgb(var(--border-base))] overflow-hidden p-6 space-y-4 hover:border-primary-400 transition-all shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <div className="space-y-3">
                      {post.coverImage && (
                        <div className="-mx-6 -mt-6 mb-4 overflow-hidden border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]">
                          <img
                            src={post.coverImage}
                            alt={post.coverAlt || post.title}
                            width={800}
                            height={420}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-44 object-cover group-hover:scale-[1.02] transition-transform duration-300"
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200 font-semibold">
                          {post.category}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[rgb(var(--text-muted))]">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          {interpolate(copy.readTimeLabel, {
                            minutes: formatNumber(post.readingTimeMinutes, locale),
                          })}
                        </span>
                      </div>

                      <h2 className="text-lg font-bold text-[rgb(var(--text-primary))] group-hover:text-primary-600 transition-colors leading-snug">
                        {post.title}
                      </h2>

                      <p className="text-sm text-[rgb(var(--text-secondary))] line-clamp-3 leading-relaxed">
                        {post.excerpt}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[rgb(var(--border-base))] flex items-center justify-between gap-2 text-xs text-[rgb(var(--text-muted))]">
                      <span>{post.author}</span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                        {formatDate(post.publishedAt, locale)}
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600">
                      <span>{copy.readMoreLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {result.totalPages > 1 && (
                <nav
                  aria-label="Blog pagination"
                  data-testid="blog-pagination"
                  className="flex items-center justify-between border-t border-[rgb(var(--border-base))] pt-6 text-xs sm:text-sm"
                >
                  <span className="text-[rgb(var(--text-muted))]">
                    {interpolate(copy.paginationStatus, {
                      page: formatNumber(result.page, locale),
                      totalPages: formatNumber(result.totalPages, locale),
                    })}
                  </span>

                  <div className="flex items-center gap-2">
                    {result.page > 1 ? (
                      <Link
                        href={buildBlogPageUrl(locale, activeCategory, result.page - 1)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[rgb(var(--border-base))] surface font-semibold text-[rgb(var(--text-primary))] hover:border-primary-400"
                      >
                        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                        {copy.paginationPrevious}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[rgb(var(--border-base))] text-[rgb(var(--text-muted))] opacity-50">
                        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                        {copy.paginationPrevious}
                      </span>
                    )}

                    {result.page < result.totalPages ? (
                      <Link
                        href={buildBlogPageUrl(locale, activeCategory, result.page + 1)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[rgb(var(--border-base))] surface font-semibold text-[rgb(var(--text-primary))] hover:border-primary-400"
                      >
                        {copy.paginationNext}
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[rgb(var(--border-base))] text-[rgb(var(--text-muted))] opacity-50">
                        {copy.paginationNext}
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                </nav>
              )}
            </div>
          )}

          {/* Consented Email Subscription Box */}
          <div className="max-w-2xl mx-auto pt-4">
            <BlogSubscribeBox channel="blog" />
          </div>
        </Container>
      </Section>
    </>
  );
}
