import 'server-only';

import type { CmsBlockNode, CmsPublicFaqDto } from '@hrm/shared-types';
import { getDictionary } from '../i18n';
import { DEFAULT_LOCALE, type WebsiteLocale } from '../i18n/types';
import type { FaqItem } from '../components/marketing/FaqAccordion';
import { fetchCmsJsonWithFallback } from './cms-resilient-cache';

function getServerApiBase(): string {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000'
  ).replace(/\/+$/, '');
}

export function stripHtmlToPlainText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchPublicCmsFaqs(options: {
  locale?: WebsiteLocale;
  category?: string;
  pageSlug?: string;
  ids?: string[];
  limit?: number;
} = {}): Promise<{ ok: boolean; items: FaqItem[] }> {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const params = new URLSearchParams();
  params.set('locale', locale);
  if (options.ids && options.ids.length > 0) {
    params.set('ids', options.ids.join(','));
  } else {
    if (options.category) params.set('category', options.category);
    if (options.pageSlug) params.set('pageSlug', options.pageSlug);
  }
  if (options.limit) params.set('limit', String(options.limit));

  const queryString = params.toString();
  const res = await fetchCmsJsonWithFallback<{ data?: CmsPublicFaqDto[] }>({
    cacheKey: `cms:faqs:${queryString}`,
    url: `${getServerApiBase()}/api/v1/public/content/faqs?${queryString}`,
    revalidateSeconds: 30,
    tags: ['cms-faqs'],
    timeoutMs: 2500,
    treat404AsAuthoritative: false,
  });

  if (res.ok && Array.isArray(res.data?.data)) {
    return {
      ok: true,
      items: res.data.data.map((f) => {
        const useBn = locale === 'bn' && f.resolvedLocale === 'bn';
        const question = (useBn && f.questionBn ? f.questionBn : f.questionEn).trim();
        const rawAnswer = (useBn && f.answerBn ? f.answerBn : f.answerEn).trim();
        const isHtml = /<[a-z][\s\S]*>/i.test(rawAnswer);
        return {
          id: f.id,
          question,
          answer: stripHtmlToPlainText(rawAnswer),
          ...(isHtml ? { answerHtml: rawAnswer } : {}),
        };
      }),
    };
  }

  // Fallback to bundled Stage A.4 FAQ items for known system pages if API & cache are empty
  if (options.pageSlug === 'home' || options.pageSlug === 'pricing') {
    const dict = getDictionary(locale);
    const bundled =
      options.pageSlug === 'home' ? dict.home.faq.items : dict.pricing.faq.items;
    return {
      ok: false,
      items: bundled.slice(0, options.limit ?? 10).map((item) => ({
        id: item.id,
        question: item.question,
        answer: item.answer,
      })),
    };
  }

  return { ok: false, items: [] };
}

export async function resolveFaqBlocksForPage(
  blocks: readonly CmsBlockNode[],
  fallbackPageSlug: string,
  locale: WebsiteLocale = DEFAULT_LOCALE,
): Promise<Map<string, FaqItem[]>> {
  const faqBlocks: Array<Extract<CmsBlockNode, { type: 'faq_list' }>> = [];
  for (const blk of blocks) {
    if (blk.type === 'faq_list') {
      faqBlocks.push(blk);
    } else if (blk.type === 'columns') {
      for (const col of blk.props.columns) {
        for (const child of col.blocks) {
          if (child.type === 'faq_list') {
            faqBlocks.push(child);
          }
        }
      }
    }
  }

  const resolved = new Map<string, FaqItem[]>();
  if (faqBlocks.length === 0) return resolved;

  await Promise.all(
    faqBlocks.map(async (blk) => {
      const hasIds = Array.isArray(blk.props.faqIds) && blk.props.faqIds.length > 0;
      const result = await fetchPublicCmsFaqs({
        locale,
        ids: hasIds ? blk.props.faqIds : undefined,
        category: !hasIds ? blk.props.category : undefined,
        pageSlug:
          !hasIds && !blk.props.category
            ? blk.props.pageSlug || fallbackPageSlug
            : blk.props.pageSlug,
        limit: blk.props.limit ?? 10,
      });
      resolved.set(blk.id, result.items);
    }),
  );

  return resolved;
}
