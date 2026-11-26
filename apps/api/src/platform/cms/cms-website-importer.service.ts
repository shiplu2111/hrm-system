import { createHash } from 'crypto';
import type {
  CmsApprovalStatus,
  CmsBlock,
  CmsLocale,
  CmsPageStatus,
  CmsTranslationStatus,
} from '@hrm/shared-types';
import { Prisma, PrismaClient } from '@prisma/client';
import { validateAndSanitizeCmsBlocks } from './cms-blocks.validator';
import { CMS_LEGAL_PAGE_SLUG_SET } from './cms.constants';
import { sanitizeCmsRichTextHtml } from './cms-sanitizer';

export interface WebsiteImportLegalDocSource {
  slug: 'terms' | 'privacy' | 'cookies' | 'dpa';
  title: string;
  version: string;
  effectiveDate: string;
  legalApproved: boolean;
  reviewedOn: string | null;
  draftNotice: string;
  summary: string;
  bodyMarkdown: string;
}

export interface WebsiteImportCareerSource {
  slug: string;
  department: string;
  workMode: string;
  location: string;
  employmentType: string;
  title: string;
  summary: string;
  postedAt?: string;
}

export interface WebsiteImportSourceBundle {
  /** Merged dictionaries (en base, bn merged with en fallback for display completeness). */
  en: Record<string, any>;
  bn: Record<string, any>;
  /** Raw bn overrides object so we know exactly which sections have genuine Bengali translations. */
  rawBn: Record<string, any>;
  legalDocs: WebsiteImportLegalDocSource[];
  careers: WebsiteImportCareerSource[];
}

export interface PlannedPageLocaleVersion {
  locale: CmsLocale;
  title: string;
  seoTitle: string;
  seoDescription: string;
  canonicalPath: string;
  noIndex: boolean;
  isTranslated: boolean;
  translationStatus: CmsTranslationStatus;
  blocks: CmsBlock[];
  contentHash: string;
  changeNote: string;
}

export interface PlannedSystemPageImport {
  slug: string;
  canonicalPath: string;
  isLegal: boolean;
  targetPageStatus: CmsPageStatus;
  requiresApproval: boolean;
  targetApprovalStatus: CmsApprovalStatus;
  targetPublished: boolean;
  locales: PlannedPageLocaleVersion[];
}

export interface PlannedFaqImport {
  category: string;
  pageSlug: string;
  questionEn: string;
  answerEn: string;
  questionBn: string | null;
  answerBn: string | null;
  isBnTranslated: boolean;
  sortOrder: number;
}

export interface WebsiteCmsImportPlan {
  pages: PlannedSystemPageImport[];
  faqs: PlannedFaqImport[];
  careers: WebsiteImportCareerSource[];
}

export interface DryRunPageDiff {
  slug: string;
  isLegal: boolean;
  action: 'create_page_and_versions' | 'import_versions' | 'update_state_only' | 'skip_unchanged';
  targetPageStatus: CmsPageStatus;
  targetApprovalStatus: CmsApprovalStatus;
  localesToImport: Array<{
    locale: CmsLocale;
    blocksCount: number;
    translationStatus: CmsTranslationStatus;
    publishImmediately: boolean;
    reason: string;
  }>;
}

export interface WebsiteCmsImportReport {
  mode: 'dry-run' | 'apply';
  summary: {
    pagesTotal: number;
    pagesCreated: number;
    versionsCreated: number;
    versionsSkippedUnchanged: number;
    legalDraftsMarkedPendingReview: number;
    faqsCreatedOrUpdated: number;
    faqsSkippedUnchanged: number;
    careersImported: number;
    careersSkipped: number;
  };
  pages: DryRunPageDiff[];
  faqs: Array<{
    pageSlug: string;
    questionEn: string;
    action: 'create' | 'update' | 'skip';
  }>;
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Lightweight, deterministic Markdown-to-HTML converter for legal documents,
 * validated immediately through the server-side HTML allowlist sanitizer.
 */
export function markdownToSanitizedHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const htmlParts: string[] = [];
  let inList = false;

  const formatInline = (line: string): string => {
    let out = escapeHtml(line);
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    return out;
  };

