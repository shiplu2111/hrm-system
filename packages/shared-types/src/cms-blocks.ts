import { z } from 'zod';

export const CMS_MAX_BLOCKS_PER_PAGE = 100;
export const CMS_MAX_TOTAL_LEAF_BLOCKS = 300;
export const CMS_MAX_RICH_TEXT_BYTES = 100 * 1024; // 100 KB per rich_text HTML string
export const CMS_MAX_PAGE_BLOCKS_BYTES = 512 * 1024; // 512 KB serialized blocks JSON

export const CMS_SAFE_URL_ERROR =
  'URL must be a relative path (/ or #) or use https:, http:, or mailto:';

export function isSafeCmsLinkUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  // Block control chars / whitespace smuggling inside protocol scheme
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return false;

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }
  if (trimmed.startsWith('#')) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    return protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:';
  } catch {
    return false;
  }
}

export function isSafeCmsImageUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return false;
  if (trimmed.startsWith('//')) return false;

  // Allow relative CMS Media Library file endpoints (Stage C.1)
  if (
    trimmed.startsWith('/api/v1/public/content/media/') ||
    trimmed.startsWith('/media/')
  ) {
    return !/\s/.test(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol.toLowerCase() === 'https:';
  } catch {
    return false;
  }
}

export function normalizeAllowlistedVideoEmbedUrl(
  rawUrl: string,
  expectedProvider?: 'youtube' | 'vimeo',
): { provider: 'youtube' | 'vimeo'; embedUrl: string; videoId: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

  // YouTube patterns: youtube.com/watch?v=ID, youtube.com/embed/ID, youtube-nocookie.com/embed/ID, youtu.be/ID
  if (!expectedProvider || expectedProvider === 'youtube') {
    let videoId: string | null = null;
    if (host === 'youtu.be') {
      const seg = parsed.pathname.split('/').filter(Boolean)[0] ?? '';
      if (/^[A-Za-z0-9_-]{6,20}$/.test(seg)) videoId = seg;
    } else if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        const v = parsed.searchParams.get('v') ?? '';
        if (/^[A-Za-z0-9_-]{6,20}$/.test(v)) videoId = v;
      } else {
        const embedMatch = parsed.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{6,20})$/);
        if (embedMatch) videoId = embedMatch[1];
      }
    } else if (host === 'youtube-nocookie.com') {
      const embedMatch = parsed.pathname.match(/^\/embed\/([A-Za-z0-9_-]{6,20})$/);
      if (embedMatch) videoId = embedMatch[1];
    }

    if (videoId) {
      return {
        provider: 'youtube',
        videoId,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      };
    }
  }

  // Vimeo patterns: vimeo.com/<digits> or player.vimeo.com/video/<digits>
  if (!expectedProvider || expectedProvider === 'vimeo') {
    let videoId: string | null = null;
    if (host === 'vimeo.com') {
      const m = parsed.pathname.match(/^\/(\d{5,15})$/);
      if (m) videoId = m[1];
    } else if (host === 'player.vimeo.com') {
      const m = parsed.pathname.match(/^\/video\/(\d{5,15})$/);
      if (m) videoId = m[1];
    }

    if (videoId) {
      return {
        provider: 'vimeo',
        videoId,
        embedUrl: `https://player.vimeo.com/video/${videoId}`,
      };
    }
  }

  return null;
}

const safeLinkUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(isSafeCmsLinkUrl, { message: CMS_SAFE_URL_ERROR });

const blockIdSchema = z.string().trim().min(1).max(80);

export const cmsHeadingBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal('heading'),
    props: z
      .object({
        level: z.union([
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4),
          z.literal(5),
          z.literal(6),
        ]),
        text: z.string().trim().min(1).max(240),
        subtitle: z.string().trim().max(500).optional(),
        align: z.enum(['left', 'center', 'right']).optional().default('left'),
      })
      .strict(),
  })
  .strict();

export const cmsRichTextBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal('rich_text'),
    props: z
      .object({
        html: z
          .string()
          .max(CMS_MAX_RICH_TEXT_BYTES, 'Rich text HTML exceeds maximum allowed length.'),
      })
      .strict(),
  })
  .strict();

export const cmsImageBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal('image'),
    props: z
      .object({
        mediaId: z.string().uuid('Image block requires a valid mediaId UUID.'),
        alt: z.string().trim().min(1, 'Image alt text is required.').max(300),
        caption: z.string().trim().max(500).optional(),
        aspectRatio: z.enum(['auto', '16:9', '4:3', '1:1']).optional().default('auto'),
      })
      .strict(),
  })
  .strict();

export const cmsButtonBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal('button'),
    props: z
      .object({
        label: z.string().trim().min(1).max(100),
        href: safeLinkUrlSchema,
        variant: z
          .enum(['primary', 'secondary', 'outline', 'ghost', 'inverse'])
          .optional()
          .default('primary'),
        size: z.enum(['sm', 'md', 'lg']).optional().default('md'),
        openInNewTab: z.boolean().optional().default(false),
      })
      .strict(),
  })
  .strict();

