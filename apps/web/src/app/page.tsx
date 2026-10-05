import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Languages,
  Quote,
  Rocket,
  Settings2,
  Smartphone,
  UploadCloud,
} from 'lucide-react';
import { CtaBanner } from '@/components/CtaBanner';
import { Faq, pricingFaq } from '@/components/Faq';
import { ProductPreview } from '@/components/ProductPreview';
import { PricingPlans } from '@/components/pricing/PricingPlans';
import { ButtonLink } from '@/components/ui/Button';
import { Container, Section, SectionHeading } from '@/components/ui/Section';
import { featureCategories } from '@/lib/features';

const stats = [
  { value: '45+', label: 'HR & payroll modules' },
  { value: '1 day', label: 'Typical setup time' },
  { value: '99.9%', label: 'Uptime target' },
  { value: '2', label: 'Languages: English & Bangla' },
];

const industries = ['Garments & textiles', 'Manufacturing', 'Retail chains', 'IT & services', 'Healthcare', 'NGOs'];

const steps = [
  {
    icon: Settings2,
    title: 'Pick a plan',
    text: 'Choose the modules and headcount you need. Switch plans whenever your business changes.',
  },
  {
    icon: UploadCloud,
    title: 'We import your data',
    text: 'Send us your Excel sheets — employees, leave balances, salary structures — and we load them for you.',
  },
  {
    icon: Rocket,
    title: 'Go live',
    text: 'Invite HR, managers and employees. Everyone signs in to one portal and sees what their role allows.',
  },
];

const testimonials = [
  {
    quote:
      'Payroll for 900 workers used to take our team four days of spreadsheets. With CMSN-HR it is calculated, reviewed and approved in an afternoon.',
    name: 'Farhana Akter',
    role: 'Head of HR, textile manufacturer',
  },
  {
    quote:
      'Rosters, attendance and overtime finally live in one place. Site managers approve from their phones and the numbers flow straight into payroll.',
    name: 'Imran Chowdhury',
    role: 'Operations Director, retail chain',
  },
  {
    quote:
      'Employees check their own leave balance and payslips in Bangla. HR tickets dropped by more than half in the first month.',
    name: 'Nusrat Jahan',
    role: 'HR Manager, IT services company',
  },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/80 via-white to-white">
        <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
        <Container className="relative pb-20 pt-16 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center animate-fade-up">
            <Link
              href="/features#self-service"
              className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-1.5 text-sm font-medium text-brand-700 shadow-sm transition hover:border-brand-300"
            >
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">New</span>
              One portal for HR teams and employees
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
              HR, payroll and attendance —{' '}
              <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
                finally in one place
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
              CMSN-HR runs your employee records, time tracking, leave, rosters and payroll on one cloud platform, with a
              self-service app your people will actually use.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/pricing" size="lg">
                See plans & pricing
                <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/contact?topic=demo" variant="secondary" size="lg">
                Book a free demo
              </ButtonLink>
            </div>
            <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
              {['Guided data migration', 'Local payment options', 'English & Bangla'].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-16 animate-fade-up [animation-delay:150ms]">
            <ProductPreview />
          </div>
        </Container>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <Container className="grid grid-cols-2 gap-8 py-10 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold tracking-tight text-brand-700">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-600">{stat.label}</p>
            </div>
          ))}
        </Container>
      </section>

      <Section id="features">
        <SectionHeading
          eyebrow="Everything HR needs"
          title="Replace five tools and a pile of spreadsheets"
          description="Every module shares the same employee record, so a change in one place is reflected everywhere — from the roster to the payslip."
        />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featureCategories.slice(0, 6).map(({ id, icon: Icon, title, summary, points }) => (
            <Link
              key={id}
              href={`/features#${id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-elevated"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{summary}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-500">
                {points.slice(0, 3).map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                    {point}
                  </li>
                ))}
              </ul>
            </Link>
          ))}
        </div>
        <div className="mt-10 text-center">
          <ButtonLink href="/features" variant="secondary">
            Explore all features
            <ArrowRight className="h-4 w-4" aria-hidden />
          </ButtonLink>
        </div>
      </Section>

      <section className="bg-brand-950 py-20 text-white sm:py-24">
        <Container className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-300">Employee self-service</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Every employee gets their own HR desk — in their pocket
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-brand-100">
              Employees sign in to the same portal as HR and see only their own space: attendance, leave, roster, payslips
              and help. Managers approve requests from anywhere.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                { icon: Smartphone, text: 'Android & iOS app with clock-in' },
                { icon: Languages, text: 'English and Bangla interface' },
                { icon: BadgeCheck, text: 'Leave & overtime approvals on the go' },
                { icon: Building2, text: 'Payslips and documents on demand' },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-brand-100">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <Icon className="h-4 w-4 text-brand-200" aria-hidden />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="mx-auto w-full max-w-sm rounded-[2.5rem] border-[10px] border-brand-900 bg-white p-5 text-slate-700 shadow-2xl" aria-hidden>
            <p className="text-xs text-slate-400">Good morning,</p>
            <p className="text-lg font-bold text-slate-900">Jordan Lee</p>
            <div className="mt-4 rounded-2xl bg-brand-600 p-4 text-white">
              <p className="text-xs text-brand-100">Today · Morning shift</p>
              <p className="mt-1 text-2xl font-bold">09:00 – 18:00</p>
              <div className="mt-3 rounded-lg bg-white py-2 text-center text-sm font-semibold text-brand-700">Clock in</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ['Annual leave', '12 days'],
                ['Sick leave', '8 days'],
                ['This month', '21 days present'],
                ['Last payslip', 'September'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] text-slate-400">{label}</p>
                  <p className="text-sm font-semibold text-slate-800">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <Section>
        <SectionHeading
          eyebrow="How it works"
          title="Live in days, not months"
          description="No servers to install and no consultants to hire. Our onboarding team does the heavy lifting."
        />
        <ol className="mt-14 grid gap-8 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="relative rounded-2xl border border-slate-200 bg-white p-7 shadow-card">
              <span className="absolute right-6 top-6 text-5xl font-bold text-slate-100">{i + 1}</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5">
          <p className="text-center text-sm font-medium text-slate-500">Built for teams in</p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {industries.map((industry) => (
              <li key={industry} className="rounded-full bg-white px-4 py-1.5 text-sm text-slate-700 ring-1 ring-slate-200">
                {industry}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section className="bg-slate-50">
        <SectionHeading eyebrow="Customers" title="HR teams that got their week back" />
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-card">
              <Quote className="h-8 w-8 text-brand-200" aria-hidden />
              <blockquote className="mt-4 flex-1 leading-relaxed text-slate-700">“{t.quote}”</blockquote>
              <figcaption className="mt-6 border-t border-slate-100 pt-5">
                <p className="font-semibold text-slate-900">{t.name}</p>
                <p className="text-sm text-slate-500">{t.role}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section id="pricing">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple plans that grow with you"
          description="One price per company — not per user. Pay monthly or save with yearly billing."
        />
        <div className="mt-12">
          <PricingPlans />
        </div>
        <p className="mt-6 text-center text-sm">
          <Link href="/pricing#compare" className="font-semibold text-brand-700 hover:text-brand-800">
            Compare every feature →
          </Link>
        </p>
      </Section>

      <Section className="bg-slate-50">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />
        <div className="mt-12">
          <Faq items={pricingFaq.slice(0, 4)} />
        </div>
      </Section>

      <CtaBanner />
    </>
  );
}
