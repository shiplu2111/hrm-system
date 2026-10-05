'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { Check, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, FormAlert, Honeypot } from '@/components/forms/Field';
import { PAYMENT_METHODS, flattenErrors, orderSchema, type FieldErrors, type OrderInput } from '@/lib/forms';
import {
  CURRENCIES,
  YEARLY_MONTHS_CHARGED,
  employeeLimitLabel,
  formatMoney,
  getPlan,
  periodPrice,
  plans,
  yearlySaving,
  type BillingCycle,
  type Currency,
} from '@/lib/plans';
import { postForm } from '@/lib/submit';

type PurchasablePlan = 'starter' | 'business';

interface Props {
  initialPlan: PurchasablePlan;
  initialCycle: BillingCycle;
  initialCurrency: Currency;
}

type FormState = Omit<OrderInput, 'plan' | 'cycle' | 'currency' | 'employees' | 'acceptTerms'> & {
  employees: string;
  acceptTerms: boolean;
};

const purchasable = plans.filter((p): p is (typeof plans)[number] & { id: PurchasablePlan } => p.monthlyPrice !== null);

function OptionCard({
  checked,
  onSelect,
  name,
  title,
  subtitle,
}: {
  checked: boolean;
  onSelect: () => void;
  name: string;
  title: string;
  subtitle: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
        checked ? 'border-brand-600 bg-brand-50/60 ring-1 ring-brand-600' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="mt-1 accent-brand-600" />
      <span>
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{subtitle}</span>
      </span>
    </label>
  );
}