  const closeList = () => {
    if (inList) {
      htmlParts.push('</ul>');
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      closeList();
      continue;
    }

    if (trimmed.startsWith('### ')) {
      closeList();
      htmlParts.push(`<h3>${formatInline(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith('## ')) {
      closeList();
      htmlParts.push(`<h2>${formatInline(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith('# ')) {
      closeList();
      htmlParts.push(`<h1>${formatInline(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith('> ')) {
      closeList();
      htmlParts.push(`<blockquote><p>${formatInline(trimmed.slice(2))}</p></blockquote>`);
    } else if (trimmed.startsWith('- ')) {
      if (!inList) {
        htmlParts.push('<ul>');
        inList = true;
      }
      htmlParts.push(`<li>${formatInline(trimmed.slice(2))}</li>`);
    } else {
      closeList();
      htmlParts.push(`<p>${formatInline(trimmed)}</p>`);
    }
  }
  closeList();

  return sanitizeCmsRichTextHtml(htmlParts.join('\n'));
}

function hashVersionPayload(payload: {
  title: string;
  seoTitle: string;
  seoDescription: string;
  canonicalPath: string;
  noIndex: boolean;
  blocks: CmsBlock[];
}): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

function makeImportChangeNote(slug: string, locale: CmsLocale, hash: string, isLegal: boolean): string {
  const suffix = isLegal ? 'LEGAL DRAFT pending Stage F review' : 'Published website import';
  return `[website-import:sha256:${hash}] ${suffix} (${slug}/${locale})`;
}

function normalizeBlocksForSchema(blocks: CmsBlock[]): CmsBlock[] {
  return blocks.map((block) => {
    if (block.type === 'heading') {
      return {
        ...block,
        props: {
          ...block.props,
          text: clip(block.props.text, 238),
          ...(block.props.subtitle !== undefined
            ? { subtitle: clip(block.props.subtitle, 495) }
            : {}),
        },
      };
    }
    if (block.type === 'feature_cards') {
      return {
        ...block,
        props: {
          ...block.props,
          ...(block.props.heading !== undefined
            ? { heading: clip(block.props.heading, 198) }
            : {}),
          ...(block.props.subtitle !== undefined
            ? { subtitle: clip(block.props.subtitle, 495) }
            : {}),
          cards: block.props.cards.map((card) => ({
            ...card,
            title: clip(card.title, 158),
            description: clip(card.description, 595),
            ...(card.badge !== undefined ? { badge: clip(card.badge, 38) } : {}),
            ...(card.linkLabel !== undefined ? { linkLabel: clip(card.linkLabel, 78) } : {}),
          })),
        },
      };
    }
    if (block.type === 'cta_band') {
      return {
        ...block,
        props: {
          ...block.props,
          title: clip(block.props.title, 198),
          ...(block.props.description !== undefined
            ? { description: clip(block.props.description, 595) }
            : {}),
          primaryButton: {
            ...block.props.primaryButton,
            label: clip(block.props.primaryButton.label, 78),
          },
          ...(block.props.secondaryButton
            ? {
                secondaryButton: {
                  ...block.props.secondaryButton,
                  label: clip(block.props.secondaryButton.label, 78),
                },
              }
            : {}),
        },
      };
    }
    return block;
  });
}

function buildPageLocaleSnapshot(params: {
  slug: string;
  locale: CmsLocale;
  title: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalPath: string;
  noIndex?: boolean;
  isLegal: boolean;
  isTranslated: boolean;
  translationStatus: CmsTranslationStatus;
  rawBlocks: CmsBlock[];
}): PlannedPageLocaleVersion {
  const validatedBlocks = validateAndSanitizeCmsBlocks(normalizeBlocksForSchema(params.rawBlocks));
  const title = params.title.trim();
  const seoTitle = (params.seoTitle || title).trim();
  const seoDescription = (params.seoDescription || '').trim();
  const canonicalPath =
    params.locale === 'bn'
      ? params.canonicalPath === '/'
        ? '/bn'
        : `/bn${params.canonicalPath}`
      : params.canonicalPath;
  const noIndex = Boolean(params.noIndex || params.isLegal);
  const contentHash = hashVersionPayload({
    title,
    seoTitle,
    seoDescription,
    canonicalPath,
    noIndex,
    blocks: validatedBlocks,
  });

  return {
    locale: params.locale,
    title,
    seoTitle,
    seoDescription,
    canonicalPath,
    noIndex,
    isTranslated: params.isTranslated,
    translationStatus: params.translationStatus,
    blocks: validatedBlocks,
    contentHash,
    changeNote: makeImportChangeNote(params.slug, params.locale, contentHash, params.isLegal),
  };
}

function bulletsToHtml(items: string[]): string {
  if (!items || items.length === 0) return '';
  return `<ul>${items.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`;
}

function clip(value: string, max = 580): string {
  const s = String(value ?? '').trim();
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/**
 * Maps all hard-coded content from `apps/website` dictionaries, legal markdown files,
 * FAQs, and careers data into schema-validated CMS page blocks and records.
 */
export function buildWebsiteCmsImportPlan(bundle: WebsiteImportSourceBundle): WebsiteCmsImportPlan {
  const { en, bn, rawBn, legalDocs, careers } = bundle;
  const pages: PlannedSystemPageImport[] = [];

  const ctaFor = (d: Record<string, any>, custom?: { title?: string; desc?: string; p?: string; s?: string; pHref?: string; sHref?: string }): CmsBlock => ({
    id: 'closing-cta',
    type: 'cta_band',
    props: {
      title: custom?.title || d.home.cta.title,
      description: custom?.desc || d.home.cta.description,
      tone: 'dark',
      primaryButton: {
        label: custom?.p || d.home.cta.primaryButton,
        href: custom?.pHref || '/signup',
      },
      secondaryButton: {
        label: custom?.s || d.home.cta.secondaryButton,
        href: custom?.sHref || '/demo',
      },
    },
  });

  // -------------------------------------------------------------------------
  // 1. HOME (/) - en & bn
  // -------------------------------------------------------------------------
  const buildHomeBlocks = (d: Record<string, any>): CmsBlock[] => [
    {
      id: 'home-hero-heading',
      type: 'heading',
      props: {
        level: 1,
        text: clip(d.home.hero.title, 230),
        subtitle: clip(d.home.hero.subtitle, 490),
        align: 'left',
      },
    },
    {
      id: 'home-hero-actions',
      type: 'columns',
      props: {
        ratio: '50-50',
        gap: 'md',
        columns: [
          {
            id: 'col-primary-cta',
            blocks: [
              {
                id: 'home-hero-primary-btn',
                type: 'button',
                props: {
                  label: d.home.hero.primaryCta,
                  href: '/signup',
                  variant: 'primary',
                  size: 'lg',
                  openInNewTab: false,
                },
              },
            ],
          },
          {
            id: 'col-secondary-cta',
            blocks: [
              {
                id: 'home-hero-secondary-btn',
                type: 'button',
                props: {
                  label: d.home.hero.secondaryCta,
                  href: '/demo',
                  variant: 'outline',
                  size: 'lg',
                  openInNewTab: false,
                },
              },
            ],
          },
        ],
      },
    },
    {
      id: 'home-differentiators',
      type: 'feature_cards',
      props: {
        heading: d.home.differentiators.title,
        subtitle: d.home.differentiators.subtitle,
        columns: 2,
        cards: [
          {
            id: 'diff-country',
            title: d.home.differentiators.countryCore.title,
            description: clip(d.home.differentiators.countryCore.description),
            badge: d.home.differentiators.countryCore.badge,
            linkHref: '/solutions/countries',
          },
          {
            id: 'diff-offline',
            title: d.home.differentiators.offlineAttendance.title,
            description: clip(d.home.differentiators.offlineAttendance.description),
            badge: d.home.differentiators.offlineAttendance.badge,
            linkHref: '/features/attendance',
          },
          {
            id: 'diff-payroll',
            title: d.home.differentiators.payrollEngine.title,
            description: clip(d.home.differentiators.payrollEngine.description),
            badge: d.home.differentiators.payrollEngine.badge,
            linkHref: '/features/payroll',
          },
          {
            id: 'diff-audit',
            title: d.home.differentiators.auditTrail.title,
            description: clip(d.home.differentiators.auditTrail.description),
            badge: d.home.differentiators.auditTrail.badge,
            linkHref: '/security',
          },
        ],
      },
    },
    {
      id: 'home-modules-grid',
      type: 'feature_cards',
      props: {
        heading: d.home.modules.title,
        subtitle: d.home.modules.subtitle,
        columns: 2,
        cards: (d.home.modules.groups as any[]).map((g) => ({
          id: `mod-${g.id}`,
          title: g.title,
          description: clip(g.description),
          badge: g.badge || g.refs,
        })),
      },
    },
    {
      id: 'home-how-it-works',
      type: 'feature_cards',
      props: {
        heading: d.home.howItWorks.title,
        subtitle: d.home.howItWorks.subtitle,
        columns: 3,
        cards: (d.home.howItWorks.steps as any[]).map((s, idx) => ({
          id: `step-${idx + 1}`,
          title: `${s.number}. ${s.title}`,
          description: clip(s.description),
          badge: s.refs,
        })),
      },
    },
    {
      id: 'home-telemetry-intro',
      type: 'rich_text',
      props: {
        html: `<h2>${escapeHtml(d.home.telemetry.title)}</h2><p>${escapeHtml(d.home.telemetry.subtitle)}</p>`,
      },
    },
    {
      id: 'home-faq',
      type: 'faq_list',
      props: {
        heading: d.home.faq.title,
        category: 'general',
        pageSlug: 'home',
        limit: 10,
      },
    },
    ctaFor(d),
  ];

  pages.push({
    slug: 'home',
    canonicalPath: '/',
    isLegal: false,
    targetPageStatus: 'published',
    requiresApproval: false,
    targetApprovalStatus: 'none',
    targetPublished: true,
    locales: [
      buildPageLocaleSnapshot({
        slug: 'home',
        locale: 'en',
        title: en.meta.defaultTitle,
        seoTitle: en.meta.defaultTitle,
        seoDescription: en.meta.description,
        canonicalPath: '/',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildHomeBlocks(en),
      }),
      buildPageLocaleSnapshot({
        slug: 'home',
        locale: 'bn',
        title: bn.meta.defaultTitle,
        seoTitle: bn.meta.defaultTitle,
        seoDescription: bn.meta.description,
        canonicalPath: '/',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildHomeBlocks(bn),
      }),
    ],
  });

  // -------------------------------------------------------------------------
  // 2. FEATURES OVERVIEW (/features) & 7 FEATURE DETAIL PAGES
  // -------------------------------------------------------------------------
  const buildFeaturesOverviewBlocks = (d: Record<string, any>): CmsBlock[] => {
    const featureSpecs = Object.values(d.features.pages) as any[];
    const liveCards = featureSpecs
      .filter((f) => f.phaseStatus === 'live')
      .map((f) => ({
        id: `feat-${f.slug}`,
        title: f.title,
        description: clip(f.summary),
        badge: f.phaseBadge,
        linkHref: `/features/${f.slug}`,
      }));
    const upcomingCards = featureSpecs
      .filter((f) => f.phaseStatus === 'coming_soon')
      .map((f) => ({
        id: `feat-${f.slug}`,
        title: f.title,
        description: clip(f.summary),
        badge: f.phaseBadge,
        linkHref: `/features/${f.slug}`,
      }));

    const blocks: CmsBlock[] = [
      {
        id: 'features-hero',
        type: 'heading',
        props: {
          level: 1,
          text: d.features.overview.title,
          subtitle: d.features.overview.subtitle,
          align: 'left',
        },
      },
    ];
    if (liveCards.length > 0) {
      blocks.push({
        id: 'features-live-grid',
        type: 'feature_cards',
        props: {
          heading: d.features.overview.liveGroupHeading,
          subtitle: d.features.overview.liveGroupSubtitle,
          columns: 2,
          cards: liveCards,
        },
      });
    }
    if (upcomingCards.length > 0) {
      blocks.push({
        id: 'features-upcoming-grid',
        type: 'feature_cards',
        props: {
          heading: d.features.overview.upcomingGroupHeading,
          subtitle: d.features.overview.upcomingGroupSubtitle,
          columns: 2,
          cards: upcomingCards,
        },
      });
    }
    blocks.push(
      ctaFor(d, {
        title: d.features.overview.cta.title,
        desc: d.features.overview.cta.description,
        p: d.features.overview.cta.primaryLabel,
        s: d.features.overview.cta.secondaryLabel,
      }),
    );
    return blocks;
  };

  pages.push({
    slug: 'features',
    canonicalPath: '/features',
    isLegal: false,
    targetPageStatus: 'published',
    requiresApproval: false,
    targetApprovalStatus: 'none',
    targetPublished: true,
    locales: [
      buildPageLocaleSnapshot({
        slug: 'features',
        locale: 'en',
        title: en.features.overview.metaTitle,
        seoTitle: en.features.overview.metaTitle,
        seoDescription: en.features.overview.metaDescription,
        canonicalPath: '/features',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildFeaturesOverviewBlocks(en),
      }),
      buildPageLocaleSnapshot({
        slug: 'features',
        locale: 'bn',
        title: bn.features.overview.metaTitle,
        seoTitle: bn.features.overview.metaTitle,
        seoDescription: bn.features.overview.metaDescription,
        canonicalPath: '/features',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildFeaturesOverviewBlocks(bn),
      }),
    ],
  });

  const buildFeatureDetailBlocks = (spec: any): CmsBlock[] => {
    const blocks: CmsBlock[] = [
      {
        id: `feat-${spec.slug}-hero`,
        type: 'heading',
        props: {
          level: 1,
          text: spec.headline,
          subtitle: spec.summary,
          align: 'left',
        },
      },
    ];
    if (spec.phaseNotice) {
      blocks.push({
        id: `feat-${spec.slug}-phase-notice`,
        type: 'rich_text',
        props: {
          html: `<blockquote><p><strong>${escapeHtml(spec.phaseBadge)}:</strong> ${escapeHtml(spec.phaseNotice)}</p></blockquote>`,
        },
      });
    }
    blocks.push({
      id: `feat-${spec.slug}-who`,
      type: 'rich_text',
      props: {
        html: `<h2>${escapeHtml(spec.whoItIsFor.heading)}</h2><p>${escapeHtml(spec.whoItIsFor.audience)}</p>${bulletsToHtml(spec.whoItIsFor.outcomes)}`,
      },
    });
    blocks.push({
      id: `feat-${spec.slug}-blocks`,
      type: 'feature_cards',
      props: {
        heading: spec.title,
        subtitle: spec.moduleRefs,
        columns: 2,
        cards: (spec.blocks as any[]).map((b) => ({
          id: `fb-${b.id}`,
          title: b.title,
          description: clip(`${b.description} (${b.bullets.join('; ')})`),
          badge: b.phaseLabel,
        })),
      },
    });
    blocks.push({
      id: `feat-${spec.slug}-cta`,
      type: 'cta_band',
      props: {
        title: spec.cta.title,
        description: spec.cta.description,
        tone: 'dark',
        primaryButton: { label: spec.cta.primaryLabel, href: '/signup' },
        secondaryButton: { label: spec.cta.secondaryLabel, href: '/demo' },
      },
    });
    return blocks;
  };

  for (const [featureKey, enSpec] of Object.entries<any>(en.features.pages)) {
    const pageSlug = `features-${featureKey}`;
    const canonicalPath = `/features/${featureKey}`;
    const bnSpec = bn.features.pages[featureKey];
    const hasBn = Boolean(rawBn?.features?.pages?.[featureKey]);

    pages.push({
      slug: pageSlug,
      canonicalPath,
      isLegal: false,
      targetPageStatus: 'published',
      requiresApproval: false,
      targetApprovalStatus: 'none',
      targetPublished: true,
      locales: [
        buildPageLocaleSnapshot({
          slug: pageSlug,
          locale: 'en',
          title: enSpec.title,
          seoTitle: enSpec.headline,
          seoDescription: enSpec.summary,
          canonicalPath,
          isLegal: false,
          isTranslated: true,
          translationStatus: 'translated',
          rawBlocks: buildFeatureDetailBlocks(enSpec),
        }),
        ...(hasBn && bnSpec
          ? [
              buildPageLocaleSnapshot({
                slug: pageSlug,
                locale: 'bn',
                title: bnSpec.title,
                seoTitle: bnSpec.headline,
                seoDescription: bnSpec.summary,
                canonicalPath,
                isLegal: false,
                isTranslated: true,
                translationStatus: 'translated',
                rawBlocks: buildFeatureDetailBlocks(bnSpec),
              }),
            ]
          : []),
      ],
    });
  }

  // -------------------------------------------------------------------------
  // 3. SOLUTIONS OVERVIEW (/solutions), COUNTRIES (/solutions/countries) & 5 SEGMENTS
  // -------------------------------------------------------------------------
  const buildSolutionsOverviewBlocks = (d: Record<string, any>): CmsBlock[] => {
    const segs = Object.values(d.solutions.segments) as any[];
    const sizeCards = segs
      .filter((s) => s.category === 'company_size')
      .map((s) => ({
        id: `sol-${s.slug}`,
        title: s.title,
        description: clip(s.summary),
        badge: s.categoryLabel,
        linkHref: `/solutions/${s.slug}`,
      }));
    const workforceCards = segs
      .filter((s) => s.category === 'workforce_type')
      .map((s) => ({
        id: `sol-${s.slug}`,
        title: s.title,
        description: clip(s.summary),
        badge: s.categoryLabel,
        linkHref: `/solutions/${s.slug}`,
      }));

    const blocks: CmsBlock[] = [
      {
        id: 'solutions-hero',
        type: 'heading',
        props: {
          level: 1,
          text: d.solutions.overview.title,
          subtitle: d.solutions.overview.subtitle,
          align: 'left',
        },
      },
    ];
    if (sizeCards.length > 0) {
      blocks.push({
        id: 'solutions-size',
        type: 'feature_cards',
        props: {
          heading: d.solutions.overview.sizeHeading,
          subtitle: d.solutions.overview.sizeSubtitle,
          columns: 3,
          cards: sizeCards,
        },
      });
    }
    if (workforceCards.length > 0) {
      blocks.push({
        id: 'solutions-workforce',
        type: 'feature_cards',
        props: {
          heading: d.solutions.overview.workforceHeading,
          subtitle: d.solutions.overview.workforceSubtitle,
          columns: 2,
          cards: workforceCards,
        },
      });
    }
    blocks.push({
      id: 'solutions-country-cta',
      type: 'cta_band',
      props: {
        title: d.solutions.overview.countryBannerTitle,
        description: d.solutions.overview.countryBannerDesc,
        tone: 'tinted',
        primaryButton: {
          label: d.solutions.overview.countryBannerCta,
          href: '/solutions/countries',
        },
      },
    });
    return blocks;
  };

  pages.push({
    slug: 'solutions',
    canonicalPath: '/solutions',
    isLegal: false,
    targetPageStatus: 'published',
    requiresApproval: false,
    targetApprovalStatus: 'none',
    targetPublished: true,
    locales: [
      buildPageLocaleSnapshot({
        slug: 'solutions',
        locale: 'en',
        title: en.solutions.overview.metaTitle,
        seoTitle: en.solutions.overview.metaTitle,
        seoDescription: en.solutions.overview.metaDescription,
        canonicalPath: '/solutions',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildSolutionsOverviewBlocks(en),
      }),
      buildPageLocaleSnapshot({
        slug: 'solutions',
        locale: 'bn',
        title: bn.solutions.overview.metaTitle,
        seoTitle: bn.solutions.overview.metaTitle,
        seoDescription: bn.solutions.overview.metaDescription,
        canonicalPath: '/solutions',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildSolutionsOverviewBlocks(bn),
      }),
    ],
  });

  const buildCountriesBlocks = (d: Record<string, any>): CmsBlock[] => [
    {
      id: 'countries-hero',
      type: 'heading',
      props: {
        level: 1,
        text: d.countries.index.title,
        subtitle: d.countries.index.subtitle,
        align: 'left',
      },
    },
    {
      id: 'countries-live-list',
      type: 'dynamic_block',
      props: {
        widget: 'country_list',
        heading: d.countries.index.selectorLabel,
        subtitle: d.countries.index.eyebrow,
      },
    },
    ctaFor(d),
  ];

  pages.push({
    slug: 'solutions-countries',
    canonicalPath: '/solutions/countries',
    isLegal: false,
    targetPageStatus: 'published',
    requiresApproval: false,
    targetApprovalStatus: 'none',
    targetPublished: true,
    locales: [
      buildPageLocaleSnapshot({
        slug: 'solutions-countries',
        locale: 'en',
        title: en.countries.index.metaTitle,
        seoTitle: en.countries.index.metaTitle,
        seoDescription: en.countries.index.metaDescription,
        canonicalPath: '/solutions/countries',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildCountriesBlocks(en),
      }),
      buildPageLocaleSnapshot({
        slug: 'solutions-countries',
        locale: 'bn',
        title: bn.countries.index.metaTitle,
        seoTitle: bn.countries.index.metaTitle,
        seoDescription: bn.countries.index.metaDescription,
        canonicalPath: '/solutions/countries',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildCountriesBlocks(bn),
      }),
    ],
  });

  const buildSolutionSegmentBlocks = (seg: any): CmsBlock[] => [
    {
      id: `sol-${seg.slug}-hero`,
      type: 'heading',
      props: {
        level: 1,
        text: seg.headline,
        subtitle: seg.summary,
        align: 'left',
      },
    },
    {
      id: `sol-${seg.slug}-fit`,
      type: 'rich_text',
      props: {
        html: `<h2>${escapeHtml(seg.whoItIsFor.heading)}</h2><p>${escapeHtml(seg.whoItIsFor.description)}</p>${bulletsToHtml(seg.whoItIsFor.highlights)}`,
      },
    },
    {
      id: `sol-${seg.slug}-caps`,
      type: 'feature_cards',
      props: {
        heading: seg.title,
        subtitle: seg.eyebrow,
        columns: 3,
        cards: (seg.capabilities as any[]).map((c) => ({
          id: `cap-${c.id}`,
          title: c.title,
          description: clip(`${c.description} (${c.bullets.join('; ')})`),
          badge: c.moduleRefs,
        })),
      },
    },
    {
      id: `sol-${seg.slug}-cta`,
      type: 'cta_band',
      props: {
        title: seg.cta.title,
        description: seg.cta.description,
        tone: 'dark',
        primaryButton: { label: seg.cta.primaryLabel, href: '/signup' },
        secondaryButton: { label: seg.cta.secondaryLabel, href: '/demo' },
      },
    },
  ];

  for (const [segKey, enSeg] of Object.entries<any>(en.solutions.segments)) {
    const pageSlug = `solutions-${segKey}`;
    const canonicalPath = `/solutions/${segKey}`;
    const bnSeg = bn.solutions.segments[segKey];
    const hasBn = Boolean(rawBn?.solutions?.segments?.[segKey]);

    pages.push({
      slug: pageSlug,
      canonicalPath,
      isLegal: false,
      targetPageStatus: 'published',
      requiresApproval: false,
      targetApprovalStatus: 'none',
      targetPublished: true,
      locales: [
        buildPageLocaleSnapshot({
          slug: pageSlug,
          locale: 'en',
          title: enSeg.title,
          seoTitle: enSeg.headline,
          seoDescription: enSeg.summary,
          canonicalPath,
          isLegal: false,
          isTranslated: true,
          translationStatus: 'translated',
          rawBlocks: buildSolutionSegmentBlocks(enSeg),
        }),
        ...(hasBn && bnSeg
          ? [
              buildPageLocaleSnapshot({
                slug: pageSlug,
                locale: 'bn',
                title: bnSeg.title,
                seoTitle: bnSeg.headline,
                seoDescription: bnSeg.summary,
                canonicalPath,
                isLegal: false,
                isTranslated: true,
                translationStatus: 'translated',
                rawBlocks: buildSolutionSegmentBlocks(bnSeg),
              }),
            ]
          : []),
      ],
    });
  }

  // -------------------------------------------------------------------------
  // 4. PRICING (/pricing) — Dynamic blocks (NO hardcoded prices) + Pricing FAQs
  // -------------------------------------------------------------------------
  const buildPricingBlocks = (d: Record<string, any>): CmsBlock[] => [
    {
      id: 'pricing-hero',
      type: 'heading',
      props: {
        level: 1,
        text: d.pricing.title,
        subtitle: d.pricing.subtitle,
        align: 'left',
      },
    },
    {
      id: 'pricing-live-table',
      type: 'dynamic_block',
      props: {
        widget: 'pricing_table',
        heading: d.pricing.eyebrow,
        subtitle: d.pricing.controls.annualBadge,
      },
    },
    {
      id: 'pricing-estimator-copy',
      type: 'rich_text',
      props: {
        html: `<h2>${escapeHtml(d.pricing.calculator.title)}</h2><p>${escapeHtml(d.pricing.calculator.subtitle)}</p><p><em>${escapeHtml(d.pricing.calculator.disclaimer)}</em></p>`,
      },
    },
    {
      id: 'pricing-live-comparison',
      type: 'dynamic_block',
      props: {
        widget: 'plan_comparison',
        heading: d.pricing.matrix.title,
        subtitle: d.pricing.matrix.subtitle,
      },
    },
    {
      id: 'pricing-faq',
      type: 'faq_list',
      props: {
        heading: d.pricing.faq.title,
        category: 'pricing',
        pageSlug: 'pricing',
        limit: 10,
      },
    },
    ctaFor(d, {
      title: d.pricing.cta.heading,
      desc: d.pricing.cta.body,
      p: d.pricing.cta.primaryCta,
      s: d.pricing.cta.secondaryCta,
      sHref: '/contact?topic=sales',
    }),
  ];

  pages.push({
    slug: 'pricing',
    canonicalPath: '/pricing',
    isLegal: false,
    targetPageStatus: 'published',
    requiresApproval: false,
    targetApprovalStatus: 'none',
    targetPublished: true,
    locales: [
      buildPageLocaleSnapshot({
        slug: 'pricing',
        locale: 'en',
        title: en.pricing.metaTitle,
        seoTitle: en.pricing.metaTitle,
        seoDescription: en.pricing.metaDescription,
        canonicalPath: '/pricing',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildPricingBlocks(en),
      }),
      buildPageLocaleSnapshot({
        slug: 'pricing',
        locale: 'bn',
        title: bn.pricing.metaTitle,
        seoTitle: bn.pricing.metaTitle,
        seoDescription: bn.pricing.metaDescription,
        canonicalPath: '/pricing',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildPricingBlocks(bn),
      }),
    ],
  });

  // -------------------------------------------------------------------------
  // 5. SECURITY (/security)
  // -------------------------------------------------------------------------
  const buildSecurityBlocks = (d: Record<string, any>): CmsBlock[] => [
    {
      id: 'security-hero',
      type: 'heading',
      props: {
        level: 1,
        text: d.security.title,
        subtitle: d.security.subtitle,
        align: 'left',
      },
    },
    {
      id: 'security-review-note',
      type: 'rich_text',
      props: {
        html: `<p><strong>${escapeHtml(d.security.lastReviewedLabel)}</strong> ${escapeHtml(d.security.lastReviewedDate)}</p><p>${escapeHtml(d.security.noFakeBadgesNote)}</p>`,
      },
    },
    {
      id: 'security-how-it-works',
      type: 'feature_cards',
      props: {
        heading: d.security.howItWorks.title,
        subtitle: d.security.howItWorks.subtitle,
        columns: 3,
        cards: (d.security.howItWorks.steps as any[]).map((s) => ({
          id: `sec-step-${s.step}`,
          title: `${s.step}. ${s.title}`,
          description: s.description,
        })),
      },
    },
    {
      id: 'security-controls',
      type: 'feature_cards',
      props: {
        heading: d.security.controlsSection.title,
        subtitle: d.security.controlsSection.subtitle,
        columns: 2,
        cards: (d.security.controlsSection.controls as any[]).map((c) => ({
          id: `ctrl-${c.id}`,
          title: c.title,
          description: clip(`${c.summary} ${c.details.join(' ')}`),
        })),
      },
    },
    {
      id: 'security-support-flow',
      type: 'feature_cards',
      props: {
        heading: d.security.supportFlow.title,
        subtitle: d.security.supportFlow.subtitle,
        columns: 2,
        cards: (d.security.supportFlow.steps as any[]).map((s, idx) => ({
          id: `sup-step-${idx + 1}`,
          title: s.label,
          description: s.detail,
        })),
      },
    },
    ctaFor(d, {
      title: d.security.cta.title,
      desc: d.security.cta.description,
      p: d.security.cta.primaryCta,
      s: d.security.cta.secondaryCta,
    }),
  ];

  pages.push({
    slug: 'security',
    canonicalPath: '/security',
    isLegal: false,
    targetPageStatus: 'published',
    requiresApproval: false,
    targetApprovalStatus: 'none',
    targetPublished: true,
    locales: [
      buildPageLocaleSnapshot({
        slug: 'security',
        locale: 'en',
        title: en.security.metaTitle,
        seoTitle: en.security.metaTitle,
        seoDescription: en.security.metaDescription,
        canonicalPath: '/security',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildSecurityBlocks(en),
      }),
      ...(rawBn?.security
        ? [
            buildPageLocaleSnapshot({
              slug: 'security',
              locale: 'bn',
              title: bn.security.metaTitle,
              seoTitle: bn.security.metaTitle,
              seoDescription: bn.security.metaDescription,
              canonicalPath: '/security',
              isLegal: false,
              isTranslated: true,
              translationStatus: 'translated',
              rawBlocks: buildSecurityBlocks(bn),
            }),
          ]
        : []),
    ],
  });

  // -------------------------------------------------------------------------
  // 6. ABOUT (/about) & CAREERS (/careers)
  // -------------------------------------------------------------------------
  const buildAboutBlocks = (d: Record<string, any>): CmsBlock[] => {
    const about = d.company.about;
    return [
      {
        id: 'about-hero',
        type: 'heading',
        props: {
          level: 1,
          text: about.title,
          subtitle: about.subtitle,
          align: 'left',
        },
      },
      {
        id: 'about-mission-story',
        type: 'rich_text',
        props: {
          html: `<h2>${escapeHtml(about.mission.title)}</h2><p>${escapeHtml(about.mission.description)}</p>${bulletsToHtml(about.mission.highlights.map((h: any) => `${h.label}: ${h.value}`))}<h2>${escapeHtml(about.story.title)}</h2>${about.story.paragraphs.map((p: string) => `<p>${escapeHtml(p)}</p>`).join('')}`,
        },
      },
      {
        id: 'about-principles',
        type: 'feature_cards',
        props: {
          heading: about.principles.title,
          subtitle: about.principles.description,
          columns: 2,
          cards: (about.principles.items as any[]).map((item) => ({
            id: `pr-${item.id}`,
            title: item.title,
            description: item.description,
          })),
        },
      },
      {
        id: 'about-team',
        type: 'feature_cards',
        props: {
          heading: about.team.title,
          subtitle: about.team.placeholderNotice,
          columns: 3,
          cards: (about.team.slots as any[]).map((slot) => ({
            id: slot.id,
            title: slot.name,
            description: `${slot.role} — ${slot.bio}`,
            badge: about.team.rolePendingBadge,
          })),
        },
      },
      ctaFor(d, {
        title: about.cta.heading,
        desc: about.cta.body,
        p: about.cta.primaryCta,
        s: about.cta.secondaryCta,
      }),
    ];
  };

  pages.push({
    slug: 'about',
    canonicalPath: '/about',
    isLegal: false,
    targetPageStatus: 'published',
    requiresApproval: false,
    targetApprovalStatus: 'none',
    targetPublished: true,
    locales: [
      buildPageLocaleSnapshot({
        slug: 'about',
        locale: 'en',
        title: en.company.about.metaTitle,
        seoTitle: en.company.about.metaTitle,
        seoDescription: en.company.about.metaDescription,
        canonicalPath: '/about',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildAboutBlocks(en),
      }),
      ...(rawBn?.company?.about
        ? [
            buildPageLocaleSnapshot({
              slug: 'about',
              locale: 'bn',
              title: bn.company.about.metaTitle,
              seoTitle: bn.company.about.metaTitle,
              seoDescription: bn.company.about.metaDescription,
              canonicalPath: '/about',
              isLegal: false,
              isTranslated: true,
              translationStatus: 'translated',
              rawBlocks: buildAboutBlocks(bn),
            }),
          ]
        : []),
    ],
  });

  const buildCareersBlocks = (d: Record<string, any>): CmsBlock[] => {
    const c = d.company.careers;
    return [
      {
        id: 'careers-hero',
        type: 'heading',
        props: {
          level: 1,
          text: c.title,
          subtitle: c.subtitle,
          align: 'left',
        },
      },
      {
        id: 'careers-openings-intro',
        type: 'rich_text',
        props: {
          html: `<h2>${escapeHtml(c.openings.title)}</h2><p>${escapeHtml(c.openings.description)}</p><h3>${escapeHtml(c.openings.empty.title)}</h3><p>${escapeHtml(c.openings.empty.body)}</p>`,
        },
      },
      {
        id: 'careers-culture',
        type: 'feature_cards',
        props: {
          heading: c.culture.title,
          subtitle: c.culture.description,
          columns: 2,
          cards: (c.culture.items as any[]).map((item) => ({
            id: `cul-${item.id}`,
            title: item.title,
            description: item.description,
          })),
        },
      },
      ctaFor(d, {
        title: c.cta.heading,
        desc: c.cta.body,
        p: c.cta.primaryCta,
        s: c.cta.secondaryCta,
        sHref: '/contact',
      }),
    ];
  };

  pages.push({
    slug: 'careers',
    canonicalPath: '/careers',
    isLegal: false,
    targetPageStatus: 'published',
    requiresApproval: false,
    targetApprovalStatus: 'none',
    targetPublished: true,
    locales: [
      buildPageLocaleSnapshot({
        slug: 'careers',
        locale: 'en',
        title: en.company.careers.metaTitle,
        seoTitle: en.company.careers.metaTitle,
        seoDescription: en.company.careers.metaDescription,
        canonicalPath: '/careers',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildCareersBlocks(en),
      }),
      ...(rawBn?.company?.careers
        ? [
            buildPageLocaleSnapshot({
              slug: 'careers',
              locale: 'bn',
              title: bn.company.careers.metaTitle,
              seoTitle: bn.company.careers.metaTitle,
              seoDescription: bn.company.careers.metaDescription,
              canonicalPath: '/careers',
              isLegal: false,
              isTranslated: true,
              translationStatus: 'translated',
              rawBlocks: buildCareersBlocks(bn),
            }),
          ]
        : []),
    ],
  });

  // -------------------------------------------------------------------------
  // 7. CONTACT (/contact) & BOOK A DEMO (/demo)
  // -------------------------------------------------------------------------
  const buildContactBlocks = (d: Record<string, any>): CmsBlock[] => {
    const ct = d.leads.contact;
    return [
      {
        id: 'contact-hero',
        type: 'heading',
        props: {
          level: 1,
          text: ct.title,
          subtitle: ct.subtitle,
          align: 'left',
        },
      },
      {
        id: 'contact-topics',
        type: 'feature_cards',
        props: {
          heading: ct.topicHeading,
          columns: 2,
          cards: (ct.topics as any[]).map((topic) => ({
            id: `topic-${topic.id}`,
            title: topic.label,
            description: topic.shortDescription,
          })),
        },
      },
      {
        id: 'contact-guidance',
        type: 'rich_text',
        props: {
          html: `<h2>${escapeHtml(ct.forms.salesHeading)}</h2><p>${escapeHtml(ct.forms.salesSubtitle)}</p><h3>${escapeHtml(ct.supportGuidance.title)}</h3><p>${escapeHtml(ct.supportGuidance.body)}</p>${bulletsToHtml(ct.supportGuidance.reasons)}<p><strong>${escapeHtml(ct.confirmation.salesTitle)}</strong>: ${escapeHtml(ct.confirmation.body)}</p>`,
        },
      },
    ];
  };

  pages.push({
    slug: 'contact',
    canonicalPath: '/contact',
    isLegal: false,
    targetPageStatus: 'published',
    requiresApproval: false,
    targetApprovalStatus: 'none',
    targetPublished: true,
    locales: [
      buildPageLocaleSnapshot({
        slug: 'contact',
        locale: 'en',
        title: en.leads.contact.metaTitle,
        seoTitle: en.leads.contact.metaTitle,
        seoDescription: en.leads.contact.metaDescription,
        canonicalPath: '/contact',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildContactBlocks(en),
      }),
      buildPageLocaleSnapshot({
        slug: 'contact',
        locale: 'bn',
        title: bn.leads.contact.metaTitle,
        seoTitle: bn.leads.contact.metaTitle,
        seoDescription: bn.leads.contact.metaDescription,
        canonicalPath: '/contact',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildContactBlocks(bn),
      }),
    ],
  });

  const buildDemoBlocks = (d: Record<string, any>): CmsBlock[] => {
    const dm = d.leads.demo;
    return [
      {
        id: 'demo-hero',
        type: 'heading',
        props: {
          level: 1,
          text: dm.title,
          subtitle: dm.subtitle,
          align: 'left',
        },
      },
      {
        id: 'demo-highlights-copy',
        type: 'rich_text',
        props: {
          html: `<h2>${escapeHtml(dm.form.heading)}</h2>${bulletsToHtml(dm.highlights)}<h3>${escapeHtml(dm.thankYou.title)}</h3><p>${escapeHtml(dm.thankYou.bodyDefault)}</p>`,
        },
      },
      {
        id: 'demo-pricing-cta',
        type: 'cta_band',
        props: {
          title: dm.thankYou.schedulerHeading,
          description: dm.thankYou.schedulerPendingNotice,
          tone: 'tinted',
          primaryButton: { label: dm.thankYou.viewPricingCta, href: '/pricing' },
          secondaryButton: { label: dm.thankYou.exploreFeaturesCta, href: '/features' },
        },
      },
    ];
  };

  pages.push({
    slug: 'demo',
    canonicalPath: '/demo',
    isLegal: false,
    targetPageStatus: 'published',
    requiresApproval: false,
    targetApprovalStatus: 'none',
    targetPublished: true,
    locales: [
      buildPageLocaleSnapshot({
        slug: 'demo',
        locale: 'en',
        title: en.leads.demo.metaTitle,
        seoTitle: en.leads.demo.metaTitle,
        seoDescription: en.leads.demo.metaDescription,
        canonicalPath: '/demo',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildDemoBlocks(en),
      }),
      buildPageLocaleSnapshot({
        slug: 'demo',
        locale: 'bn',
        title: bn.leads.demo.metaTitle,
        seoTitle: bn.leads.demo.metaTitle,
        seoDescription: bn.leads.demo.metaDescription,
        canonicalPath: '/demo',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildDemoBlocks(bn),
      }),
    ],
  });

  // -------------------------------------------------------------------------
  // 8. HELP CENTER INTRO (/help) & 404 TEXT (/not-found)
  // -------------------------------------------------------------------------
  const buildHelpIntroBlocks = (d: Record<string, any>): CmsBlock[] => [
    {
      id: 'help-hero',
      type: 'heading',
      props: {
        level: 1,
        text: d.help.title,
        subtitle: d.help.subtitle,
        align: 'left',
      },
    },
    {
      id: 'help-intro-copy',
      type: 'rich_text',
      props: {
        html: `<h2>${escapeHtml(d.help.categoriesHeading)}</h2><p>${escapeHtml(d.help.categoriesSubtitle)}</p><h2>${escapeHtml(d.help.popularHeading)}</h2><p>${escapeHtml(d.help.popularSubtitle)}</p><h3>${escapeHtml(d.help.articlePage.existingCustomerTitle)}</h3><p>${escapeHtml(d.help.articlePage.existingCustomerBody)}</p>`,
      },
    },
    {
      id: 'help-cta',
      type: 'cta_band',
      props: {
        title: d.help.articlePage.existingCustomerTitle,
        description: d.help.articlePage.existingCustomerBody,
        tone: 'tinted',
        primaryButton: { label: d.help.articlePage.logInCta, href: '/login' },
        secondaryButton: {
          label: d.help.articlePage.existingCustomerCta,
          href: '/contact?topic=support',
        },
      },
    },
  ];

  pages.push({
    slug: 'help',
    canonicalPath: '/help',
    isLegal: false,
    targetPageStatus: 'published',
    requiresApproval: false,
    targetApprovalStatus: 'none',
    targetPublished: true,
    locales: [
      buildPageLocaleSnapshot({
        slug: 'help',
        locale: 'en',
        title: en.help.metaTitle,
        seoTitle: en.help.metaTitle,
        seoDescription: en.help.metaDescription,
        canonicalPath: '/help',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildHelpIntroBlocks(en),
      }),
      buildPageLocaleSnapshot({
        slug: 'help',
        locale: 'bn',
        title: bn.help.metaTitle,
        seoTitle: bn.help.metaTitle,
        seoDescription: bn.help.metaDescription,
        canonicalPath: '/help',
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildHelpIntroBlocks(bn),
      }),
    ],
  });

  const buildNotFoundBlocks = (d: Record<string, any>): CmsBlock[] => {
    const nf = d.errors.notFound;
    return [
      {
        id: 'not-found-hero',
        type: 'heading',
        props: {
          level: 1,
          text: nf.title,
          subtitle: nf.description,
          align: 'center',
        },
      },
      {
        id: 'not-found-home-btn',
        type: 'button',
        props: {
          label: nf.primaryCta,
          href: '/',
          variant: 'primary',
          size: 'md',
          openInNewTab: false,
        },
      },
      {
        id: 'not-found-destinations',
        type: 'feature_cards',
        props: {
          heading: nf.helpfulHeading,
          columns: 3,
          cards: [
            { id: 'dest-home', title: nf.links.home, description: '/', linkHref: '/' },
            { id: 'dest-status', title: nf.links.telemetry, description: '/status', linkHref: '/status' },
            { id: 'dest-login', title: nf.links.login, description: '/login', linkHref: '/login' },
          ],
        },
      },
    ];
  };

  pages.push({
    slug: 'not-found',
    canonicalPath: '/404',
    isLegal: false,
    targetPageStatus: 'published',
    requiresApproval: false,
    targetApprovalStatus: 'none',
    targetPublished: true,
    locales: [
      buildPageLocaleSnapshot({
        slug: 'not-found',
        locale: 'en',
        title: en.meta.notFoundTitle,
        seoTitle: en.meta.notFoundTitle,
        seoDescription: en.meta.notFoundDescription,
        canonicalPath: '/404',
        noIndex: true,
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildNotFoundBlocks(en),
      }),
      buildPageLocaleSnapshot({
        slug: 'not-found',
        locale: 'bn',
        title: bn.meta.notFoundTitle,
        seoTitle: bn.meta.notFoundTitle,
        seoDescription: bn.meta.notFoundDescription,
        canonicalPath: '/404',
        noIndex: true,
        isLegal: false,
        isTranslated: true,
        translationStatus: 'translated',
        rawBlocks: buildNotFoundBlocks(bn),
      }),
    ],
  });

  // -------------------------------------------------------------------------
  // 9. REMAINING SYSTEM SHELL PAGES (integrations, changelog, status, blog, customers)
  // -------------------------------------------------------------------------
  const shellDefs: Array<{
    slug: string;
    canonicalPath: string;
    noIndex?: boolean;
    getCopy: (d: Record<string, any>) => {
      metaTitle: string;
      metaDescription: string;
      title: string;
      subtitle: string;
      bodyHtml: string;
    };
  }> = [
    {
      slug: 'integrations',
      canonicalPath: '/integrations',
      getCopy: (d) => ({
        metaTitle: d.integrations.meta.title,
        metaDescription: d.integrations.meta.description,
        title: d.integrations.hero.title,
        subtitle: d.integrations.hero.subtitle,
        bodyHtml: `<p>${escapeHtml(d.integrations.hero.subtitle)}</p>`,
      }),
    },
    {
      slug: 'changelog',
      canonicalPath: '/changelog',
      getCopy: (d) => ({
        metaTitle: d.changelog.metaTitle,
        metaDescription: d.changelog.metaDescription,
        title: d.changelog.title,
        subtitle: d.changelog.subtitle,
        bodyHtml: `<p>${escapeHtml(d.changelog.shippedNote)}</p>`,
      }),
    },
    {
      slug: 'status',
      canonicalPath: '/status',
      getCopy: (d) => ({
        metaTitle: d.status.meta.title,
        metaDescription: d.status.meta.description,
        title: d.status.hero.title,
        subtitle: d.status.hero.subtitle,
        bodyHtml: `<p>${escapeHtml(d.status.components.subtitle)}</p>`,
      }),
    },
    {
      slug: 'blog',
      canonicalPath: '/blog',
      getCopy: (d) => ({
        metaTitle: d.blog.metaTitle,
        metaDescription: d.blog.metaDescription,
        title: d.blog.title,
        subtitle: d.blog.subtitle,
        bodyHtml: `<p>${escapeHtml(d.blog.emptyTitle)}</p>`,
      }),
    },
    {
      slug: 'customers',
      canonicalPath: '/customers',
      noIndex: true,
      getCopy: (d) => ({
        metaTitle: d.customers.index.metaTitle,
        metaDescription: d.customers.index.metaDescription,
        title: d.customers.index.title,
        subtitle: d.customers.index.metaDescription,
        bodyHtml: `<p>${escapeHtml(d.customers.index.empty.title)}</p>`,
      }),
    },
  ];

  for (const shell of shellDefs) {
    const enCopy = shell.getCopy(en);
    const bnCopy = shell.getCopy(bn);
    pages.push({
      slug: shell.slug,
      canonicalPath: shell.canonicalPath,
      isLegal: false,
      targetPageStatus: 'published',
      requiresApproval: false,
      targetApprovalStatus: 'none',
      targetPublished: true,
      locales: [
        buildPageLocaleSnapshot({
          slug: shell.slug,
          locale: 'en',
          title: enCopy.title,
          seoTitle: enCopy.metaTitle,
          seoDescription: enCopy.metaDescription,
          canonicalPath: shell.canonicalPath,
          noIndex: shell.noIndex,
          isLegal: false,
          isTranslated: true,
          translationStatus: 'translated',
          rawBlocks: [
            {
              id: `${shell.slug}-hero`,
              type: 'heading',
              props: { level: 1, text: enCopy.title, subtitle: enCopy.subtitle, align: 'left' },
            },
            {
              id: `${shell.slug}-intro`,
              type: 'rich_text',
              props: { html: enCopy.bodyHtml },
            },
          ],
        }),
        buildPageLocaleSnapshot({
          slug: shell.slug,
          locale: 'bn',
          title: bnCopy.title,
          seoTitle: bnCopy.metaTitle,
          seoDescription: bnCopy.metaDescription,
          canonicalPath: shell.canonicalPath,
          noIndex: shell.noIndex,
          isLegal: false,
          isTranslated: true,
          translationStatus: 'translated',
          rawBlocks: [
            {
              id: `${shell.slug}-hero`,
              type: 'heading',
              props: { level: 1, text: bnCopy.title, subtitle: bnCopy.subtitle, align: 'left' },
            },
            {
              id: `${shell.slug}-intro`,
              type: 'rich_text',
              props: { html: bnCopy.bodyHtml },
            },
          ],
        }),
      ],
    });
  }

  // -------------------------------------------------------------------------
  // 10. LEGAL PAGES (terms, privacy, cookies, dpa, subprocessors)
  // Imported strictly as DRAFT marked PENDING REVIEW — NEVER approved or published!
  // -------------------------------------------------------------------------
  for (const legalDoc of legalDocs) {
    const html = markdownToSanitizedHtml(legalDoc.bodyMarkdown);
    const blocks: CmsBlock[] = [
      {
        id: `legal-${legalDoc.slug}-hero`,
        type: 'heading',
        props: {
          level: 1,
          text: legalDoc.title,
          subtitle: `${legalDoc.draftNotice} · Version ${legalDoc.version} · Effective ${legalDoc.effectiveDate}`,
          align: 'left',
        },
      },
      {
        id: `legal-${legalDoc.slug}-body`,
        type: 'rich_text',
        props: { html },
      },
    ];

    pages.push({
      slug: legalDoc.slug,
      canonicalPath: `/${legalDoc.slug}`,
      isLegal: true,
      targetPageStatus: 'draft',
      requiresApproval: true,
      targetApprovalStatus: 'pending_approval',
      targetPublished: false,
      locales: [
        buildPageLocaleSnapshot({
          slug: legalDoc.slug,
          locale: 'en',
          title: legalDoc.title,
          seoTitle: `${legalDoc.title} (Draft Pending Legal Review)`,
          seoDescription: legalDoc.summary,
          canonicalPath: `/${legalDoc.slug}`,
          noIndex: true,
          isLegal: true,
          isTranslated: true,
          translationStatus: 'in_review',
          rawBlocks: blocks,
        }),
      ],
    });
  }

  // Subprocessors legal page also imported strictly as DRAFT pending review
  const subcopy = en.legal.subprocessors;
  pages.push({
    slug: 'subprocessors',
    canonicalPath: '/subprocessors',
    isLegal: true,
    targetPageStatus: 'draft',
    requiresApproval: true,
    targetApprovalStatus: 'pending_approval',
    targetPublished: false,
    locales: [
      buildPageLocaleSnapshot({
        slug: 'subprocessors',
        locale: 'en',
        title: subcopy.title,
        seoTitle: `${subcopy.title} (Draft Pending Legal Review)`,
        seoDescription: subcopy.subtitle,
        canonicalPath: '/subprocessors',
        noIndex: true,
        isLegal: true,
        isTranslated: true,
        translationStatus: 'in_review',
        rawBlocks: [
          {
            id: 'subprocessors-hero',
            type: 'heading',
            props: {
              level: 1,
              text: subcopy.title,
              subtitle: subcopy.subtitle,
              align: 'left',
            },
          },
          {
            id: 'subprocessors-body',
            type: 'rich_text',
            props: {
              html: `<blockquote><p><strong>${escapeHtml(en.legal.badges.draftBannerTitle)}</strong></p></blockquote><h2>${escapeHtml(subcopy.tableTitle)}</h2><p>${escapeHtml(subcopy.unconfiguredTitle)}</p><p>${escapeHtml(subcopy.subscribeDescription)}</p>`,
            },
          },
        ],
      }),
    ],
  });

  // -------------------------------------------------------------------------
  // 11. FAQ ANSWERS (Home + Pricing) in EN + BN
  // -------------------------------------------------------------------------
  const faqs: PlannedFaqImport[] = [];
  const bnHomeFaqMap = new Map<string, { question: string; answer: string }>(
    (bn.home.faq.items as any[]).map((item) => [item.id, item]),
  );
  (en.home.faq.items as any[]).forEach((item, index) => {
    const bnItem = bnHomeFaqMap.get(item.id);
    const hasBnFaq = Boolean(rawBn?.home?.faq?.items?.[index]?.question && bnItem);
    faqs.push({
      category: 'general',
      pageSlug: 'home',
      questionEn: item.question,
      answerEn: item.answer,
      questionBn: bnItem?.question ?? null,
      answerBn: bnItem?.answer ?? null,
      isBnTranslated: hasBnFaq,
      sortOrder: index + 1,
    });
  });

  const bnPricingFaqMap = new Map<string, { question: string; answer: string }>(
    (bn.pricing.faq.items as any[]).map((item) => [item.id, item]),
  );
  (en.pricing.faq.items as any[]).forEach((item, index) => {
    const bnItem = bnPricingFaqMap.get(item.id);
    const hasBnFaq = Boolean(rawBn?.pricing?.faq?.items?.[index]?.question && bnItem);
    faqs.push({
      category: 'pricing',
      pageSlug: 'pricing',
      questionEn: item.question,
      answerEn: item.answer,
      questionBn: bnItem?.question ?? null,
      answerBn: bnItem?.answer ?? null,
      isBnTranslated: hasBnFaq,
      sortOrder: index + 1,
    });
  });

  return { pages, faqs, careers };
}

/**
 * Evaluates or applies a planned CMS import cleanly and deterministically.
 * - `mode: 'dry-run'` inspects DB state and prints/returns what WILL change without writing.
 * - `mode: 'apply'` is repeatable/idempotent: skips unchanged imported versions & FAQs,
 *   never marks legal pages as approved/published (imports them as draft + pending_approval).
 */
export async function executeWebsiteCmsImport(
  prisma: PrismaClient,
  plan: WebsiteCmsImportPlan,
  options: { mode: 'dry-run' | 'apply'; actorId?: string | null; actorEmail?: string },
): Promise<WebsiteCmsImportReport> {
  const isDryRun = options.mode === 'dry-run';
  const existingPages = await prisma.cmsPage.findMany({
    include: {
      locales: true,
      versions: {
        orderBy: { versionNumber: 'desc' },
      },
    },
  });
  const existingPagesBySlug = new Map(existingPages.map((p) => [p.slug, p]));
  const existingFaqs = await prisma.cmsFaq.findMany();
  const existingCareers = await prisma.cmsCareer.findMany();
  const existingCareersBySlug = new Map(existingCareers.map((c) => [c.slug, c]));

  const summary = {
    pagesTotal: plan.pages.length,
    pagesCreated: 0,
    versionsCreated: 0,
    versionsSkippedUnchanged: 0,
    legalDraftsMarkedPendingReview: 0,
    faqsCreatedOrUpdated: 0,
    faqsSkippedUnchanged: 0,
    careersImported: 0,
    careersSkipped: 0,
  };

  const pageDiffs: DryRunPageDiff[] = [];
  const faqDiffs: WebsiteCmsImportReport['faqs'] = [];
  const now = new Date();
  const authorName = options.actorEmail ?? 'website-import';

  for (const plannedPage of plan.pages) {
    const existing = existingPagesBySlug.get(plannedPage.slug);
    const isLegal = plannedPage.isLegal || CMS_LEGAL_PAGE_SLUG_SET.has(plannedPage.slug);
    const localesToImport: DryRunPageDiff['localesToImport'] = [];

    for (const locVer of plannedPage.locales) {
      const marker = `[website-import:sha256:${locVer.contentHash}]`;
      const existingLocVersions = (existing?.versions ?? []).filter(
        (v) => v.locale === locVer.locale,
      );
      const alreadyHasExactImport = existingLocVersions.some((v) =>
        (v.changeNote || '').includes(marker),
      );

      if (alreadyHasExactImport) {
        summary.versionsSkippedUnchanged++;
      } else {
        localesToImport.push({
          locale: locVer.locale,
          blocksCount: locVer.blocks.length,
          translationStatus: locVer.translationStatus,
          publishImmediately: plannedPage.targetPublished,
          reason: existing
            ? existingLocVersions.length > 0
              ? 'Append imported content version beyond existing snapshot'
              : 'Create first localized content version'
            : 'Create new system page + v1 snapshot',
        });
      }
    }

    const needsStateUpdate =
      existing &&
      (isLegal
        ? existing.status !== 'draft' ||
          !existing.requiresApproval ||
          existing.approvalStatus !== 'pending_approval' ||
          existing.currentPublishedVersionId !== null
        : existing.status !== plannedPage.targetPageStatus ||
          existing.kind !== 'system' ||
          !existing.locked);

    const action: DryRunPageDiff['action'] = !existing
      ? 'create_page_and_versions'
      : localesToImport.length > 0
        ? 'import_versions'
        : needsStateUpdate
          ? 'update_state_only'
          : 'skip_unchanged';

    if (!existing) summary.pagesCreated++;
    summary.versionsCreated += localesToImport.length;
    if (isLegal && action !== 'skip_unchanged') {
      summary.legalDraftsMarkedPendingReview++;
    }

    pageDiffs.push({
      slug: plannedPage.slug,
      isLegal,
      action,
      targetPageStatus: plannedPage.targetPageStatus,
      targetApprovalStatus: plannedPage.targetApprovalStatus,
      localesToImport,
    });

    if (!isDryRun && action !== 'skip_unchanged') {
      await prisma.$transaction(async (tx) => {
        let pageRecord = existing;
        if (!pageRecord) {
          const created = await tx.cmsPage.create({
            data: {
              kind: 'system',
              slug: plannedPage.slug,
              status: plannedPage.targetPageStatus,
              locked: true,
              requiresApproval: isLegal,
              approvalStatus: plannedPage.targetApprovalStatus,
              publishedAt: plannedPage.targetPublished ? now : null,
            },
          });
          pageRecord = { ...created, locales: [], versions: [] };
        }

        const versionIdByLocale = new Map<CmsLocale, string>();

        for (const locVer of plannedPage.locales) {
          const marker = `[website-import:sha256:${locVer.contentHash}]`;
          const matchingVersion = pageRecord.versions.find(
            (v) => v.locale === locVer.locale && (v.changeNote || '').includes(marker),
          );

          let resolvedVersionId: string;
          if (matchingVersion) {
            resolvedVersionId = matchingVersion.id;
          } else {
            const latestVer = await tx.cmsPageVersion.findFirst({
              where: { pageId: pageRecord.id, locale: locVer.locale },
              orderBy: { versionNumber: 'desc' },
              select: { versionNumber: true },
            });
            const nextVerNum = (latestVer?.versionNumber ?? 0) + 1;
            const createdVersion = await tx.cmsPageVersion.create({
              data: {
                pageId: pageRecord.id,
                versionNumber: nextVerNum,
                locale: locVer.locale,
                title: locVer.title,
                seoTitle: locVer.seoTitle,
                seoDescription: locVer.seoDescription,
                canonicalPath: locVer.canonicalPath,
                noIndex: locVer.noIndex,
                blocks: locVer.blocks as unknown as Prisma.InputJsonValue,
                isTranslated: locVer.isTranslated,
                authorId: options.actorId ?? null,
                authorName,
                changeNote: locVer.changeNote,
              },
            });
            resolvedVersionId = createdVersion.id;
          }
          versionIdByLocale.set(locVer.locale, resolvedVersionId);

          await tx.cmsPageLocale.upsert({
            where: { pageId_locale: { pageId: pageRecord.id, locale: locVer.locale } },
            create: {
              pageId: pageRecord.id,
              locale: locVer.locale,
              isTranslated: locVer.isTranslated,
              translationStatus: locVer.translationStatus,
              currentDraftVersionId: resolvedVersionId,
              currentPublishedVersionId: plannedPage.targetPublished ? resolvedVersionId : null,
            },
            update: {
              isTranslated: locVer.isTranslated,
              translationStatus: locVer.translationStatus,
              currentDraftVersionId: resolvedVersionId,
              currentPublishedVersionId: plannedPage.targetPublished ? resolvedVersionId : null,
            },
          });
        }

        const enVerId = versionIdByLocale.get('en') ?? null;

        if (isLegal) {
          // Legal pages MUST NEVER be marked approved or published on import
          await tx.cmsPage.update({
            where: { id: pageRecord.id },
            data: {
              status: 'draft',
              requiresApproval: true,
              approvalStatus: 'pending_approval',
              pendingApprovalVersionId: enVerId,
              submittedForApprovalById: options.actorId ?? null,
              submittedForApprovalAt: now,
              submissionNote: 'Imported from apps/website (LEGAL_APPROVED=false); pending Stage F legal review',
              approvedById: null,
              approvedAt: null,
              approvalNote: null,
              currentPublishedVersionId: null,
              publishedAt: null,
            },
          });
        } else {
          await tx.cmsPage.update({
            where: { id: pageRecord.id },
            data: {
              status: 'published',
              requiresApproval: false,
              approvalStatus: 'none',
              publishedAt: pageRecord.publishedAt ?? now,
              ...(enVerId ? { currentPublishedVersionId: enVerId } : {}),
            },
          });
        }

        await tx.platformAuditLog.create({
          data: {
            userId: options.actorId ?? null,
            action: 'cms.website_import_page',
            module: 'cms',
            recordId: pageRecord.id,
            reason: isLegal
              ? `Imported legal draft "${plannedPage.slug}" as pending_approval`
              : `Imported published system page "${plannedPage.slug}"`,
            oldValue: existing
              ? {
                  status: existing.status,
                  approvalStatus: existing.approvalStatus,
                  currentPublishedVersionId: existing.currentPublishedVersionId,
                }
              : Prisma.JsonNull,
            newValue: {
              slug: plannedPage.slug,
              status: plannedPage.targetPageStatus,
              approvalStatus: plannedPage.targetApprovalStatus,
              locales: Array.from(versionIdByLocale.keys()),
              publishedVersionId: isLegal ? null : enVerId,
            },
          },
        });
      });
    }
  }

  // FAQs upsert (deduplicated by pageSlug + questionEn)
  for (const faq of plan.faqs) {
    const match = existingFaqs.find(
      (f) => f.pageSlug === faq.pageSlug && f.questionEn === faq.questionEn,
    );
    const unchanged =
      match &&
      match.answerEn === faq.answerEn &&
      match.questionBn === faq.questionBn &&
      match.answerBn === faq.answerBn &&
      match.isBnTranslated === faq.isBnTranslated &&
      match.sortOrder === faq.sortOrder &&
      match.isPublished;

    if (unchanged) {
      summary.faqsSkippedUnchanged++;
      faqDiffs.push({ pageSlug: faq.pageSlug, questionEn: faq.questionEn, action: 'skip' });
      continue;
    }

    summary.faqsCreatedOrUpdated++;
    faqDiffs.push({
      pageSlug: faq.pageSlug,
      questionEn: faq.questionEn,
      action: match ? 'update' : 'create',
    });

    if (!isDryRun) {
      if (match) {
        await prisma.cmsFaq.update({
          where: { id: match.id },
          data: {
            category: faq.category,
            answerEn: faq.answerEn,
            questionBn: faq.questionBn,
            answerBn: faq.answerBn,
            isBnTranslated: faq.isBnTranslated,
            sortOrder: faq.sortOrder,
            isPublished: true,
          },
        });
      } else {
        await prisma.cmsFaq.create({
          data: {
            category: faq.category,
            pageSlug: faq.pageSlug,
            questionEn: faq.questionEn,
            answerEn: faq.answerEn,
            questionBn: faq.questionBn,
            answerBn: faq.answerBn,
            isBnTranslated: faq.isBnTranslated,
            sortOrder: faq.sortOrder,
            isPublished: true,
          },
        });
      }
    }
  }

  // Careers import (from typed data file when real openings exist)
  for (const job of plan.careers) {
    if (existingCareersBySlug.has(job.slug)) {
      summary.careersSkipped++;
      continue;
    }
    summary.careersImported++;
    if (!isDryRun) {
      await prisma.cmsCareer.create({
        data: {
          slug: job.slug,
          status: 'open',
          department: job.department,
          locationType: job.workMode,
          locationText: job.location,
          employmentType: job.employmentType,
          titleEn: job.title,
          summaryEn: job.summary,
          descriptionHtmlEn: sanitizeCmsRichTextHtml(`<p>${escapeHtml(job.summary)}</p>`),
          publishedAt: job.postedAt ? new Date(job.postedAt) : now,
        },
      });
    }
  }

  return {
    mode: options.mode,
    summary,
    pages: pageDiffs,
    faqs: faqDiffs,
  };
}
