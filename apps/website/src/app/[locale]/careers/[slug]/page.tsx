import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Briefcase,
  ExternalLink,
  Lock,
  Mail,
  MapPin,
  Users,
} from 'lucide-react';
import {
  ButtonLink,
  Container,
  Section,
  TranslationFallbackNotice,
} from '../../../../components/marketing';
import { SafeHtmlContent } from '../../../../components/cms/SafeHtmlContent';
import { fetchCareerBySlug } from '../../../../lib/careers';
import { getDictionary, resolveWebsiteLocale } from '../../../../i18n';
import { buildPageMetadata } from '../../../../lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const role = await fetchCareerBySlug(slug, locale);

  if (!role) {
    return buildPageMetadata({
      title: 'Role Not Found',
      description: 'Requested career listing was not found.',
      path: `/careers/${slug}`,
      locale,
      noIndex: true,
    });
  }

  const isClosed = role.status !== 'open';
  return buildPageMetadata({
    title: isClosed
      ? `${role.title} (No Longer Open) — Careers`
      : `${role.title} — Careers`,
    description:
      role.summary || `${role.title} (${role.location}, ${role.employmentType})`,
    path: `/careers/${role.slug}`,
    locale,
    eyebrow: role.department,
    noIndex: isClosed,
  });
}

export default async function CareerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const role = await fetchCareerBySlug(slug, locale);

  if (!role) {
    notFound();
  }

  const isClosed = role.status !== 'open';

  if (isClosed) {
    return (
      <Section surface="tinted" rhythm="default">
        <Container>
          <div
            data-testid="career-closed-page"
            className="max-w-2xl mx-auto surface rounded-2xl border border-[rgb(var(--border-base))] p-8 sm:p-10 text-center space-y-5 shadow-card"
          >
            <div className="mx-auto w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Lock className="w-6 h-6" aria-hidden="true" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                {locale === 'bn' ? 'আবেদন বন্ধ রয়েছে' : 'No Longer Open'}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-[rgb(var(--text-primary))]">
                {role.title}
              </h1>
              <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed">
                {locale === 'bn'
                  ? 'এই পদের জন্য আবেদন প্রক্রিয়া ইতিমধ্যেই সম্পন্ন হয়েছে বা বর্তমানে বন্ধ আছে। খোলা পদসমূহ দেখতে ক্যারিয়ার পাতায় ফিরে যান।'
                  : 'Thank you for your interest. This position is no longer open for new applications. Explore our Careers page for any active openings or reach out via Contact.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <ButtonLink href="/careers" variant="primary" size="md">
                <ArrowLeft className="w-4 h-4 mr-1.5" aria-hidden="true" />
                {locale === 'bn' ? 'সকল খোলা পদ দেখুন' : 'View Open Roles'}
              </ButtonLink>
              <ButtonLink href="/contact" variant="secondary" size="md">
                {dict.company.careers.openings.empty.primaryCta}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </Section>
    );
  }

  return (
    <Section surface="tinted" rhythm="default">
      <Container>
        <div className="max-w-3xl mx-auto space-y-8">
          <ButtonLink href="/careers" variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" aria-hidden="true" />
            {dict.company.careers.eyebrow}
          </ButtonLink>

          {locale === 'bn' && role.fallbackUsed && (
            <TranslationFallbackNotice
              locale={locale}
              reason="untranslated_page"
              basePath={`/careers/${role.slug}`}
            />
          )}

          <header className="surface rounded-2xl border border-[rgb(var(--border-base))] p-6 sm:p-8 shadow-card space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[rgb(var(--text-muted))]">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700">
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                {role.department}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                {role.location}
              </span>
              <span>· {role.workMode}</span>
              <span>· {role.employmentType}</span>
            </div>

            <h1 className="text-display-sm sm:text-display-md font-bold text-[rgb(var(--text-primary))]">
              {role.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {role.applyUrl ? (
                <a
                  href={role.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors shadow-sm"
                >
                  <span>{dict.company.careers.openings.applyCta}</span>
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </a>
              ) : role.applyEmail ? (
                <a
                  href={`mailto:${role.applyEmail}?subject=${encodeURIComponent(`Application: ${role.title}`)}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors shadow-sm"
                >
                  <Mail className="w-4 h-4" aria-hidden="true" />
                  <span>Apply via {role.applyEmail}</span>
                </a>
              ) : (
                <ButtonLink
                  href={`/contact?role=${encodeURIComponent(role.slug)}`}
                  variant="primary"
                  size="md"
                >
                  <Briefcase className="w-4 h-4 mr-1.5" aria-hidden="true" />
                  {dict.company.careers.openings.applyCta}
                </ButtonLink>
              )}

              {role.applyUrl && role.applyEmail && (
                <a
                  href={`mailto:${role.applyEmail}?subject=${encodeURIComponent(`Application: ${role.title}`)}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[rgb(var(--border-base))] surface text-sm font-medium text-[rgb(var(--text-primary))] hover:border-primary-400"
                >
                  <Mail className="w-4 h-4 text-primary-600" aria-hidden="true" />
                  <span>{role.applyEmail}</span>
                </a>
              )}
            </div>
          </header>

          <div className="surface rounded-2xl border border-[rgb(var(--border-base))] p-6 sm:p-8 shadow-card">
            <SafeHtmlContent
              html={role.descriptionHtml}
              className="prose prose-slate dark:prose-invert max-w-none leading-relaxed prose-headings:font-bold prose-a:text-primary-600"
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}
