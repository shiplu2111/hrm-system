import { NextResponse, type NextRequest } from 'next/server';
import { env } from '../../../env';
import { getDictionary, localizePath, resolveWebsiteLocale } from '../../../i18n';
import { getBlogContentProvider } from '../../../lib/blog';
import { buildRssFeedXml } from '../../../lib/rss';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const locale = resolveWebsiteLocale(req.nextUrl.searchParams.get('locale') ?? undefined);
  const dict = getDictionary(locale).blog;
  const result = await getBlogContentProvider(locale).listPublishedPosts({ pageSize: 50 });

  const rssXml = buildRssFeedXml({
    title: `CMSN-HR — ${dict.metaTitle}`,
    link: `${baseUrl}${localizePath('/blog', locale)}`,
    feedUrl: `${baseUrl}/blog/rss.xml`,
    description: dict.metaDescription,
    language: locale,
    items: result.items.map((post) => {
      const link = `${baseUrl}${localizePath(`/blog/${encodeURIComponent(post.slug)}`, locale)}`;
      return {
        title: post.title,
        link,
        guid: link,
        pubDate: post.publishedAt,
        category: post.category,
        description: post.excerpt,
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
