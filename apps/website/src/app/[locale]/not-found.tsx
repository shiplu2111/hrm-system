import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { permanentRedirect, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ErrorState } from '../../components/layout/ErrorState';
import { ButtonLink } from '../../components/marketing';
import { createTranslator, DEFAULT_LOCALE, getDictionary, isWebsiteLocale } from '../../i18n';
import { lookupCmsRedirect } from '../../lib/cms-redirects';

const defaultDict = getDictionary(DEFAULT_LOCALE);
const tMeta = createTranslator(defaultDict);

export const metadata: Metadata = {
  title: tMeta('meta.notFoundTitle'),
  description: tMeta('meta.notFoundDescription'),
  robots: { index: false, follow: false },
};

export default async function NotFoundPage() {
  // Check CMS redirects across any unmatched nested route before rendering 404
  try {
    const hdrs = await headers();
    const rawPathname = hdrs.get('x-cms-pathname');
    if (rawPathname && rawPathname !== '/') {
      const rule = await lookupCmsRedirect(rawPathname);
      if (rule) {
        const firstSeg = rawPathname.split('/')[1];
        const locale = firstSeg && isWebsiteLocale(firstSeg) ? firstSeg : DEFAULT_LOCALE;
        const target =
          rule.destinationUrl.startsWith('/') &&
          locale !== DEFAULT_LOCALE &&
          !rule.destinationUrl.startsWith(`/${locale}`)
            ? `/${locale}${rule.destinationUrl === '/' ? '' : rule.destinationUrl}`
            : rule.destinationUrl;
        if (rule.redirectType === 'temporary_302' || rule.redirectType === 'temporary_307') {
          redirect(target);
        }
        permanentRedirect(target);
      }
    }
  } catch (err) {
    // Re-throw Next.js internal redirect errors; ignore static prerender header absence
    if (
      err &&
      typeof err === 'object' &&
      'digest' in err &&
      typeof (err as { digest?: unknown }).digest === 'string' &&
      (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
    ) {
      throw err;
    }
  }

  const dict = getDictionary(DEFAULT_LOCALE);
  const t = createTranslator(dict);

  return (
    <ErrorState
      badge={t('errors.notFound.badge')}
      tone="neutral"
      title={t('errors.notFound.title')}
      description={t('errors.notFound.description')}
      actions={
        <>
          <ButtonLink
            href="/"
            variant="primary"
            size="md"
            leadingIcon={<ArrowLeft className="w-4 h-4" aria-hidden="true" />}
          >
            {t('errors.notFound.primaryCta')}
          </ButtonLink>
          <ButtonLink href="/components" variant="outline" size="md">
            {t('errors.notFound.secondaryCta')}
          </ButtonLink>
        </>
      }
      helpfulHeading={t('errors.notFound.helpfulHeading')}
      helpfulLinks={[
        { label: t('errors.notFound.links.home'), href: '/' },
        { label: t('errors.notFound.links.telemetry'), href: '/status' },
        { label: t('errors.notFound.links.login'), href: '/login' },
      ]}
    />
  );
}
