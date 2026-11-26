import type { Metadata } from 'next';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { apiClient } from '../../../api/client';
import { LegalDocumentView } from '../../../components/legal/LegalDocumentView';
import { env } from '../../../env';
import { formatNumber, getDictionary, interpolate, localizePath, resolveWebsiteLocale } from '../../../i18n';
import { getLegalDocument } from '../../../lib/legal';
import { buildPageMetadata } from '../../../lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const doc = getLegalDocument('dpa');
  return buildPageMetadata({
    title: locale === 'bn' ? dict.legal.nav.dpa : doc.title,
    description: doc.summary,
    path: '/dpa',
    locale,
    eyebrow: locale === 'bn' ? 'আইনি ও গোপনীয়তা' : 'Legal & Privacy',
  });
}

export default async function DpaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const doc = getLegalDocument('dpa');
  const dpaMeta = await apiClient.legal.getDpa({ cache: 'no-store' });

  const pdfHref = dpaMeta
    ? `${env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}${dpaMeta.downloadUrl}`
    : `${env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/api/v1/public/legal/dpa/pdf`;

  const sizeKb = dpaMeta ? Math.max(1, Math.round(dpaMeta.byteSize / 1024)) : null;

  const downloadSlot = (
    <div
      data-testid="dpa-pdf-download-card"
      className="surface rounded-2xl border border-[rgb(var(--border-base))] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div className="space-y-1">
        <h2 className="text-base font-bold text-[rgb(var(--text-primary))]">
          {dict.legal.dpa.downloadCardTitle}
        </h2>
        <p className="text-xs sm:text-sm text-[rgb(var(--text-secondary))]">
          {dict.legal.dpa.downloadCardSubtitle}
        </p>
        {dpaMeta && sizeKb !== null && (
          <p data-testid="dpa-pdf-meta" className="text-xs font-mono text-[rgb(var(--text-muted))]">
            {interpolate(dict.legal.dpa.fileMetaNote, {
              filename: dpaMeta.filename,
              sizeKb: formatNumber(sizeKb, locale),
            })}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <a
          href={pdfHref}
          download={dpaMeta?.filename || 'CMSN-HR-DPA-2026-11.pdf'}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="dpa-pdf-download-btn"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-xs sm:text-sm font-semibold hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span>{dict.legal.dpa.downloadCta}</span>
        </a>
        <Link
          href={localizePath('/subprocessors', locale)}
          className="text-xs font-semibold text-primary-600 hover:underline px-2 py-1"
        >
          {dict.legal.dpa.subprocessorsLinkCta}
        </Link>
      </div>
    </div>
  );

  return <LegalDocumentView doc={doc} locale={locale} headerActionSlot={downloadSlot} />;
}
