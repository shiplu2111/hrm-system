import {
  CMS_SAFE_URL_ERROR,
  isSafeCmsImageUrl,
  isSafeCmsLinkUrl,
} from '@hrm/shared-types';

const ALLOWED_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'b',
  'strong',
  'i',
  'em',
  'u',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'blockquote',
  'code',
  'pre',
]);

const VOID_TAGS = new Set(['br', 'hr', 'img']);

const DANGEROUS_CONTENT_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'math',
  'object',
  'embed',
  'applet',
  'iframe',
  'title',
  'meta',
  'link',
  'xml',
  'head',
]);

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseAttributes(rawAttrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z0-9:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(rawAttrStr)) !== null) {
    const key = match[1].toLowerCase();
    const val = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[key] = val;
  }
  return attrs;
}

function decodeBasicEntities(input: string): string {
  return input
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

/**
 * Validates and normalizes link URLs entered in the editor link dialog.
 * Allows `/path`, `#anchor`, `https://`, `http://`, and `mailto:` URLs,
 * rejecting `javascript:`, `data:`, `vbscript:`, control chars, and protocol-relative `//`.
 */
export function validateCmsLinkInput(rawUrl: string): {
  valid: boolean;
  normalizedUrl: string;
  error?: string;
} {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, normalizedUrl: '', error: 'URL is required.' };
  }

  if (!isSafeCmsLinkUrl(trimmed)) {
    return {
      valid: false,
      normalizedUrl: trimmed,
      error: CMS_SAFE_URL_ERROR,
    };
  }

  return { valid: true, normalizedUrl: trimmed };
}

/**
 * Converts plain clipboard text into escaped paragraph HTML blocks
 * for the "Paste as plain text" toggle or plain-text-only paste mode.
 */
export function plainTextToSafeHtml(rawText: string): string {
  if (!rawText) return '';
  const normalized = rawText.replace(/\r\n?/g, '\n');
  const paragraphs = normalized.split(/\n{2,}/);
  return paragraphs
    .map((para) => {
      const lines = para.split('\n').map((line) => escapeHtmlText(line));
      return `<p>${lines.join('<br>')}</p>`;
    })
    .join('');
}

/**
 * Strips Microsoft Word XML/MSO markup, Google Docs inline styles, web page wrapper junk,
 * scripts/event handlers, and disallowed attributes before TipTap ingests pasted HTML or
 * before raw HTML edits are synced back to the visual editor.
 * Server-side sanitization in `sanitizeCmsRichTextHtml` remains authoritative on every save.
 */
