import { PayloadTooLargeException } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import {
  CMS_MAX_RICH_TEXT_BYTES,
  isSafeCmsImageUrl,
  isSafeCmsLinkUrl,
  normalizeAllowlistedVideoEmbedUrl,
} from '@hrm/shared-types';

const ALLOWED_RICH_TEXT_TAGS = [
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
  'iframe',
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_RICH_TEXT_TAGS,
  disallowedTagsMode: 'discard',
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'svg', 'math', 'object', 'embed'],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'data-media-id', 'loading'],
    th: ['scope', 'colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    blockquote: ['cite'],
    code: ['class'],
    iframe: ['src', 'title', 'width', 'height', 'allowfullscreen', 'loading'],
  },
  allowedClasses: {
    code: [/^language-[a-z0-9-]+$/i],
  },
  allowedSchemes: ['https', 'http', 'mailto'],
  allowedSchemesByTag: {
    a: ['https', 'http', 'mailto'],
    img: ['https'],
    blockquote: ['https', 'http'],
    iframe: ['https'],
  },
  allowProtocolRelative: false,
  enforceHtmlBoundary: true,
  transformTags: {
    a: (_tagName, attribs) => {
      const nextAttribs: Record<string, string> = {};
      const href = attribs.href?.trim();
      if (href && isSafeCmsLinkUrl(href)) {
        nextAttribs.href = href;
        nextAttribs.rel = 'noopener noreferrer';
        if (attribs.target === '_blank') {
          nextAttribs.target = '_blank';
        }
      }
      if (attribs.title?.trim()) {
        nextAttribs.title = attribs.title.trim().slice(0, 200);
      }
      return { tagName: 'a', attribs: nextAttribs };
    },
    img: (_tagName, attribs) => {
      const src = attribs.src?.trim() ?? '';
      const alt = attribs.alt?.trim() ?? '';
      if (!src || !alt || !isSafeCmsImageUrl(src)) {
        return { tagName: 'img', attribs: {} };
      }
      const nextAttribs: Record<string, string> = {
        src,
        alt: alt.slice(0, 300),
        loading: 'lazy',
      };
      if (attribs.title?.trim()) {
        nextAttribs.title = attribs.title.trim().slice(0, 200);
      }
      if (attribs.width && /^\d{1,4}$/.test(attribs.width)) {
        nextAttribs.width = attribs.width;
      }
      if (attribs.height && /^\d{1,4}$/.test(attribs.height)) {
        nextAttribs.height = attribs.height;
      }
      if (
        attribs['data-media-id'] &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          attribs['data-media-id'].trim(),
        )
      ) {
        nextAttribs['data-media-id'] = attribs['data-media-id'].trim();
      }
      return { tagName: 'img', attribs: nextAttribs };
    },
    blockquote: (_tagName, attribs) => {
      const nextAttribs: Record<string, string> = {};
      if (attribs.cite && isSafeCmsLinkUrl(attribs.cite)) {
        nextAttribs.cite = attribs.cite.trim();
      }
      return { tagName: 'blockquote', attribs: nextAttribs };
    },
    iframe: (_tagName, attribs) => {
      const normalized = normalizeAllowlistedVideoEmbedUrl(attribs.src ?? '');
      if (!normalized) {
        return { tagName: 'iframe', attribs: {} };
      }
      const safeTitle = (attribs.title || `${normalized.provider} embedded video`).trim().slice(0, 200);
      const safeAttribs: Record<string, string> = {
        src: normalized.embedUrl,
        title: safeTitle,
        loading: 'lazy',
      };
      if (attribs.width && /^\d{1,4}$/.test(attribs.width)) {
        safeAttribs.width = attribs.width;
      }
      if (attribs.height && /^\d{1,4}$/.test(attribs.height)) {
        safeAttribs.height = attribs.height;
      }
      if (attribs.allowfullscreen !== undefined) {
        safeAttribs.allowfullscreen = 'true';
      }
      return { tagName: 'iframe', attribs: safeAttribs };
    },
  },
  exclusiveFilter: (frame) => {
    if (frame.tag === 'iframe') {
      return !normalizeAllowlistedVideoEmbedUrl(frame.attribs.src ?? '');
    }
    if (frame.tag === 'img') {
      const src = frame.attribs.src?.trim() ?? '';
      const alt = frame.attribs.alt?.trim() ?? '';
      return !src || !alt || !isSafeCmsImageUrl(src);
    }
    return false;
  },
};

/**
 * Enforces size limits and server-side allowlist HTML sanitization on rich-text content.
 * Strips scripts, inline event handlers, styles, unknown tags, unsafe URL schemes,
 * and disallowed iframes; forces rel="noopener noreferrer" on all valid links.
 */
export function sanitizeCmsRichTextHtml(
  rawHtml: string,
  maxBytes = CMS_MAX_RICH_TEXT_BYTES,
): string {
  if (typeof rawHtml !== 'string') {
    return '';
  }

  const byteLen = Buffer.byteLength(rawHtml, 'utf8');
  if (byteLen > maxBytes) {
    throw new PayloadTooLargeException({
      code: 'CMS_CONTENT_TOO_LARGE',
      message: `Rich text HTML (${byteLen} bytes) exceeds maximum allowed limit of ${maxBytes} bytes.`,
    });
  }

  return sanitizeHtml(rawHtml, SANITIZE_OPTIONS).trim();
}
