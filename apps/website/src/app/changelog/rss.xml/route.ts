import { NextResponse, type NextRequest } from 'next/server';
import { env } from '../../../env';
import { getDictionary, localizePath, resolveWebsiteLocale } from '../../../i18n';
import { fetchPublishedChangelogEntries } from '../../../lib/changelog';
import { buildRssFeedXml } from '../../../lib/rss';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const locale = resolveWebsiteLocale(req.nextUrl.searchParams.get('locale') ?? undefined);
  const dict = getDictionary(locale).changelog;
  const entries = await fetchPublishedChangelogEntries(locale);

  const rssXml = buildRssFeedXml({
    title: `CMSN-HR — ${dict.metaTitle}`,
    link: `${baseUrl}${localizePath('/changelog', locale)}`,
    feedUrl: `${baseUrl}/changelog/rss.xml`,
    description: dict.metaDescription,
    language: locale,
    items: entries.map((entry) => {
      const link = `${baseUrl}${localizePath('/changelog', locale)}#${encodeURIComponent(entry.slug)}`;
      return {
        title: `[${entry.tag}] ${entry.title}`,
        link,
        guid: link,
        pubDate: `${entry.date}T00:00:00Z`,
        category: entry.tag,
        description: entry.summary || entry.title,
      };
    }),
  });

  return new NextResponse(rssXml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=10, stale-while-revalidate=30',
    },
  });
}
