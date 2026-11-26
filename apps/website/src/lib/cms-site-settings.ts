import type { CmsLocale, CmsSiteSettingsBundleDto } from '@hrm/shared-types';
import { fetchCmsJsonWithFallback } from './cms-resilient-cache';

const DEFAULT_BUNDLE: CmsSiteSettingsBundleDto = {
  contact: {
    companyName: { en: 'CMSN-HR', bn: 'সিএমএসএন-এইচআর' },
    address: {
      en: 'House 24, Road 11, Banani, Dhaka 1213, Bangladesh',
      bn: 'বাড়ি ২৪, রোড ১১, বনানী, ঢাকা ১২১৩, বাংলাদেশ',
    },
    phone: '+880 1700-000000',
    salesEmail: 'sales@cmsnbd.com',
    supportEmail: 'support@cmsnbd.com',
  },
  socialLinks: {
    linkedin: '',
    x: '',
    facebook: '',
    youtube: '',
    github: '',
  },
  announcementBar: {
    enabled: false,
    text: { en: '', bn: '' },
    linkLabel: { en: '', bn: '' },
    linkUrl: '',
    startsAt: null,
    endsAt: null,
    dismissible: true,
  },
  footer: {
    tagline: { en: '', bn: '' },
    copyrightText: { en: '', bn: '' },
  },
  cookieBanner: {
    title: { en: '', bn: '' },
    body: { en: '', bn: '' },
    policyLinkText: { en: '', bn: '' },
    acceptAllLabel: { en: '', bn: '' },
    declineAllLabel: { en: '', bn: '' },
    customizeLabel: { en: '', bn: '' },
  },
  seo: {
    defaultOgImageUrl: '',
    titleTemplate: '%s | CMSN-HR',
    defaultDescription: { en: '', bn: '' },
  },
  locale: {
    defaultLanguage: 'en',
    supportedLocales: ['en', 'bn'],
    fallbackLocale: 'en',
  },
};

function getWebsiteApiBaseUrl(): string {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000'
  ).replace(/\/+$/, '');
}

function mergeLocalized(
  raw: unknown,
  fallback: { en: string; bn: string },
): { en: string; bn: string } {
  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as { en?: unknown; bn?: unknown };
  return {
    en: typeof r.en === 'string' ? r.en : fallback.en,
    bn: typeof r.bn === 'string' ? r.bn : fallback.bn,
  };
}

export async function fetchPublicSiteSettingsBundle(): Promise<CmsSiteSettingsBundleDto> {
  const result = await fetchCmsJsonWithFallback<{
    data?: Record<string, Record<string, unknown>>;
  }>({
    cacheKey: 'cms:settings:bundle',
    url: `${getWebsiteApiBaseUrl()}/api/v1/public/content/settings`,
    revalidateSeconds: 30,
    tags: ['cms-settings'],
    timeoutMs: 2500,
    treat404AsAuthoritative: false,
  });

  if (!result.ok || !result.data?.data) {
    return DEFAULT_BUNDLE;
  }

  const raw = result.data.data;
    const contact = raw['site.contact'] ?? {};
    const social = raw['site.social'] ?? {};
    const ann = raw['site.announcement'] ?? {};
    const footer = raw['site.footer'] ?? {};
    const cookie = raw['site.cookie_banner'] ?? {};
    const seo = raw['seo.defaults'] ?? {};
    const locale = raw['locale.config'] ?? {};

    const defaultLang: CmsLocale =
      locale.defaultLanguage === 'bn' || locale.defaultLocale === 'bn' ? 'bn' : 'en';

    return {
      contact: {
        companyName: mergeLocalized(contact.companyName, DEFAULT_BUNDLE.contact.companyName),
        address: mergeLocalized(contact.address, DEFAULT_BUNDLE.contact.address),
        phone: typeof contact.phone === 'string' ? contact.phone : DEFAULT_BUNDLE.contact.phone,
        salesEmail:
          typeof contact.salesEmail === 'string'
            ? contact.salesEmail
            : DEFAULT_BUNDLE.contact.salesEmail,
        supportEmail:
          typeof contact.supportEmail === 'string'
            ? contact.supportEmail
            : DEFAULT_BUNDLE.contact.supportEmail,
      },
      socialLinks: {
        linkedin: typeof social.linkedin === 'string' ? social.linkedin : '',
        x: typeof social.x === 'string' ? social.x : '',
        facebook: typeof social.facebook === 'string' ? social.facebook : '',
        youtube: typeof social.youtube === 'string' ? social.youtube : '',
        github: typeof social.github === 'string' ? social.github : '',
      },
      announcementBar: {
        enabled: Boolean(ann.enabled),
        text: mergeLocalized(ann.text, DEFAULT_BUNDLE.announcementBar.text),
        linkLabel: mergeLocalized(ann.linkLabel, DEFAULT_BUNDLE.announcementBar.linkLabel),
        linkUrl: typeof ann.linkUrl === 'string' ? ann.linkUrl : '',
        startsAt: typeof ann.startsAt === 'string' ? ann.startsAt : null,
        endsAt: typeof ann.endsAt === 'string' ? ann.endsAt : null,
        dismissible: ann.dismissible !== undefined ? Boolean(ann.dismissible) : true,
      },
      footer: {
        tagline: mergeLocalized(footer.tagline, DEFAULT_BUNDLE.footer.tagline),
        copyrightText: mergeLocalized(footer.copyrightText, DEFAULT_BUNDLE.footer.copyrightText),
      },
      cookieBanner: {
        title: mergeLocalized(cookie.title, DEFAULT_BUNDLE.cookieBanner.title),
        body: mergeLocalized(cookie.body, DEFAULT_BUNDLE.cookieBanner.body),
        policyLinkText: mergeLocalized(
          cookie.policyLinkText,
          DEFAULT_BUNDLE.cookieBanner.policyLinkText,
        ),
        acceptAllLabel: mergeLocalized(
          cookie.acceptAllLabel,
          DEFAULT_BUNDLE.cookieBanner.acceptAllLabel,
        ),
        declineAllLabel: mergeLocalized(
          cookie.declineAllLabel,
          DEFAULT_BUNDLE.cookieBanner.declineAllLabel,
        ),
        customizeLabel: mergeLocalized(
          cookie.customizeLabel,
          DEFAULT_BUNDLE.cookieBanner.customizeLabel,
        ),
      },
      seo: {
        defaultOgImageUrl:
          typeof seo.defaultOgImageUrl === 'string' ? seo.defaultOgImageUrl : '',
        titleTemplate:
          typeof seo.titleTemplate === 'string'
            ? seo.titleTemplate
            : DEFAULT_BUNDLE.seo.titleTemplate,
        defaultDescription: mergeLocalized(
          seo.defaultDescription,
          DEFAULT_BUNDLE.seo.defaultDescription,
        ),
      },
      locale: {
        defaultLanguage: defaultLang,
        supportedLocales: ['en', 'bn'],
        fallbackLocale: 'en',
      },
    };
}
