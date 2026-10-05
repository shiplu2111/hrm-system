'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import {
  CURRENCIES,
  YEARLY_MONTHS_CHARGED,
  effectiveMonthlyPrice,
  formatMoney,
  isCurrency,
  periodPrice,
  plans,
  yearlySaving,
  type BillingCycle,
  type Currency,
  type Plan,
} from '@/lib/plans';

const CURRENCY_STORAGE_KEY = 'cmsn_pricing_currency';

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; badge?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              active ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {option.label}
            {option.badge && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  active ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function checkoutHref(plan: Plan, cycle: BillingCycle, currency: Currency) {
  if (!plan.monthlyPrice) return `/contact?topic=sales&plan=${plan.id}`;
  return `/checkout?plan=${plan.id}&cycle=${cycle}&currency=${currency}`;
}

function PlanCard({ plan, cycle, currency }: { plan: Plan; cycle: BillingCycle; currency: Currency }) {
  const monthly = effectiveMonthlyPrice(plan, currency, cycle);
  const total = periodPrice(plan, currency, cycle);
  const saving = yearlySaving(plan, currency);

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-white p-7 ${
        plan.featured ? 'border-brand-600 shadow-elevated ring-1 ring-brand-600' : 'border-slate-200 shadow-card'
      }`}
    >
      {plan.featured && (
        <span className="absolute -top-3 left-7 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
          Most popular
        </span>
      )}
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      <p className="mt-1.5 min-h-[2.75rem] text-sm text-slate-600">{plan.tagline}</p>

      <div className="mt-6 min-h-[5.5rem]">
        {monthly === null ? (
          <>
            <p className="text-4xl font-bold tracking-tight text-slate-900">Custom</p>
            <p className="mt-2 text-sm text-slate-500">Tailored to your headcount and modules</p>
          </>
        ) : (
          <>
            <p className="flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tracking-tight text-slate-900">{formatMoney(monthly, currency)}</span>
              <span className="text-sm text-slate-500">/ month</span>
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {cycle === 'yearly' && total !== null && saving !== null
                ? `${formatMoney(total, currency)} billed yearly · save ${formatMoney(saving, currency)}`
                : 'Billed monthly · cancel anytime'}
            </p>
          </>
        )}
      </div>

      <ButtonLink
        href={checkoutHref(plan, cycle, currency)}
        variant={plan.featured ? 'primary' : 'secondary'}
        className="mt-6 w-full"
      >
        {plan.monthlyPrice ? `Choose ${plan.name}` : 'Talk to sales'}
      </ButtonLink>

      <ul className="mt-7 space-y-3 border-t border-slate-100 pt-6 text-sm">
        {plan.highlights.map((item) => (
          <li key={item} className="flex gap-3">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PricingPlans({ defaultCycle = 'yearly' }: { defaultCycle?: BillingCycle }) {
  const [cycle, setCycle] = useState<BillingCycle>(defaultCycle);
  const [currency, setCurrency] = useState<Currency>('BDT');

  useEffect(() => {
    const saved = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (isCurrency(saved)) setCurrency(saved);
  }, []);

  const changeCurrency = (next: Currency) => {
    setCurrency(next);
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, next);
  };

  return (
    <div>
      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
        <Segmented
          label="Billing cycle"
          value={cycle}
          onChange={setCycle}
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly', badge: `${12 - YEARLY_MONTHS_CHARGED} months free` },
          ]}
        />
        <Segmented
          label="Currency"
          value={currency}
          onChange={changeCurrency}
          options={CURRENCIES.map((c) => ({ value: c, label: c === 'BDT' ? '৳ BDT' : '$ USD' }))}
        />
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3 lg:gap-8">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} cycle={cycle} currency={currency} />
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        Prices are per company and exclude VAT. Need more employees than your plan allows? We&apos;ll quote an add-on.
      </p>
    </div>
  );
}
