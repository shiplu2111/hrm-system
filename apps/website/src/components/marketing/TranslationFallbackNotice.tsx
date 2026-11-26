import Link from 'next/link';
import { Languages } from 'lucide-react';
import {
  getFallbackNoticeCopy,
  localizePath,
  type FallbackReason,
  type WebsiteLocale,
} from '../../i18n';

interface TranslationFallbackNoticeProps {
  locale: WebsiteLocale;
  reason: FallbackReason;
  basePath: string;
  className?: string;
}

/**
 * Visible notice shown when a localized route falls back to English content
 * (e.g. legal drafts, Help Center KB articles, blog posts, or status/changelog entries).
 */
export function TranslationFallbackNotice({
  locale,
  reason,
  basePath,
  className = '',
}: TranslationFallbackNoticeProps) {
  const copy = getFallbackNoticeCopy(locale, reason);
  if (!copy) {
    return null;
  }

  return (
    <div
      role="note"
      data-testid="translation-fallback-notice"
      className={`rounded-xl border border-warning-200 bg-warning-50 px-4 py-3.5 text-xs sm:text-sm text-warning-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`.trim()}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <Languages className="w-4 h-4 text-warning-700 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-0.5 min-w-0">
          <p className="font-semibold text-warning-950">{copy.title}</p>
          <p className="text-xs text-warning-800 leading-relaxed">{copy.body}</p>
        </div>
      </div>
      <Link
        href={localizePath(basePath, 'en')}
        hrefLang="en"
        className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-warning-300 bg-white text-xs font-semibold text-warning-900 hover:bg-warning-100/60 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {copy.switchToEnglishLabel}
      </Link>
    </div>
  );
}