export function CheckoutForm({ initialPlan, initialCycle, initialCurrency }: Props) {
  const router = useRouter();
  const [planId, setPlanId] = useState<PurchasablePlan>(initialPlan);
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [form, setForm] = useState<FormState>({
    employees: '',
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    country: initialCurrency === 'BDT' ? 'Bangladesh' : '',
    address: '',
    paymentMethod: initialCurrency === 'BDT' ? 'bank_transfer' : 'card',
    notes: '',
    acceptTerms: false,
    website: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const plan = getPlan(planId)!;
  const total = periodPrice(plan, currency, cycle)!;
  const saving = yearlySaving(plan, currency)!;
  const upgradeHint = useMemo(() => {
    const count = Number(form.employees);
    return plan.employeeLimit !== null && count > plan.employeeLimit;
  }, [form.employees, plan.employeeLimit]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key as string]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const inputProps = (key: keyof FormState) => ({
    id: key,
    name: key,
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${key}-error` : undefined,
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const payload = { ...form, plan: planId, cycle, currency };
    const parsed = orderSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors = flattenErrors(parsed.error);
      setErrors(fieldErrors);
      const first = Object.keys(fieldErrors)[0];
      if (first) document.getElementById(first)?.focus();
      return;
    }
    setSubmitting(true);
    const result = await postForm('/api/orders', payload);
    if (result.ok) {
      router.push(`/checkout/success?ref=${encodeURIComponent(result.reference)}&plan=${planId}`);
      return;
    }
    setSubmitting(false);
    setFormError(result.error);
    if (result.fieldErrors) setErrors(result.fieldErrors);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="space-y-8">
        <fieldset className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
          <legend className="sr-only">Plan</legend>
          <h2 className="text-lg font-semibold">1. Your plan</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {purchasable.map((p) => (
              <OptionCard
                key={p.id}
                name="plan"
                checked={planId === p.id}
                onSelect={() => setPlanId(p.id)}
                title={p.name}
                subtitle={`${employeeLimitLabel(p)} · ${formatMoney(p.monthlyPrice![currency], currency)}/mo`}
              />
            ))}
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="field-label">Billing cycle</p>
              <div className="grid gap-3">
                <OptionCard
                  name="cycle"
                  checked={cycle === 'monthly'}
                  onSelect={() => setCycle('monthly')}
                  title="Monthly"
                  subtitle="Pay month to month"
                />
                <OptionCard
                  name="cycle"
                  checked={cycle === 'yearly'}
                  onSelect={() => setCycle('yearly')}
                  title={`Yearly · ${12 - YEARLY_MONTHS_CHARGED} months free`}
                  subtitle={`Save ${formatMoney(saving, currency)} per year`}
                />
              </div>
            </div>
            <div>
              <p className="field-label">Currency</p>
              <div className="grid gap-3">
                {CURRENCIES.map((c) => (
                  <OptionCard
                    key={c}
                    name="currency"
                    checked={currency === c}
                    onSelect={() => setCurrency(c)}
                    title={c === 'BDT' ? 'Bangladeshi Taka (৳)' : 'US Dollar ($)'}
                    subtitle={c === 'BDT' ? 'For companies billed in Bangladesh' : 'For international billing'}
                  />
                ))}
              </div>
            </div>
          </div>
          <Field
            id="employees"
            label="Number of employees"
            error={errors.employees}
            hint={`${plan.name} covers ${employeeLimitLabel(plan).toLowerCase()}.`}
            className="mt-5 sm:max-w-xs"
          >
            <input
              {...inputProps('employees')}
              type="number"
              inputMode="numeric"
              min={1}
              className="field-input"
              value={form.employees}
              onChange={(e) => set('employees', e.target.value)}
            />
          </Field>
          {upgradeHint && planId === 'starter' && !errors.employees && (
            <p className="mt-2 text-sm text-amber-700">
              That&apos;s more than Starter covers.{' '}
              <button type="button" className="font-semibold underline" onClick={() => setPlanId('business')}>
                Switch to Business
              </button>
            </p>
          )}
        </fieldset>

        <fieldset className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
          <legend className="sr-only">Company details</legend>
          <h2 className="text-lg font-semibold">2. Company & contact</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field id="companyName" label="Company name" error={errors.companyName} className="sm:col-span-2">
              <input
                {...inputProps('companyName')}
                className="field-input"
                autoComplete="organization"
                value={form.companyName}
                onChange={(e) => set('companyName', e.target.value)}
              />
            </Field>
            <Field id="contactName" label="Your full name" error={errors.contactName}>
              <input
                {...inputProps('contactName')}
                className="field-input"
                autoComplete="name"
                value={form.contactName}
                onChange={(e) => set('contactName', e.target.value)}
              />
            </Field>
            <Field id="email" label="Work email" error={errors.email}>
              <input
                {...inputProps('email')}
                type="email"
                className="field-input"
                autoComplete="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field id="phone" label="Phone" error={errors.phone}>
              <input
                {...inputProps('phone')}
                type="tel"
                className="field-input"
                autoComplete="tel"
                placeholder="+880 1XXX-XXXXXX"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </Field>
            <Field id="country" label="Country" error={errors.country}>
              <input
                {...inputProps('country')}
                className="field-input"
                autoComplete="country-name"
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
              />
            </Field>
            <Field id="address" label="Billing address" optional error={errors.address} className="sm:col-span-2">
              <input
                {...inputProps('address')}
                className="field-input"
                autoComplete="street-address"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
          <legend className="sr-only">Payment</legend>
          <h2 className="text-lg font-semibold">3. Payment preference</h2>
          <p className="mt-1 text-sm text-slate-500">
            You won&apos;t be charged now. We&apos;ll confirm your order and send an invoice for the method you choose.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
            {PAYMENT_METHODS.map((method) => (
              <OptionCard
                key={method.value}
                name="paymentMethod"
                checked={form.paymentMethod === method.value}
                onSelect={() => set('paymentMethod', method.value)}
                title={method.label}
                subtitle={
                  method.value === 'purchase_order'
                    ? 'For procurement-led purchases'
                    : method.value === 'card'
                      ? 'Visa, Mastercard, Amex'
                      : method.value === 'mobile_banking'
                        ? 'Merchant payment in Bangladesh'
                        : 'Local or international wire'
                }
              />
            ))}
          </div>
          {errors.paymentMethod && <p className="field-error">{errors.paymentMethod}</p>}
          <Field id="notes" label="Anything we should know?" optional error={errors.notes} className="mt-5">
            <textarea
              {...inputProps('notes')}
              rows={4}
              className="field-input"
              placeholder="Number of branches, payroll go-live date, current HR software…"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </Field>
        </fieldset>
        <Honeypot value={form.website ?? ''} onChange={(v) => set('website', v)} />
      </div>

      <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card lg:sticky lg:top-24">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Plan</dt>
            <dd className="font-medium text-slate-900">{plan.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Billing</dt>
            <dd className="font-medium capitalize text-slate-900">{cycle}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Coverage</dt>
            <dd className="font-medium text-slate-900">{employeeLimitLabel(plan)}</dd>
          </div>
          {cycle === 'yearly' && (
            <div className="flex justify-between text-emerald-700">
              <dt>Yearly saving</dt>
              <dd className="font-medium">−{formatMoney(saving, currency)}</dd>
            </div>
          )}
        </dl>
        <div className="mt-5 flex items-baseline justify-between border-t border-slate-100 pt-5">
          <span className="text-sm text-slate-500">Total {cycle === 'yearly' ? 'per year' : 'per month'}</span>
          <span className="text-2xl font-bold text-slate-900">{formatMoney(total, currency)}</span>
        </div>
        <p className="mt-1 text-right text-xs text-slate-400">Excludes VAT</p>

        <ul className="mt-5 space-y-2 text-sm text-slate-600">
          {plan.highlights.slice(1, 5).map((item) => (
            <li key={item} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
              {item}
            </li>
          ))}
        </ul>

        <label className="mt-6 flex gap-3 text-sm text-slate-600">
          <input
            id="acceptTerms"
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
            checked={form.acceptTerms}
            onChange={(e) => set('acceptTerms', e.target.checked)}
            aria-invalid={errors.acceptTerms ? true : undefined}
          />
          <span>
            I agree to the{' '}
            <Link href="/terms" className="font-medium text-brand-700 underline" target="_blank">
              terms of service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="font-medium text-brand-700 underline" target="_blank">
              privacy policy
            </Link>
            .
          </span>
        </label>
        {errors.acceptTerms && <p className="field-error">{errors.acceptTerms}</p>}

        {formError && (
          <div className="mt-5">
            <FormAlert>{formError}</FormAlert>
          </div>
        )}

        <Button type="submit" size="lg" className="mt-6 w-full" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
          {submitting ? 'Placing order…' : 'Place order'}
        </Button>
        <p className="mt-3 text-center text-xs text-slate-500">No payment is taken on this page.</p>
      </aside>
    </form>
  );
}
