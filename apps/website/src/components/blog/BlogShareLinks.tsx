'use client';

import { useState } from 'react';
import { Check, Link2, Mail, Share2 } from 'lucide-react';
import { useWebsiteI18n } from '../../i18n/client';

export function BlogShareLinks({ url, title }: { url: string; title: string }) {
  const { t } = useWebsiteI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failures in restricted contexts
    }
  };

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div
      data-testid="blog-share-links"
      className="flex flex-wrap items-center gap-2.5 pt-2"
      aria-label={t('blog.share.heading')}
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--text-muted))] mr-1">
        <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
        {t('blog.share.heading')}:
      </span>

      <button
        type="button"
        onClick={() => void handleCopy()}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[rgb(var(--border-base))] surface text-xs font-semibold text-[rgb(var(--text-primary))] hover:border-primary-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-success-600" aria-hidden="true" />
            <span>{t('blog.share.copied')}</span>
          </>
        ) : (
          <>
            <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('blog.share.copyLink')}</span>
          </>
        )}
      </button>

      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center px-3 py-1.5 rounded-lg border border-[rgb(var(--border-base))] surface text-xs font-semibold text-[rgb(var(--text-secondary))] hover:text-primary-600 hover:border-primary-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {t('blog.share.shareLinkedIn')}
      </a>

      <a
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center px-3 py-1.5 rounded-lg border border-[rgb(var(--border-base))] surface text-xs font-semibold text-[rgb(var(--text-secondary))] hover:text-primary-600 hover:border-primary-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {t('blog.share.shareX')}
      </a>

      <a
        href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[rgb(var(--border-base))] surface text-xs font-semibold text-[rgb(var(--text-secondary))] hover:text-primary-600 hover:border-primary-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Mail className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{t('blog.share.shareEmail')}</span>
      </a>
    </div>
  );
}
