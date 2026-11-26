import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  PublicKbArticleDetail,
  PublicKbArticleSummary,
  PublicKbCategory,
  PublicKbCategoryDetail,
  PublicKbFeedbackResponse,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';

/**
 * Enforces strict visibility for the unauthenticated marketing website Help Center:
 * Only articles marked published AND public, with NO per-country or per-plan restriction,
 * are permitted on public routes.
 */
export function isPublicHelpCenterArticle(article: {
  status?: string | null;
  published?: boolean | null;
  isPublic?: boolean | null;
  targetCountries?: string[] | null;
  targetPlans?: string[] | null;
}): boolean {
  const isPublished = article.published === true && article.status === 'published';
  if (!isPublished || article.isPublic === false) {
    return false;
  }

  const countries = article.targetCountries ?? [];
  const hasCountryRestriction =
    countries.length > 0 && !countries.every((c) => c.trim().toUpperCase() === 'ALL');
  if (hasCountryRestriction) {
    return false;
  }

  const plans = article.targetPlans ?? [];
  const hasPlanRestriction =
    plans.length > 0 && !plans.every((p) => p.trim().toLowerCase() === 'all');
  if (hasPlanRestriction) {
    return false;
  }

  return true;
}

function estimateReadingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function tokenizeWords(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (Math.abs(m - n) > 3) return Math.abs(m - n);

  const prev = Array.from({ length: n + 1 }, (_, i) => i);
  const curr = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function bigramDiceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) ?? 0) + 1);
  }

  let matches = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    const count = bigramsA.get(bg) ?? 0;
    if (count > 0) {
      matches += 1;
      bigramsA.set(bg, count - 1);
    }
  }

  return (2 * matches) / (a.length - 1 + (b.length - 1));
}

function scoreFieldMatch(queryToken: string, fieldWords: string[], weight: number): number {
  let best = 0;
  for (const word of fieldWords) {
    if (word === queryToken) {
      return weight;
    }
    if (word.startsWith(queryToken) || queryToken.startsWith(word)) {
      best = Math.max(best, weight * 0.8);
      continue;
    }
    const maxDist = queryToken.length >= 6 ? 2 : 1;
    const dist = levenshteinDistance(queryToken, word);
    if (dist <= maxDist) {
      best = Math.max(best, weight * (dist === 1 ? 0.65 : 0.5));
      continue;
    }
    const dice = bigramDiceSimilarity(queryToken, word);
    if (dice >= 0.52) {
      best = Math.max(best, weight * dice * 0.6);
    }
  }
  return best;
}

export function scoreArticleForQuery(
  rawQuery: string,
  article: {
    title: string;
    summary: string;
    body: string;
    tags: string[];
    category?: { name?: string | null } | null;
  },
): number {
  const trimmed = rawQuery.trim().toLowerCase();
  if (!trimmed) return 1;

  const queryTokens = tokenizeWords(trimmed);
  if (queryTokens.length === 0) return 1;

  const titleLower = article.title.toLowerCase();
  const summaryLower = article.summary.toLowerCase();
  const titleWords = tokenizeWords(article.title);
  const summaryWords = tokenizeWords(article.summary);
  const tagWords = article.tags.flatMap((t) => tokenizeWords(t));
  const categoryWords = tokenizeWords(article.category?.name ?? '');
  const bodyWords = tokenizeWords(article.body);

  let totalScore = 0;

  if (titleLower.includes(trimmed)) totalScore += 140;
  if (summaryLower.includes(trimmed)) totalScore += 75;

  let matchedTokenCount = 0;
  for (const qToken of queryTokens) {
    const tokenScore = Math.max(
      scoreFieldMatch(qToken, titleWords, 100),
      scoreFieldMatch(qToken, tagWords, 85),
      scoreFieldMatch(qToken, summaryWords, 65),
      scoreFieldMatch(qToken, categoryWords, 50),
      scoreFieldMatch(qToken, bodyWords, 35),
    );
    if (tokenScore > 0) {
      matchedTokenCount += 1;
      totalScore += tokenScore;
    }
  }

  // Require at least half of query tokens to have a fuzzy or exact match
  const minTokensRequired = Math.max(1, Math.ceil(queryTokens.length * 0.5));
  return matchedTokenCount >= minTokensRequired ? totalScore : 0;
}

