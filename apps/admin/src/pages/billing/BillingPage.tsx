import { useState } from 'react';
import { ArrowUpCircle, Check, CreditCard, Info, Lock, Users } from 'lucide-react';
import type { PlanUsageMetric, SubscriptionPlanTier, TenantSubscriptionView } from '@hrm/shared-types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusPill } from '@/components/ui/StatusPill';
import { ProgressBar } from '@/components/ui/Progress';
import { OrgErrorBanner } from '@/components/org/OrgScreenParts';
import { PlanLimitPrompt } from '@/components/billing/PlanLimitPrompt';
import { UpgradeRequestModal } from '@/components/billing/UpgradeRequestModal';
import { useSubscription } from '@/hooks/useSubscription';
import { billingCopy as copy, planName } from '@/lib/billing-copy';
import {
  employeeUsage,
  featuresAddedBy,
  lockedFeatures,
  planById,
  planRank,
  usagePercent,
  usageTone,
} from '@/lib/plan-usage';

function seatsLabel(metric: PlanUsageMetric): string {
  if (metric.limit === null) return copy.unlimited;
  if (metric.used > metric.limit) return copy.overBy(metric.used - metric.limit);
  const left = metric.limit - metric.used;
  return left === 0 ? copy.noSeatsLeft : copy.seatsLeft(left);
}

function PlanSummaryCard({ view }: { view: TenantSubscriptionView }) {
  const limit = planById(view, view.planId)?.limits.employees ?? null;
  return (
    <Card className="p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted uppercase tracking-wide">{copy.currentPlan}</span>
        <StatusPill tone={view.status === 'active' ? 'success' : 'warning'}>{copy.status[view.status]}</StatusPill>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 flex items-center justify-center shrink-0">
          <CreditCard className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <div className="text-2xl font-bold text-primary leading-tight">{planName(view.planId)}</div>
          <div className="text-sm text-secondary">{copy.plans[view.planId].tagline}</div>
        </div>
      </div>
      <div className="text-sm text-secondary border-t border-base pt-3">{copy.employeesLimit(limit)}</div>
    </Card>
  );
}

function UsageCard({ metric, approachingRatio }: { metric: PlanUsageMetric; approachingRatio: number }) {
  const tone = usageTone(metric.level);
  return (
    <Card className="p-5 flex flex-col gap-4">
      <span className="text-xs font-semibold text-muted uppercase tracking-wide">{copy.usageTitle}</span>
      <div>
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Users className="h-4 w-4 text-muted" aria-hidden /> {copy.employeesMetric}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary leading-tight">
              {metric.limit === null ? metric.used.toLocaleString() : copy.usageOf(metric.used, metric.limit)}
            </div>
            <div
              className={`text-xs font-medium ${
                tone === 'error' ? 'text-error-600' : tone === 'warning' ? 'text-warning-700 dark:text-warning-300' : 'text-muted'
              }`}
            >
              {seatsLabel(metric)}
            </div>
          </div>
        </div>
        {metric.limit === null ? (
          <p className="text-sm text-secondary mt-2">{copy.usedUnlimited(metric.used)}</p>
        ) : (
          <div
            className="relative mt-3"
            role="meter"
            aria-label={copy.employeesMetric}
            aria-valuemin={0}
            aria-valuemax={metric.limit}
            aria-valuenow={metric.used}
          >
            <ProgressBar value={usagePercent(metric)} tone={tone} />
            <span
              aria-hidden
              className="absolute -top-1 h-3.5 w-px bg-[rgb(var(--border-strong))]"
              style={{ left: `${approachingRatio * 100}%` }}
            />
          </div>
        )}
      </div>
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <Info className="h-3.5 w-3.5 shrink-0 mt-px" aria-hidden /> {copy.employeesHint}
      </p>
    </Card>
  );
}

