import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { apiClient } from '../../../../../api/client';
import { HelpArticleTemplate } from '../../../../../components/help/HelpArticleTemplate';
import { Container, Section } from '../../../../../components/marketing';
import { resolveWebsiteLocale } from '../../../../../i18n';
import { buildPageMetadata } from '../../../../../lib/seo';

export const revalidate = 10;
export const dynamicParams = true;

export async function generateStaticParams() {
  const articles = await apiClient.knowledgeBase.listArticles(undefined, { revalidate: 10 }).catch(() => []);
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const article = await apiClient.knowledgeBase.getArticle(slug, { revalidate: 10 });
  if (!article) {
    return buildPageMetadata({
      title: 'Help Article Not Found',
      description: 'Requested Help Center article could not be found.',
      path: `/help/articles/${slug}`,
      locale,
      noIndex: true,
    });
  }
  return buildPageMetadata({
    title: `${article.title} — Help Center`,
    description: article.summary,
    path: `/help/articles/${slug}`,
    locale,
    eyebrow: article.categoryName || 'Help Center',
    type: 'article',
    publishedTime: article.publishedAt ?? undefined,
    modifiedTime: article.updatedAt,
  });
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const article = await apiClient.knowledgeBase.getArticle(slug, { revalidate: 10 });

  if (!article) {
    notFound();
  }

  return (
    <Section surface="tinted" rhythm="default" className="relative overflow-hidden">
      <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
      <Container>
        <HelpArticleTemplate article={article} locale={locale} />
      </Container>
    </Section>
  );
}