@Injectable()
export class PublicKbService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return (this.prisma as any).unscoped || this.prisma;
  }

  private toSummary(a: any): PublicKbArticleSummary {
    return {
      id: a.id,
      categoryId: a.categoryId,
      categoryName: a.category?.name ?? 'General',
      categorySlug: a.category?.slug ?? 'general',
      title: a.title,
      slug: a.slug,
      summary: a.summary,
      tags: a.tags ?? [],
      authorName: a.authorName ?? null,
      viewCount: a.viewCount ?? 0,
      helpfulYesCount: a.helpfulYesCount ?? 0,
      helpfulNoCount: a.helpfulNoCount ?? 0,
      readingTimeMinutes: estimateReadingMinutes(a.body ?? ''),
      publishedAt: a.publishedAt ? new Date(a.publishedAt).toISOString() : null,
      updatedAt: new Date(a.updatedAt).toISOString(),
    };
  }

  async listPublicCategories(): Promise<PublicKbCategory[]> {
    const categories = await this.db.globalKbCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        articles: {
          where: {
            published: true,
            status: 'published',
            isPublic: true,
          },
          select: {
            status: true,
            published: true,
            isPublic: true,
            targetCountries: true,
            targetPlans: true,
          },
        },
      },
    });

    return categories
      .map((c: any) => {
        const publicArticles = (c.articles ?? []).filter(isPublicHelpCenterArticle);
        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          icon: c.icon,
          sortOrder: c.sortOrder,
          articleCount: publicArticles.length,
        };
      })
      .filter((c: PublicKbCategory) => c.articleCount > 0);
  }

  async getPublicCategoryBySlug(slug: string): Promise<PublicKbCategoryDetail> {
    const normalized = slug.trim().toLowerCase();
    const category = await this.db.globalKbCategory.findUnique({
      where: { slug: normalized },
      include: {
        articles: {
          where: {
            published: true,
            status: 'published',
            isPublic: true,
          },
          orderBy: [{ viewCount: 'desc' }, { updatedAt: 'desc' }],
          include: {
            category: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Help category "${normalized}" not found.`);
    }

    const publicArticles = (category.articles ?? []).filter(isPublicHelpCenterArticle);
    if (publicArticles.length === 0) {
      throw new NotFoundException(`Help category "${normalized}" has no public articles.`);
    }

    return {
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        icon: category.icon,
        sortOrder: category.sortOrder,
        articleCount: publicArticles.length,
      },
      articles: publicArticles.map((a: any) => this.toSummary(a)),
    };
  }

  async listPublicArticles(params?: {
    search?: string;
    categorySlug?: string;
  }): Promise<PublicKbArticleSummary[]> {
    const where: any = {
      published: true,
      status: 'published',
      isPublic: true,
    };

    if (params?.categorySlug?.trim()) {
      where.category = {
        slug: params.categorySlug.trim().toLowerCase(),
      };
    }

    const rows = await this.db.globalKbArticle.findMany({
      where,
      orderBy: [{ viewCount: 'desc' }, { updatedAt: 'desc' }],
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    const publicRows = rows.filter(isPublicHelpCenterArticle);

    const searchTerm = params?.search?.trim();
    if (!searchTerm) {
      return publicRows.map((a: any) => this.toSummary(a));
    }

    const scored = publicRows
      .map((a: any) => ({
        article: a,
        score: scoreArticleForQuery(searchTerm, a),
      }))
      .filter((entry: { score: number }) => entry.score > 0)
      .sort((a: { score: number; article: any }, b: { score: number; article: any }) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.article.viewCount ?? 0) - (a.article.viewCount ?? 0);
      });

    return scored.map((entry: { article: any }) => this.toSummary(entry.article));
  }

  async getPublicArticleBySlug(slug: string): Promise<PublicKbArticleDetail> {
    const normalized = slug.trim().toLowerCase();
    const article = await this.db.globalKbArticle.findUnique({
      where: { slug: normalized },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!article || !isPublicHelpCenterArticle(article)) {
      throw new NotFoundException(`Help Center article "${normalized}" not found.`);
    }

    // Fetch public candidates for related articles (same category first, then overlapping tags)
    const candidateRows = await this.db.globalKbArticle.findMany({
      where: {
        published: true,
        status: 'published',
        isPublic: true,
        id: { not: article.id },
      },
      orderBy: [{ viewCount: 'desc' }],
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
      take: 30,
    });

    const articleTags = new Set<string>((article.tags ?? []).map((t: string) => t.toLowerCase()));
    const related = candidateRows
      .filter(isPublicHelpCenterArticle)
      .map((candidate: any) => {
        const sameCategoryBonus = candidate.categoryId === article.categoryId ? 100 : 0;
        const sharedTagCount = (candidate.tags ?? []).filter((t: string) =>
          articleTags.has(t.toLowerCase()),
        ).length;
        return {
          candidate,
          relevance: sameCategoryBonus + sharedTagCount * 20,
        };
      })
      .sort(
        (a: { relevance: number; candidate: any }, b: { relevance: number; candidate: any }) =>
          b.relevance - a.relevance || (b.candidate.viewCount ?? 0) - (a.candidate.viewCount ?? 0),
      )
      .slice(0, 3)
      .map((entry: { candidate: any }) => this.toSummary(entry.candidate));

    return {
      ...this.toSummary(article),
      body: article.body,
      relatedArticles: related,
    };
  }

  async incrementPublicView(slug: string): Promise<{ articleId: string; viewCount: number }> {
    const normalized = slug.trim().toLowerCase();
    const article = await this.db.globalKbArticle.findUnique({
      where: { slug: normalized },
      select: {
        id: true,
        status: true,
        published: true,
        isPublic: true,
        targetCountries: true,
        targetPlans: true,
      },
    });

    if (!article || !isPublicHelpCenterArticle(article)) {
      throw new NotFoundException(`Help Center article "${normalized}" not found.`);
    }

    const updated = await this.db.globalKbArticle.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    });

    return {
      articleId: article.id,
      viewCount: updated.viewCount,
    };
  }

  async recordFeedback(slug: string, helpful: boolean): Promise<PublicKbFeedbackResponse> {
    const normalized = slug.trim().toLowerCase();
    const article = await this.db.globalKbArticle.findUnique({
      where: { slug: normalized },
      select: {
        id: true,
        slug: true,
        status: true,
        published: true,
        isPublic: true,
        targetCountries: true,
        targetPlans: true,
      },
    });

    if (!article || !isPublicHelpCenterArticle(article)) {
      throw new NotFoundException(`Help Center article "${normalized}" not found.`);
    }

    const updated = await this.db.globalKbArticle.update({
      where: { id: article.id },
      data: helpful
        ? { helpfulYesCount: { increment: 1 } }
        : { helpfulNoCount: { increment: 1 } },
      select: {
        id: true,
        slug: true,
        helpfulYesCount: true,
        helpfulNoCount: true,
      },
    });

    return {
      articleId: updated.id,
      slug: updated.slug,
      helpfulYesCount: updated.helpfulYesCount,
      helpfulNoCount: updated.helpfulNoCount,
    };
  }
}
