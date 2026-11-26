import {
  CMS_SYSTEM_PAGE_DEFS,
  type CmsBlockNode,
  type CmsPublicSitemapPageDto,
  type CmsResolvedPageDto,
} from '@hrm/shared-types';
import { getDictionary, type WebsiteLocale } from '../i18n';
import { getLegalDocument, type LegalDocumentSlug } from './legal';

type SystemPageDef = (typeof CMS_SYSTEM_PAGE_DEFS)[number];

const SYSTEM_PAGE_BY_SLUG = new Map<string, SystemPageDef>(
  CMS_SYSTEM_PAGE_DEFS.map((def) => [def.slug.toLowerCase(), def]),
);

const SYSTEM_PAGE_BY_CANONICAL = new Map<string, SystemPageDef>(
  CMS_SYSTEM_PAGE_DEFS.map((def) => [
    def.canonicalPath.replace(/^\/+|\/+$/g, '').toLowerCase() || 'home',
    def,
  ]),
);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function markdownToSimpleSafeHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }
    if (line.startsWith('### ')) {
      closeList();
      out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    } else if (line.startsWith('## ')) {
      closeList();
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith('# ')) {
      closeList();
      out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (line.startsWith('- ')) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${escapeHtml(line.slice(2))}</li>`);
    } else {
      closeList();
      out.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}

export function resolveSystemPageDefinition(rawSlug: string): SystemPageDef | null {
  const normalized = rawSlug.trim().replace(/^\/+|\/+$/g, '').toLowerCase() || 'home';
  const dashed = normalized.replace(/\//g, '-');
  return (
    SYSTEM_PAGE_BY_SLUG.get(normalized) ??
    SYSTEM_PAGE_BY_SLUG.get(dashed) ??
    SYSTEM_PAGE_BY_CANONICAL.get(normalized) ??
    null
  );
}

export function isCmsSystemSlug(rawSlug: string): boolean {
  return resolveSystemPageDefinition(rawSlug) !== null;
}

/**
 * Generates deterministic bundled Stage A.4 system page content directly from the
 * website's i18n dictionaries and legal markdown files whenever the Content API is
 * down and no prior cached response exists.
 */
export function getBundledSystemPageDefault(
  rawSlug: string,
  locale: WebsiteLocale,
): CmsResolvedPageDto | null {
  const def = resolveSystemPageDefinition(rawSlug);
  if (!def) return null;

  const dict = getDictionary(locale);
  const enDict = getDictionary('en');
  const title: string = locale === 'bn' && def.bnTranslated ? def.titleBn : def.titleEn;
  const fallbackUsed = locale === 'bn' && !def.bnTranslated;

  const blocks: CmsBlockNode[] = [];
  let seoTitle: string = title;
  let seoDescription: string = dict.meta.description;

  const slug = def.slug;

  if (slug === 'home') {
    seoTitle = dict.meta.defaultTitle;
    seoDescription = dict.meta.description;
    blocks.push(
      {
        id: 'default-home-heading',
        type: 'heading',
        props: {
          level: 1,
          text: dict.home.hero.title,
          subtitle: dict.home.hero.subtitle,
          align: 'center',
        },
      },
      {
        id: 'default-home-modules',
        type: 'feature_cards',
        props: {
          heading: dict.home.modules.title,
          subtitle: dict.home.modules.subtitle,
          columns: 3,
          cards: dict.home.modules.groups.slice(0, 6).map((m) => ({
            id: `default-mod-${m.id}`,
            title: m.title,
            description: m.description,
            linkLabel: dict.components.learnMore,
            linkHref: '/features',
          })),
        },
      },
      {
        id: 'default-home-faq',
        type: 'faq_list',
        props: {
          heading: dict.home.faq.title,
          pageSlug: 'home',
          limit: 6,
        },
      },
    );
  } else if (slug === 'features') {
    seoTitle = dict.features.overview.metaTitle;
    seoDescription = dict.features.overview.metaDescription;
    blocks.push(
      {
        id: 'default-features-heading',
        type: 'heading',
        props: {
          level: 1,
          text: dict.features.overview.title,
          subtitle: dict.features.overview.subtitle,
          align: 'left',
        },
      },
      {
        id: 'default-features-cards',
        type: 'feature_cards',
        props: {
          columns: 3,
          cards: Object.entries(dict.features.pages).map(([key, pg]) => ({
            id: `default-feat-${key}`,
            title: pg.title,
            description: pg.summary,
            linkLabel: dict.components.learnMore,
            linkHref: `/features/${key}`,
          })),
        },
      },
    );
  } else if (slug.startsWith('features-')) {
    const featureKey = slug.replace(/^features-/, '') as keyof typeof dict.features.pages;
    const featurePage = dict.features.pages[featureKey];
    if (featurePage) {
      seoTitle = featurePage.headline;
      seoDescription = featurePage.summary;
      blocks.push({
        id: `default-${slug}-heading`,
        type: 'heading',
        props: {
          level: 1,
          text: featurePage.title,
          subtitle: featurePage.summary,
          align: 'left',
        },
      });
      if (Array.isArray(featurePage.blocks) && featurePage.blocks.length > 0) {
        blocks.push({
          id: `default-${slug}-cards`,
          type: 'feature_cards',
          props: {
            columns: 3,
            cards: featurePage.blocks.slice(0, 6).map((b) => ({
              id: `default-feat-blk-${b.id}`,
              title: b.title,
              description: b.description,
              badge: b.phaseLabel,
            })),
          },
        });
      }
    }
  } else if (slug === 'pricing') {
    seoTitle = dict.pricing.metaTitle;
    seoDescription = dict.pricing.metaDescription;
    blocks.push(
      {
        id: 'default-pricing-heading',
        type: 'heading',
        props: {
          level: 1,
          text: dict.pricing.title,
          subtitle: dict.pricing.subtitle,
          align: 'center',
        },
      },
      {
        id: 'default-pricing-table',
        type: 'dynamic_block',
        props: {
          widget: 'pricing_table',
        },
      },
      {
        id: 'default-pricing-faq',
        type: 'faq_list',
        props: {
          heading: dict.pricing.faq.title,
          pageSlug: 'pricing',
          limit: 6,
        },
      },
    );
  } else if (slug === 'solutions-countries') {
    seoTitle = dict.countries.index.metaTitle;
    seoDescription = dict.countries.index.metaDescription;
    blocks.push(
      {
        id: 'default-countries-heading',
        type: 'heading',
        props: {
          level: 1,
          text: dict.countries.index.title,
          subtitle: dict.countries.index.subtitle,
          align: 'left',
        },
      },
      {
        id: 'default-countries-list',
        type: 'dynamic_block',
        props: {
          widget: 'country_list',
        },
      },
    );
  } else if (slug === 'solutions' || slug.startsWith('solutions-')) {
    const segKey = slug === 'solutions' ? '' : slug.replace(/^solutions-/, '');
    const segment =
      segKey && segKey in dict.solutions.segments
        ? dict.solutions.segments[segKey as keyof typeof dict.solutions.segments]
        : null;
    seoTitle = segment?.headline || dict.solutions.overview.metaTitle;
    seoDescription = segment?.summary || dict.solutions.overview.metaDescription;
    blocks.push({
      id: `default-${slug}-heading`,
      type: 'heading',
      props: {
        level: 1,
        text: segment?.title || dict.solutions.overview.metaTitle,
        subtitle: segment?.summary || dict.solutions.overview.metaDescription,
        align: 'left',
      },
    });
  } else if (slug === 'security') {
    seoTitle = dict.security.metaTitle;
    seoDescription = dict.security.metaDescription;
    blocks.push(
      {
        id: 'default-security-heading',
        type: 'heading',
        props: {
          level: 1,
          text: dict.security.title,
          subtitle: dict.security.subtitle,
          align: 'left',
        },
      },
      {
        id: 'default-security-controls',
        type: 'feature_cards',
        props: {
          heading: dict.security.controlsSection.title,
          subtitle: dict.security.controlsSection.subtitle,
          columns: 3,
          cards: dict.security.controlsSection.controls.slice(0, 6).map((c) => ({
            id: `default-sec-${c.id}`,
            title: c.title,
            description: c.summary,
          })),
        },
      },
    );
  } else if (slug === 'about') {
    seoTitle = dict.company.about.metaTitle;
    seoDescription = dict.company.about.metaDescription;
    blocks.push(
      {
        id: 'default-about-heading',
        type: 'heading',
        props: {
          level: 1,
          text: dict.company.about.title,
          subtitle: dict.company.about.subtitle,
          align: 'left',
        },
      },
      {
        id: 'default-about-principles',
        type: 'feature_cards',
        props: {
          heading: dict.company.about.principles.title,
          subtitle: dict.company.about.principles.description,
          columns: 2,
          cards: dict.company.about.principles.items.map((item) => ({
            id: `default-about-${item.id}`,
            title: item.title,
            description: item.description,
          })),
        },
      },
    );
  } else if (slug === 'terms' || slug === 'privacy' || slug === 'cookies' || slug === 'dpa') {
    let legalHtml = `<p>${escapeHtml(enDict.legal.badges.draftBannerTitle)}</p>`;
    let docTitle: string = def.titleEn;
    let docSummary: string = def.titleEn;
    try {
      const doc = getLegalDocument(slug as LegalDocumentSlug);
      docTitle = doc.title;
      docSummary = doc.summary;
      legalHtml = markdownToSimpleSafeHtml(doc.body);
    } catch {
      // Fallback already populated cleanly
    }
    seoTitle = docTitle;
    seoDescription = docSummary;
    blocks.push(
      {
        id: `default-${slug}-heading`,
        type: 'heading',
        props: {
          level: 1,
          text: docTitle,
          subtitle: docSummary,
          align: 'left',
        },
      },
      {
        id: `default-${slug}-body`,
        type: 'rich_text',
        props: {
          html: legalHtml,
        },
      },
    );
  } else {
    blocks.push({
      id: `default-${slug}-heading`,
      type: 'heading',
      props: {
        level: 1,
        text: title,
        subtitle: dict.meta.description,
        align: 'left',
      },
    });
  }

  blocks.push({
    id: `default-${slug}-cta`,
    type: 'cta_band',
    props: {
      title: dict.home.hero.primaryCta,
      description: dict.meta.description,
      tone: 'tinted',
      primaryButton: {
        label: dict.home.hero.primaryCta,
        href: '/signup',
      },
      secondaryButton: {
        label: dict.home.hero.secondaryCta,
        href: '/demo',
      },
    },
  });

  const activeLocale = fallbackUsed ? 'en' : locale;

  return {
    pageId: `system-default:${slug}`,
    slug: def.slug,
    kind: 'system',
    status: 'published',
    locked: true,
    requiresApproval: slug === 'terms' || slug === 'privacy' || slug === 'cookies' || slug === 'dpa',
    requestedLocale: locale,
    resolvedLocale: activeLocale,
    fallbackUsed,
    isTranslated: !fallbackUsed,
    translationStatus: !fallbackUsed ? 'translated' : 'untranslated',
    isPreview: false,
    version: {
      id: `system-default-ver:${slug}:${activeLocale}`,
      pageId: `system-default:${slug}`,
      versionNumber: 1,
      locale: activeLocale,
      title,
      seoTitle,
      seoDescription,
      canonicalPath: def.canonicalPath,
      ogImageUrl: null,
      noIndex: slug === 'not-found',
      blocks,
      isTranslated: !fallbackUsed,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  };
}

export function listBundledSystemSitemapPages(): CmsPublicSitemapPageDto[] {
  const baseline = '2026-01-01T00:00:00.000Z';
  return CMS_SYSTEM_PAGE_DEFS.filter(
    (def) => def.slug !== 'not-found' && def.slug !== 'blog',
  ).map((def) => ({
    id: `system-default:${def.slug}`,
    slug: def.slug,
    kind: 'system',
    canonicalPath: def.canonicalPath,
    updatedAt: baseline,
    publishedAt: baseline,
  }));
}
