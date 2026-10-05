import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { CtaBanner } from '@/components/CtaBanner';
import { Container, PageHero } from '@/components/ui/Section';
import { featureCategories } from '@/lib/features';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Core HR, attendance, leave, rosters, payroll, recruitment, performance, self-service and reporting — every CMSN-HR module explained.',
};

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Every HR process, one connected platform"
        description="From the first job post to the final payslip, CMSN-HR keeps your people data in one place and your processes moving."
      />

      <div className="sticky top-16 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <Container>
          <nav className="-mx-1 flex gap-1 overflow-x-auto py-3" aria-label="Feature categories">
            {featureCategories.map((category) => (
              <a
                key={category.id}
                href={`#${category.id}`}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
              >
                {category.title}
              </a>
            ))}
          </nav>
        </Container>
      </div>

      <Container className="py-16 sm:py-20">
        <div className="space-y-6">
          {featureCategories.map(({ id, icon: Icon, title, summary, points }, index) => (
            <section
              key={id}
              id={id}
              className="scroll-mt-36 grid gap-8 rounded-2xl border border-slate-200 bg-white p-7 shadow-card sm:p-10 lg:grid-cols-[1fr_1.3fr]"
            >
              <div>
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <p className="mt-5 text-sm font-semibold text-brand-600">{String(index + 1).padStart(2, '0')}</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">{title}</h2>
                <p className="mt-3 leading-relaxed text-slate-600">{summary}</p>
              </div>
              <ul className="grid content-start gap-3 sm:grid-cols-2">
                {points.map((point) => (
                  <li key={point} className="flex gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Container>

      <CtaBanner title="See it with your own data" />
    </>
  );
}
