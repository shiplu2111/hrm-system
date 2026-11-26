import {
  CMS_LEGAL_PAGE_SLUGS,
  CMS_SYSTEM_PAGE_DEFS,
  normalizeAllowlistedVideoEmbedUrl,
  type CmsBlockNode,
  type CmsLocale,
  type CmsPageDetailDto,
  type CmsTranslationStatus,
} from '@hrm/shared-types';
import { validateCmsLinkInput } from './rich-text-utils';

export interface SystemPageLocaleDraft {
  locale: CmsLocale;
  title: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  canonicalPath: string;
  noIndex: boolean;
  blocks: CmsBlockNode[];
  isTranslated: boolean;
  translationStatus: CmsTranslationStatus;
  changeNote: string;
  sourceVersionNumber?: number;
}

export interface SystemPageFieldWarning {
  path: string;
  label: string;
  message: string;
}

export interface SeoLengthHint {
  tone: 'optimal' | 'warning' | 'info';
  text: string;
  length: number;
  maxRecommended: number;
}

function cloneBlocks(blocks: CmsBlockNode[]): CmsBlockNode[] {
  return JSON.parse(JSON.stringify(blocks)) as CmsBlockNode[];
}

export function isLegalSystemPage(slug: string, requiresApproval?: boolean): boolean {
  return (
    Boolean(requiresApproval) ||
    (CMS_LEGAL_PAGE_SLUGS as readonly string[]).includes(slug.trim().toLowerCase())
  );
}

/**
 * Hydrates a locale working draft for a system page, preserving the page's fixed block skeleton.
 * If Bengali does not have a saved version yet, clones the English block layout as empty/draft slots.
 */
export function buildLocaleDraftFromDetail(
  detail: CmsPageDetailDto,
  locale: CmsLocale,
): SystemPageLocaleDraft {
  const locRow = detail.page.locales.find((l) => l.locale === locale);
  const enRow = detail.page.locales.find((l) => l.locale === 'en');

  const targetVersionId =
    locRow?.currentDraftVersionId || locRow?.currentPublishedVersionId;
  const ownVersion =
    detail.versions.find((v) => v.id === targetVersionId) ||
    detail.versions.find((v) => v.locale === locale);

  const enVersionId =
    enRow?.currentDraftVersionId ||
    enRow?.currentPublishedVersionId ||
    detail.page.currentPublishedVersionId;
  const enFallbackVersion =
    detail.versions.find((v) => v.id === enVersionId) ||
    detail.versions.find((v) => v.locale === 'en');

  const sysDef = CMS_SYSTEM_PAGE_DEFS.find((d) => d.slug === detail.page.slug);
  const resolvedSource = ownVersion || enFallbackVersion;
  const blocks = cloneBlocks(
    Array.isArray(resolvedSource?.blocks) ? resolvedSource.blocks : [],
  );

  const defaultCanonical =
    locale === 'bn'
      ? `/bn${sysDef?.canonicalPath === '/' ? '' : sysDef?.canonicalPath ?? `/${detail.page.slug}`}`
      : sysDef?.canonicalPath ?? `/${detail.page.slug}`;

  return {
    locale,
    title:
      ownVersion?.title ??
      (locale === 'bn' ? sysDef?.titleBn : sysDef?.titleEn) ??
      '',
    seoTitle: ownVersion?.seoTitle ?? '',
    seoDescription: ownVersion?.seoDescription ?? '',
    ogImageUrl: ownVersion?.ogImageUrl ?? '',
    canonicalPath: ownVersion?.canonicalPath ?? defaultCanonical,
    noIndex: Boolean(ownVersion?.noIndex ?? false),
    blocks,
    isTranslated:
      locale === 'en' ? true : Boolean(locRow?.isTranslated && ownVersion?.isTranslated),
    translationStatus:
      locale === 'en' ? 'translated' : locRow?.translationStatus ?? 'untranslated',
    changeNote: '',
    sourceVersionNumber: ownVersion?.versionNumber,
  };
}

