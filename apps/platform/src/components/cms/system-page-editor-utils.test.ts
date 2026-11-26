import type { CmsPageDetailDto } from '@hrm/shared-types';
import {
  buildLocaleDraftFromDetail,
  copyEnglishDraftToBengali,
  getSeoLengthHint,
  isLegalSystemPage,
  validateSystemPageRequiredFields,
} from './system-page-editor-utils';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('--- Running SystemPageEditor Utility Tests ---');

const detailFixture: CmsPageDetailDto = {
  page: {
    id: 'sys-pricing-id',
    kind: 'system',
    slug: 'pricing',
    status: 'published',
    locked: true,
    requiresApproval: false,
    approvalStatus: 'none',
    canonicalPath: '/pricing',
    titleEn: 'Pricing Plans',
    locales: [
      {
        locale: 'en',
        isTranslated: true,
        translationStatus: 'translated',
        currentDraftVersionId: 'ver-en-1',
        currentPublishedVersionId: 'ver-en-1',
        updatedAt: '2026-11-26T00:00:00.000Z',
      },
      {
        locale: 'bn',
        isTranslated: false,
        translationStatus: 'untranslated',
        currentDraftVersionId: null,
        currentPublishedVersionId: null,
        updatedAt: '2026-11-26T00:00:00.000Z',
      },
    ],
    createdAt: '2026-11-26T00:00:00.000Z',
    updatedAt: '2026-11-26T00:00:00.000Z',
  },
  versions: [
    {
      id: 'ver-en-1',
      pageId: 'sys-pricing-id',
      versionNumber: 1,
      locale: 'en',
      title: 'Transparent Pricing for Growing Teams',
      seoTitle: 'CMSN-HR Pricing Plans & Estimator',
      seoDescription:
        'Explore transparent per-employee pricing for multi-tenant HR, payroll, attendance, and leave management across Bangladesh and global teams.',
      canonicalPath: '/pricing',
      ogImageUrl: '/api/v1/public/content/media/550e8400-e29b-41d4-a716-446655440000/file',
      noIndex: false,
      isTranslated: true,
      blocks: [
        {
          id: 'hero-heading',
          type: 'heading',
          props: { level: 1, text: 'Simple Per-Seat Pricing', align: 'center' },
        },
        {
          id: 'live-pricing-widget',
          type: 'dynamic_block',
          props: {
            widget: 'pricing_table',
            heading: 'Choose your tier',
            subtitle: 'Billed monthly or annually',
          },
        },
      ],
      createdAt: '2026-11-26T00:00:00.000Z',
    },
  ],
};

// 1. Hydrate EN and BN fallback skeleton
const enDraft = buildLocaleDraftFromDetail(detailFixture, 'en');
assert(enDraft.title === 'Transparent Pricing for Growing Teams', 'EN title hydrated');
assert(enDraft.blocks.length === 2, 'EN fixed block count preserved');

const bnDraftInitial = buildLocaleDraftFromDetail(detailFixture, 'bn');
assert(bnDraftInitial.blocks.length === 2, 'Untranslated BN still gets fixed system skeleton');
assert(bnDraftInitial.translationStatus === 'untranslated', 'BN initial status is untranslated');

// 2. Copy from English helper
const bnCopied = copyEnglishDraftToBengali(enDraft, bnDraftInitial);
assert(bnCopied.title === enDraft.title, 'Copy from English populates BN title');
assert(bnCopied.seoTitle === enDraft.seoTitle, 'Copy from English populates BN SEO title');
assert(bnCopied.blocks.length === 2, 'Copy from English preserves locked blocks');
assert(bnCopied.translationStatus === 'in_review', 'Copy from English marks BN draft in_review');
console.log('✓ Locale hydration and Copy-from-English passed');

// 3. SEO Length hints
assert(getSeoLengthHint('title', '').tone === 'warning', 'Empty SEO title triggers warning');
assert(
  getSeoLengthHint('title', 'CMSN-HR Payroll & HR Software Pricing Plans').tone === 'optimal',
  'Optimal SEO title length passes',
);
assert(
  getSeoLengthHint('description', 'x'.repeat(145)).tone === 'optimal',
  'Optimal SEO description length passes',
);
assert(
  getSeoLengthHint('description', 'x'.repeat(190)).tone === 'warning',
  'Overlong SEO description triggers warning',
);
console.log('✓ SEO length hints passed');

// 4. Required fields warning validator
assert(
  validateSystemPageRequiredFields(enDraft).length === 0,
  'Valid system page draft yields zero warnings',
);

const brokenDraft = {
  ...enDraft,
  title: '  ',
  blocks: [
    {
      id: 'hero-heading',
      type: 'heading' as const,
      props: { level: 1 as const, text: '', align: 'left' as const },
    },
    {
      id: 'cta-img',
      type: 'image' as const,
      props: {
        mediaId: '550e8400-e29b-41d4-a716-446655440000',
        alt: '',
        aspectRatio: 'auto' as const,
      },
    },
    {
      id: 'btn-1',
      type: 'button' as const,
      props: { label: 'Start', href: 'javascript:alert(1)', variant: 'primary' as const, size: 'md' as const, openInNewTab: false },
    },
  ],
};
const warnings = validateSystemPageRequiredFields(brokenDraft);
assert(warnings.some((w) => w.path === 'title'), 'Flags empty page title');
assert(warnings.some((w) => w.path === 'hero-heading.text'), 'Flags empty heading text');
assert(warnings.some((w) => w.path === 'cta-img.alt'), 'Flags empty image alt text');
assert(warnings.some((w) => w.path === 'btn-1.href'), 'Flags invalid button href');
console.log(`✓ Required field warnings passed (${warnings.length} warnings detected cleanly)`);

// 5. Legal approval detection
assert(isLegalSystemPage('privacy') === true, 'privacy is legal');
assert(isLegalSystemPage('dpa') === true, 'dpa is legal');
assert(isLegalSystemPage('pricing') === false, 'pricing is not legal');
console.log('✓ SystemPageEditor utility tests passed');
