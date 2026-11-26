import Link from 'next/link';
import { AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { Container, Section, TranslationFallbackNotice } from '../marketing';
import { DEFAULT_LOCALE, formatDate, getDictionary, localizePath, type WebsiteLocale } from '../../i18n';
import type { LegalDocument } from '../../lib/legal';
import { CookieSettingsButton } from './CookieSettingsButton';

interface LegalDocumentViewProps {
  doc: LegalDocument;
  locale?: WebsiteLocale;
  showCookieSettingsAction?: boolean;
  headerActionSlot?: React.ReactNode;
}

function renderInlineFormatting(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-[rgb(var(--text-primary))]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-[rgb(var(--bg-subtle))] font-mono text-[0.9em] text-[rgb(var(--text-primary))]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function renderMarkdownBlocks(markdown: string): React.ReactNode[] {
  const lines = markdown.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = (keyPrefix: number) => {
    if (listBuffer.length === 0) return;
    nodes.push(
      <ul
        key={`list-${keyPrefix}`}
        className="list-disc pl-5 space-y-1.5 text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed"
      >
        {listBuffer.map((item, i) => (
          <li key={i}>{renderInlineFormatting(item)}</li>
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      flushList(index);
      return;
    }

    if (line.startsWith('- ')) {
      listBuffer.push(line.slice(2));
      return;
    }

    flushList(index);

    if (line.startsWith('## ')) {
      nodes.push(
        <h2
          key={`h2-${index}`}
          className="text-xl font-bold text-[rgb(var(--text-primary))] pt-4"
        >
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith('### ')) {
      nodes.push(
        <h3
          key={`h3-${index}`}
          className="text-base font-bold text-[rgb(var(--text-primary))] pt-2"
        >
          {line.slice(4)}
        </h3>,
      );
    } else if (line.startsWith('> ')) {
      nodes.push(
        <blockquote
          key={`bq-${index}`}
          className="rounded-xl border border-warning-200 bg-warning-50 p-4 text-xs sm:text-sm text-warning-900"
        >
          {renderInlineFormatting(line.slice(2))}
        </blockquote>,
      );
    } else {
      nodes.push(
        <p
          key={`p-${index}`}
          className="text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed"
        >
          {renderInlineFormatting(line)}
        </p>,
      );
    }
  });

  flushList(lines.length);
  return nodes;
}

export function LegalDocumentView({
  doc,
  locale = DEFAULT_LOCALE,
  showCookieSettingsAction,
  headerActionSlot,
}: LegalDocumentViewProps) {
  const dict = getDictionary(locale);
  const copy = dict.legal;

  const navItems = [
    { slug: 'terms', href: '/terms', label: copy.nav.terms },
    { slug: 'privacy', href: '/privacy', label: copy.nav.privacy },
    { slug: 'cookies', href: '/cookies', label: copy.nav.cookies },
    { slug: 'dpa', href: '/dpa', label: copy.nav.dpa },
    { slug: 'subprocessors', href: '/subprocessors', label: copy.nav.subprocessors },
    { slug: 'security', href: '/security', label: copy.nav.security },
  ];

  return (
    <>
      <Section surface="tinted" rhythm="default" className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
        <Container size="narrow">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface text-xs font-semibold text-[rgb(var(--text-secondary))]">
              <FileText className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              <span>CMSN-HR Legal</span>
            </span>

            <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {doc.title}
            </h1>

            {doc.summary && (
              <p className="text-base text-[rgb(var(--text-secondary))] leading-relaxed">
                {doc.summary}
              </p>
            )}

            {/* Version & Effective Date Metadata */}
            <div className="surface rounded-xl border border-[rgb(var(--border-base))] p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[rgb(var(--text-muted))] block">
                  {copy.badges.versionLabel}
                </span>
                <span
                  data-testid="legal-version"
                  className="font-mono font-semibold text-[rgb(var(--text-primary))]"
                >
                  {doc.version}
                </span>
              </div>
              <div>
                <span className="text-[rgb(var(--text-muted))] block">
                  {copy.badges.effectiveDateLabel}
                </span>
                <span
                  data-testid="legal-effective-date"
                  className="font-mono font-semibold text-[rgb(var(--text-primary))]"
                >
                  {formatDate(doc.effectiveDate, locale)}
                </span>
              </div>
              <div>
                <span className="text-[rgb(var(--text-muted))] block">
                  {copy.badges.reviewedOnLabel}
                </span>
                <span
                  data-testid="legal-reviewed-on"
                  className="font-mono font-semibold text-[rgb(var(--text-primary))]"
                >
                  {doc.legalApproved && doc.reviewedOn
                    ? formatDate(doc.reviewedOn, locale)
                    : copy.badges.pendingReviewValue}
                </span>
              </div>
            </div>

            {/* Draft vs Approved Banner */}
            {!doc.legalApproved ? (
              <div
                data-testid="legal-draft-banner"
                role="status"
                className="rounded-xl border border-warning-300 bg-warning-50 p-4 flex items-start gap-3 text-warning-900"
              >
                <AlertTriangle className="w-5 h-5 text-warning-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1 text-xs sm:text-sm">
                  <div className="font-bold">
                    {locale === 'bn' ? copy.badges.draftBannerTitle : doc.draftNotice}
                  </div>
                  <p className="opacity-90">{copy.badges.draftBannerDescription}</p>
                </div>
              </div>
            ) : (
              <div
                data-testid="legal-approved-banner"
                className="rounded-xl border border-success-200 bg-success-50 p-3.5 flex items-center gap-2.5 text-xs sm:text-sm text-success-900"
              >
                <CheckCircle2 className="w-4 h-4 text-success-700 shrink-0" aria-hidden="true" />
                <span className="font-semibold">{copy.badges.approvedBannerTitle}</span>
              </div>
            )}

            <TranslationFallbackNotice
              locale={locale}
              reason="legal_document"
              basePath={`/${doc.slug}`}
            />

            {headerActionSlot}
          </div>
        </Container>
      </Section>

      <Section surface="base" rhythm="default">
        <Container size="narrow">
          <div className="space-y-8">
            {/* Cross Links */}
            <nav aria-label="Legal documents" className="flex flex-wrap gap-2 border-b border-[rgb(var(--border-base))] pb-4">
              {navItems.map((item) => {
                const active = item.slug === doc.slug;
                return (
                  <Link
                    key={item.href}
                    href={localizePath(item.href, locale)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-primary-600 text-white'
                        : 'surface border border-[rgb(var(--border-base))] text-[rgb(var(--text-secondary))] hover:border-primary-400'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div data-testid={`legal-body-${doc.slug}`} className="space-y-4">
              {renderMarkdownBlocks(doc.body)}
            </div>

            {showCookieSettingsAction && (
              <div className="pt-4 border-t border-[rgb(var(--border-base))]">
                <CookieSettingsButton />
              </div>
            )}
          </div>
        </Container>
      </Section>
    </>
  );
}
