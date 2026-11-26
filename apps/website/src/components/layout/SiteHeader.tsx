'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import type { CmsMenuDto, CmsMenuItemDto } from '@hrm/shared-types';
import type { AvailableTenantLanguage } from '../../api/types';
import {
  PRIMARY_DIRECT_LINKS,
  PRODUCT_MEGA_MENU,
  SOLUTIONS_MEGA_MENU,
  type MegaMenuGroup,
} from '../../config/navigation';
import { localizePath } from '../../i18n';
import { useWebsiteI18n } from '../../i18n/client';
import { isSafeCmsHref } from '../../lib/cms-html-sanitizer';
import { ButtonLink, Container } from '../marketing';
import { LanguageSwitcher } from './LanguageSwitcher';

type StaticOpenMenuId = 'product' | 'solutions' | null;

interface ResolvedCmsNavLeaf {
  id: string;
  label: string;
  description?: string;
  badge?: string;
  href: string;
  openInNewTab: boolean;
}

interface ResolvedCmsNavTopItem {
  id: string;
  label: string;
  href: string;
  openInNewTab: boolean;
  groups: Array<{
    key: string;
    items: ResolvedCmsNavLeaf[];
  }>;
}

const NAV_LINK_CLASSES =
  'inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-[rgb(var(--text-secondary))] hover:text-primary-700 hover:bg-primary-50/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 whitespace-nowrap';

function isExternalUrl(href: string): boolean {
  return href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:');
}

function isBlogHref(href: string): boolean {
  const clean = href.trim().replace(/^\/(en|bn)(?=\/|$)/, '').replace(/\/+$/, '');
  return clean === '/blog' || clean.startsWith('/blog/');
}

function pickLocalizedItemText(
  locale: 'en' | 'bn',
  enValue?: string | null,
  bnValue?: string | null,
): string {
  if (locale === 'bn') {
    return bnValue?.trim() || enValue?.trim() || '';
  }
  return enValue?.trim() || bnValue?.trim() || '';
}

function buildCmsHeaderNavigation(
  menus: readonly CmsMenuDto[] | undefined,
  locale: 'en' | 'bn',
  hasBlogPosts: boolean,
): ResolvedCmsNavTopItem[] {
  const headerMenus = (menus ?? []).filter((m) => m.isActive && m.location === 'header');
  if (headerMenus.length === 0) return [];

  const allItems: CmsMenuItemDto[] = headerMenus
    .flatMap((m) => m.items ?? [])
    .filter((item) => item.isVisible !== false)
    .filter((item) => hasBlogPosts || !isBlogHref(item.href))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (allItems.length === 0) return [];

  const childrenByParent = new Map<string, CmsMenuItemDto[]>();
  const topLevel: CmsMenuItemDto[] = [];

  for (const item of allItems) {
    if (!item.parentId) {
      topLevel.push(item);
    } else {
      const bucket = childrenByParent.get(item.parentId) ?? [];
      bucket.push(item);
      childrenByParent.set(item.parentId, bucket);
    }
  }

  return topLevel.map((parent) => {
    const directChildren = (childrenByParent.get(parent.id) ?? []).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    const toLeaf = (child: CmsMenuItemDto): ResolvedCmsNavLeaf => {
      const safeHref = isSafeCmsHref(child.href) ? child.href : '/';
      return {
        id: child.id,
        label: pickLocalizedItemText(locale, child.labelEn, child.labelBn) || safeHref,
        description:
          pickLocalizedItemText(locale, child.descriptionEn, child.descriptionBn) || undefined,
        badge: pickLocalizedItemText(locale, child.badgeEn, child.badgeBn) || undefined,
        href: safeHref,
        openInNewTab: Boolean(child.openInNewTab),
      };
    };

    const groups: Array<{ key: string; items: ResolvedCmsNavLeaf[] }> = [];
    const hasGrandchildren = directChildren.some(
      (child) => (childrenByParent.get(child.id)?.length ?? 0) > 0,
    );

    if (hasGrandchildren) {
      for (const groupNode of directChildren) {
        const grandchildren = (childrenByParent.get(groupNode.id) ?? []).sort(
          (a, b) => a.sortOrder - b.sortOrder,
        );
        if (grandchildren.length > 0) {
          groups.push({
            key:
              pickLocalizedItemText(locale, groupNode.labelEn, groupNode.labelBn) ||
              groupNode.href,
            items: grandchildren.map(toLeaf),
          });
        } else {
          const fallbackGroup = groups.find((g) => g.key === '');
          if (fallbackGroup) {
            fallbackGroup.items.push(toLeaf(groupNode));
          } else {
            groups.push({ key: '', items: [toLeaf(groupNode)] });
          }
        }
      }
    } else if (directChildren.length > 0) {
      groups.push({
        key: pickLocalizedItemText(locale, parent.labelEn, parent.labelBn) || parent.href,
        items: directChildren.map(toLeaf),
      });
    }

    const safeParentHref = isSafeCmsHref(parent.href) ? parent.href : '/';
    return {
      id: parent.id,
      label: pickLocalizedItemText(locale, parent.labelEn, parent.labelBn) || safeParentHref,
      href: safeParentHref,
      openInNewTab: Boolean(parent.openInNewTab),
      groups,
    };
  });
}