/**
 * Copies English copy, SEO metadata, social image, and fixed blocks into the Bengali draft
 * so translators can work from existing English copy while keeping the locked structure intact.
 */
export function copyEnglishDraftToBengali(
  enDraft: SystemPageLocaleDraft,
  currentBnDraft: SystemPageLocaleDraft,
): SystemPageLocaleDraft {
  return {
    ...currentBnDraft,
    locale: 'bn',
    title: enDraft.title || currentBnDraft.title,
    seoTitle: enDraft.seoTitle || enDraft.title || currentBnDraft.seoTitle,
    seoDescription: enDraft.seoDescription || currentBnDraft.seoDescription,
    ogImageUrl: enDraft.ogImageUrl || currentBnDraft.ogImageUrl,
    blocks: cloneBlocks(enDraft.blocks),
    translationStatus:
      currentBnDraft.translationStatus === 'translated' ? 'translated' : 'in_review',
    isTranslated: currentBnDraft.translationStatus === 'translated',
    changeNote: currentBnDraft.changeNote || 'Copied initial text and layout from English',
  };
}

export function getSeoLengthHint(
  field: 'title' | 'description',
  rawValue: string,
): SeoLengthHint {
  const len = rawValue.trim().length;
  if (field === 'title') {
    if (len === 0) {
      return {
        tone: 'warning',
        text: 'Recommended 30–60 characters (currently empty — search uses Page Title).',
        length: 0,
        maxRecommended: 60,
      };
    }
    if (len < 30) {
      return {
        tone: 'info',
        text: `Short (${len}/60 chars) — aim for 30–60 chars for search snippets.`,
        length: len,
        maxRecommended: 60,
      };
    }
    if (len <= 60) {
      return {
        tone: 'optimal',
        text: `Good length (${len}/60 chars).`,
        length: len,
        maxRecommended: 60,
      };
    }
    if (len <= 70) {
      return {
        tone: 'info',
        text: `Slightly long (${len}/60 chars) — may wrap or clip.`,
        length: len,
        maxRecommended: 60,
      };
    }
    return {
      tone: 'warning',
      text: `Too long (${len}/60 chars) — search results truncate past ~60 chars.`,
      length: len,
      maxRecommended: 60,
    };
  }

  if (len === 0) {
    return {
      tone: 'warning',
      text: 'Recommended 120–160 characters for search snippets & social sharing.',
      length: 0,
      maxRecommended: 160,
    };
  }
  if (len < 120) {
    return {
      tone: 'info',
      text: `Short (${len}/160 chars) — aim for 120–160 chars.`,
      length: len,
      maxRecommended: 160,
    };
  }
  if (len <= 160) {
    return {
      tone: 'optimal',
      text: `Optimal snippet length (${len}/160 chars).`,
      length: len,
      maxRecommended: 160,
    };
  }
  return {
    tone: 'warning',
    text: `Too long (${len}/160 chars) — descriptions over 160 chars are truncated.`,
    length: len,
    maxRecommended: 160,
  };
}

