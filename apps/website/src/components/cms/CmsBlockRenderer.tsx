import Link from 'next/link';
import type { JSX } from 'react';
import {
  CheckCircle2,
  Coins,
  ExternalLink,
  Globe2,
  Layers,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  normalizeAllowlistedVideoEmbedUrl,
  type CmsBlockNode,
} from '@hrm/shared-types';
import type { PublicCountryView, PublicPlanView } from '@/api/types';
import {
  createTranslator,
  getDictionary,
  localizePath,
  type WebsiteLocale,
} from '@/i18n';
import { resolveCmsAssetUrl } from '@/lib/blog/cms-provider';
import { isSafeCmsHref } from '@/lib/cms-html-sanitizer';
import {
  ButtonLink,
  Container,
  CtaBand,
  FaqAccordion,
  FeatureCard,
  type FaqItem,
  Section,
  SectionHeader,
} from '@/components/marketing';
import { PricingInteractive } from '@/components/pricing/PricingInteractive';
import { CountrySelector } from '@/components/solutions/CountrySelector';
import { SafeHtmlContent } from './SafeHtmlContent';

export interface CmsBlockRendererProps {
  blocks: readonly CmsBlockNode[];
  locale: WebsiteLocale;
  faqByBlockId?: ReadonlyMap<string, FaqItem[]>;
  plans?: readonly PublicPlanView[];
  countries?: readonly PublicCountryView[];
  emitFaqStructuredData?: boolean;
  /** Disable Section outer wrapper when rendering inside an embedded column cell */
  insideColumn?: boolean;
}

function resolveBlockHref(rawHref: string, locale: WebsiteLocale): string {
  const safeHref = isSafeCmsHref(rawHref) ? rawHref.trim() : '/';
  if (safeHref.startsWith('/') && !safeHref.startsWith('/api/')) {
    return localizePath(safeHref, locale);
  }
  return safeHref;
}

function getColumnGridClass(ratio?: string, count?: number): string {
  if (ratio === '60-40') return 'grid-cols-1 lg:grid-cols-[3fr_2fr]';
  if (ratio === '40-60') return 'grid-cols-1 lg:grid-cols-[2fr_3fr]';
  if (ratio === '25-50-25') return 'grid-cols-1 lg:grid-cols-[1fr_2fr_1fr]';
  if (ratio === '33-33-33' || count === 3) return 'grid-cols-1 md:grid-cols-3';
  if (count === 4) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
  return 'grid-cols-1 md:grid-cols-2';
}