export function SiteHeader({
  hasBlogPosts = false,
  availableLanguages,
  cmsMenus,
}: {
  hasBlogPosts?: boolean;
  availableLanguages?: readonly AvailableTenantLanguage[];
  cmsMenus?: readonly CmsMenuDto[];
}) {
  const { locale, t } = useWebsiteI18n();
  const cmsTopItems = useMemo(
    () => buildCmsHeaderNavigation(cmsMenus, locale, hasBlogPosts),
    [cmsMenus, locale, hasBlogPosts],
  );
  const usingCmsMenus = cmsTopItems.length > 0;

  const directLinks = hasBlogPosts
    ? [...PRIMARY_DIRECT_LINKS, { labelKey: 'nav.blog' as const, href: '/blog' }]
    : PRIMARY_DIRECT_LINKS;
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroupOpen, setMobileGroupOpen] = useState<string | null>(null);

  const headerRef = useRef<HTMLElement>(null);
  const productTriggerRef = useRef<HTMLButtonElement>(null);
  const solutionsTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const productPanelRef = useRef<HTMLDivElement>(null);
  const solutionsPanelRef = useRef<HTMLDivElement>(null);

  const closeDesktopMenu = useCallback((returnFocusToTrigger = false) => {
    setOpenMenu((prev) => {
      if (returnFocusToTrigger) {
        if (prev === 'product') productTriggerRef.current?.focus();
        if (prev === 'solutions') solutionsTriggerRef.current?.focus();
      }
      return null;
    });
  }, []);

  // Close menus on outside click or Escape key
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openMenu) {
          e.preventDefault();
          closeDesktopMenu(true);
        } else if (mobileOpen) {
          e.preventDefault();
          setMobileOpen(false);
          mobileToggleRef.current?.focus();
        }
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu, mobileOpen, closeDesktopMenu]);

  const handleTriggerKeyDown = (
    menuId: Exclude<StaticOpenMenuId, null>,
    panelRef: React.RefObject<HTMLDivElement | null>,
  ) => {
    return (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOpenMenu(menuId);
        requestAnimationFrame(() => {
          const firstLink = panelRef.current?.querySelector<HTMLElement>('a[href]');
          firstLink?.focus();
        });
      }
    };
  };

  const handleContainerBlur = (e: FocusEvent<HTMLDivElement>) => {
    const nextFocused = e.relatedTarget as Node | null;
    if (!nextFocused || !e.currentTarget.contains(nextFocused)) {
      setOpenMenu(null);
    }
  };

  const handlePanelKeyDown = (
    panelRef: React.RefObject<HTMLDivElement | null>,
  ) => {
    return (e: KeyboardEvent<HTMLDivElement>) => {
      const links = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('a[href]') ?? []);
      if (links.length === 0) return;
      const currentIdx = links.indexOf(document.activeElement as HTMLElement);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        links[(currentIdx + 1) % links.length]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        links[(currentIdx - 1 + links.length) % links.length]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        links[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        links[links.length - 1]?.focus();
      }
    };
  };

  const renderMegaMenuPanel = (
    menuId: Exclude<StaticOpenMenuId, null>,
    groups: MegaMenuGroup[],
    panelRef: React.RefObject<HTMLDivElement | null>,
    showFooterCallout = false,
  ) => {
    if (openMenu !== menuId) return null;

    return (
      <div
        id={`mega-menu-${menuId}`}
        ref={panelRef}
        role="region"
        aria-label={t(menuId === 'product' ? 'nav.product' : 'nav.solutions')}
        onKeyDown={handlePanelKeyDown(panelRef)}
        className="absolute left-0 top-full pt-2 w-[38rem] max-w-[90vw] z-50"
      >
        <div className="surface-elevated rounded-xl p-6 border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]">
          <div className="grid grid-cols-2 gap-6">
            {groups.map((group) => (
              <div key={group.headingKey}>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 mb-3 px-2">
                  {t(group.headingKey)}
                </p>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={localizePath(item.href, locale)}
                        onClick={() => setOpenMenu(null)}
                        className="block rounded-lg p-2.5 hover:bg-[rgb(var(--bg-hover))]/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[rgb(var(--text-primary))]">
                            {t(item.titleKey)}
                          </span>
                          {item.badgeKey && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-2xs font-semibold bg-warning-50 text-warning-700 border border-warning-200">
                              {t(item.badgeKey)}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-[rgb(var(--text-muted))] leading-relaxed">
                          {t(item.descriptionKey)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {showFooterCallout && (
            <div className="mt-5 pt-4 border-t border-[rgb(var(--border-base))] flex items-center justify-between gap-4 px-2">
              <div>
                <p className="text-xs font-semibold text-[rgb(var(--text-primary))]">
                  {t('nav.productMenu.callout.title')}
                </p>
                <p className="text-xs text-[rgb(var(--text-muted))]">
                  {t('nav.productMenu.callout.description')}
                </p>
              </div>
              <Link
                href={localizePath('/components', locale)}
                onClick={() => setOpenMenu(null)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 whitespace-nowrap rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span>{t('nav.productMenu.callout.cta')}</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCmsNavHref = (href: string): string =>
    isExternalUrl(href) ? href : localizePath(href, locale);

  const renderCmsLeafLink = (
    item: ResolvedCmsNavLeaf,
    className: string,
    onDone: () => void,
  ) => {
    const resolved = renderCmsNavHref(item.href);
    const content = (
      <>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[rgb(var(--text-primary))]">
            {item.label}
          </span>
          {item.badge && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-2xs font-semibold bg-warning-50 text-warning-700 border border-warning-200">
              {item.badge}
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-0.5 text-xs text-[rgb(var(--text-muted))] leading-relaxed">
            {item.description}
          </p>
        )}
      </>
    );

    if (item.openInNewTab || isExternalUrl(item.href)) {
      return (
        <a
          href={resolved}
          target={item.openInNewTab ? '_blank' : undefined}
          rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
          onClick={onDone}
          className={className}
        >
          {content}
        </a>
      );
    }

    return (
      <Link href={resolved} onClick={onDone} className={className}>
        {content}
      </Link>
    );
  };

  const renderMobileGroup = (menuId: Exclude<StaticOpenMenuId, null>, label: string, groups: MegaMenuGroup[]) => {
    const isExpanded = mobileGroupOpen === menuId;
    return (
      <div className="border-b border-[rgb(var(--border-base))] py-2">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={`mobile-submenu-${menuId}`}
          aria-label={t('a11y.toggleSubmenu', { label })}
          onClick={() => setMobileGroupOpen(isExpanded ? null : menuId)}
          className="w-full min-h-[44px] flex items-center justify-between px-2 py-2.5 text-base font-semibold text-[rgb(var(--text-primary))] rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <span>{label}</span>
          <ChevronDown
            className={`w-4 h-4 text-primary-600 transition-transform duration-150 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        <div id={`mobile-submenu-${menuId}`} hidden={!isExpanded} className="mt-1 pb-2 pl-3 space-y-4">
          {groups.map((group) => (
            <div key={group.headingKey}>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 mb-1.5 px-2">
                {t(group.headingKey)}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={localizePath(item.href, locale)}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-between gap-2 px-2 py-2 rounded-md text-sm font-medium text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      <span>{t(item.titleKey)}</span>
                      {item.badgeKey && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-2xs font-semibold bg-warning-50 text-warning-700 border border-warning-200">
                          {t(item.badgeKey)}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 w-full border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]/95 backdrop-blur"
    >
      <Container className="h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link
          href={localizePath('/', locale)}
          aria-label={t('a11y.homeLink')}
          className="inline-flex items-center gap-3 rounded-md py-1 px-1 -ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0">
            {t('brand.monogram')}
          </div>
          <span className="text-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
            {t('brand.namePrefix')}
            <span className="text-primary-600">{t('brand.nameSuffix')}</span>
          </span>
        </Link>

        {/* Desktop Main Navigation */}
        <nav
          aria-label={t('a11y.primaryNavigation')}
          className="hidden lg:flex items-center gap-1"
        >
          {usingCmsMenus ? (
            cmsTopItems.map((top) =>
              top.groups.length > 0 ? (
                <div
                  key={top.id}
                  className="relative"
                  onMouseEnter={() => setOpenMenu(top.id)}
                  onMouseLeave={() => setOpenMenu(null)}
                  onBlur={handleContainerBlur}
                >
                  <button
                    type="button"
                    aria-expanded={openMenu === top.id}
                    aria-haspopup="true"
                    aria-controls={`cms-mega-menu-${top.id}`}
                    onClick={() => setOpenMenu(openMenu === top.id ? null : top.id)}
                    className={NAV_LINK_CLASSES}
                  >
                    <span>{top.label}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-150 ${
                        openMenu === top.id ? 'rotate-180 text-primary-600' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {openMenu === top.id && (
                    <div
                      id={`cms-mega-menu-${top.id}`}
                      role="region"
                      aria-label={top.label}
                      className="absolute left-0 top-full pt-2 w-[36rem] max-w-[90vw] z-50"
                    >
                      <div className="surface-elevated rounded-xl p-6 border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))]">
                        <div
                          className={`grid gap-6 ${
                            top.groups.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
                          }`}
                        >
                          {top.groups.map((group) => (
                            <div key={group.key}>
                              <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 mb-3 px-2">
                                {group.key}
                              </p>
                              <ul className="space-y-1">
                                {group.items.map((leaf) => (
                                  <li key={leaf.id}>
                                    {renderCmsLeafLink(
                                      leaf,
                                      'block rounded-lg p-2.5 hover:bg-[rgb(var(--bg-hover))]/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                                      () => setOpenMenu(null),
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : top.openInNewTab || isExternalUrl(top.href) ? (
                <a
                  key={top.id}
                  href={renderCmsNavHref(top.href)}
                  target={top.openInNewTab ? '_blank' : undefined}
                  rel={top.openInNewTab ? 'noopener noreferrer' : undefined}
                  className={NAV_LINK_CLASSES}
                >
                  {top.label}
                </a>
              ) : (
                <Link key={top.id} href={renderCmsNavHref(top.href)} className={NAV_LINK_CLASSES}>
                  {top.label}
                </Link>
              ),
            )
          ) : (
            <>
              {/* Product Mega-Menu */}
              <div
                className="relative"
                onMouseEnter={() => setOpenMenu('product')}
                onMouseLeave={() => setOpenMenu(null)}
                onBlur={handleContainerBlur}
              >
                <button
                  ref={productTriggerRef}
                  type="button"
                  aria-expanded={openMenu === 'product'}
                  aria-haspopup="true"
                  aria-controls="mega-menu-product"
                  onClick={() => setOpenMenu(openMenu === 'product' ? null : 'product')}
                  onKeyDown={handleTriggerKeyDown('product', productPanelRef)}
                  className={NAV_LINK_CLASSES}
                >
                  <span>{t('nav.product')}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                      openMenu === 'product' ? 'rotate-180 text-primary-600' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {renderMegaMenuPanel('product', PRODUCT_MEGA_MENU, productPanelRef, true)}
              </div>

              {/* Solutions Mega-Menu */}
              <div
                className="relative"
                onMouseEnter={() => setOpenMenu('solutions')}
                onMouseLeave={() => setOpenMenu(null)}
                onBlur={handleContainerBlur}
              >
                <button
                  ref={solutionsTriggerRef}
                  type="button"
                  aria-expanded={openMenu === 'solutions'}
                  aria-haspopup="true"
                  aria-controls="mega-menu-solutions"
                  onClick={() => setOpenMenu(openMenu === 'solutions' ? null : 'solutions')}
                  onKeyDown={handleTriggerKeyDown('solutions', solutionsPanelRef)}
                  className={NAV_LINK_CLASSES}
                >
                  <span>{t('nav.solutions')}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                      openMenu === 'solutions' ? 'rotate-180 text-primary-600' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {renderMegaMenuPanel('solutions', SOLUTIONS_MEGA_MENU, solutionsPanelRef, false)}
              </div>

              {/* Direct Links: Pricing, Resources, Company (+ Blog when published posts exist) */}
              {directLinks.map((item) => (
                <Link key={item.href} href={localizePath(item.href, locale)} className={NAV_LINK_CLASSES}>
                  {t(item.labelKey)}
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden lg:flex items-center gap-2.5">
          <LanguageSwitcher variant="header" availableLanguages={availableLanguages} />
          <Link
            href={localizePath('/login', locale)}
            className="px-3.5 py-2 rounded-md text-sm font-semibold text-[rgb(var(--text-primary))] hover:text-primary-600 hover:bg-primary-50/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 whitespace-nowrap"
          >
            {t('nav.logIn')}
          </Link>
          <ButtonLink href={`/signup`} variant="primary" size="sm">
            {t('nav.startFreeTrial')}
          </ButtonLink>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex lg:hidden items-center gap-2">
          <LanguageSwitcher variant="header" availableLanguages={availableLanguages} />
          <ButtonLink
            href={`/signup`}
            variant="primary"
            size="sm"
            className="hidden xs:inline-flex"
          >
            {t('nav.startFreeTrial')}
          </ButtonLink>
          <button
            ref={mobileToggleRef}
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
            aria-label={mobileOpen ? t('a11y.closeMenu') : t('a11y.openMenu')}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            {mobileOpen ? (
              <X className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </Container>

      {/* Mobile Navigation Drawer */}
      <div
        id="mobile-nav-drawer"
        hidden={!mobileOpen}
        className="lg:hidden border-t border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] max-h-[calc(100vh-4rem)] overflow-y-auto shadow-elevated"
      >
        <Container className="py-4 space-y-2">
          <nav aria-label={t('a11y.mobileNavigation')}>
            {usingCmsMenus ? (
              <div className="space-y-1">
                {cmsTopItems.map((top) =>
                  top.groups.length > 0 ? (
                    <div key={top.id} className="border-b border-[rgb(var(--border-base))] py-2">
                      <button
                        type="button"
                        aria-expanded={mobileGroupOpen === top.id}
                        aria-controls={`cms-mobile-submenu-${top.id}`}
                        onClick={() =>
                          setMobileGroupOpen(mobileGroupOpen === top.id ? null : top.id)
                        }
                        className="w-full min-h-[44px] flex items-center justify-between px-2 py-2.5 text-base font-semibold text-[rgb(var(--text-primary))] rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        <span>{top.label}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-primary-600 transition-transform duration-150 ${
                            mobileGroupOpen === top.id ? 'rotate-180' : ''
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                      <div
                        id={`cms-mobile-submenu-${top.id}`}
                        hidden={mobileGroupOpen !== top.id}
                        className="mt-1 pb-2 pl-3 space-y-4"
                      >
                        {top.groups.map((group) => (
                          <div key={group.key}>
                            <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 mb-1.5 px-2">
                              {group.key}
                            </p>
                            <ul className="space-y-1">
                              {group.items.map((leaf) => (
                                <li key={leaf.id}>
                                  {renderCmsLeafLink(
                                    leaf,
                                    'block px-2 py-2 rounded-md text-sm font-medium text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--text-primary))]',
                                    () => setMobileOpen(false),
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : top.openInNewTab || isExternalUrl(top.href) ? (
                    <a
                      key={top.id}
                      href={renderCmsNavHref(top.href)}
                      target={top.openInNewTab ? '_blank' : undefined}
                      rel={top.openInNewTab ? 'noopener noreferrer' : undefined}
                      onClick={() => setMobileOpen(false)}
                      className="block min-h-[44px] px-2 py-2.5 rounded-md text-base font-semibold text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-hover))]"
                    >
                      {top.label}
                    </a>
                  ) : (
                    <Link
                      key={top.id}
                      href={renderCmsNavHref(top.href)}
                      onClick={() => setMobileOpen(false)}
                      className="block min-h-[44px] px-2 py-2.5 rounded-md text-base font-semibold text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-hover))]"
                    >
                      {top.label}
                    </Link>
                  ),
                )}
              </div>
            ) : (
              <>
                {renderMobileGroup('product', t('nav.product'), PRODUCT_MEGA_MENU)}
                {renderMobileGroup('solutions', t('nav.solutions'), SOLUTIONS_MEGA_MENU)}

                <div className="py-2 space-y-1 border-b border-[rgb(var(--border-base))]">
                  {directLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={localizePath(item.href, locale)}
                      onClick={() => setMobileOpen(false)}
                      className="block min-h-[44px] px-2 py-2.5 rounded-md text-base font-semibold text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      {t(item.labelKey)}
                    </Link>
                  ))}
                </div>
              </>
            )}

            <div className="pt-4 pb-2 flex flex-col gap-2.5">
              <ButtonLink
                href="/login"
                variant="outline"
                size="md"
                className="w-full"
                onClick={() => setMobileOpen(false)}
              >
                {t('nav.logIn')}
              </ButtonLink>
              <ButtonLink
                href={`/signup`}
                external
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => setMobileOpen(false)}
              >
                {t('nav.startFreeTrial')}
              </ButtonLink>
            </div>
          </nav>
        </Container>
      </div>
    </header>
  );
}
