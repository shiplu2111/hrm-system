'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  Check,
  Coins,
  Minus,
} from 'lucide-react';
import type { PublicPlanView } from '../../api/types';
import { formatNumber } from '../../i18n';
import { formatMoney } from '../../i18n/currency';
import { useCurrency } from '../../i18n/currency-client';
import { useWebsiteI18n } from '../../i18n/client';
import { canTrackAnalytics, trackAnalyticsEvent } from '../../lib/analytics';
import { useCookieConsent } from '../legal/CookieConsentProvider';
import {
  calculatePlanEstimate,
  findPublishedPlanPrice,
  getPlanEmployeeCap,
  type BillingCycle,
} from '../../lib/pricing-calculator';
import { ButtonLink, Container, PricingCard, Section, SectionHeader } from '../marketing';

interface PricingInteractiveProps {
  plans: readonly PublicPlanView[];
}

const EMPLOYEE_PRESETS = [10, 25, 50, 100, 250] as const;

export function PricingInteractive({ plans }: PricingInteractiveProps) {
  const { locale, t } = useWebsiteI18n();
  const { currency, currencies, setCurrency } = useCurrency();
  const { consent, hydrated } = useCookieConsent();

  const hasAnnualPrices = useMemo(
    () =>
      plans.some((plan) =>
        plan.prices.some(
          (price) =>
            price.billingCycle === 'annual' &&
            (price.amount > 0 || (price.perSeatAmount ?? 0) > 0),
        ),
      ),
    [plans],
  );

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const activeCycle: BillingCycle = hasAnnualPrices ? billingCycle : 'monthly';

  const defaultSelectedCode =
    plans.find((p) => p.code === 'starter')?.code ??
    plans.find((p) => p.pricingModel !== 'free')?.code ??
    plans[0]?.code ??
    'starter';

  const [selectedPlanCode, setSelectedPlanCode] = useState<string>(defaultSelectedCode);
  const [employeeCount, setEmployeeCount] = useState<number>(25);

  // Hydrate selected plan, billing cycle, and headcount from query params so locale switching preserves selection
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const qPlan = params.get('plan');
      if (qPlan && plans.some((p) => p.code === qPlan)) {
        setSelectedPlanCode(qPlan);
      }
      const qCycle = params.get('cycle');
      if (qCycle === 'annual' || qCycle === 'monthly') {
        setBillingCycle(qCycle);
      }
      const qEmp = Number.parseInt(params.get('employees') || '', 10);
      if (!Number.isNaN(qEmp) && qEmp >= 1 && qEmp <= 5000) {
        setEmployeeCount(qEmp);
      }
    } catch {
      // Ignore query parsing issues
    }
  }, [plans]);

  // Track Funnel Step 2 (pricing_view) once per visit when analytics is allowed
  useEffect(() => {
    if (!hydrated || !canTrackAnalytics(consent)) {
      return;
    }
    trackAnalyticsEvent('pricing_view', {
      locale,
      consent,
      hydrated,
      dedupKey: 'funnel:pricing_view',
      useSessionDedup: true,
      props: {
        planCount: plans.length,
        currency,
      },
    });
  }, [hydrated, consent, locale, plans.length, currency]);

  const syncQueryState = (next: { plan?: string; cycle?: BillingCycle; employees?: number }) => {
    try {
      const url = new URL(window.location.href);
      if (next.plan) url.searchParams.set('plan', next.plan);
      if (next.cycle) url.searchParams.set('cycle', next.cycle);
      if (typeof next.employees === 'number') url.searchParams.set('employees', String(next.employees));
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch {
      // Ignore history errors
    }
  };

  const selectedPlan =
    plans.find((p) => p.code === selectedPlanCode) ?? plans[0] ?? null;

  const estimate = selectedPlan
    ? calculatePlanEstimate(selectedPlan, currency, activeCycle, employeeCount)
    : null;

  // Ordered limit & feature rows across all plans for the Compare Matrix
  const limitRows = useMemo(() => {
    const map = new Map<string, string>();
    for (const plan of plans) {
      for (const limit of plan.limits) {
        if (!map.has(limit.key)) {
          map.set(limit.key, limit.label);
        }
      }
    }
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [plans]);

  const featureRows = useMemo(() => {
    const map = new Map<string, string>();
    for (const plan of plans) {
      for (const feature of plan.features) {
        if (!map.has(feature.key)) {
          map.set(feature.key, feature.label);
        }
      }
    }
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [plans]);

  if (plans.length === 0) {
    return (
      <Section surface="tinted" rhythm="default" bordered>
        <Container>
          <div className="surface rounded-2xl border border-[rgb(var(--border-base))] p-8 sm:p-10 text-center max-w-2xl mx-auto space-y-4">
            <h2 className="text-xl font-bold text-[rgb(var(--text-primary))]">
              {t('pricing.unavailable.title')}
            </h2>
            <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed">
              {t('pricing.unavailable.body')}
            </p>
            <div className="pt-2">
              <ButtonLink href="/contact?topic=sales" variant="primary" size="md">
                {t('pricing.unavailable.retryHint')}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </Section>
    );
  }

  return (
    <>
      {/* 1. Cycle + Currency Controls & Plan Cards Grid */}
      <Section surface="tinted" rhythm="default" bordered id="plans">
        <Container className="space-y-10">
          {/* Controls Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl surface p-4 border border-[rgb(var(--border-base))]">
            {hasAnnualPrices ? (
              <div
                className="inline-flex items-center gap-1 p-1 rounded-lg bg-[rgb(var(--bg-muted))] border border-[rgb(var(--border-base))]"
                role="group"
                aria-label={t('pricing.controls.billingCycleLabel')}
              >
                <button
                  type="button"
                  data-testid="cycle-monthly"
                  aria-pressed={activeCycle === 'monthly'}
                  onClick={() => {
                    setBillingCycle('monthly');
                    syncQueryState({ cycle: 'monthly' });
                  }}
                  className={`px-4 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${activeCycle === 'monthly'
                    ? 'bg-[rgb(var(--bg-surface))] text-primary-700 shadow-xs'
                    : 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
                    }`}
                >
                  {t('pricing.controls.monthlyLabel')}
                </button>
                <button
                  type="button"
                  data-testid="cycle-annual"
                  aria-pressed={activeCycle === 'annual'}
                  onClick={() => {
                    setBillingCycle('annual');
                    syncQueryState({ cycle: 'annual' });
                  }}
                  className={`px-4 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${activeCycle === 'annual'
                    ? 'bg-[rgb(var(--bg-surface))] text-primary-700 shadow-xs'
                    : 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]'
                    }`}
                >
                  {t('pricing.controls.annualLabel')}
                </button>
              </div>
            ) : (
              <span className="text-xs font-medium text-[rgb(var(--text-muted))]">
                {t('pricing.controls.monthlyLabel')}
              </span>
            )}

            <div className="flex items-center gap-2.5">
              <Coins className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
              <label
                htmlFor="pricing-currency-select"
                className="text-xs sm:text-sm font-semibold text-[rgb(var(--text-primary))]"
              >
                {t('pricing.controls.currencyLabel')}:
              </label>
              <select
                id="pricing-currency-select"
                data-testid="pricing-currency-select"
                value={currency}
                onChange={(e) => {
                  const next = e.target.value;
                  setCurrency(next);
                  try {
                    const url = new URL(window.location.href);
                    url.searchParams.set('currency', next);
                    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
                  } catch {
                    // Ignore history errors
                  }
                }}
                className="min-h-[38px] rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-surface))] px-3 py-1.5 text-sm font-medium text-[rgb(var(--text-primary))] shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {currencies.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code} ({item.symbol}) — {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Plan Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
            {plans.map((plan) => {
              const price = findPublishedPlanPrice(plan, currency, activeCycle);
              const empCap = getPlanEmployeeCap(plan);
              const isEnterprise = plan.code === 'enterprise';
              const hasPrice = Boolean(price) && plan.pricingModel !== 'custom';

              let priceDisplay = t('pricing.units.contactUs');
              let priceUnit: string | undefined;
              let limitNote: string | undefined = t('pricing.units.contactUsNote');

              if (hasPrice && price) {
                if (plan.pricingModel === 'free') {
                  priceDisplay = formatMoney(0, currency, locale);
                  priceUnit = t('pricing.units.free', { seats: formatNumber(empCap ?? 10, locale) });
                } else if (plan.pricingModel === 'per_employee') {
                  priceDisplay = formatMoney(price.perSeatAmount ?? price.amount, currency, locale);
                  priceUnit = t(
                    activeCycle === 'annual'
                      ? 'pricing.units.perEmployeeYear'
                      : 'pricing.units.perEmployeeMonth',
                  );
                } else if (plan.pricingModel === 'base_plus_employee') {
                  priceDisplay = formatMoney(price.amount, currency, locale);
                  priceUnit = t(
                    activeCycle === 'annual'
                      ? 'pricing.units.basePlusAnnual'
                      : 'pricing.units.basePlusMonthly',
                    {
                      perSeat: formatMoney(price.perSeatAmount ?? 0, currency, locale),
                      included: formatNumber(plan.includedSeats, locale),
                    },
                  );
                } else {
                  priceDisplay = formatMoney(price.amount, currency, locale);
                  priceUnit = t(
                    activeCycle === 'annual'
                      ? 'pricing.units.flatYear'
                      : 'pricing.units.flatMonth',
                  );
                }

                limitNote =
                  empCap === null
                    ? t('pricing.units.unlimitedSeats')
                    : t('pricing.units.upToSeats', { seats: formatNumber(empCap, locale) });
              }

              const useContactCta = isEnterprise || !hasPrice;

              return (
                <PricingCard
                  key={plan.id}
                  name={plan.name}
                  description={plan.description}
                  priceDisplay={priceDisplay}
                  priceUnit={priceUnit}
                  limitNote={limitNote}
                  badge={plan.isPopular ? t('pricing.controls.popularBadge') : undefined}
                  highlighted={plan.isPopular}
                  ctaLabel={
                    useContactCta
                      ? isEnterprise
                        ? t('pricing.ctas.contactSales')
                        : t('pricing.ctas.contactUs')
                      : t('pricing.ctas.startTrial')
                  }
                  ctaHref={
                    useContactCta
                      ? `/contact?topic=sales&plan=${encodeURIComponent(plan.code)}`
                      : `/signup?plan=${encodeURIComponent(plan.code)}`
                  }
                  features={plan.features.map((f) => ({
                    label: f.label,
                    included: f.included,
                  }))}
                />
              );
            })}
          </div>
        </Container>
      </Section>

      {/* 2. Team Size Estimator Calculator (matches BillingInvoicingService formula) */}
      <Section surface="base" rhythm="default" bordered id="calculator">
        <Container className="space-y-10">
          <SectionHeader
            align="left"
            eyebrow={t('pricing.calculator.eyebrow')}
            title={t('pricing.calculator.title')}
            subtitle={t('pricing.calculator.subtitle')}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Inputs Column */}
            <div className="lg:col-span-7 surface rounded-2xl p-6 sm:p-8 border border-[rgb(var(--border-base))] space-y-6">
              {/* Plan Selector Tabs */}
              <div className="space-y-2.5">
                <span className="block text-sm font-semibold text-[rgb(var(--text-primary))]">
                  {t('pricing.calculator.planSelectLabel')}
                </span>
                <div className="flex flex-wrap gap-2" role="group" aria-label={t('pricing.calculator.planSelectLabel')}>
                  {plans.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      data-testid={`calc-plan-${p.code}`}
                      aria-pressed={selectedPlan?.code === p.code}
                      onClick={() => {
                        setSelectedPlanCode(p.code);
                        syncQueryState({ plan: p.code });
                      }}
                      className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${selectedPlan?.code === p.code
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-secondary))] border-[rgb(var(--border-strong))] hover:border-primary-400'
                        }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Employee Count Input + Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <label
                    htmlFor="pricing-employee-count"
                    className="text-sm font-semibold text-[rgb(var(--text-primary))]"
                  >
                    {t('pricing.calculator.employeeCountLabel')}
                  </label>
                  <input
                    id="pricing-employee-count"
                    data-testid="pricing-employee-count"
                    type="number"
                    min={1}
                    max={5000}
                    value={employeeCount}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      const clamped = Number.isNaN(val) ? 1 : Math.min(5000, Math.max(1, val));
                      setEmployeeCount(clamped);
                      syncQueryState({ employees: clamped });
                    }}
                    className="w-28 rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-surface))] px-3 py-1.5 text-right font-mono text-base font-bold text-[rgb(var(--text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  />
                </div>

                <input
                  aria-label={t('pricing.calculator.employeeCountLabel')}
                  type="range"
                  min={1}
                  max={500}
                  value={Math.min(500, employeeCount)}
                  onChange={(e) => {
                    const nextVal = Number.parseInt(e.target.value, 10) || 1;
                    setEmployeeCount(nextVal);
                    syncQueryState({ employees: nextVal });
                  }}
                  className="w-full accent-primary-600 cursor-pointer"
                />

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-[rgb(var(--text-muted))]">
                    {t('pricing.calculator.presetLabel')}
                  </span>
                  {EMPLOYEE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setEmployeeCount(preset);
                        syncQueryState({ employees: preset });
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${employeeCount === preset
                        ? 'bg-primary-50 border-primary-300 text-primary-700'
                        : 'bg-[rgb(var(--bg-muted))] border-transparent text-[rgb(var(--text-secondary))] hover:border-[rgb(var(--border-strong))]'
                        }`}
                    >
                      {formatNumber(preset, locale)}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-[rgb(var(--text-muted))]">
                  {t('pricing.calculator.employeeCountHelp')}
                </p>
              </div>
            </div>

            {/* Result Output Card */}
            <div className="lg:col-span-5 surface rounded-2xl p-6 sm:p-8 border-2 border-primary-200 space-y-5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary-700">
                  <Calculator className="w-4 h-4" aria-hidden="true" />
                  {selectedPlan?.name}
                </span>
                <span className="px-2.5 py-0.5 rounded-sm text-xs font-mono font-semibold bg-warning-50 text-warning-800 border border-warning-200">
                  {t('pricing.calculator.estimateBadge')}
                </span>
              </div>

              {estimate && estimate.hasPublishedPrice ? (
                <>
                  <div className="pb-4 border-b border-[rgb(var(--border-base))]">
                    <p className="text-xs font-medium text-[rgb(var(--text-muted))]">
                      {t('pricing.calculator.monthlyEquivalentLabel')}
                    </p>
                    <p
                      data-testid="calc-monthly-total"
                      className="mt-1 font-mono text-3xl sm:text-4xl font-bold tracking-tight text-[rgb(var(--text-primary))]"
                    >
                      {formatMoney(estimate.estimatedMonthlyTotal, estimate.currency, locale)}
                      <span className="text-sm font-sans font-normal text-[rgb(var(--text-muted))] ml-1.5">
                        / {locale === 'bn' ? 'মাস' : 'mo'}
                      </span>
                    </p>
                    {activeCycle === 'annual' && (
                      <p
                        data-testid="calc-annual-total"
                        className="mt-1.5 text-xs font-mono font-medium text-primary-700"
                      >
                        {t('pricing.calculator.billedAnnuallyLabel', {
                          cycleTotal: formatMoney(estimate.cycleTotal, estimate.currency, locale),
                        })}
                      </p>
                    )}
                  </div>

                  {/* Line-item breakdown matching BillingInvoicingService */}
                  <dl className="space-y-2.5 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-[rgb(var(--text-secondary))]">
                        {t('pricing.calculator.baseFeeLabel', {
                          included: formatNumber(estimate.includedSeats, locale),
                        })}
                      </dt>
                      <dd className="font-mono font-semibold text-[rgb(var(--text-primary))]">
                        {formatMoney(estimate.baseAmount, estimate.currency, locale)}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-[rgb(var(--text-secondary))]">
                        {estimate.billableExtraSeats > 0 && estimate.perSeatAmount !== null
                          ? t('pricing.calculator.extraSeatsLabel', {
                            extraSeats: formatNumber(estimate.billableExtraSeats, locale),
                            perSeat: formatMoney(estimate.perSeatAmount, estimate.currency, locale),
                          })
                          : t('pricing.calculator.noExtraSeatsLabel', {
                            count: formatNumber(estimate.employeeCount, locale),
                          })}
                      </dt>
                      <dd className="font-mono font-semibold text-[rgb(var(--text-primary))]">
                        {formatMoney(estimate.extraSeatsAmount, estimate.currency, locale)}
                      </dd>
                    </div>
                  </dl>

                  {estimate.exceedsCap && estimate.employeeCap !== null && (
                    <div
                      role="alert"
                      data-testid="calc-cap-warning"
                      className="rounded-lg border border-warning-200 bg-warning-50 p-3 flex items-start gap-2 text-xs font-medium text-warning-800"
                    >
                      <AlertTriangle className="w-4 h-4 text-warning-700 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        {t('pricing.calculator.capExceededNotice', {
                          planName: selectedPlan?.name ?? '',
                          cap: formatNumber(estimate.employeeCap, locale),
                          count: formatNumber(estimate.employeeCount, locale),
                        })}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-4 space-y-3 border-b border-[rgb(var(--border-base))]">
                  <p className="font-mono text-2xl font-bold text-[rgb(var(--text-primary))]">
                    {t('pricing.units.contactUs')}
                  </p>
                  <p className="text-sm text-[rgb(var(--text-secondary))]">
                    {t('pricing.calculator.customPlanNotice')}
                  </p>
                </div>
              )}

              <p className="text-xs text-[rgb(var(--text-muted))] leading-relaxed">
                {t('pricing.calculator.disclaimer')}
              </p>

              <div>
                <ButtonLink
                  href={
                    !estimate?.hasPublishedPrice || selectedPlan?.code === 'enterprise'
                      ? `/contact?topic=sales&plan=${encodeURIComponent(selectedPlan?.code ?? 'enterprise')}&employees=${employeeCount}`
                      : `/signup?plan=${encodeURIComponent(selectedPlan?.code ?? 'starter')}`
                  }
                  variant="primary"
                  size="md"
                  className="w-full"
                >
                  {!estimate?.hasPublishedPrice || selectedPlan?.code === 'enterprise'
                    ? t('pricing.ctas.contactSales')
                    : t('pricing.ctas.startTrial')}
                </ButtonLink>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* 3. Compare Plans Feature & Limits Matrix */}
      <Section surface="tinted" rhythm="default" bordered id="compare">
        <Container className="space-y-10">
          <SectionHeader
            align="left"
            eyebrow={t('pricing.matrix.eyebrow')}
            title={t('pricing.matrix.title')}
            subtitle={t('pricing.matrix.subtitle')}
          />

          {/* Mobile Stacked Comparison Cards (zero horizontal overflow) */}
          <div className="md:hidden space-y-4">
            {plans.map((plan) => (
              <div
                key={`mobile-${plan.id}`}
                className="surface rounded-2xl p-5 border border-[rgb(var(--border-base))] space-y-4"
              >
                <h3 className="text-base font-bold text-[rgb(var(--text-primary))]">{plan.name}</h3>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-700">
                    {t('pricing.matrix.limitsGroupHeading')}
                  </p>
                  <dl className="divide-y divide-[rgb(var(--border-subtle))] text-xs">
                    {limitRows.map((limitRow) => {
                      const entry = plan.limits.find((l) => l.key === limitRow.key);
                      const val = entry?.value;
                      let display: string;
                      if (val === null) display = t('pricing.matrix.unlimitedValue');
                      else if (val === 0) display = t('pricing.matrix.zeroValue');
                      else if (typeof val === 'number') display = formatNumber(val, locale);
                      else display = '—';
                      return (
                        <div key={`m-l-${plan.id}-${limitRow.key}`} className="py-2 flex items-center justify-between gap-2">
                          <dt className="text-[rgb(var(--text-secondary))]">{limitRow.label}</dt>
                          <dd className="font-mono font-semibold text-[rgb(var(--text-primary))]">{display}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>

                <div className="space-y-2 pt-2 border-t border-[rgb(var(--border-subtle))]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-700">
                    {t('pricing.matrix.featuresGroupHeading')}
                  </p>
                  <ul className="space-y-2 text-xs">
                    {featureRows.map((featRow) => {
                      const entry = plan.features.find((f) => f.key === featRow.key);
                      const included = Boolean(entry?.included);
                      return (
                        <li
                          key={`m-f-${plan.id}-${featRow.key}`}
                          className={`flex items-center gap-2 ${included ? 'text-[rgb(var(--text-primary))]' : 'text-[rgb(var(--text-muted))]'
                            }`}
                        >
                          {included ? (
                            <Check className="w-3.5 h-3.5 text-success-600 shrink-0" aria-hidden="true" />
                          ) : (
                            <Minus className="w-3.5 h-3.5 text-secondary-400 shrink-0" aria-hidden="true" />
                          )}
                          <span>{featRow.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop & Tablet Side-by-Side Comparison Matrix */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] shadow-card">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/60">
                  <th scope="col" className="py-4 px-5 font-semibold text-[rgb(var(--text-primary))]">
                    {t('pricing.matrix.featureColumnHeading')}
                  </th>
                  {plans.map((plan) => (
                    <th
                      key={plan.id}
                      scope="col"
                      className="py-4 px-5 font-bold text-center text-[rgb(var(--text-primary))]"
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-subtle))]">
                {/* Workspace Limits Group */}
                <tr className="bg-[rgb(var(--bg-muted))]/30">
                  <th
                    colSpan={plans.length + 1}
                    scope="colgroup"
                    className="py-2.5 px-5 text-xs font-semibold uppercase tracking-wider text-primary-700"
                  >
                    {t('pricing.matrix.limitsGroupHeading')}
                  </th>
                </tr>
                {limitRows.map((limitRow) => (
                  <tr key={limitRow.key}>
                    <th scope="row" className="py-3.5 px-5 font-medium text-[rgb(var(--text-primary))]">
                      {limitRow.label}
                    </th>
                    {plans.map((plan) => {
                      const entry = plan.limits.find((l) => l.key === limitRow.key);
                      const val = entry?.value;
                      let display: string;
                      if (val === null) {
                        display = t('pricing.matrix.unlimitedValue');
                      } else if (val === 0) {
                        display = t('pricing.matrix.zeroValue');
                      } else if (typeof val === 'number') {
                        display = formatNumber(val, locale);
                      } else {
                        display = '—';
                      }
                      return (
                        <td
                          key={`${plan.id}-${limitRow.key}`}
                          className="py-3.5 px-5 text-center font-mono text-xs sm:text-sm text-[rgb(var(--text-secondary))]"
                        >
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Feature Flags Group */}
                <tr className="bg-[rgb(var(--bg-muted))]/30">
                  <th
                    colSpan={plans.length + 1}
                    scope="colgroup"
                    className="py-2.5 px-5 text-xs font-semibold uppercase tracking-wider text-primary-700"
                  >
                    {t('pricing.matrix.featuresGroupHeading')}
                  </th>
                </tr>
                {featureRows.map((featRow) => (
                  <tr key={featRow.key}>
                    <th scope="row" className="py-3.5 px-5 font-medium text-[rgb(var(--text-primary))]">
                      {featRow.label}
                    </th>
                    {plans.map((plan) => {
                      const entry = plan.features.find((f) => f.key === featRow.key);
                      const included = Boolean(entry?.included);
                      return (
                        <td
                          key={`${plan.id}-${featRow.key}`}
                          className="py-3.5 px-5 text-center"
                        >
                          {included ? (
                            <span className="inline-flex items-center justify-center">
                              <Check className="w-4 h-4 text-success-600" aria-hidden="true" />
                              <span className="sr-only">{t('pricing.matrix.includedAria')}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center">
                              <Minus className="w-4 h-4 text-secondary-400" aria-hidden="true" />
                              <span className="sr-only">{t('pricing.matrix.notIncludedAria')}</span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </Section>
    </>
  );
}
