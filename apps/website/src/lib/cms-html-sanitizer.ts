/**
 * Server- and client-safe HTML sanitizer for CMS rich-text rendering in `@hrm/website`.
 *
 * Strips dangerous executable elements, event-handler attributes, inline styles
 * containing expression/url payloads, and unsafe URI schemes (`javascript:`,
 * `vbscript:`, `data:`) so unsanitised HTML is never injected into the DOM.
 */

const DANGEROUS_WITH_BODY_REGEX =
  /<\s*(script|iframe|object|embed|form|style|svg|math|noscript|template|textarea|select|option|button|input)\b[^<>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;

const DANGEROUS_VOID_OR_UNCLOSED_REGEX =
  /<\s*(script|iframe|object|embed|form|style|svg|math|meta|link|base|noscript|template|input|button)\b[^<>]*\/?>/gi;

const HTML_COMMENT_REGEX = /<!--[\s\S]*?-->/g;

const ALLOWED_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'col',
  'colgroup',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'ins',
  'kbd',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  'q',
  's',
  'samp',
  'section',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'time',
  'tr',
  'u',
  'ul',
  'var',
]);

const GLOBAL_ALLOWED_ATTRS = new Set(['class', 'dir', 'id', 'lang', 'title']);

const TAG_ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'name', 'rel', 'target']),
  blockquote: new Set(['cite']),
  col: new Set(['span']),
  colgroup: new Set(['span']),
  details: new Set(['open']),
  img: new Set(['alt', 'decoding', 'height', 'loading', 'sizes', 'src', 'srcset', 'width']),
  ol: new Set(['reversed', 'start', 'type']),
  td: new Set(['colspan', 'headers', 'rowspan']),
  th: new Set(['abbr', 'colspan', 'headers', 'rowspan', 'scope']),
  time: new Set(['datetime']),
};

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function decodeHtmlEntitiesMinimal(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);?/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, '')
    .replace(/&newline;/gi, '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");
}

export function isSafeCmsHref(rawValue: string): boolean {
  const decoded = decodeHtmlEntitiesMinimal(rawValue)
    .replace(/[\u0000-\u001f\u007f\s]+/g, '')
    .trim();
  if (!decoded) return false;
  if (decoded.startsWith('#') || (decoded.startsWith('/') && !decoded.startsWith('//'))) {
    return true;
  }
  const colonIdx = decoded.indexOf(':');
  if (colonIdx === -1) {
    // Relative path without scheme (e.g. "pricing" or "docs/guide")
    return !decoded.startsWith('//');
  }
  const protocol = decoded.slice(0, colonIdx + 1).toLowerCase();
  return SAFE_URL_PROTOCOLS.has(protocol);
}

export function isSafeCmsImageSrc(rawValue: string): boolean {
  const decoded = decodeHtmlEntitiesMinimal(rawValue)
    .replace(/[\u0000-\u001f\u007f\s]+/g, '')
    .trim();
  if (!decoded) return false;
  if (decoded.startsWith('/') && !decoded.startsWith('//')) {
    return true;
  }
  try {
    const parsed = new URL(decoded);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function escapeAttrValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeSrcset(rawValue: string): string {
  const entries = rawValue
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [url, descriptor] = part.split(/\s+/, 2);
      if (!url || !isSafeCmsImageSrc(url)) return null;
      return descriptor ? `${url} ${descriptor}` : url;
    })
    .filter((entry): entry is string => Boolean(entry));
  return entries.join(', ');
}

function sanitizeTagAttributes(tagName: string, rawAttrs: string): string {
  const allowedForTag = TAG_ALLOWED_ATTRS[tagName] ?? new Set<string>();
  const kept = new Map<string, string | null>();
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(rawAttrs)) !== null) {
    const attrName = match[1].toLowerCase();
    const rawVal = match[2] ?? match[3] ?? match[4] ?? null;

    if (attrName.startsWith('on') || attrName === 'srcdoc' || attrName === 'formaction' || attrName === 'style') {
      continue;
    }

    if (!GLOBAL_ALLOWED_ATTRS.has(attrName) && !allowedForTag.has(attrName)) {
      continue;
    }

    if (attrName === 'href' || attrName === 'cite') {
      if (!rawVal || !isSafeCmsHref(rawVal)) continue;
      kept.set(attrName, rawVal.trim());
      continue;
    }

    if (attrName === 'src') {
      if (!rawVal || !isSafeCmsImageSrc(rawVal)) continue;
      kept.set(attrName, rawVal.trim());
      continue;
    }

    if (attrName === 'srcset') {
      if (!rawVal) continue;
      const safeSrcset = sanitizeSrcset(rawVal);
      if (safeSrcset) kept.set(attrName, safeSrcset);
      continue;
    }

    if (attrName === 'target') {
      const normalized = rawVal?.trim();
      if (normalized === '_blank' || normalized === '_self') {
        kept.set('target', normalized);
      }
      continue;
    }

    kept.set(attrName, rawVal);
  }

  if (tagName === 'a' && kept.get('target') === '_blank') {
    const relTokens = new Set(
      (kept.get('rel') ?? '')
        .split(/\s+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    );
    relTokens.add('noopener');
    relTokens.add('noreferrer');
    kept.set('rel', Array.from(relTokens).join(' '));
  }

  const serialized: string[] = [];
  for (const [name, val] of kept.entries()) {
    if (val === null) {
      serialized.push(name);
    } else {
      serialized.push(`${name}="${escapeAttrValue(val)}"`);
    }
  }
  return serialized.length > 0 ? ` ${serialized.join(' ')}` : '';
}

const SELF_CLOSING_ALLOWED = new Set(['br', 'col', 'hr', 'img']);

/**
 * Sanitizes untrusted or CMS-authored HTML strings prior to DOM injection.
 */
export function sanitizeCmsRenderHtml(rawHtml?: string | null): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  let cleaned = rawHtml.replace(HTML_COMMENT_REGEX, '');

  // Iteratively strip dangerous element blocks until fixed point
  for (let pass = 0; pass < 4; pass++) {
    const next = cleaned
      .replace(DANGEROUS_WITH_BODY_REGEX, '')
      .replace(DANGEROUS_VOID_OR_UNCLOSED_REGEX, '');
    if (next === cleaned) break;
    cleaned = next;
  }

  return cleaned.replace(
    /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)\b([^<>]*)>/g,
    (_full, slash: string, tag: string, attrs: string) => {
      const lowerTag = tag.toLowerCase();
      if (!ALLOWED_TAGS.has(lowerTag)) {
        return '';
      }
      if (slash) {
        return SELF_CLOSING_ALLOWED.has(lowerTag) ? '' : `</${lowerTag}>`;
      }
      const safeAttrs = sanitizeTagAttributes(lowerTag, attrs ?? '');
      if (SELF_CLOSING_ALLOWED.has(lowerTag)) {
        return `<${lowerTag}${safeAttrs} />`;
      }
      return `<${lowerTag}${safeAttrs}>`;
    },
  );
}
