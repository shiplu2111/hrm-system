import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Headphones, ShieldCheck, UploadCloud } from 'lucide-react';
import { CheckoutForm } from '@/components/forms/CheckoutForm';
import { Container } from '@/components/ui/Section';
import { getPlan, isBillingCycle, isCurrency } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Order your CMSN-HR plan.',
  robots: { index: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function CheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const plan = getPlan(first(params.plan));
  if (plan && !plan.monthlyPrice) redirect(`/contact?topic=sales&plan=${plan.id}`);

  const cycle = first(params.cycle);
  const currency = first(params.currency);
  const planId = plan?.id === 'starter' ? 'starter' : 'business';

  return (
    <div className="bg-slate-50 pb-20">
      <Container className="pt-10">
        <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to pricing
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Complete your order</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Tell us about your company. We&apos;ll confirm within one business day, send your invoice, and set up your
          workspace as soon as payment is received.
        </p>

        <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-600">
          <li className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden />
            No payment taken today
          </li>
          <li className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-brand-600" aria-hidden />
            Free data migration
          </li>
          <li className="flex items-center gap-2">
            <Headphones className="h-4 w-4 text-brand-600" aria-hidden />
            Guided onboarding call
          </li>
        </ul>

        <div className="mt-10">
          <CheckoutForm
            initialPlan={planId}
            initialCycle={isBillingCycle(cycle) ? cycle : 'yearly'}
            initialCurrency={isCurrency(currency) ? currency : 'BDT'}
          />
        </div>
      </Container>
    </div>
  );
}
