import type { Metadata } from 'next';
import { Lock } from 'lucide-react';
import { WorkspaceLoginForm } from '../../../components/leads/WorkspaceLoginForm';
import { Container, Section } from '../../../components/marketing';
import { getDictionary, resolveWebsiteLocale } from '../../../i18n';
import { buildPageMetadata } from '../../../lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  return buildPageMetadata({
    title: dict.login.metaTitle,
    description: dict.login.metaDescription,
    path: '/login',
    locale,
    eyebrow: dict.login.eyebrow,
  });
}

export default async function PublicLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const copy = dict.login;

  return (
    <Section surface="tinted" rhythm="default" className="relative overflow-hidden">
      <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
      <Container>
        <div className="max-w-lg mx-auto text-center space-y-4 mb-8">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface text-xs font-semibold text-[rgb(var(--text-secondary))]">
            <Lock className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
            <span>{copy.eyebrow}</span>
          </span>

          <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
            {copy.title}
          </h1>

          <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed">
            {copy.subtitle}
          </p>
        </div>

        <WorkspaceLoginForm />
      </Container>
    </Section>
  );
}
