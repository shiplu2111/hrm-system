'use client';

import Link from 'next/link';
import type { CmsMenuDto, CmsSiteSettingsBundleDto } from '@hrm/shared-types';
import { Coins, Mail, MapPin, Phone } from 'lucide-react';
import type { AvailableTenantLanguage } from '../../api/types';
import { CookieSettingsButton } from '../legal/CookieSettingsButton';
import { buildFooterColumns, LEGAL_LINKS } from '../../config/navigation';
import { env } from '../../env';
import { localizePath } from '../../i18n';
import { useWebsiteI18n } from '../../i18n/client';
import { useCurrency } from '../../i18n/currency-client';
import { isSafeCmsHref } from '../../lib/cms-html-sanitizer';
import { Container } from '../marketing';
import { LanguageSwitcher } from './LanguageSwitcher';

interface ResolvedFooterLink {
  id: string;
  label: string;
  href: string;
  openInNewTab: boolean;
}

interface ResolvedFooterColumn {
  id: string;
  heading: string;
  links: ResolvedFooterLink[];
}

function isBlogHref(href: string): boolean {
  const clean = href.trim().replace(/^\/(en|bn)(?=\/|$)/, '').replace(/\/+$/, '');
  return clean === '/blog' || clean.startsWith('/blog/');
}

function isExternalHref(href: string): boolean {
  return (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  );
}

function pickLocalizedText(
  locale: 'en' | 'bn',
  enValue?: string | null,
  bnValue?: string | null,
): string {
  if (locale === 'bn') return bnValue?.trim() || enValue?.trim() || '';
  return enValue?.trim() || bnValue?.trim() || '';
}

function resolveCmsFooterColumns(
  menus: readonly CmsMenuDto[] | undefined,
  locale: 'en' | 'bn',
  hasBlogPosts: boolean,
): ResolvedFooterColumn[] {
  const footerMenus = (menus ?? []).filter((m) => m.isActive && m.location === 'footer');
  if (footerMenus.length === 0) return [];

  const allItems = footerMenus
    .flatMap((m) => m.items ?? [])
    .filter((i) => i.isVisible !== false && (hasBlogPosts || !isBlogHref(i.href)))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const hasChildItems = allItems.some((i) => Boolean(i.parentId));
  if (hasChildItems) {
    const parents = allItems.filter((i) => !i.parentId);
    const cols: ResolvedFooterColumn[] = [];
    for (const parent of parents) {
      const children = allItems
        .filter((i) => i.parentId === parent.id)
        .map((c) => {
          const safeHref = isSafeCmsHref(c.href) ? c.href : '/';
          return {
            id: c.id,
            label: pickLocalizedText(locale, c.labelEn, c.labelBn) || safeHref,
            href: safeHref,
            openInNewTab: Boolean(c.openInNewTab),
          };
        });
      if (children.length > 0) {
        cols.push({
          id: parent.id,
          heading: pickLocalizedText(locale, parent.labelEn, parent.labelBn) || 'Links',
          links: children,
        });
      }
    }
    if (cols.length > 0) return cols;
  }

  return footerMenus
    .map((menu) => ({
      id: menu.id,
      heading: menu.name,
      links: (menu.items ?? [])
        .filter((i) => i.isVisible !== false && (hasBlogPosts || !isBlogHref(i.href)))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => {
          const safeHref = isSafeCmsHref(c.href) ? c.href : '/';
          return {
            id: c.id,
            label: pickLocalizedText(locale, c.labelEn, c.labelBn) || safeHref,
            href: safeHref,
            openInNewTab: Boolean(c.openInNewTab),
          };
        }),
    }))
    .filter((col) => col.links.length > 0);
}

