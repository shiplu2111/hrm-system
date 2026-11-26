import { sanitizeCmsRenderHtml } from '@/lib/cms-html-sanitizer';

export interface SafeHtmlContentProps {
  html?: string | null;
  className?: string;
  as?: 'div' | 'section' | 'article';
}

/**
 * Safely sanitizes and renders CMS-authored HTML strings without injecting raw
 * unsanitised scripts, inline event handlers, or unsafe URI schemes.
 */
export function SafeHtmlContent({
  html,
  className,
  as: Tag = 'div',
}: SafeHtmlContentProps) {
  const sanitized = sanitizeCmsRenderHtml(html);
  if (!sanitized) return null;

  return (
    <Tag
      className={className}
      // eslint-disable-next-line react/no-danger -- output is passed through sanitizeCmsRenderHtml allowlist sanitizer
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
