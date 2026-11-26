import { DEFAULT_LOCALE, type WebsiteLocale } from '../../i18n/types';
import { CmsBlogContentProvider } from './cms-provider';
import type { BlogContentProvider } from './types';

export type {
  BlogCategorySummary,
  BlogContentProvider,
  BlogListQuery,
  BlogListResult,
  BlogPostDetail,
  BlogPostStatus,
  BlogPostSummary,
} from './types';

/**
 * Returns a CMS-backed BlogContentProvider for the requested locale.
 */
export function getBlogContentProvider(
  locale: WebsiteLocale = DEFAULT_LOCALE,
): BlogContentProvider {
  return new CmsBlogContentProvider(locale);
}