function resolveCmsLegalLinks(
  menus: readonly CmsMenuDto[] | undefined,
  locale: 'en' | 'bn',
): ResolvedFooterLink[] {
  const legalMenus = (menus ?? []).filter((m) => m.isActive && m.location === 'legal');
  if (legalMenus.length === 0) return [];
  return legalMenus
    .flatMap((m) => m.items ?? [])
    .filter((i) => i.isVisible !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => {
      const safeHref = isSafeCmsHref(item.href) ? item.href : '/';
      return {
        id: item.id,
        label: pickLocalizedText(locale, item.labelEn, item.labelBn) || safeHref,
        href: safeHref,
        openInNewTab: Boolean(item.openInNewTab),
      };
    });
}

export function SiteFooter({
  hasBlogPosts = false,
  availableLanguages,
  siteSettings,
  cmsMenus,
}: {
  hasBlogPosts?: boolean;
  availableLanguages?: readonly AvailableTenantLanguage[];
  siteSettings?: Pick<CmsSiteSettingsBundleDto, 'contact' | 'socialLinks' | 'footer'>;
  cmsMenus?: readonly CmsMenuDto[];
}) {
  const { locale, t } = useWebsiteI18n();
  const { currency, currencies, setCurrency } = useCurrency();
  const currentYear = new Date().getFullYear();

  const cmsColumns = resolveCmsFooterColumns(cmsMenus, locale, hasBlogPosts);
  const columns: ResolvedFooterColumn[] =
    cmsColumns.length > 0
      ? cmsColumns
      : buildFooterColumns(env.NEXT_PUBLIC_PORTAL_URL, env.NEXT_PUBLIC_PLATFORM_URL, {
          hasBlogPosts,
        }).map((col) => ({
          id: col.id,
          heading: t(col.headingKey),
          links: col.links.map((item) => ({
            id: `${col.id}-${item.href}`,
            label: t(item.labelKey),
            href: item.href,
            openInNewTab: Boolean(item.external),
          })),
        }));

  const cmsLegal = resolveCmsLegalLinks(cmsMenus, locale);
  const legalLinks: ResolvedFooterLink[] =
    cmsLegal.length > 0
      ? cmsLegal
      : LEGAL_LINKS.map((item) => ({
          id: item.href,
          label: t(item.labelKey),
          href: item.href,
          openInNewTab: false,
        }));

  const footerTagline =
    (locale === 'bn'
      ? siteSettings?.footer.tagline.bn || siteSettings?.footer.tagline.en
      : siteSettings?.footer.tagline.en) || t('brand.tagline');
  const copyrightText =
    (locale === 'bn'
      ? siteSettings?.footer.copyrightText.bn || siteSettings?.footer.copyrightText.en
      : siteSettings?.footer.copyrightText.en) ||
    t('footer.copyright', {
      year: currentYear,
      company: t('brand.platformName'),
    });
  const addressText =
    locale === 'bn'
      ? siteSettings?.contact.address.bn || siteSettings?.contact.address.en
      : siteSettings?.contact.address.en;
  const socialEntries = (
    [
      { label: 'LinkedIn', href: siteSettings?.socialLinks.linkedin },
      { label: 'X', href: siteSettings?.socialLinks.x },
      { label: 'Facebook', href: siteSettings?.socialLinks.facebook },
      { label: 'YouTube', href: siteSettings?.socialLinks.youtube },
      { label: 'GitHub', href: siteSettings?.socialLinks.github },
    ] as const
  ).filter((s): s is { label: typeof s.label; href: string } => Boolean(s.href && s.href.trim()));

  return (
    <footer className="border-t border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-secondary))]">
      <Container className="py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10 lg:gap-8">
          {/* Brand Summary Column */}
          <div className="lg:col-span-2 space-y-4">
            <Link
              href={localizePath('/', locale)}
              className="inline-flex items-center gap-3 rounded-md py-1 px-1 -ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0">
                {t('brand.monogram')}
              </div>
              <span className="text-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
                {t('brand.namePrefix')}
                <span className="text-primary-600">{t('brand.nameSuffix')}</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-[rgb(var(--text-muted))] max-w-sm">
              {footerTagline}
            </p>

            {(siteSettings?.contact.salesEmail ||
              siteSettings?.contact.supportEmail ||
              siteSettings?.contact.phone ||
              addressText) && (
              <div className="space-y-1.5 text-xs text-[rgb(var(--text-muted))]">
                {siteSettings?.contact.salesEmail && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Sales: </span>
                    <a
                      href={`mailto:${siteSettings.contact.salesEmail}`}
                      className="text-[rgb(var(--text-primary))] hover:underline"
                    >
                      {siteSettings.contact.salesEmail}
                    </a>
                  </div>
                )}
                {siteSettings?.contact.supportEmail && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Support: </span>
                    <a
                      href={`mailto:${siteSettings.contact.supportEmail}`}
                      className="text-[rgb(var(--text-primary))] hover:underline"
                    >
                      {siteSettings.contact.supportEmail}
                    </a>
                  </div>
                )}
                {siteSettings?.contact.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{siteSettings.contact.phone}</span>
                  </div>
                )}
                {addressText && (
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{addressText}</span>
                  </div>
                )}
              </div>
            )}

            {socialEntries.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {socialEntries.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-md border border-[rgb(var(--border-base))] text-[11px] font-medium hover:text-primary-600 hover:border-primary-400 transition-colors"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}

            <div>
              <Link
                href={localizePath('/status', locale)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success-50 border border-success-200 text-xs font-medium text-success-700 hover:bg-success-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span className="w-2 h-2 rounded-full bg-success-600" aria-hidden="true" />
                <span>{t('footer.statusOperational')}</span>
              </Link>
            </div>
          </div>

          {/* Navigation Link Columns */}
          {columns.map((column) => (
            <div key={column.id}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-primary))] mb-4">
                {column.heading}
              </h2>
              <ul className="space-y-2.5">
                {column.links.map((item) => {
                  const external = item.openInNewTab || isExternalHref(item.href);
                  const href = isExternalHref(item.href)
                    ? item.href
                    : localizePath(item.href, locale);
                  return (
                    <li key={item.id}>
                      {external ? (
                        <a
                          href={href}
                          target={item.openInNewTab ? '_blank' : undefined}
                          rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                          className="text-sm text-[rgb(var(--text-secondary))] hover:text-primary-600 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                        >
                          {item.label}
                        </a>
                      ) : (
                        <Link
                          href={href}
                          className="text-sm text-[rgb(var(--text-secondary))] hover:text-primary-600 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                        >
                          {item.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Legal & Language Row */}
        <div className="mt-12 pt-8 border-t border-[rgb(var(--border-base))] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 text-xs text-[rgb(var(--text-muted))]">
            <span>{copyrightText}</span>

            <nav aria-label={t('a11y.legalNavigation')} className="flex flex-wrap items-center gap-4 sm:gap-5">
              {legalLinks.map((item) =>
                item.openInNewTab || isExternalHref(item.href) ? (
                  <a
                    key={item.id}
                    href={isExternalHref(item.href) ? item.href : localizePath(item.href, locale)}
                    target={item.openInNewTab ? '_blank' : undefined}
                    rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                    className="hover:text-[rgb(var(--text-primary))] transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.id}
                    href={localizePath(item.href, locale)}
                    className="hover:text-[rgb(var(--text-primary))] transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                  >
                    {item.label}
                  </Link>
                ),
              )}
              <CookieSettingsButton variant="footer" />
            </nav>
          </div>

          {/* Accessible Currency & Language Switchers */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-[rgb(var(--text-muted))]" aria-hidden="true" />
              <label htmlFor="footer-currency-select" className="sr-only">
                {t('a11y.selectCurrency')}
              </label>
              <select
                id="footer-currency-select"
                aria-label={t('a11y.selectCurrency')}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="min-h-[36px] rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-surface))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--text-primary))] shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              >
                {currencies.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code} ({item.symbol})
                  </option>
                ))}
              </select>
            </div>

            <LanguageSwitcher variant="footer" availableLanguages={availableLanguages} />
          </div>
        </div>
      </Container>
    </footer>
  );
}
