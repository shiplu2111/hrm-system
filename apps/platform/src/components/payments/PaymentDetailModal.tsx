import { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  FileText,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import type { PlatformPaymentDetailView } from '@hrm/shared-types';
import { PermissionGate } from '@/components/rbac';
import { usePermission } from '@/hooks/usePermission';
import { getPlatformPayment } from '@/lib/payments-api';
import { RefundPaymentModal, RetryPaymentModal } from './PaymentActionModals';

interface PaymentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentId: string | null;
  onActionSuccess: () => void;
}

export function PaymentDetailModal({
  isOpen,
  onClose,
  paymentId,
  onActionSuccess,
}: PaymentDetailModalProps) {
  const [payment, setPayment] = useState<PlatformPaymentDetailView | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Submodals
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isRetryModalOpen, setIsRetryModalOpen] = useState(false);

  const canEditBilling = usePermission('billing', 'edit');

  const loadDetail = async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getPlatformPayment(id);
      setPayment(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load payment detail.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && paymentId) {
      loadDetail(paymentId);
    } else {
      setPayment(null);
    }
  }, [isOpen, paymentId]);

  if (!isOpen) return null;

  const total = payment ? Number(payment.amount) : 0;
  const refunded = payment ? Number(payment.amountRefunded || 0) : 0;
  const net = Math.max(0, total - refunded);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" /> Succeeded
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800">
            <AlertCircle className="h-3.5 w-3.5" /> Failed
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <Coins className="h-3.5 w-3.5" /> Fully Refunded
          </span>
        );
      case 'partially_refunded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Coins className="h-3.5 w-3.5" /> Partially Refunded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Clock className="h-3.5 w-3.5" /> {status}
          </span>
        );
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    Transaction Record
                  </h3>
                  {payment && getStatusBadge(payment.status)}
                </div>
                <p className="text-xs text-slate-500 font-mono">
                  {payment?.providerPaymentId || payment?.id}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
                <span className="text-xs font-semibold">Loading payment details…</span>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {payment && !isLoading && (
              <>
                {/* Failure Reason Callout from Provider */}
                {payment.status === 'failed' && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-red-800 dark:text-red-300 uppercase tracking-wider">
                      <AlertTriangle className="h-4 w-4" /> Provider Failure Diagnostics
                    </div>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-semibold">Error Code:</span>
                        <span className="font-mono px-2 py-0.5 rounded bg-red-200/60 dark:bg-red-900/50 text-red-900 dark:text-red-200 font-bold">
                          {payment.errorCode || 'unspecified_error'}
                        </span>
                      </div>
                      <div className="text-red-700 dark:text-red-300">
                        <span className="text-slate-500 font-semibold">Message: </span>
                        {payment.errorMessage || 'Transaction was declined by cardholder bank or gateway.'}
                      </div>
                      {payment.retryCount > 0 && (
                        <div className="text-[11px] text-slate-500">
                          Automated Retries Attempted: <span className="font-bold">{payment.retryCount}</span>
                          {payment.lastRetryAt && ` · Last attempted ${new Date(payment.lastRetryAt).toLocaleString()}`}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Financial Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Charged</div>
                    <div className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                      ${total.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-500">{payment.currency}</div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Refunded Volume</div>
                    <div className={`mt-1 text-lg font-extrabold ${refunded > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}>
                      ${refunded.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-500">{payment.currency}</div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net Settled</div>
                    <div className="mt-1 text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                      ${net.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-500">{payment.currency}</div>
                  </div>
                </div>

                {/* Tenant & Invoicing Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-950">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Building2 className="h-4 w-4" />
                      <span>Tenant:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{payment.tenantName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      <CreditCard className="h-4 w-4" />
                      <span>Payment Method:</span>
                      <span className="font-mono text-slate-900 dark:text-white">{payment.paymentMethod || 'card'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      <span>Provider Gateway:</span>
                      <span className="font-semibold uppercase text-slate-900 dark:text-white">{payment.provider}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {payment.invoice ? (
                      <div className="flex items-center gap-2 text-slate-500">
                        <FileText className="h-4 w-4" />
                        <span>Linked Invoice:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {payment.invoice.invoiceNumber}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {payment.invoice.status}
                        </span>
                      </div>
                    ) : (
                      <div className="text-slate-400">No linked invoice attached</div>
                    )}
                    <div className="flex items-center gap-2 text-slate-500">
                      <Calendar className="h-4 w-4" />
                      <span>Processed At:</span>
                      <span className="text-slate-900 dark:text-white">
                        {payment.paidAt ? new Date(payment.paidAt).toLocaleString() : new Date(payment.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Refund Ledger Table */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-rose-500" /> Refund Ledger ({payment.refunds.length})
                  </h4>

                  {payment.refunds.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center text-xs text-slate-400">
                      No refunds have been issued against this payment transaction.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Refund ID</th>
                            <th className="py-2.5 px-3">Reason / Justification</th>
                            <th className="py-2.5 px-3">Refunded By</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {payment.refunds.map((ref) => (
                            <tr key={ref.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                              <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                                {new Date(ref.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">
                                {ref.providerRefundId || ref.id.slice(0, 8)}
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-900 dark:text-white max-w-xs truncate">
                                {ref.reason}
                              </td>
                              <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                                {ref.refundedBy}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                                -${ref.amount.toFixed(2)} {ref.currency}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-950/40">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Close
            </button>

            <div className="flex items-center gap-2">
              {payment?.status === 'failed' && canEditBilling && (
                <button
                  type="button"
                  onClick={() => setIsRetryModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm"
                >
                  <RefreshCw className="h-4 w-4" /> Retry Payment Now
                </button>
              )}

              {(payment?.status === 'succeeded' || payment?.status === 'partially_refunded') && canEditBilling && (
                <button
                  type="button"
                  onClick={() => setIsRefundModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-sm"
                >
                  <Coins className="h-4 w-4" /> Issue Refund
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Submodals */}
      <RefundPaymentModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        payment={payment}
        onSuccess={(updated) => {
          setPayment(updated);
          onActionSuccess();
        }}
      />

      <RetryPaymentModal
        isOpen={isRetryModalOpen}
        onClose={() => setIsRetryModalOpen(false)}
        payment={payment}
        onSuccess={() => {
          if (paymentId) loadDetail(paymentId);
          onActionSuccess();
        }}
      />
    </>
  );
}
