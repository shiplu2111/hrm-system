import {
  CMS_RESERVED_SLUGS,
  type CmsBlockNode,
  type CmsCustomPageTemplate,
} from '@hrm/shared-types';

const BENGALI_CHAR_REGEX = /[\u0980-\u09FF]/;
const SLUG_FORMAT_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUG_SET = new Set<string>(CMS_RESERVED_SLUGS);

// Phonetic Bengali Unicode -> Latin transliteration map for readable URL slugs
const BN_MAP: Record<string, string> = {
  'অ': 'o',
  'আ': 'a',
  'ই': 'i',
  'ঈ': 'i',
  'উ': 'u',
  'ঊ': 'u',
  'ঋ': 'ri',
  'এ': 'e',
  'ঐ': 'oi',
  'ও': 'o',
  'ঔ': 'ou',
  'া': 'a',
  'ি': 'i',
  'ী': 'i',
  'ু': 'u',
  'ূ': 'u',
  'ৃ': 'ri',
  'ে': 'e',
  'ৈ': 'oi',
  'ো': 'o',
  'ৌ': 'ou',
  'ক': 'k',
  'খ': 'kh',
  'গ': 'g',
  'ঘ': 'gh',
  'ঙ': 'ng',
  'চ': 'ch',
  'ছ': 'chh',
  'জ': 'j',
  'ঝ': 'jh',
  'ঞ': 'n',
  'ট': 't',
  'ঠ': 'th',
  'ড': 'd',
  'ঢ': 'dh',
  'ণ': 'n',
  'ত': 't',
  'থ': 'th',
  'দ': 'd',
  'ধ': 'dh',
  'ন': 'n',
  'প': 'p',
  'ফ': 'ph',
  'ব': 'b',
  'ভ': 'bh',
  'ম': 'm',
  'য': 'j',
  'র': 'r',
  'ল': 'l',
  'শ': 'sh',
  'ষ': 'sh',
  'স': 's',
  'হ': 'h',
  'ড়': 'r',
  'ঢ়': 'rh',
  'য়': 'y',
  'ড়': 'r',
  'ঢ়': 'rh',
  'য়': 'y',
  'ৎ': 't',
  'ং': 'ng',
  'ঃ': 'h',
  'ঁ': '',
  '্': '',
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

const BN_CONSONANTS = new Set(
  'কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহড়ঢ়য়ড়ঢ়য়'.split(''),
);
const BN_VOWEL_SIGNS = new Set('ািীুূৃেৈোৌ্'.split(''));

export function hasBengaliScript(text: string): boolean {
  return BENGALI_CHAR_REGEX.test(text || '');
}

/**
 * Transliterates Bengali + English text into an ASCII URL-safe kebab-case slug.
 * Inserts inherent 'o'/'a' vowels neatly between un-vowelled Bengali consonants where appropriate.
 */
export function transliterateBengaliToSlug(raw: string): string {
  if (!raw || !raw.trim()) return '';
  const chars = Array.from(raw.trim());
  let out = '';

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];

    if (BN_MAP[ch] !== undefined) {
      out += BN_MAP[ch];
      // Add an inherent light vowel when a standalone consonant precedes another consonant in the same word
      if (
        BN_CONSONANTS.has(ch) &&
        next &&
        !BN_VOWEL_SIGNS.has(next) &&
        BN_CONSONANTS.has(next)
      ) {
        out += 'o';
      }
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      out += ch.toLowerCase();
    } else if (/[\s_\-–—/।,.:;!?&+]/.test(ch)) {
      out += '-';
    }
  }

  return out
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

/**
 * Generates a URL-safe slug from English or Bengali titles.
 */
export function generateSlugFromTitle(rawTitle: string): string {
  if (!rawTitle?.trim()) return '';
  if (hasBengaliScript(rawTitle)) {
    return transliterateBengaliToSlug(rawTitle);
  }
  return rawTitle
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s-]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

