import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Info,
  Loader2,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type {
  PlanChangePreview,
  PlanChangeResult,
  SubscriptionPlanTier,
  TenantSubscriptionView,
} from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { executePlanChange, previewPlanChange } from '@/lib/billing-api';
import { planName } from '@/lib/billing-copy';
import { featuresAddedBy } from '@/lib/plan-usage';

interface Props {
  open: boolean;
  onClose: () => void;
  view: TenantSubscriptionView;
  targetPlanCode: SubscriptionPlanTier;
  onSuccess?: () => void;
}

export function PlanChangeModal({
  open,
  onClose,
  view,
  targetPlanCode,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [preview, setPreview] = useState<PlanChangePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanChangeResult | null>(null);

  const fromName = planName(view.planId);
  const toName = planName(targetPlanCode);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setResult(null);

    previewPlanChange(targetPlanCode)
      .then((res) => {
        setPreview(res);
      })
      .catch((err) => {
        setError(err.message || 'Failed to preview plan change. Please try again.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, targetPlanCode]);

  const handleConfirm = async () => {
    if (!preview) return;
    setExecuting(true);
    setError(null);

    try {
      const res = await executePlanChange(targetPlanCode);
      setResult(res);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      const msg = err.details && Array.isArray(err.details)
        ? err.details.join(' ')
        : err.message || 'Plan change could not be executed.';
      setError(msg);
    } finally {
      setExecuting(false);
    }
  };

  const newFeatures = featuresAddedBy(view, targetPlanCode);

  const title = result
    ? result.changeType === 'upgrade'
      ? 'Upgrade Successful!'
      : 'Downgrade Scheduled'
    : preview?.isUpgrade
      ? `Upgrade to ${toName}`
      : `Downgrade to ${toName}`;

  const renderFooter = () => {
    if (result) {
      return (
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      );
    }

    if (loading || !preview) {
      return (
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      );
    }

    if (preview.isUpgrade) {
      return (
        <>
          <Button variant="secondary" onClick={onClose} disabled={executing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={executing}
            className="gap-2"
          >
            {executing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing Payment...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Approve & Pay {preview.currency} {preview.proratedAmount.toFixed(2)}
              </>
            )}
          </Button>
        </>
      );
    }

    // Downgrade
    if (!preview.allowed) {
      return (
        <Button variant="secondary" onClick={onClose}>
          Understood, Close
        </Button>
      );
    }

    return (
      <>
        <Button variant="secondary" onClick={onClose} disabled={executing}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          onClick={handleConfirm}
          disabled={executing}
          className="border-warning-400 text-warning-800 dark:text-warning-300 hover:bg-warning-50 dark:hover:bg-warning-950/30 gap-2"
        >
          {executing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Scheduling Downgrade...
            </>
          ) : (
            <>
              <Clock className="h-4 w-4" />
              Schedule Downgrade for Renewal
            </>
          )}
        </Button>
      </>
    );
  };

  return (
    <Modal
      open={open}
      onClose={executing ? () => {} : onClose}
      title={title}
      size="md"
      footer={renderFooter()}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-secondary">
          <Loader2 className="h-8 w-8 animate-spin text-accent-500 mb-3" />
          <p className="text-sm font-medium">Calculating plan comparison and proration...</p>
        </div>
      ) : result ? (
        <div className="py-4 space-y-4 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-success-50 dark:bg-success-950/40 text-success-600 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-primary">{result.message}</h3>
            <p className="text-sm text-secondary mt-1">
              {result.effectiveImmediately
                ? 'Your new entitlements and quotas are active right now.'
                : `Your subscription will transition automatically on ${new Date(result.effectiveDate).toLocaleDateString()}.`}
            </p>
          </div>
          {result.proratedCharged ? (
            <div className="p-3 rounded-lg bg-base text-xs font-mono text-secondary">
              Charged: {result.currency} {result.proratedCharged.toFixed(2)} (Invoice ID: {result.invoiceId ?? 'Settled'})
            </div>
          ) : null}
        </div>
      ) : !preview ? (
        <div className="p-4 text-sm text-error-600">
          {error || 'Unable to load plan change information.'}
        </div>
      ) : preview.isUpgrade ? (
        // =====================================================================
        // UPGRADE VIEW: Prorated Charge Approval
        // =====================================================================
        <div className="space-y-5">
          {error ? (
            <div className="p-3 rounded-lg border border-error-300 bg-error-50 text-error-700 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          ) : null}

          <div className="flex items-center justify-between p-4 rounded-xl border border-base bg-surface">
            <div>
              <div className="text-xs font-semibold text-muted uppercase">Plan Transition</div>
              <div className="text-base font-bold text-primary mt-0.5 flex items-center gap-2">
                <span>{fromName}</span>
                <span className="text-muted">→</span>
                <span className="text-accent-600 dark:text-accent-400">{toName}</span>
              </div>
            </div>
            <StatusPill tone="success">Immediate Upgrade</StatusPill>
          </div>

          {/* Prorated Charge Summary Card */}
          <div className="rounded-xl border border-accent-200 dark:border-accent-900/60 bg-accent-50/50 dark:bg-accent-950/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-accent-900 dark:text-accent-200 uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-accent-600" />
                Prorated Charge for Approval
              </span>
              <span className="text-xs text-secondary font-medium">
                {preview.daysRemaining} days left in cycle
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <div>
                <span className="text-3xl font-extrabold text-primary">
                  {preview.currency} {preview.proratedAmount.toFixed(2)}
                </span>
                <span className="text-xs text-secondary ml-1.5 font-medium">due today</span>
              </div>
              <div className="text-right text-xs text-secondary">
                <div>Cycle total: {preview.totalDaysInPeriod} days</div>
                <div className="font-semibold text-primary">
                  Then {preview.currency} {preview.newRecurringAmount.toFixed(2)} / mo on renewal
                </div>
              </div>
            </div>

            <p className="text-xs text-secondary border-t border-accent-200/60 dark:border-accent-900/40 pt-2 flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 text-accent-600 mt-0.5" />
              You will be charged the difference between your current plan and {toName} prorated strictly for the remaining {preview.daysRemaining} days of your current billing period.
            </p>
          </div>

          {/* New Capabilities Gained */}
          {newFeatures.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-bold text-primary uppercase tracking-wide">
                Features Unlocked Immediately
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-secondary">
                {newFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success-600 shrink-0" />
                    <span className="font-medium text-primary capitalize">{f.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        // =====================================================================
        // DOWNGRADE VIEW: Block Check & Renewal Notice
        // =====================================================================
        <div className="space-y-5">
          {error ? (
            <div className="p-3 rounded-lg border border-error-300 bg-error-50 text-error-700 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          ) : null}

          <div className="flex items-center justify-between p-4 rounded-xl border border-base bg-surface">
            <div>
              <div className="text-xs font-semibold text-muted uppercase">Requested Downgrade</div>
              <div className="text-base font-bold text-primary mt-0.5 flex items-center gap-2">
                <span>{fromName}</span>
                <span className="text-muted">→</span>
                <span className="text-warning-700 dark:text-warning-300">{toName}</span>
              </div>
            </div>
            <StatusPill tone={preview.allowed ? 'warning' : 'error'}>
              {preview.allowed ? 'Takes Effect at Renewal' : 'Blocked by Usage'}
            </StatusPill>
          </div>

          {!preview.allowed ? (
            // =================================================================
            // DOWNGRADE BLOCKED: Exact reasons listed (Section 7)
            // =================================================================
            <div className="rounded-xl border border-error-300 dark:border-error-800 bg-error-50 dark:bg-error-950/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-error-800 dark:text-error-300 font-bold text-sm">
                <ShieldAlert className="h-4 w-4 shrink-0 text-error-600" />
                Downgrade Blocked (BILLING_SUBSCRIPTION.md §7)
              </div>
              <p className="text-xs text-error-700 dark:text-error-400">
                You cannot downgrade to {toName} while your organization is actively using features or exceeding limits not supported by the lower tier. Resolve the following {preview.blockReasons.length} item(s) first:
              </p>
              <ul className="space-y-2 pt-1 border-t border-error-200 dark:border-error-900/60">
                {preview.blockReasons.map((reason, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs font-medium text-error-800 dark:text-error-300"
                  >
                    <XCircle className="h-4 w-4 text-error-600 shrink-0 mt-0.5" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            // =================================================================
            // DOWNGRADE ELIGIBLE: Scheduled for Renewal Notice
            // =================================================================
            <div className="rounded-xl border border-warning-200 dark:border-warning-900 bg-warning-50 dark:bg-warning-950/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-warning-900 dark:text-warning-200 font-bold text-sm">
                <Calendar className="h-4 w-4 shrink-0 text-warning-600" />
                Renewal Effective Date
              </div>
              <p className="text-sm font-semibold text-primary">
                Takes effect on {new Date(preview.effectiveDate).toLocaleDateString()}
              </p>
              <p className="text-xs text-secondary leading-relaxed border-t border-warning-200/60 dark:border-warning-900/40 pt-2">
                Per SaaS billing rules, downgrades take effect at the end of your prepaid billing period. You will continue to have full access to all {fromName} capabilities until {new Date(preview.effectiveDate).toLocaleDateString()}. On that date, your recurring charge will adjust to {preview.currency} {preview.newRecurringAmount.toFixed(2)}/mo.
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
