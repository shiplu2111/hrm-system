import { useState } from 'react';
import { AlertTriangle, ArrowUpCircle, X } from 'lucide-react';
import type { TenantSubscriptionView } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { billingCopy as copy, planName } from '@/lib/billing-copy';
import { employeeUsage, isAtLimit, needsUpgradePrompt, planById } from '@/lib/plan-usage';
import { UpgradeRequestModal } from './UpgradeRequestModal';

interface Props {
  view: TenantSubscriptionView;
  /** Shown as a secondary action, e.g. to open the plan page from elsewhere in the app. */
  onViewPlan?: () => void;
}

/** Upgrade prompt for an employee limit that is close or reached (BILLING_SUBSCRIPTION.md §3). */
export function PlanLimitPrompt({ view, onViewPlan }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const metric = employeeUsage(view);

  if (!metric || metric.limit === null || !needsUpgradePrompt(metric.level)) return null;
  const atLimit = isAtLimit(metric.level);
  if (dismissed && !atLimit) return null;

  const plan = planName(view.planId);
  const next = view.nextPlanId ? planById(view, view.nextPlanId) : null;
  const title =
    metric.level === 'approaching'
      ? copy.prompt.approachingTitle
      : metric.level === 'reached'
        ? copy.prompt.reachedTitle
        : copy.prompt.exceededTitle;
  const body =
    metric.level === 'approaching'
      ? copy.prompt.approachingBody(metric.used, metric.limit, plan)
      : metric.level === 'reached'
        ? copy.prompt.reachedBody(metric.limit, plan)
        : copy.prompt.exceededBody(metric.used, metric.limit, plan);

  return (
    <>
      <div
        role={atLimit ? 'alert' : 'status'}
        className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border px-4 py-3 ${
          atLimit
            ? 'border-error-200 bg-error-50 dark:border-error-800 dark:bg-error-950/30'
            : 'border-warning-300 bg-warning-50 dark:border-warning-800 dark:bg-warning-900/20'
        }`}
      >
        <AlertTriangle className={`h-5 w-5 shrink-0 ${atLimit ? 'text-error-600' : 'text-warning-600'}`} aria-hidden />
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold ${
              atLimit ? 'text-error-700 dark:text-error-300' : 'text-warning-800 dark:text-warning-300'
            }`}
          >
            {title}
          </p>
          <p className="text-sm text-secondary mt-0.5">
            {body} {next ? copy.prompt.nextPlan(planName(next.planId), next.limits.employees) : null}
            {atLimit ? ` ${copy.prompt.freeSeat}` : null}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onViewPlan ? (
            <Button variant="secondary" size="sm" onClick={onViewPlan}>
              {copy.prompt.viewPlan}
            </Button>
          ) : null}
          {next ? (
            <Button variant="primary" size="sm" onClick={() => setRequestOpen(true)}>
              <ArrowUpCircle className="h-4 w-4" aria-hidden /> {copy.requestUpgrade}
            </Button>
          ) : null}
          {!atLimit ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDismissed(true)}
              aria-label={copy.prompt.dismiss}
              title={copy.prompt.dismiss}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>
      {next ? (
        <UpgradeRequestModal
          open={requestOpen}
          onClose={() => setRequestOpen(false)}
          view={view}
          targetPlanId={next.planId}
        />
      ) : null}
    </>
  );
}