function FeaturesCard({ view }: { view: TenantSubscriptionView }) {
  const locked = lockedFeatures(view);
  return (
    <Card className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[rgb(var(--border-base))]">
      <div className="p-5">
        <h2 className="text-sm font-semibold text-primary mb-3">{copy.includedTitle}</h2>
        <ul className="space-y-2.5">
          {view.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5">
              <Check className="h-4 w-4 shrink-0 mt-0.5 text-success-600 dark:text-success-400" aria-hidden />
              <div>
                <div className="text-sm font-medium text-primary">{copy.features[feature].label}</div>
                <div className="text-xs text-muted">{copy.features[feature].description}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="p-5">
        <h2 className="text-sm font-semibold text-primary mb-3">{copy.lockedTitle}</h2>
        {locked.length === 0 ? (
          <p className="text-sm text-secondary">{copy.topTier}</p>
        ) : (
          <ul className="space-y-2.5">
            {locked.map(({ feature, planId }) => (
              <li key={feature} className="flex items-start gap-2.5">
                <Lock className="h-4 w-4 shrink-0 mt-0.5 text-muted" aria-hidden />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-secondary">{copy.features[feature].label}</div>
                  <div className="text-xs text-muted">{copy.features[feature].description}</div>
                </div>
                <StatusPill tone="accent">{copy.lockedOn(planName(planId))}</StatusPill>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function PlanComparison({
  view,
  onRequest,
}: {
  view: TenantSubscriptionView;
  onRequest: (planId: SubscriptionPlanTier) => void;
}) {
  const currentRank = planRank(view, view.planId);
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-primary">{copy.compareTitle}</h2>
        <p className="text-sm text-secondary mt-0.5">{copy.compareBody}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {view.plans.map((plan, rank) => {
          const isCurrent = rank === currentRank;
          const below = view.plans[rank - 1];
          return (
            <Card
              key={plan.planId}
              className={`p-5 flex flex-col gap-4 ${isCurrent ? 'border-2 border-accent-500 shadow-md' : ''}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-primary">{planName(plan.planId)}</h3>
                  {isCurrent ? <StatusPill tone="accent">{copy.yourPlan}</StatusPill> : null}
                </div>
                <p className="text-xs text-secondary mt-1">{copy.plans[plan.planId].tagline}</p>
                <p className="text-sm font-medium text-primary mt-3">{copy.employeesLimit(plan.limits.employees)}</p>
              </div>
              <div className="flex-1 border-t border-base pt-3">
                {below ? <p className="text-xs text-muted mb-2">{copy.everythingIn(planName(below.planId))}</p> : null}
                <ul className="space-y-1.5">
                  {featuresAddedBy(view, plan.planId).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-primary">
                      <Check className="h-4 w-4 shrink-0 mt-0.5 text-success-600 dark:text-success-400" aria-hidden />
                      {copy.features[feature].label}
                    </li>
                  ))}
                </ul>
              </div>
              {isCurrent ? (
                <Button variant="secondary" className="w-full" disabled>
                  {copy.yourPlan}
                </Button>
              ) : rank > currentRank ? (
                <Button
                  variant={plan.planId === view.nextPlanId ? 'primary' : 'secondary'}
                  className="w-full"
                  onClick={() => onRequest(plan.planId)}
                >
                  <ArrowUpCircle className="h-4 w-4" aria-hidden /> {copy.requestUpgrade}
                </Button>
              ) : (
                <p className="text-xs text-muted">{copy.downgradeNote}</p>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function BillingSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-40 lg:col-span-2" />
      </div>
      <Skeleton className="h-56" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    </div>
  );
}

export function BillingPage() {
  const { view, loading, error, reload } = useSubscription();
  const [requestPlanId, setRequestPlanId] = useState<SubscriptionPlanTier | null>(null);
  const metric = view ? employeeUsage(view) : null;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        <p className="text-sm text-secondary mt-0.5">{copy.description}</p>
      </div>

      {loading ? (
        <BillingSkeleton />
      ) : error ? (
        <OrgErrorBanner message={error} onRetry={() => void reload()} />
      ) : !view ? (
        <Card className="p-5 text-sm text-secondary">{copy.noTenant}</Card>
      ) : (
        <>
          {view.status !== 'active' ? (
            <div className="flex items-start gap-2 rounded-xl border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-800 dark:border-warning-800 dark:bg-warning-900/20 dark:text-warning-300">
              <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
              {copy.statusNotice[view.status]}
            </div>
          ) : null}

          <PlanLimitPrompt view={view} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <PlanSummaryCard view={view} />
            <div className="lg:col-span-2">
              {metric ? <UsageCard metric={metric} approachingRatio={view.approachingRatio} /> : null}
            </div>
          </div>

          <FeaturesCard view={view} />

          <PlanComparison view={view} onRequest={setRequestPlanId} />

          {requestPlanId ? (
            <UpgradeRequestModal
              open
              onClose={() => setRequestPlanId(null)}
              view={view}
              targetPlanId={requestPlanId}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