function collectBlockWarnings(
  blocks: CmsBlockNode[],
  warnings: SystemPageFieldWarning[],
  prefix: string,
): void {
  blocks.forEach((block, idx) => {
    const path = `${prefix}${block.id || idx}`;
    if (block.type === 'heading') {
      if (!block.props.text?.trim()) {
        warnings.push({
          path: `${path}.text`,
          label: `Heading (${block.id})`,
          message: 'Heading text is required.',
        });
      }
    } else if (block.type === 'rich_text') {
      const textOnly = (block.props.html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .trim();
      const hasMedia = /<img\b/i.test(block.props.html || '');
      if (!textOnly && !hasMedia) {
        warnings.push({
          path: `${path}.html`,
          label: `Rich Text (${block.id})`,
          message: 'Rich text block cannot be completely empty.',
        });
      }
    } else if (block.type === 'image') {
      if (!block.props.mediaId?.trim()) {
        warnings.push({
          path: `${path}.mediaId`,
          label: `Image (${block.id})`,
          message: 'Select an image from the Media Library.',
        });
      }
      if (!block.props.alt?.trim()) {
        warnings.push({
          path: `${path}.alt`,
          label: `Image (${block.id})`,
          message: 'Image alt text is required for accessibility.',
        });
      }
    } else if (block.type === 'button') {
      if (!block.props.label?.trim()) {
        warnings.push({
          path: `${path}.label`,
          label: `Button (${block.id})`,
          message: 'Button label is required.',
        });
      }
      const linkCheck = validateCmsLinkInput(block.props.href || '');
      if (!linkCheck.valid) {
        warnings.push({
          path: `${path}.href`,
          label: `Button (${block.id})`,
          message: linkCheck.error || 'Valid button link URL is required.',
        });
      }
    } else if (block.type === 'feature_cards') {
      block.props.cards.forEach((card, cIdx) => {
        if (!card.title?.trim()) {
          warnings.push({
            path: `${path}.cards[${cIdx}].title`,
            label: `Feature Card #${cIdx + 1} (${block.id})`,
            message: 'Feature card title is required.',
          });
        }
        if (!card.description?.trim()) {
          warnings.push({
            path: `${path}.cards[${cIdx}].description`,
            label: `Feature Card #${cIdx + 1} (${block.id})`,
            message: 'Feature card description is required.',
          });
        }
        if (card.linkHref?.trim() && !validateCmsLinkInput(card.linkHref).valid) {
          warnings.push({
            path: `${path}.cards[${cIdx}].linkHref`,
            label: `Feature Card #${cIdx + 1} (${block.id})`,
            message: 'Card link URL is invalid.',
          });
        }
      });
    } else if (block.type === 'cta_band') {
      if (!block.props.title?.trim()) {
        warnings.push({
          path: `${path}.title`,
          label: `CTA Band (${block.id})`,
          message: 'CTA headline title is required.',
        });
      }
      if (!block.props.primaryButton?.label?.trim()) {
        warnings.push({
          path: `${path}.primaryButton.label`,
          label: `CTA Primary Button (${block.id})`,
          message: 'Primary button label is required.',
        });
      }
      if (!validateCmsLinkInput(block.props.primaryButton?.href || '').valid) {
        warnings.push({
          path: `${path}.primaryButton.href`,
          label: `CTA Primary Button (${block.id})`,
          message: 'Primary button URL is required and must be valid.',
        });
      }
    } else if (block.type === 'video_embed') {
      if (!block.props.title?.trim()) {
        warnings.push({
          path: `${path}.title`,
          label: `Video Embed (${block.id})`,
          message: 'Video title is required for accessibility.',
        });
      }
      if (!normalizeAllowlistedVideoEmbedUrl(block.props.url || '', block.props.provider)) {
        warnings.push({
          path: `${path}.url`,
          label: `Video Embed (${block.id})`,
          message: `Video URL must match a valid ${block.props.provider} embed URL.`,
        });
      }
    } else if (block.type === 'columns') {
      block.props.columns.forEach((col, colIdx) => {
        collectBlockWarnings(col.blocks, warnings, `${path}.col${colIdx}.`);
      });
    }
  });
}

/**
 * Validates required fields on the active locale draft (Page Title + all block required fields)
 * so the System Page Editor can surface inline and banner warnings when fields are empty.
 */
export function validateSystemPageRequiredFields(
  draft: SystemPageLocaleDraft,
): SystemPageFieldWarning[] {
  const warnings: SystemPageFieldWarning[] = [];
  if (!draft.title?.trim()) {
    warnings.push({
      path: 'title',
      label: 'Page Title',
      message: 'Page Title is required.',
    });
  }
  collectBlockWarnings(draft.blocks, warnings, '');
  return warnings;
}
