import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { LockedPayrollPeriodSummary, PayrollSimulationResult } from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApiError } from '@/lib/tenant-api-client';
import { formatDate, formatMoney, formatSignedMoney, payrollCopy } from '@/lib/payroll-copy';

export type PayrollImpactState =
  | { status: 'loading'; asOf: string }
  | { status: 'ready'; asOf: string; result: PayrollSimulationResult }
  | { status: 'error'; asOf: string; message: string };

const CONFIRM_ARM_DELAY_MS = 600;

interface PayrollReviewDialogProps {
  open: boolean;
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
  impact?: PayrollImpactState | null;
  retroPeriods?: LockedPayrollPeriodSummary[];
  confirmLabel: string;
  confirmDisabled?: boolean;
  tone?: 'primary' | 'danger';
  /** Throwing keeps the dialog open and shows the error. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
  onBack?: () => void;
}

/**
 * Mandatory confirmation step for payroll-affecting writes (UI_GUIDELINES.md §5):
 * summarises the change and its pay impact before anything is committed.
 */
export function PayrollReviewDialog({
  open,
  title,
  intro,
  children,
  impact,
  retroPeriods = [],
  confirmLabel,
  confirmDisabled = false,
  tone = 'primary',
  onConfirm,
  onClose,
  onBack,
}: PayrollReviewDialogProps) {
  const copy = payrollCopy.structureReview;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [armed, setArmed] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setBusy(false);
      setError(null);
      setAcknowledged(false);
      setArmed(false);
    }
  }

  // The confirm button sits where the opener's button was, so a double-click must not commit.
  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => setArmed(true), CONFIRM_ARM_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  const retro = retroPeriods.length > 0;
  const impactFailed = impact?.status === 'error';
  const needsAcknowledgement = retro || impactFailed;
  const impactLoading = impact?.status === 'loading';
  const canConfirm =
    armed && !busy && !confirmDisabled && !impactLoading && (!needsAcknowledgement || acknowledged);

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const guardedClose = busy ? () => undefined : onClose;

  return (
    <Modal
      open={open}
      onClose={guardedClose}
      title={title}
      size="lg"
      footer={
        <>
          {onBack ? (
            <Button variant="ghost" onClick={onBack} disabled={busy} className="mr-auto">
              {payrollCopy.common.back}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {payrollCopy.common.cancel}
          </Button>
          <Button variant={tone} onClick={() => void handleConfirm()} disabled={!canConfirm}>
            {busy ? payrollCopy.common.saving : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {intro ? <p className="text-sm text-secondary">{intro}</p> : null}
        {children}

        {impact ? <ImpactTable impact={impact} /> : null}

        {retro ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-900/20 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-warning-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-warning-800 dark:text-warning-200">{copy.retroTitle}</p>
              <p className="text-warning-800/90 dark:text-warning-200/90 mt-0.5">
                {copy.retroBody(
                  retroPeriods
                    .map((p) => `${formatDate(p.startDate)} – ${formatDate(p.endDate)}`)
                    .join(', '),
                )}
              </p>
            </div>
          </div>
        ) : null}

        {needsAcknowledgement ? (
          <label className="flex items-start gap-2.5 text-sm text-primary cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-base accent-accent-600"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              disabled={busy}
            />
            <span>{retro ? copy.acknowledgeRetro : copy.acknowledgeUnavailable}</span>
          </label>
        ) : null}

        <p className="flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5" />
          {payrollCopy.common.auditNote}
        </p>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function ImpactTable({ impact }: { impact: PayrollImpactState }) {
  const copy = payrollCopy.structureReview;

  if (impact.status === 'error') {
    return (
      <div className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>{copy.impactUnavailable(impact.message)}</span>
      </div>
    );
  }

  const rows: Array<{ label: string; key: 'grossPay' | 'totalDeductions' | 'netPay'; strong?: boolean }> = [
    { label: payrollCopy.structures.gross, key: 'grossPay' },
    { label: payrollCopy.structures.totalDeductions, key: 'totalDeductions' },
    { label: payrollCopy.structures.net, key: 'netPay', strong: true },
  ];

  return (
    <div className="rounded-lg border border-base overflow-hidden">
      <div className="px-4 py-2.5 bg-[rgb(var(--bg-muted))] text-xs font-semibold text-secondary uppercase tracking-wide">
        {copy.impactTitle(formatDate(impact.asOf))}
      </div>
      <table className="w-full text-sm" aria-busy={impact.status === 'loading'}>
        <thead>
          <tr className="border-b border-base text-xs text-secondary">
            <th className="text-left font-medium px-4 py-2" />
            <th className="text-right font-medium px-4 py-2">{copy.impactCurrent}</th>
            <th className="text-right font-medium px-4 py-2">{copy.impactAfter}</th>
            <th className="text-right font-medium px-4 py-2">{copy.impactDiff}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgb(var(--border-base))]">
          {rows.map((row) => {
            if (impact.status === 'loading') {
              return (
                <tr key={row.key}>
                  <td className="px-4 py-2.5 text-secondary">{row.label}</td>
                  {[0, 1, 2].map((i) => (
                    <td key={i} className="px-4 py-2.5">
                      <Skeleton className="h-4 w-20 ml-auto" />
                    </td>
                  ))}
                </tr>
              );
            }
            const { baseline, simulated, delta } = impact.result;
            const diff = Number(delta[row.key]);
            const favourable = row.key === 'totalDeductions' ? diff < 0 : diff > 0;
            return (
              <tr key={row.key} className={row.strong ? 'font-semibold' : ''}>
                <td className={`px-4 py-2.5 ${row.strong ? 'text-primary' : 'text-secondary'}`}>{row.label}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-secondary">
                  {formatMoney(baseline[row.key])}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-primary">
                  {formatMoney(simulated[row.key])}
                </td>
                <td
                  className={`px-4 py-2.5 text-right tabular-nums ${
                    diff === 0
                      ? 'text-muted'
                      : favourable
                        ? 'text-success-700 dark:text-success-400'
                        : 'text-error-700 dark:text-error-400'
                  }`}
                >
                  {formatSignedMoney(delta[row.key])}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