function renderSingleBlock(
  block: CmsBlockNode,
  opts: Omit<CmsBlockRendererProps, 'blocks'>,
) {
  const {
    locale,
    faqByBlockId,
    plans = [],
    countries = [],
    emitFaqStructuredData = true,
    insideColumn = false,
  } = opts;
  const dict = getDictionary(locale);
  const t = createTranslator(dict);

  switch (block.type) {
    case 'heading': {
      const Tag = (`h${block.props.level}` as unknown) as keyof JSX.IntrinsicElements;
      const alignClass =
        block.props.align === 'center'
          ? 'text-center mx-auto'
          : block.props.align === 'right'
            ? 'text-right ml-auto'
            : 'text-left';
      const sizeClass =
        block.props.level === 1
          ? 'text-display-sm sm:text-display-lg font-bold tracking-tight'
          : block.props.level === 2
            ? 'text-2xl sm:text-3xl font-bold tracking-tight'
            : 'text-xl sm:text-2xl font-semibold';

      return (
        <div key={block.id} className={`max-w-3xl space-y-2.5 ${alignClass}`}>
          <Tag className={`${sizeClass} text-[rgb(var(--text-primary))]`}>
            {block.props.text}
          </Tag>
          {block.props.subtitle && (
            <p className="text-base sm:text-lg text-[rgb(var(--text-secondary))] leading-relaxed">
              {block.props.subtitle}
            </p>
          )}
        </div>
      );
    }

    case 'rich_text':
      return (
        <div
          key={block.id}
          className="surface rounded-2xl border border-[rgb(var(--border-base))] p-6 sm:p-8 shadow-card"
        >
          <SafeHtmlContent
            html={block.props.html}
            className="prose prose-slate dark:prose-invert max-w-none leading-relaxed prose-headings:font-bold prose-a:text-primary-600 prose-img:rounded-xl"
          />
        </div>
      );

    case 'image': {
      const src = resolveCmsAssetUrl(
        `/api/v1/public/content/media/${encodeURIComponent(block.props.mediaId)}/file`,
      );
      if (!src) return null;
      const aspectClass =
        block.props.aspectRatio === '16:9'
          ? 'aspect-video object-cover'
          : block.props.aspectRatio === '4:3'
            ? 'aspect-[4/3] object-cover'
            : block.props.aspectRatio === '1:1'
              ? 'aspect-square object-cover'
              : 'h-auto object-cover';

      return (
        <figure
          key={block.id}
          className="overflow-hidden rounded-2xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]"
        >
          <img
            src={src}
            alt={block.props.alt}
            loading="lazy"
            decoding="async"
            className={`w-full block ${aspectClass}`}
          />
          {block.props.caption && (
            <figcaption className="px-4 py-2.5 text-xs text-[rgb(var(--text-muted))] border-t border-[rgb(var(--border-base))]">
              {block.props.caption}
            </figcaption>
          )}
        </figure>
      );
    }

    case 'button': {
      const safeHref = isSafeCmsHref(block.props.href) ? block.props.href : '/';
      const isExternal = Boolean(block.props.openInNewTab) || safeHref.startsWith('http');
      return (
        <div key={block.id} className="flex flex-wrap items-center gap-3">
          <ButtonLink
            href={safeHref}
            external={isExternal}
            target={block.props.openInNewTab ? '_blank' : undefined}
            rel={block.props.openInNewTab ? 'noopener noreferrer' : undefined}
            variant={block.props.variant}
            size={block.props.size}
          >
            {block.props.label}
          </ButtonLink>
        </div>
      );
    }

    case 'feature_cards': {
      const cols = block.props.columns ?? 3;
      const colGrid =
        cols === 2
          ? 'grid-cols-1 md:grid-cols-2'
          : cols === 4
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            : 'grid-cols-1 md:grid-cols-3';

      return (
        <div key={block.id} className="space-y-6">
          {(block.props.heading || block.props.subtitle) && (
            <SectionHeader
              align="center"
              title={block.props.heading ?? ''}
              subtitle={block.props.subtitle}
            />
          )}
          <div className={`grid ${colGrid} gap-6`}>
            {block.props.cards.map((card, idx) => (
              <FeatureCard
                key={card.id || `${block.id}-card-${idx}`}
                icon={<Layers className="w-5 h-5" aria-hidden="true" />}
                title={card.title}
                description={card.description}
                badge={card.badge ? { label: card.badge, tone: 'primary' } : undefined}
                href={
                  card.linkHref && isSafeCmsHref(card.linkHref)
                    ? card.linkHref
                    : undefined
                }
                ctaLabel={card.linkLabel}
              />
            ))}
          </div>
        </div>
      );
    }

    case 'faq_list': {
      const resolvedItems = faqByBlockId?.get(block.id) ?? [];
      if (resolvedItems.length === 0) return null;

      return (
        <div key={block.id} className="space-y-5">
          {block.props.heading && (
            <h2 className="text-2xl sm:text-3xl font-bold text-[rgb(var(--text-primary))]">
              {block.props.heading}
            </h2>
          )}
          <FaqAccordion
            items={resolvedItems}
            emitStructuredData={emitFaqStructuredData}
          />
        </div>
      );
    }

    case 'cta_band': {
      const primaryHref = isSafeCmsHref(block.props.primaryButton.href)
        ? block.props.primaryButton.href
        : '/';
      const secondaryHref =
        block.props.secondaryButton && isSafeCmsHref(block.props.secondaryButton.href)
          ? block.props.secondaryButton.href
          : undefined;
      const bandTone = block.props.tone === 'tinted' ? 'tinted' : 'dark';

      const content = (
        <CtaBand
          tone={bandTone}
          title={block.props.title}
          description={block.props.description ?? ''}
          className={insideColumn ? 'py-4' : 'py-2'}
          actions={
            <>
              <ButtonLink
                href={primaryHref}
                variant={bandTone === 'dark' ? 'inverse' : 'primary'}
                size="lg"
              >
                {block.props.primaryButton.label}
              </ButtonLink>
              {block.props.secondaryButton && secondaryHref && (
                <ButtonLink
                  href={secondaryHref}
                  variant="outline"
                  size="lg"
                  className={
                    bandTone === 'dark'
                      ? '!bg-transparent !text-white !border-white/40 hover:!bg-white/10'
                      : ''
                  }
                >
                  {block.props.secondaryButton.label}
                </ButtonLink>
              )}
            </>
          }
        />
      );
      return <div key={block.id}>{content}</div>;
    }

    case 'video_embed': {
      const normalized = normalizeAllowlistedVideoEmbedUrl(
        block.props.url,
        block.props.provider,
      );
      if (!normalized) return null;

      return (
        <figure
          key={block.id}
          className="overflow-hidden rounded-2xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] shadow-card"
        >
          <div className="aspect-video w-full bg-slate-950">
            <iframe
              src={normalized.embedUrl}
              title={block.props.title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="w-full h-full border-0"
            />
          </div>
          {block.props.caption && (
            <figcaption className="px-4 py-2.5 text-xs text-[rgb(var(--text-muted))] border-t border-[rgb(var(--border-base))]">
              {block.props.caption}
            </figcaption>
          )}
        </figure>
      );
    }

    case 'divider': {
      const pad =
        block.props.spacing === 'lg'
          ? 'py-8'
          : block.props.spacing === 'sm'
            ? 'py-2'
            : 'py-4';
      return (
        <div key={block.id} className={`${pad} flex items-center gap-4`}>
          <hr className="flex-1 border-[rgb(var(--border-base))]" />
          {block.props.label && (
            <span className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-muted))]">
              {block.props.label}
            </span>
          )}
          {block.props.label && <hr className="flex-1 border-[rgb(var(--border-base))]" />}
        </div>
      );
    }

    case 'columns': {
      const gapClass =
        block.props.gap === 'lg'
          ? 'gap-8 lg:gap-10'
          : block.props.gap === 'sm'
            ? 'gap-4'
            : 'gap-6';
      const gridClass = getColumnGridClass(block.props.ratio, block.props.columns.length);
      return (
        <div key={block.id} className={`grid ${gridClass} ${gapClass} items-start`}>
          {block.props.columns.map((column, idx) => (
            <div key={column.id || `${block.id}-col-${idx}`} className="space-y-6 min-w-0">
              {column.blocks.map((nested) =>
                renderSingleBlock(nested, {
                  ...opts,
                  insideColumn: true,
                }),
              )}
            </div>
          ))}
        </div>
      );
    }

    case 'dynamic_block': {
      const widget = block.props.widget;
      if (widget === 'pricing_table' || widget === 'plan_comparison') {
        return (
          <div key={block.id} className="space-y-6">
            {(block.props.heading || block.props.subtitle) && (
              <SectionHeader
                align="center"
                title={block.props.heading ?? ''}
                subtitle={block.props.subtitle}
              />
            )}
            <PricingInteractive plans={plans} />
          </div>
        );
      }

      if (widget === 'country_list') {
        return (
          <div key={block.id} className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                {block.props.heading && (
                  <h2 className="text-2xl sm:text-3xl font-bold text-[rgb(var(--text-primary))]">
                    {block.props.heading}
                  </h2>
                )}
                {block.props.subtitle && (
                  <p className="mt-2 text-sm sm:text-base text-[rgb(var(--text-secondary))]">
                    {block.props.subtitle}
                  </p>
                )}
              </div>
              <div className="w-full md:w-80">
                <CountrySelector countries={[...countries]} />
              </div>
            </div>

            {countries.length === 0 ? (
              <div className="surface rounded-2xl p-8 text-center space-y-3">
                <Globe2 className="w-8 h-8 text-secondary-500 mx-auto" aria-hidden="true" />
                <p className="text-sm font-medium text-[rgb(var(--text-secondary))]">
                  {t('countries.index.emptyDescription')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {countries.map((country) => (
                  <article
                    key={country.id}
                    className="surface rounded-xl p-6 flex flex-col justify-between border border-[rgb(var(--border-base))] hover:shadow-card-hover transition-shadow"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-primary-600">
                          {country.isoCode}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[rgb(var(--text-muted))]">
                          <Coins className="w-3.5 h-3.5" aria-hidden="true" />
                          {country.currency}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-[rgb(var(--text-primary))]">
                        <Link
                          href={resolveBlockHref(`/solutions/countries/${country.slug}`, locale)}
                          className="hover:text-primary-600 transition-colors"
                        >
                          {country.name}
                        </Link>
                      </h3>
                      <div className="flex flex-wrap gap-1.5 pt-1 text-xs text-[rgb(var(--text-secondary))]">
                        {country.statutorySupport.tax && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-success-50 text-success-700 border border-success-200">
                            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                            Tax
                          </span>
                        )}
                        {country.statutorySupport.socialSecurityOrSuperannuation && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary-50 text-primary-700 border border-primary-200">
                            <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                            Statutory
                          </span>
                        )}
                        {country.statutorySupport.statutoryLeave && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary-100 text-secondary-700 border border-secondary-200">
                            <Sparkles className="w-3 h-3" aria-hidden="true" />
                            Leave & Holidays
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="pt-4 mt-4 border-t border-[rgb(var(--border-base))]">
                      <Link
                        href={resolveBlockHref(`/solutions/countries/${country.slug}`, locale)}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700"
                      >
                        <span>{t('countries.index.cardViewDetailsCta')}</span>
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        );
      }

      return null;
    }

    default:
      return null;
  }
}

export function CmsBlockRenderer({
  blocks,
  locale,
  faqByBlockId,
  plans = [],
  countries = [],
  emitFaqStructuredData = true,
}: CmsBlockRendererProps) {
  if (!blocks.length) return null;

  return (
    <Section surface="base" rhythm="default">
      <Container className="space-y-8">
        {blocks.map((block) =>
          renderSingleBlock(block, {
            locale,
            faqByBlockId,
            plans,
            countries,
            emitFaqStructuredData,
          }),
        )}
      </Container>
    </Section>
  );
}
