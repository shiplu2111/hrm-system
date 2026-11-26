import { generateSlugFromTitle } from './custom-page-utils';

export function estimateBlogReadingTimeMinutes(
  htmlEn?: string | null,
  htmlBn?: string | null,
): number {
  const countWords = (html?: string | null): number => {
    if (!html || !html.trim()) return 0;
    const stripped = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .trim();
    if (!stripped) return 0;
    return stripped.split(/\s+/).filter(Boolean).length;
  };
  const words = Math.max(countWords(htmlEn), countWords(htmlBn));
  return Math.max(1, Math.min(120, Math.round(words / 200)));
}

export function generateBlogSlugFromTitle(title: string): string {
  return generateSlugFromTitle(title).slice(0, 140);
}

export function parseBlogTagsInput(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 20);
}

export function getBlogSeoLengthHint(
  value: string,
  kind: 'title' | 'description',
): { count: number; status: 'empty' | 'ok' | 'short' | 'long'; hint: string } {
  const count = (value || '').trim().length;
  if (kind === 'title') {
    if (count === 0) return { count, status: 'empty', hint: 'Recommended 35–60 chars' };
    if (count < 25) return { count, status: 'short', hint: `${count}/60 chars (a bit short)` };
    if (count > 65) return { count, status: 'long', hint: `${count}/60 chars (may truncate in SERPs)` };
    return { count, status: 'ok', hint: `${count}/60 chars (optimal)` };
  }
  if (count === 0) return { count, status: 'empty', hint: 'Recommended 120–160 chars' };
  if (count < 70) return { count, status: 'short', hint: `${count}/160 chars (a bit short)` };
  if (count > 165) return { count, status: 'long', hint: `${count}/160 chars (may truncate)` };
  return { count, status: 'ok', hint: `${count}/160 chars (optimal)` };
}

export function collectBlogPostWarnings(input: {
  titleEn: string;
  slug: string;
  excerptEn: string;
  bodyHtmlEn: string;
  categoryId: string;
  authorId: string;
  coverMediaId?: string | null;
  coverAltEn?: string | null;
  isBnTranslated?: boolean;
  titleBn?: string | null;
  excerptBn?: string | null;
  bodyHtmlBn?: string | null;
}): string[] {
  const warnings: string[] = [];
  if (!input.titleEn.trim()) warnings.push('English title is required.');
  if (!input.slug.trim()) warnings.push('URL slug is required.');
  if (!input.excerptEn.trim()) warnings.push('English excerpt is required.');
  if (!input.bodyHtmlEn.replace(/<[^>]+>/g, '').trim()) {
    warnings.push('English post content cannot be empty.');
  }
  if (!input.categoryId) warnings.push('Select a blog category.');
  if (!input.authorId) warnings.push('Select an author.');
  if (input.coverMediaId && !(input.coverAltEn || '').trim()) {
    warnings.push('Cover image is attached — add English alt text for accessibility.');
  }
  if (input.isBnTranslated) {
    if (!(input.titleBn || '').trim()) warnings.push('Bengali title is missing.');
    if (!(input.excerptBn || '').trim()) warnings.push('Bengali excerpt is missing.');
    if (!(input.bodyHtmlBn || '').replace(/<[^>]+>/g, '').trim()) {
      warnings.push('Bengali body content is missing.');
    }
  }
  return warnings;
}
