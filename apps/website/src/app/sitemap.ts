import type { MetadataRoute } from 'next';
import { apiClient } from '../api/client';
import { getApprovedCaseStudies } from '../data/case-studies';
import { DEFAULT_LOCALE, getDictionary } from '../i18n';
import { getBlogContentProvider } from '../lib/blog';
import { fetchOpenCareerListings } from '../lib/careers';
import { fetchAllPublishedCmsPages } from '../lib/cms-pages';
import { buildHreflangLanguages, getSiteUrl } from '../lib/seo';

type SitemapEntry = MetadataRoute.Sitemap[number];

function createSitemapEntry(
  baseUrl: string,
  path: string,
  lastModified: Date,
  changeFrequency: SitemapEntry['changeFrequency'],
  priority: number,
): SitemapEntry {
  const normalizedPath = path === '/' ? '/' : path.startsWith('/') ? path : `/${path}`;
  return {
    url: normalizedPath === '/' ? baseUrl : `${baseUrl}${normalizedPath}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: {
      languages: buildHreflangLanguages(normalizedPath),
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const now = new Date();
  const dict = getDictionary(DEFAULT_LOCALE);

  const featureUrls: MetadataRoute.Sitemap = [
    createSitemapEntry(baseUrl, '/features', now, 'weekly', 0.9),
    ...Object.keys(dict.features.pages).map((slug) =>
      createSitemapEntry(baseUrl, `/features/${slug}`, now, 'weekly', 0.8),
    ),
  ];

  const [activeCountries, kbCategories, kbArticles, blogResult, publishedCmsPages, openCareers] =
    await Promise.all([
      apiClient.countries.list({ revalidate: 60 }).catch(() => []),
      apiClient.knowledgeBase.listCategories({ revalidate: 60 }).catch(() => []),
      apiClient.knowledgeBase.listArticles(undefined, { revalidate: 60 }).catch(() => []),
      getBlogContentProvider().listPublishedPosts({ pageSize: 100 }),
      fetchAllPublishedCmsPages(),
      fetchOpenCareerListings(DEFAULT_LOCALE),
    ]);

  const blogUrls: MetadataRoute.Sitemap =
    blogResult.total > 0
      ? [
          createSitemapEntry(baseUrl, '/blog', now, 'weekly', 0.7),
          ...blogResult.items.map((post) =>
            createSitemapEntry(
              baseUrl,
              `/blog/${post.slug}`,
              new Date(post.updatedAt || post.publishedAt || now),
              'monthly',
              0.6,
            ),
          ),
        ]
      : [];

  const helpUrls: MetadataRoute.Sitemap = [
    createSitemapEntry(baseUrl, '/help', now, 'weekly', 0.8),
    ...kbCategories.map((cat) =>
      createSitemapEntry(baseUrl, `/help/categories/${cat.slug}`, now, 'weekly', 0.7),
    ),
    ...kbArticles.map((art) =>
      createSitemapEntry(
        baseUrl,
        `/help/articles/${art.slug}`,
        new Date(art.updatedAt || now),
        'weekly',
        0.7,
      ),
    ),
  ];
  const countryUrls: MetadataRoute.Sitemap = [
    createSitemapEntry(baseUrl, '/solutions', now, 'weekly', 0.9),
    ...Object.keys(dict.solutions.segments).map((slug) =>
      createSitemapEntry(baseUrl, `/solutions/${slug}`, now, 'weekly', 0.8),
    ),
    createSitemapEntry(baseUrl, '/solutions/countries', now, 'daily', 0.9),
    ...activeCountries.map((country) =>
      createSitemapEntry(baseUrl, `/solutions/countries/${country.slug}`, now, 'weekly', 0.8),
    ),
  ];

  const approvedCaseStudies = getApprovedCaseStudies();
  const customerUrls: MetadataRoute.Sitemap =
    approvedCaseStudies.length > 0
      ? [
          createSitemapEntry(baseUrl, '/customers', now, 'weekly', 0.7),
          ...approvedCaseStudies.map((study) =>
            createSitemapEntry(baseUrl, `/customers/${study.slug}`, now, 'monthly', 0.6),
          ),
        ]
      : [];

  const cmsPageUrls: MetadataRoute.Sitemap = publishedCmsPages.map((pg) =>
    createSitemapEntry(
      baseUrl,
      pg.canonicalPath || (pg.slug === 'home' ? '/' : `/${pg.slug}`),
      new Date(pg.updatedAt || pg.publishedAt || now),
      'weekly',
      pg.kind === 'system' ? 0.8 : 0.7,
    ),
  );

  const staticAndDynamicEntries: MetadataRoute.Sitemap = [
    createSitemapEntry(baseUrl, '/', now, 'daily', 1.0),
    ...featureUrls,
    ...countryUrls,
    ...customerUrls,
    ...helpUrls,
    ...blogUrls,
    createSitemapEntry(baseUrl, '/pricing', now, 'weekly', 0.8),
    createSitemapEntry(baseUrl, '/signup', now, 'weekly', 0.9),
    createSitemapEntry(baseUrl, '/demo', now, 'weekly', 0.8),
    createSitemapEntry(baseUrl, '/contact', now, 'weekly', 0.8),
    createSitemapEntry(baseUrl, '/login', now, 'monthly', 0.7),
    createSitemapEntry(baseUrl, '/changelog', now, 'weekly', 0.7),
    createSitemapEntry(baseUrl, '/status', now, 'always', 0.7),
    createSitemapEntry(baseUrl, '/integrations', now, 'weekly', 0.8),
    createSitemapEntry(baseUrl, '/security', now, 'monthly', 0.7),
    createSitemapEntry(baseUrl, '/terms', now, 'monthly', 0.5),
    createSitemapEntry(baseUrl, '/privacy', now, 'monthly', 0.5),
    createSitemapEntry(baseUrl, '/cookies', now, 'monthly', 0.5),
    createSitemapEntry(baseUrl, '/dpa', now, 'monthly', 0.5),
    createSitemapEntry(baseUrl, '/subprocessors', now, 'weekly', 0.6),
    createSitemapEntry(baseUrl, '/about', now, 'monthly', 0.6),
    createSitemapEntry(baseUrl, '/careers', now, 'weekly', 0.5),
    ...openCareers.map((role) =>
      createSitemapEntry(
        baseUrl,
        `/careers/${role.slug}`,
        new Date(role.publishedAt || now),
        'weekly',
        0.5,
      ),
    ),
  ];

  // Merge published CMS pages first so CMS updatedAt timestamps & metadata win without duplicate URLs
  const seenUrls = new Set<string>();
  const combined: MetadataRoute.Sitemap = [];
  for (const entry of [...cmsPageUrls, ...staticAndDynamicEntries]) {
    if (!seenUrls.has(entry.url)) {
      seenUrls.add(entry.url);
      combined.push(entry);
    }
  }
  return combined;
}
