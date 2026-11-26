import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CalendarCheck2, Check } from 'lucide-react';
import { apiClient } from '../../../api/client';
import { BookDemoForm } from '../../../components/leads/BookDemoForm';
import { Container, Section } from '../../../components/marketing';
import { getDictionary, resolveWebsiteLocale } from '../../../i18n';
import { buildPageMetadata } from '../../../lib/seo';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  return buildPageMetadata({
    title: dict.leads.demo.metaTitle,
    description: dict.leads.demo.metaDescription,
    path: '/demo',
    locale,
    eyebrow: dict.leads.demo.eyebrow,
  });
}

export default async function BookDemoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const copy = dict.leads.demo;
  const countries = await apiClient.countries.list({ revalidate: 60 });

  return (
    <Section surface="tinted" rhythm="default" className="relative overflow-hidden">
      <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-5 space-y-6">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface text-xs font-semibold text-[rgb(var(--text-secondary))]">
              <CalendarCheck2 className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              <span>{copy.eyebrow}</span>
            </span>

            <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {copy.title}
            </h1>

            <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed">
              {copy.subtitle}
            </p>

            <ul className="space-y-3 pt-2">
              {copy.highlights.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-sm text-[rgb(var(--text-secondary))]"
                >
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-primary-50 border border-primary-200 flex items-center justify-center shrink-0 text-primary-700">
                    <Check className="w-3 h-3" aria-hidden="true" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-7 min-w-0">
            <Suspense fallback={null}>
              <BookDemoForm countries={countries} />
            </Suspense>
          </div>
        </div>
      </Container>
    </Section>
  );
}