export function stripWordAndWebPasteJunk(rawHtml: string): string {
  if (typeof rawHtml !== 'string' || !rawHtml.trim()) {
    return '';
  }

  let html = rawHtml;

  // 1. Strip Word conditional comments, fragment markers, and processing instructions
  html = html.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '');
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<\?[\s\S]*?\?>/g, '');

  // 2. Remove Microsoft Office XML namespace tags completely (<o:p>, <w:...>, <m:...>, <v:...>)
  html = html.replace(/<\/?(?:o|w|m|v|st1):[a-z0-9_-]*[^>]*>/gi, '');

  // 3. Remove dangerous / styling / metadata block elements and their inner contents
  for (const tag of DANGEROUS_CONTENT_TAGS) {
    const blockRe = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    html = html.replace(blockRe, '');
    const selfRe = new RegExp(`<\\/?${tag}\\b[^>]*\\/?>`, 'gi');
    html = html.replace(selfRe, '');
  }

  // 4. Normalize Word "MsoListParagraph" fake bullet paragraphs into clean list items when clear
  html = html.replace(
    /<p\b[^>]*class\s*=\s*["'][^"']*MsoListParagraph[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi,
    (_m, inner: string) => {
      const cleanedInner = inner
        .replace(/^(?:\s|&nbsp;|<span[^>]*>)*[·•o\-\u2022]+(?:\s|&nbsp;|<\/span>)*/i, '')
        .trim();
      return cleanedInner ? `<ul><li>${cleanedInner}</li></ul>` : '';
    },
  );

  // Merge adjacent single-item <ul> lists created by consecutive MsoListParagraph lines
  html = html.replace(/<\/ul>\s*<ul>/gi, '');

  // 5. Convert deprecated presentational wrappers (<b>/<i> stay valid or normalize clean tags)
  // and filter every remaining HTML tag against our semantic allowlist
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)(\s+[^>]*)?\/?>/g;
  html = html.replace(tagPattern, (fullMatch, rawName: string, rawAttrs = '') => {
    const isClosing = fullMatch.startsWith('</');
    const tag = rawName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      return '';
    }

    if (isClosing) {
      return VOID_TAGS.has(tag) ? '' : `</${tag}>`;
    }

    const attrs = parseAttributes(rawAttrs);

    if (tag === 'a') {
      const hrefRaw = decodeBasicEntities(attrs.href || '').trim();
      if (!hrefRaw || !isSafeCmsLinkUrl(hrefRaw)) {
        return '<a>';
      }
      const nextAttrs: string[] = [
        `href="${escapeHtmlAttr(hrefRaw)}"`,
        'rel="noopener noreferrer"',
      ];
      if (attrs.target === '_blank') {
        nextAttrs.push('target="_blank"');
      }
      if (attrs.title?.trim()) {
        nextAttrs.push(`title="${escapeHtmlAttr(decodeBasicEntities(attrs.title).trim().slice(0, 200))}"`);
      }
      return `<a ${nextAttrs.join(' ')}>`;
    }

    if (tag === 'img') {
      const src = decodeBasicEntities(attrs.src || '').trim();
      const alt = decodeBasicEntities(attrs.alt || '').trim();
      if (!src || !alt || !isSafeCmsImageUrl(src)) {
        return '';
      }
      const nextAttrs: string[] = [
        `src="${escapeHtmlAttr(src)}"`,
        `alt="${escapeHtmlAttr(alt.slice(0, 300))}"`,
      ];
      if (attrs.title?.trim()) {
        nextAttrs.push(`title="${escapeHtmlAttr(decodeBasicEntities(attrs.title).trim().slice(0, 200))}"`);
      }
      if (attrs.width && /^\d{1,4}$/.test(attrs.width.trim())) {
        nextAttrs.push(`width="${attrs.width.trim()}"`);
      }
      if (attrs.height && /^\d{1,4}$/.test(attrs.height.trim())) {
        nextAttrs.push(`height="${attrs.height.trim()}"`);
      }
      if (
        attrs['data-media-id'] &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          attrs['data-media-id'].trim(),
        )
      ) {
        nextAttrs.push(`data-media-id="${attrs['data-media-id'].trim()}"`);
      }
      return `<img ${nextAttrs.join(' ')}>`;
    }

    if (tag === 'th' || tag === 'td') {
      const nextAttrs: string[] = [];
      if (tag === 'th' && (attrs.scope === 'col' || attrs.scope === 'row')) {
        nextAttrs.push(`scope="${attrs.scope}"`);
      }
      if (attrs.colspan && /^\d{1,2}$/.test(attrs.colspan.trim())) {
        nextAttrs.push(`colspan="${attrs.colspan.trim()}"`);
      }
      if (attrs.rowspan && /^\d{1,2}$/.test(attrs.rowspan.trim())) {
        nextAttrs.push(`rowspan="${attrs.rowspan.trim()}"`);
      }
      return nextAttrs.length > 0 ? `<${tag} ${nextAttrs.join(' ')}>` : `<${tag}>`;
    }

    if (tag === 'blockquote' && attrs.cite?.trim()) {
      const cite = decodeBasicEntities(attrs.cite).trim();
      if (isSafeCmsLinkUrl(cite)) {
        return `<blockquote cite="${escapeHtmlAttr(cite)}">`;
      }
    }

    if (tag === 'code' && attrs.class?.trim()) {
      const langClass = attrs.class
        .split(/\s+/)
        .find((c) => /^language-[a-z0-9-]+$/i.test(c));
      if (langClass) {
        return `<code class="${escapeHtmlAttr(langClass)}">`;
      }
    }

    // All other semantic tags strip inline style/class/id/event-handler attributes
    return `<${tag}>`;
  });

  // Unwrap <a> anchors that lost their unsafe href (keep inner text cleanly)
  html = html.replace(/<a>([\s\S]*?)<\/a>/gi, '$1');

  // Collapse repeated &nbsp; / empty whitespace runs that Word leaves behind
  html = html.replace(/(?:&nbsp;){2,}/gi, ' ');
  html = html.replace(/<p>\s*(?:&nbsp;)?\s*<\/p>/gi, '');

  return html.trim();
}

/**
 * Counts words and user-perceived grapheme clusters (safe for Bengali conjuncts/matras).
 */
export function countWordsAndChars(
  text: string,
  locale: 'en' | 'bn' = 'en',
): { words: number; characters: number } {
  const normalized = (text || '').replace(/\u200B/g, '');
  const trimmed = normalized.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;

  let characters = 0;
  const intlWithSegmenter = Intl as unknown as {
    Segmenter?: new (
      locale?: string,
      options?: { granularity?: 'grapheme' | 'word' | 'sentence' },
    ) => { segment(input: string): Iterable<unknown> };
  };
  if (typeof Intl !== 'undefined' && typeof intlWithSegmenter.Segmenter === 'function') {
    const segmenter = new intlWithSegmenter.Segmenter(locale === 'bn' ? 'bn' : 'en', {
      granularity: 'grapheme',
    });
    for (const _ of segmenter.segment(normalized)) {
      characters++;
    }
  } else {
    characters = Array.from(normalized).length;
  }

  return { words, characters };
}