export function normalizeManualSlugInput(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

export function validateSlugFormatAndReserved(slug: string): {
  valid: boolean;
  reserved: boolean;
  error: string | null;
} {
  const trimmed = slug.trim();
  if (!trimmed) {
    return { valid: false, reserved: false, error: 'Slug is required.' };
  }
  const lower = trimmed.toLowerCase();
  if (RESERVED_SLUG_SET.has(lower)) {
    return {
      valid: false,
      reserved: true,
      error: `Slug "${lower}" is reserved (${CMS_RESERVED_SLUGS.join(', ')}) and cannot be used.`,
    };
  }
  if (trimmed !== lower || !SLUG_FORMAT_REGEX.test(trimmed)) {
    return {
      valid: false,
      reserved: false,
      error: 'Use lowercase letters (a-z), digits (0-9), and single hyphens only.',
    };
  }
  return { valid: true, reserved: false, error: null };
}

function makeBlockId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultBlock(type: CmsBlockNode['type']): CmsBlockNode {
  switch (type) {
    case 'heading':
      return {
        id: makeBlockId('heading'),
        type: 'heading',
        props: { level: 2, text: 'Section Heading', subtitle: '', align: 'left' },
      };
    case 'rich_text':
      return {
        id: makeBlockId('rich-text'),
        type: 'rich_text',
        props: { html: '<p>Write your content here...</p>' },
      };
    case 'image':
      return {
        id: makeBlockId('image'),
        type: 'image',
        props: {
          mediaId: '',
          alt: '',
          caption: '',
          aspectRatio: 'auto',
        },
      };
    case 'button':
      return {
        id: makeBlockId('button'),
        type: 'button',
        props: {
          label: 'Book a Demo',
          href: '/demo',
          variant: 'primary',
          size: 'md',
          openInNewTab: false,
        },
      };
    case 'feature_cards':
      return {
        id: makeBlockId('cards'),
        type: 'feature_cards',
        props: {
          heading: 'Key Highlights',
          subtitle: 'Built for growing multi-country teams',
          columns: 3,
          cards: [
            {
              id: makeBlockId('card'),
              title: 'Country-Configurable Rules',
              description: 'Adapt tax brackets, leave policies, and overtime formulas without custom code.',
            },
            {
              id: makeBlockId('card'),
              title: 'Deterministic Payroll Runs',
              description: 'Audited, reproducible payroll outputs with locked finalized runs.',
            },
            {
              id: makeBlockId('card'),
              title: 'Offline Mobile Attendance',
              description: 'Capture field punches reliably even when connectivity drops.',
            },
          ],
        },
      };
    case 'faq_list':
      return {
        id: makeBlockId('faq'),
        type: 'faq_list',
        props: {
          heading: 'Frequently Asked Questions',
          limit: 6,
        },
      };
    case 'cta_band':
      return {
        id: makeBlockId('cta'),
        type: 'cta_band',
        props: {
          title: 'Ready to streamline HR & Payroll?',
          description: 'Start a 14-day workspace trial or schedule a guided walkthrough.',
          tone: 'dark',
          primaryButton: { label: 'Get Started Free', href: '/signup' },
          secondaryButton: { label: 'Book a Demo', href: '/demo' },
        },
      };
    case 'video_embed':
      return {
        id: makeBlockId('video'),
        type: 'video_embed',
        props: {
          provider: 'youtube',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'Platform Walkthrough Video',
        },
      };
    case 'columns':
      return {
        id: makeBlockId('cols'),
        type: 'columns',
        props: {
          ratio: '50-50',
          gap: 'md',
          columns: [
            {
              id: makeBlockId('col1'),
              blocks: [
                {
                  id: makeBlockId('col-text'),
                  type: 'rich_text',
                  props: { html: '<p>Left column content...</p>' },
                },
              ],
            },
            {
              id: makeBlockId('col2'),
              blocks: [
                {
                  id: makeBlockId('col-text'),
                  type: 'rich_text',
                  props: { html: '<p>Right column content...</p>' },
                },
              ],
            },
          ],
        },
      };
    case 'divider':
      return {
        id: makeBlockId('divider'),
        type: 'divider',
        props: { spacing: 'md' },
      };
    case 'dynamic_block':
      return {
        id: makeBlockId('dynamic'),
        type: 'dynamic_block',
        props: {
          widget: 'pricing_table',
          heading: 'Plans Overview',
        },
      };
  }
}

export function buildCustomPageTemplateBlocks(
  template: CmsCustomPageTemplate,
  title: string,
): CmsBlockNode[] {
  const cleanTitle = title.trim() || 'Untitled Page';
  if (template === 'landing') {
    return [
      {
        id: makeBlockId('hero'),
        type: 'heading',
        props: {
          level: 1,
          text: cleanTitle,
          subtitle: 'Empower your HR, payroll, and workforce teams in minutes.',
          align: 'center',
        },
      },
      {
        id: makeBlockId('hero-cta'),
        type: 'button',
        props: {
          label: 'Start Free Trial',
          href: '/signup',
          variant: 'primary',
          size: 'lg',
          openInNewTab: false,
        },
      },
      createDefaultBlock('feature_cards'),
      {
        id: makeBlockId('body'),
        type: 'rich_text',
        props: {
          html: '<p>Add supporting details, customer outcomes, or compliance guarantees here.</p>',
        },
      },
      createDefaultBlock('cta_band'),
    ];
  }

  if (template === 'legal') {
    return [
      {
        id: makeBlockId('legal-hero'),
        type: 'heading',
        props: {
          level: 1,
          text: cleanTitle,
          subtitle: 'Effective Date: Pending Legal Approval · Version 1.0',
          align: 'left',
        },
      },
      {
        id: makeBlockId('legal-body'),
        type: 'rich_text',
        props: {
          html:
            '<h2>1. Scope &amp; Purpose</h2><p>Specify statutory scope, customer obligations, and retention safeguards here.</p><h2>2. Data Handling &amp; Contact</h2><p>Provide official compliance contact details.</p>',
        },
      },
    ];
  }

  // Standard page
  return [
    {
      id: makeBlockId('std-hero'),
      type: 'heading',
      props: {
        level: 1,
        text: cleanTitle,
        align: 'left',
      },
    },
    {
      id: makeBlockId('std-body'),
      type: 'rich_text',
      props: {
        html: '<p>Write the main content for this page here.</p>',
      },
    },
  ];
}

export function reorderBlocks(
  blocks: CmsBlockNode[],
  fromIndex: number,
  toIndex: number,
): CmsBlockNode[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= blocks.length ||
    toIndex >= blocks.length ||
    fromIndex === toIndex
  ) {
    return blocks;
  }
  const next = [...blocks];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function duplicateBlockAt(
  blocks: CmsBlockNode[],
  index: number,
): CmsBlockNode[] {
  if (index < 0 || index >= blocks.length) return blocks;
  const cloned = JSON.parse(JSON.stringify(blocks[index])) as CmsBlockNode;
  cloned.id = makeBlockId(cloned.type);
  if (cloned.type === 'columns') {
    cloned.props.columns = cloned.props.columns.map((col, idx) => ({
      ...col,
      id: makeBlockId(`col${idx + 1}`),
      blocks: col.blocks.map((child) => ({
        ...child,
        id: makeBlockId(child.type),
      })),
    }));
  }
  const next = [...blocks];
  next.splice(index + 1, 0, cloned);
  return next;
}

export function removeBlockAt(
  blocks: CmsBlockNode[],
  index: number,
): CmsBlockNode[] {
  if (index < 0 || index >= blocks.length) return blocks;
  return blocks.filter((_, idx) => idx !== index);
}
