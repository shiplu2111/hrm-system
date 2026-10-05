import type { Metadata } from 'next';
import { CheckCircle2, FileText, Mail, Rocket } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Container } from '@/components/ui/Section';
import { getPlan } from '@/lib/plans';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Order received',
  robots: { index: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const nextSteps = [
  { icon: Mail, title: 'Confirmation email', text: 'A copy of your order is on its way to your inbox.' },
  { icon: FileText, title: 'Invoice within 1 business day', text: 'Our team reviews your order and sends the invoice.' },
  { icon: Rocket, title: 'Workspace setup', text: 'Once paid, we create your workspace and book your onboarding call.' },
];

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const ref = typeof params.ref === 'string' && /^[A-Z]+-\d{8}-[A-Z0-9]{6}$/.test(params.ref) ? params.ref : null;
  const plan = getPlan(typeof params.plan === 'string' ? params.plan : undefined);

  return (
    <div className="bg-slate-50 py-20">
      <Container className="max-w-2xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card sm:p-12">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" aria-hidden />
          <h1 className="mt-5 text-3xl font-bold tracking-tight">Thank you — your order is in</h1>
          <p className="mt-3 text-slate-600">
            {plan ? `We've received your order for ${site.name} ${plan.name}.` : `We've received your order.`} Our team
            will be in touch shortly.
          </p>
          {ref && (
            <p className="mx-auto mt-6 inline-block rounded-lg bg-slate-50 px-4 py-2 font-mono text-sm text-slate-700 ring-1 ring-slate-200">
              Order reference: {ref}
            </p>
          )}

          <ol className="mt-10 space-y-4 text-left">
            {nextSteps.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4 rounded-xl bg-slate-50 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold text-slate-900">{title}</span>
                  <span className="block text-sm text-slate-600">{text}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/">Back to home</ButtonLink>
            <ButtonLink href="/contact?topic=sales" variant="secondary">
              Contact sales
            </ButtonLink>
          </div>
        </div>
      </Container>
    </div>
  );
}
