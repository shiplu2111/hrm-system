import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Coins,
  DollarSign,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import type {
  PlatformPaymentDetailView,
  PlatformPaymentListItem,
} from '@hrm/shared-types';
import {
  refundPlatformPayment,
  retryDunningTenant,
  retryPlatformPayment,
} from '@/lib/payments-api';

interface RefundPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PlatformPaymentListItem | PlatformPaymentDetailView | null;
  onSuccess: (updated: PlatformPaymentDetailView) => void;
}

export function RefundPaymentModal({
  isOpen,
  onClose,
  payment,
  onSuccess,
}: RefundPaymentModalProps) {
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !payment) return null;

  const total = Number(payment.amount);
  const alreadyRefunded = Number(payment.amountRefunded || 0);
  const maxAvailable = Number(Math.max(0, total - alreadyRefunded).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim() || reason.trim().length < 5) {
      setError('A mandatory business justification (at least 5 characters) is required for audit compliance.');
      return;
    }

    let parsedAmount: number | undefined;
    if (refundType === 'partial') {
      parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setError('Please enter a valid partial refund amount greater than 0.');
        return;
      }
      if (parsedAmount > maxAvailable) {
        setError(`Partial refund cannot exceed available balance of $${maxAvailable.toFixed(2)}.`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const updated = await refundPlatformPayment(payment.id, {
        refundType,
        amount: refundType === 'partial' ? parsedAmount : undefined,
        reason: reason.trim(),
      });
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to process refund.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-extrabold text-base">
            <Coins className="h-5 w-5" /> Issue Payment Refund
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Tenant:</span>
              <span className="font-bold text-slate-900 dark:text-white">{payment.tenantName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Transaction ID:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{payment.providerPaymentId || payment.id.slice(0, 13)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Original Total:</span>
              <span className="font-bold text-slate-900 dark:text-white">${total.toFixed(2)} {payment.currency}</span>
            </div>
            {alreadyRefunded > 0 && (
              <div className="flex justify-between text-amber-600 dark:text-amber-400">
                <span>Already Refunded:</span>
                <span className="font-semibold">-${alreadyRefunded.toFixed(2)} {payment.currency}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 font-bold text-slate-900 dark:text-white">
              <span>Max Available to Refund:</span>
              <span className="text-emerald-600 dark:text-emerald-400">${maxAvailable.toFixed(2)} {payment.currency}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Refund Option
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRefundType('full')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition ${
                  refundType === 'full'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>Full Refund</span>
                <span className="text-[11px] font-normal opacity-80 mt-0.5">${maxAvailable.toFixed(2)}</span>
              </button>

              <button
                type="button"
                onClick={() => setRefundType('partial')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition ${
                  refundType === 'partial'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>Partial Refund</span>
                <span className="text-[11px] font-normal opacity-80 mt-0.5">Custom Amount</span>
              </button>
            </div>
          </div>

          {refundType === 'partial' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Partial Refund Amount ({payment.currency}) *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={maxAvailable}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Maximum eligible: ${maxAvailable.toFixed(2)}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Mandatory Reason / Justification *
            </label>
            <textarea
              rows={3}
              placeholder="Provide explicit business justification for issuing this refund..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">This explanation will be logged into the permanent immutable audit ledger.</p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <Coins className="h-4 w-4" /> Confirm & Issue Refund
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface RetryPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment?: PlatformPaymentListItem | PlatformPaymentDetailView | null;
  tenantId?: string;
  tenantName?: string;
  onSuccess: () => void;
}

export function RetryPaymentModal({
  isOpen,
  onClose,
  payment,
  tenantId,
  tenantName,
  onSuccess,
}: RetryPaymentModalProps) {
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [failureReason, setFailureReason] = useState('Card issuer declined transaction (insufficient funds)');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const targetName = tenantName || payment?.tenantName || 'Tenant';
  const targetId = tenantId || payment?.tenantId;

  const handleRetry = async () => {
    setError(null);
    setResultMessage(null);

    try {
      setIsSubmitting(true);
      let res: { success: boolean; message: string };

      if (payment?.id) {
        res = await retryPlatformPayment(payment.id, {
          simulateFailure,
          failureReason: simulateFailure ? failureReason : undefined,
        });
      } else if (targetId) {
        res = await retryDunningTenant(targetId, {
          simulateFailure,
          failureReason: simulateFailure ? failureReason : undefined,
        });
      } else {
        throw new Error('No payment or tenant specified for retry.');
      }

      setResultMessage(res.message);
      onSuccess();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Retry failed to execute.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-extrabold text-base">
            <RefreshCw className="h-5 w-5" /> Retry Payment Recovery
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {resultMessage && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{resultMessage}</span>
            </div>
          )}

          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
            <p>
              Trigger an immediate charge attempt against the payment method on file for{' '}
              <span className="font-bold text-slate-900 dark:text-white">{targetName}</span>.
            </p>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3 text-[11px] space-y-1">
              <div>• If successful: Outstanding invoice marked paid, subscription restored to active, and dunning step reset to 0.</div>
              <div>• If declined: Dunning step advances, failure code recorded, and grace period countdown updates.</div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 select-none">
              <input
                type="checkbox"
                checked={simulateFailure}
                onChange={(e) => setSimulateFailure(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Simulate Provider Failure (Test Dunning Step Progression)</span>
            </label>

            {simulateFailure && (
              <div className="mt-3 space-y-1">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Declined Reason from Provider
                </label>
                <input
                  type="text"
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRetry}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" /> Trigger Retry Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
