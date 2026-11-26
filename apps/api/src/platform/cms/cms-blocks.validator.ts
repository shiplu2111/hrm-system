import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import {
  CMS_MAX_BLOCKS_PER_PAGE,
  CMS_MAX_PAGE_BLOCKS_BYTES,
  CMS_MAX_RICH_TEXT_BYTES,
  CMS_MAX_TOTAL_LEAF_BLOCKS,
  cmsBlocksDocumentSchema,
  normalizeAllowlistedVideoEmbedUrl,
  type CmsBlock,
} from '@hrm/shared-types';
import { sanitizeCmsRichTextHtml } from './cms-sanitizer';

function sanitizeLeafBlock(block: CmsBlock): CmsBlock {
  switch (block.type) {
    case 'rich_text':
      return {
        ...block,
        props: {
          html: sanitizeCmsRichTextHtml(block.props.html),
        },
      };
    case 'video_embed': {
      const normalized = normalizeAllowlistedVideoEmbedUrl(block.props.url, block.props.provider);
      if (!normalized) {
        throw new BadRequestException({
          code: 'INVALID_VIDEO_EMBED_URL',
          message: `Disallowed video embed URL for provider "${block.props.provider}".`,
        });
      }
      return {
        ...block,
        props: {
          ...block.props,
          url: normalized.embedUrl,
        },
      };
    }
    case 'columns':
      return {
        ...block,
        props: {
          ...block.props,
          columns: block.props.columns.map((col) => ({
            ...col,
            blocks: col.blocks.map((nested) => sanitizeLeafBlock(nested) as typeof nested),
          })),
        },
      };
    default:
      return block;
  }
}

function countTotalLeafBlocks(blocks: readonly CmsBlock[]): number {
  let total = 0;
  for (const block of blocks) {
    if (block.type === 'columns') {
      total += block.props.columns.reduce((acc, col) => acc + col.blocks.length, 0);
    } else {
      total += 1;
    }
  }
  return total;
}

/**
 * Validates CMS page block array against Zod schema, enforces payload size caps,
 * normalizes allowlisted video embeds, enforces non-editable dynamic widgets,
 * and sanitizes all rich-text HTML server-side.
 */
function assertRichTextSizesWithinLimit(nodes: unknown[]): void {
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const rec = node as Record<string, unknown>;
    const props = rec.props as Record<string, unknown> | undefined;
    if (rec.type === 'rich_text' && props && typeof props.html === 'string') {
      const htmlBytes = Buffer.byteLength(props.html, 'utf8');
      if (htmlBytes > CMS_MAX_RICH_TEXT_BYTES) {
        throw new PayloadTooLargeException({
          code: 'CMS_CONTENT_TOO_LARGE',
          message: `Rich text HTML (${htmlBytes} bytes) exceeds maximum allowed limit of ${CMS_MAX_RICH_TEXT_BYTES} bytes.`,
        });
      }
    } else if (rec.type === 'columns' && props && Array.isArray(props.columns)) {
      for (const col of props.columns) {
        if (col && typeof col === 'object' && Array.isArray((col as Record<string, unknown>).blocks)) {
          assertRichTextSizesWithinLimit((col as Record<string, unknown>).blocks as unknown[]);
        }
      }
    }
  }
}

export function validateAndSanitizeCmsBlocks(rawBlocks: unknown): CmsBlock[] {
  const serialized = JSON.stringify(rawBlocks ?? []);
  const byteSize = Buffer.byteLength(serialized, 'utf8');
  if (byteSize > CMS_MAX_PAGE_BLOCKS_BYTES) {
    throw new PayloadTooLargeException({
      code: 'CMS_BLOCKS_TOO_LARGE',
      message: `CMS blocks payload (${byteSize} bytes) exceeds maximum limit of ${CMS_MAX_PAGE_BLOCKS_BYTES} bytes.`,
    });
  }

  if (Array.isArray(rawBlocks)) {
    if (rawBlocks.length > CMS_MAX_BLOCKS_PER_PAGE) {
      throw new PayloadTooLargeException({
        code: 'CMS_TOO_MANY_BLOCKS',
        message: `Page contains ${rawBlocks.length} top-level blocks, exceeding limit of ${CMS_MAX_BLOCKS_PER_PAGE}.`,
      });
    }
    assertRichTextSizesWithinLimit(rawBlocks);
  }

  const parsed = cmsBlocksDocumentSchema.safeParse(rawBlocks);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new BadRequestException({
      code: 'INVALID_CMS_BLOCKS',
      message: firstIssue
        ? `Invalid CMS block at "${firstIssue.path.join('.')}": ${firstIssue.message}`
        : 'Invalid CMS block structure.',
      details: parsed.error.issues,
    });
  }

  const totalLeafCount = countTotalLeafBlocks(parsed.data);
  if (totalLeafCount > CMS_MAX_TOTAL_LEAF_BLOCKS) {
    throw new PayloadTooLargeException({
      code: 'CMS_TOO_MANY_BLOCKS',
      message: `Page contains ${totalLeafCount} content blocks, exceeding limit of ${CMS_MAX_TOTAL_LEAF_BLOCKS}.`,
    });
  }

  return parsed.data.map(sanitizeLeafBlock);
}