export const cmsFeatureCardItemSchema = z
  .object({
    id: z.string().trim().min(1).max(80).optional(),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(600),
    badge: z.string().trim().max(40).optional(),
    icon: z.string().trim().max(60).optional(),
    linkLabel: z.string().trim().max(80).optional(),
    linkHref: safeLinkUrlSchema.optional(),
  })
  .strict();

export const cmsFeatureCardsBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal('feature_cards'),
    props: z
      .object({
        heading: z.string().trim().max(200).optional(),
        subtitle: z.string().trim().max(500).optional(),
        columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional().default(3),
        cards: z.array(cmsFeatureCardItemSchema).min(1).max(24),
      })
      .strict(),
  })
  .strict();

export const cmsFaqListBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal('faq_list'),
    props: z
      .object({
        heading: z.string().trim().max(200).optional(),
        category: z.string().trim().max(80).optional(),
        pageSlug: z.string().trim().max(120).optional(),
        faqIds: z.array(z.string().uuid()).max(50).optional(),
        limit: z.number().int().min(1).max(50).optional().default(10),
      })
      .strict(),
  })
  .strict();

export const cmsCtaBandBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal('cta_band'),
    props: z
      .object({
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(600).optional(),
        tone: z.enum(['dark', 'tinted', 'base']).optional().default('dark'),
        primaryButton: z
          .object({
            label: z.string().trim().min(1).max(80),
            href: safeLinkUrlSchema,
          })
          .strict(),
        secondaryButton: z
          .object({
            label: z.string().trim().min(1).max(80),
            href: safeLinkUrlSchema,
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict();

export const cmsVideoEmbedBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal('video_embed'),
    props: z
      .object({
        provider: z.enum(['youtube', 'vimeo']),
        url: z.string().trim().min(1).max(500),
        title: z.string().trim().min(1, 'Video embed title is required for accessibility.').max(200),
        caption: z.string().trim().max(500).optional(),
      })
      .strict()
      .superRefine((val, ctx) => {
        const normalized = normalizeAllowlistedVideoEmbedUrl(val.url, val.provider);
        if (!normalized) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['url'],
            message: `Video URL must match an allowlisted ${val.provider} HTTPS URL pattern.`,
          });
        }
      }),
  })
  .strict();

export const cmsDividerBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal('divider'),
    props: z
      .object({
        spacing: z.enum(['sm', 'md', 'lg']).optional().default('md'),
        label: z.string().trim().max(80).optional(),
      })
      .strict(),
  })
  .strict();

/**
 * Dynamic live-data placeholder widgets: strictly `.strict()` with ONLY widget ID
 * and optional display title/subtitle — NO editable numbers, prices, rates, or limits.
 */
export const cmsDynamicBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal('dynamic_block'),
    props: z
      .object({
        widget: z.enum(['pricing_table', 'country_list', 'plan_comparison']),
        heading: z.string().trim().max(200).optional(),
        subtitle: z.string().trim().max(500).optional(),
      })
      .strict(),
  })
  .strict();

export const cmsLeafBlockSchema = z.discriminatedUnion('type', [
  cmsHeadingBlockSchema,
  cmsRichTextBlockSchema,
  cmsImageBlockSchema,
  cmsButtonBlockSchema,
  cmsFeatureCardsBlockSchema,
  cmsFaqListBlockSchema,
  cmsCtaBandBlockSchema,
  cmsVideoEmbedBlockSchema,
  cmsDividerBlockSchema,
  cmsDynamicBlockSchema,
]);

export const cmsColumnsBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal('columns'),
    props: z
      .object({
        ratio: z
          .enum(['50-50', '33-33-33', '60-40', '40-60', '25-50-25'])
          .optional()
          .default('50-50'),
        gap: z.enum(['sm', 'md', 'lg']).optional().default('md'),
        columns: z
          .array(
            z
              .object({
                id: z.string().trim().min(1).max(80).optional(),
                blocks: z.array(cmsLeafBlockSchema).max(20),
              })
              .strict(),
          )
          .min(2)
          .max(4),
      })
      .strict(),
  })
  .strict();

export const cmsBlockSchema = z.discriminatedUnion('type', [
  cmsHeadingBlockSchema,
  cmsRichTextBlockSchema,
  cmsImageBlockSchema,
  cmsButtonBlockSchema,
  cmsFeatureCardsBlockSchema,
  cmsFaqListBlockSchema,
  cmsCtaBandBlockSchema,
  cmsVideoEmbedBlockSchema,
  cmsColumnsBlockSchema,
  cmsDividerBlockSchema,
  cmsDynamicBlockSchema,
]);

export const cmsBlocksDocumentSchema = z
  .array(cmsBlockSchema)
  .max(CMS_MAX_BLOCKS_PER_PAGE, `A page version can contain at most ${CMS_MAX_BLOCKS_PER_PAGE} top-level blocks.`);

export type CmsLeafBlock = z.infer<typeof cmsLeafBlockSchema>;
export type CmsBlock = z.infer<typeof cmsBlockSchema>;
export type CmsDynamicWidgetType = z.infer<typeof cmsDynamicBlockSchema>['props']['widget'];
