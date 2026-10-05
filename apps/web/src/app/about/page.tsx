import type { Metadata } from 'next';
import { Eye, HeartHandshake, Lock, Sparkles } from 'lucide-react';
import { CtaBanner } from '@/components/CtaBanner';
import { PageHero, Section, SectionHeading } from '@/components/ui/Section';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About us',
  description: `Why we built ${site.name} and what we believe about HR software.`,
};

const values = [
  {
    icon: HeartHandshake,
    title: 'Built with HR teams',
    text: 'Every workflow started as a conversation with an HR or payroll team who was tired of spreadsheets.',
  },
  {
    icon: Eye,
    title: 'Transparent by default',
    text: 'Clear pricing, calculations you can trace back to the rule, and an audit trail for every change.',
  },
  {
    icon: Lock,
    title: 'Secure from day one',
    text: 'Isolated workspaces, encrypted sensitive data and role-based access are standard on every plan.',
  },
  {
    icon: Sparkles,
    title: 'Simple for everyone',
    text: 'If a factory worker can check their payslip in Bangla on a basic phone, we have done our job.',
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About us"
        title="We make people operations effortless"
        description={`${site.name} started with a simple idea: the system that pays people should also be the one that knows them, schedules them and helps them grow.`}
      />

      <Section>
        <div className="mx-auto max-w-3xl space-y-5 text-lg leading-relaxed text-slate-600">
          <p>
            Most growing companies run HR on a patchwork of spreadsheets, attendance machines that don&apos;t talk to
            payroll, and email threads for every leave request. HR teams spend their month reconciling instead of
            supporting people.
          </p>
          <p>
            We built {site.name} as one platform for the whole employee lifecycle — records, time, leave, rosters,
            payroll, hiring and performance — with local compliance built in and a self-service portal that employees
            and managers actually use.
          </p>
          <p>
            Today, HR teams, managers and employees all sign in to the same portal and see exactly what their role
            allows. That single source of truth is what lets payroll close in hours instead of days.
          </p>
        </div>
      </Section>

      <Section className="bg-slate-50">
        <SectionHeading eyebrow="Our values" title="What we stand for" />
        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {values.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 leading-relaxed text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </Section>

      <CtaBanner title="Come build better HR with us" />
    </>
  );
}
