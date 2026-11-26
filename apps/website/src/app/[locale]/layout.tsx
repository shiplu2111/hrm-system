import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Noto_Sans_Bengali } from 'next/font/google';
import { notFound } from 'next/navigation';
import '../../styles/globals.css';
import { AnnouncementBar, SiteFooter, SiteHeader } from '../../components/layout';
import { CookieConsentProvider } from '../../components/legal/CookieConsentProvider';
import { ConsentGatedScripts } from '../../components/legal/ConsentGatedScripts';
import { apiClient } from '../../api/client';
import { fetchPublicCmsMenus } from '../../lib/cms-menus';
import { fetchPublicSiteSettingsBundle } from '../../lib/cms-site-settings';
import {
  createTranslator,
  DEFAULT_LOCALE,
  getDictionary,
  isWebsiteLocale,
  LOCALE_OG_TAGS,
  localizePath,
  SUPPORTED_LOCALES,
  type WebsiteLocale,
} from '../../i18n';
import { WebsiteI18nProvider } from '../../i18n/client';
import { CurrencyProvider } from '../../i18n/currency-client';
import { getBlogContentProvider } from '../../lib/blog';
import {
  buildHreflangLanguages,
  buildOgImageUrl,
  buildOrganizationJsonLd,
  getSiteUrl,
  isIndexableProduction,
  safeJsonLdStringify,
} from '../../lib/seo';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  adjustFontFallback: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  adjustFontFallback: true,
});

const notoSansBengali = Noto_Sans_Bengali({
  subsets: ['bengali'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bengali',
  display: 'swap',
  adjustFontFallback: true,
});

export const revalidate = 10;

export const viewport: Viewport = {
  themeColor: '#1e4976', // Primary 600 from DESIGN_SYSTEM.md
  width: 'device-width',
  initialScale: 1,
};

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: WebsiteLocale = isWebsiteLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const tMeta = createTranslator(dict);
  const siteUrl = getSiteUrl();
  const indexableProduction = isIndexableProduction();
  const siteSettings = await fetchPublicSiteSettingsBundle();
  const canonicalPath = localizePath('/', locale);
  const customDefaultOg = siteSettings.seo.defaultOgImageUrl?.trim();
  const defaultOgImageUrl =
    customDefaultOg ||
    buildOgImageUrl({
      title: tMeta('meta.ogTitle'),
      eyebrow: tMeta('brand.fullName'),
    });
  const localizedSeoDesc =
    (locale === 'bn'
      ? siteSettings.seo.defaultDescription.bn || siteSettings.seo.defaultDescription.en
      : siteSettings.seo.defaultDescription.en) || tMeta('meta.description');

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: tMeta('meta.defaultTitle'),
      template: siteSettings.seo.titleTemplate || tMeta('meta.titleTemplate'),
    },
    description: localizedSeoDesc,
    keywords: tMeta('meta.keywords').split(','),
    authors: [{ name: tMeta('meta.author') }],
    creator: tMeta('brand.fullName'),
    publisher: tMeta('brand.platformName'),
    alternates: {
      canonical: canonicalPath,
      languages: buildHreflangLanguages('/'),
    },
    robots: indexableProduction
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        }
      : {
          index: false,
          follow: false,
          nocache: true,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
          },
        },
    openGraph: {
      type: 'website',
      locale: LOCALE_OG_TAGS[locale] ?? 'en_US',
      alternateLocale: SUPPORTED_LOCALES.filter((l) => l !== locale).map(
        (l) => LOCALE_OG_TAGS[l],
      ),
      url: canonicalPath === '/' ? siteUrl : `${siteUrl}${canonicalPath}`,
      siteName: tMeta('brand.fullName'),
      title: tMeta('meta.ogTitle'),
      description: tMeta('meta.ogDescription'),
      images: [
        {
          url: defaultOgImageUrl,
          width: 1200,
          height: 630,
          alt: tMeta('meta.ogTitle'),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: tMeta('meta.twitterTitle'),
      description: tMeta('meta.description'),
      images: [defaultOgImageUrl],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isWebsiteLocale(rawLocale)) {
    notFound();
  }
  const locale = rawLocale;
  const dict = getDictionary(locale);
  const t = createTranslator(dict);

  const [{ currencies, meta: currencyMeta }, hasBlogPosts, availableLanguages, siteSettings, cmsMenus] =
    await Promise.all([
      apiClient.currencies.list(),
      getBlogContentProvider().hasPublishedPosts(),
      apiClient.languages.list({ revalidate: 60 }),
      fetchPublicSiteSettingsBundle(),
      fetchPublicCmsMenus(),
    ]);

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${jetbrainsMono.variable} ${notoSansBengali.variable}`}
    >
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${t('brand.fullName')} Blog RSS`}
          href="/blog/rss.xml"
        />
      </head>
      <body className="min-h-screen flex flex-col font-sans antialiased bg-[rgb(var(--bg-base))] text-[rgb(var(--text-secondary))]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(buildOrganizationJsonLd()) }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 bg-primary-600 text-white px-4 py-2 rounded-md shadow-lg"
        >
          {t('a11y.skipToContent')}
        </a>
        <WebsiteI18nProvider locale={locale} dictionary={dict}>
          <CurrencyProvider
            initialCurrencies={currencies}
            defaultCurrency={currencyMeta.defaultCurrency}
          >
            <CookieConsentProvider bannerWording={siteSettings.cookieBanner}>
              <ConsentGatedScripts />
              <div className="min-h-screen flex flex-col">
                <AnnouncementBar config={siteSettings.announcementBar} />
                <SiteHeader
                  hasBlogPosts={hasBlogPosts}
                  availableLanguages={availableLanguages}
                  cmsMenus={cmsMenus}
                />
                <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 outline-none">
                  {children}
                </main>
                <SiteFooter
                  hasBlogPosts={hasBlogPosts}
                  availableLanguages={availableLanguages}
                  siteSettings={{
                    contact: siteSettings.contact,
                    socialLinks: siteSettings.socialLinks,
                    footer: siteSettings.footer,
                  }}
                  cmsMenus={cmsMenus}
                />
              </div>
            </CookieConsentProvider>
          </CurrencyProvider>
        </WebsiteI18nProvider>
      </body>
    </html>
  );
}
