import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Camera,
  Layers,
  Lock,
  ShieldCheck,
  UserRound,
  WifiOff,
} from 'lucide-react';
import {
  ButtonLink,
  Container,
  CtaBand,
  FeatureCard,
  Section,
  SectionHeader,
} from '../../../components/marketing';
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
    title: dict.company.about.metaTitle,
    description: dict.company.about.metaDescription,
    path: '/about',
    locale,
    eyebrow: dict.company.about.eyebrow,
  });
}

const PRINCIPLE_ICONS = {
  'config-over-code': Layers,
  'deterministic-payroll': ShieldCheck,
  'offline-resilience': WifiOff,
  'tenant-privacy': Lock,
} as const;

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveWebsiteLocale(rawLocale);
  const dict = getDictionary(locale);
  const about = dict.company.about;

  return (
    <>
      {/* 1. Hero */}
      <Section surface="base" rhythm="default" bordered className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0 -z-10 pointer-events-none" aria-hidden="true" />
        <Container>
          <div className="max-w-4xl space-y-6">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full surface text-xs font-semibold text-[rgb(var(--text-secondary))]">
              <Building2 className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              <span>{about.eyebrow}</span>
            </span>

            <h1 className="text-display-md sm:text-display-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              {about.title}
            </h1>

            <p className="text-base sm:text-lead-lg text-[rgb(var(--text-secondary))] leading-relaxed max-w-3xl">
              {about.subtitle}
            </p>
          </div>
        </Container>
      </Section>

      {/* 2. Mission */}
      <Section surface="tinted" rhythm="default" bordered>
        <Container className="space-y-10">
          <SectionHeader
            align="left"
            eyebrow={about.mission.eyebrow}
            title={about.mission.title}
            subtitle={about.mission.description}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {about.mission.highlights.map((item) => (
              <div
                key={item.label}
                className="surface rounded-2xl p-6 space-y-2 border border-[rgb(var(--border-base))]"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
                  {item.label}
                </p>
                <p className="text-sm sm:text-base font-medium text-[rgb(var(--text-primary))] leading-relaxed">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* 3. Story */}
      <Section surface="base" rhythm="default" bordered>
        <Container>
          <div className="max-w-3xl space-y-6">
            <SectionHeader align="left" eyebrow={about.story.eyebrow} title={about.story.title} />
            <div className="space-y-5 text-base text-[rgb(var(--text-secondary))] leading-relaxed">
              {about.story.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      {/* 4. Engineering & Product Principles */}
      <Section surface="tinted" rhythm="default" bordered>
        <Container className="space-y-10">
          <SectionHeader
            align="left"
            eyebrow={about.principles.eyebrow}
            title={about.principles.title}
            subtitle={about.principles.description}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {about.principles.items.map((item) => {
              const Icon = PRINCIPLE_ICONS[item.id];
              return (
                <FeatureCard
                  key={item.id}
                  icon={<Icon className="w-5 h-5" />}
                  title={item.title}
                  description={item.description}
                />
              );
            })}
          </div>
        </Container>
      </Section>

      {/* 5. Team & Leadership Placeholders (no fabricated names or photos) */}
      <Section surface="base" rhythm="default" bordered id="team">
        <Container className="space-y-8">
          <SectionHeader
            align="left"
            eyebrow={about.team.eyebrow}
            title={about.team.title}
            subtitle={about.team.description}
          />

          <div
            role="note"
            className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-xs sm:text-sm font-medium text-warning-800"
          >
            {about.team.placeholderNotice}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {about.team.slots.map((slot) => (
              <article
                key={slot.id}
                className="surface rounded-2xl border border-dashed border-[rgb(var(--border-strong))] p-6 flex flex-col gap-4"
              >
                {/* Marked Team Photo Placeholder */}
                <div
                  className="aspect-[4/3] w-full rounded-xl bg-[rgb(var(--bg-muted))] border border-dashed border-[rgb(var(--border-base))] flex flex-col items-center justify-center gap-2 p-4 text-center"
                  aria-label={about.team.photoPendingLabel}
                >
                  <div className="w-12 h-12 rounded-full bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border-base))] flex items-center justify-center text-[rgb(var(--text-muted))]">
                    <UserRound className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-warning-700 bg-warning-50 border border-warning-200 rounded px-2 py-0.5">
                    <Camera className="w-3 h-3" aria-hidden="true" />
                    {about.team.photoPendingLabel}
                  </span>
                </div>

                <div className="space-y-2 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[rgb(var(--text-muted))]">
                      {slot.slotTitle}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-warning-50 text-warning-700 border border-warning-200">
                      {about.team.rolePendingBadge}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[rgb(var(--text-primary))] font-mono">
                    {slot.name}
                  </h3>
                  <p className="text-xs font-mono font-medium text-primary-600">{slot.role}</p>
                  <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed pt-1">
                    {slot.bio}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      {/* 6. Related Links */}
      <Section surface="tinted" rhythm="default" bordered>
        <Container className="space-y-6">
          <h2 className="text-lg font-bold text-[rgb(var(--text-primary))]">
            {about.exploreMore.title}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="surface rounded-2xl p-6 border border-[rgb(var(--border-base))] flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <h3 className="text-base font-bold text-[rgb(var(--text-primary))]">
                  {about.exploreMore.securityTitle}
                </h3>
                <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                  {about.exploreMore.securityBody}
                </p>
              </div>
              <Link
                href="/security"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span>{about.exploreMore.securityCta}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="surface rounded-2xl p-6 border border-[rgb(var(--border-base))] flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <h3 className="text-base font-bold text-[rgb(var(--text-primary))]">
                  {about.exploreMore.careersTitle}
                </h3>
                <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                  {about.exploreMore.careersBody}
                </p>
              </div>
              <Link
                href="/careers"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span>{about.exploreMore.careersCta}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Container>
      </Section>

      {/* 7. CTA Band */}
      <CtaBand
        tone="dark"
        title={about.cta.heading}
        description={about.cta.body}
        actions={
          <>
            <ButtonLink
              href={`/signup`}
              variant="inverse"
              size="lg"
              trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
            >
              {about.cta.primaryCta}
            </ButtonLink>
            <ButtonLink
              href="/demo"
              variant="outline"
              size="lg"
              className="border-primary-400 bg-transparent text-white hover:bg-primary-800 hover:text-white"
            >
              {about.cta.secondaryCta}
            </ButtonLink>
          </>
        }
        footnote={dict.home.cta.footnote}
      />
    </>
  );
}
