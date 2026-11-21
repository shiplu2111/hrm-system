import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Eye,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import type {
  PaymentStatus,
  PlatformPaymentDetailView,
  PlatformPaymentListItem,
} from '@hrm/shared-types';
import { PermissionGate } from '@/components/rbac';
import { usePermission } from '@/hooks/usePermission';
import { listPlatformPayments } from '@/lib/payments-api';
import { DunningTenantsView } from './DunningTenantsView';
import { RefundPaymentModal, RetryPaymentModal } from './PaymentActionModals';
import { PaymentDetailModal } from './PaymentDetailModal';

type FilterStatus = 'ALL' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

interface PaymentsListProps {
  selectedTenantId?: string;
}

export function PaymentsList({ selectedTenantId }: PaymentsListProps) {
  const [subview, setSubview] = useState<'ledger' | 'dunning'>('ledger');
  const [payments, setPayments] = useState<PlatformPaymentListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Modals state
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [refundTargetPayment, setRefundTargetPayment] = useState<PlatformPaymentListItem | null>(null);
  const [retryTargetPayment, setRetryTargetPayment] = useState<PlatformPaymentListItem | null>(null);

  const canEditBilling = usePermission('billing', 'edit');

  const loadPayments = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const statusMap: Record<FilterStatus, PaymentStatus | undefined> = {
        ALL: undefined,
        SUCCEEDED: 'succeeded',
        FAILED: 'failed',
        REFUNDED: 'refunded',
        PARTIALLY_REFUNDED: 'partially_refunded',
      };

      const data = await listPlatformPayments({
        tenantId: selectedTenantId,
        status: statusMap[statusFilter],
        search: searchTerm.trim() || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });

      setPayments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load payments.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [selectedTenantId, statusFilter, fromDate, toDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPayments();
  };

  // Metrics
  const metrics = useMemo(() => {
    let collected = 0;
    let failed = 0;
    let refunded = 0;

    payments.forEach((p) => {
      const amt = Number(p.amount);
      const refAmt = Number(p.amountRefunded || 0);

      if (p.status === 'succeeded' || p.status === 'partially_refunded') {
        collected += amt;
      }
      if (p.status === 'failed') {
        failed += amt;
      }
      refunded += refAmt;
    });

    return {
      collected,
      failed,
      refunded,
      net: Math.max(0, collected - refunded),
    };
  }, [payments]);

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'succeeded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-3 w-3" /> Succeeded
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800">
            <AlertCircle className="h-3 w-3" /> Failed
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <Coins className="h-3 w-3" /> Refunded
          </span>
        );
      case 'partially_refunded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Coins className="h-3 w-3" /> Partial Refund
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Clock className="h-3 w-3" /> {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Subview Switcher */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubview('ledger')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              subview === 'ledger'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CreditCard className="h-4 w-4" /> Payments Ledger
          </button>
          <button
            type="button"
            onClick={() => setSubview('dunning')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              subview === 'dunning'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldAlert className="h-4 w-4" /> Tenants in Dunning & Recovery
          </button>
        </div>

        <button
          type="button"
          onClick={loadPayments}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Subview 2: Dunning View */}
      {subview === 'dunning' && <DunningTenantsView />}

      {/* Subview 1: Payments Ledger */}
      {subview === 'ledger' && (
        <div className="space-y-6">
          {/* Financial KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Charged</div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
                ${metrics.collected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Gross billing charges settled</div>
            </div>

            <div className="p-4 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Failed Payments Volume</div>
              <div className="mt-2 text-2xl font-extrabold text-red-700 dark:text-red-300">
                ${metrics.failed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="mt-1 text-[11px] text-red-600/80 dark:text-red-400/80">Pending retry or dunning recovery</div>
            </div>

            <div className="p-4 rounded-2xl border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Total Refunded</div>
              <div className="mt-2 text-2xl font-extrabold text-purple-700 dark:text-purple-300">
                ${metrics.refunded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="mt-1 text-[11px] text-purple-600/80 dark:text-purple-400/80">Returned to customer cards</div>
            </div>

            <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Net Settled Revenue</div>
              <div className="mt-2 text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
                ${metrics.net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="mt-1 text-[11px] text-emerald-600/80 dark:text-emerald-400/80">Net after refund deductions</div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            {/* Status Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  ['ALL', 'All Transactions'],
                  ['SUCCEEDED', 'Succeeded'],
                  ['FAILED', 'Failed'],
                  ['REFUNDED', 'Refunded'],
                  ['PARTIALLY_REFUNDED', 'Partially Refunded'],
                ] as const
              ).map(([st, label]) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    statusFilter === st
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Inputs: Search & Date Range */}
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by tenant name, invoice number, or provider transaction ID…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2">
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-white transition"
                >
                  Apply
                </button>
              </div>
            </form>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
              <span className="text-xs font-semibold">Loading payment transactions…</span>
            </div>
          ) : error ? (
            <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : payments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
              <CreditCard className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">No Payments Found</h3>
              <p className="text-xs text-slate-500 mt-0.5">Try adjusting your filters or date range.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Tenant</th>
                    <th className="py-3 px-4">Amount & Status</th>
                    <th className="py-3 px-4">Provider Failure Reason</th>
                    <th className="py-3 px-4">Transaction / Rail</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Tenant & Invoice */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {p.tenantName}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <span>{p.tenantSubdomain}.cmsnbd.com</span>
                          {p.invoiceNumber && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-indigo-600 dark:text-indigo-400">{p.invoiceNumber}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Amount & Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            ${Number(p.amount).toFixed(2)} {p.currency}
                          </span>
                          {getStatusBadge(p.status)}
                        </div>
                        {Number(p.amountRefunded || 0) > 0 && (
                          <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                            -${Number(p.amountRefunded).toFixed(2)} refunded
                          </div>
                        )}
                      </td>

                      {/* Failure Reasons from Provider */}
                      <td className="py-3 px-4 max-w-xs">
                        {p.status === 'failed' ? (
                          <div className="space-y-0.5">
                            <span className="inline-block font-mono text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
                              {p.errorCode || 'card_declined'}
                            </span>
                            <p className="text-[11px] text-red-600 dark:text-red-400 truncate" title={p.errorMessage || 'Declined'}>
                              {p.errorMessage || 'Declined by issuer'}
                            </p>
                          </div>
                        ) : p.status === 'refunded' || p.status === 'partially_refunded' ? (
                          <p className="text-[11px] text-purple-700 dark:text-purple-300 italic truncate" title={p.refundReason || 'Refund issued'}>
                            Reason: {p.refundReason || 'Settlement adjustment'}
                          </p>
                        ) : (
                          <span className="text-[11px] text-slate-400">None · Verified</span>
                        )}
                      </td>

                      {/* Transaction / Rail */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          {p.providerPaymentId || p.id.slice(0, 14)}
                        </div>
                        <div className="text-[10px] uppercase font-semibold text-slate-400">
                          {p.provider} · {p.paymentMethod || 'card'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPaymentId(p.id)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="View Payment Detail"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {p.status === 'failed' && canEditBilling && (
                            <button
                              type="button"
                              onClick={() => setRetryTargetPayment(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition shadow-sm"
                            >
                              <RefreshCw className="h-3 w-3" /> Retry Now
                            </button>
                          )}

                          {(p.status === 'succeeded' || p.status === 'partially_refunded') && canEditBilling && (
                            <button
                              type="button"
                              onClick={() => setRefundTargetPayment(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold text-[11px] transition"
                            >
                              <Coins className="h-3 w-3" /> Refund
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <PaymentDetailModal
        isOpen={Boolean(selectedPaymentId)}
        onClose={() => setSelectedPaymentId(null)}
        paymentId={selectedPaymentId}
        onActionSuccess={() => {
          loadPayments();
        }}
      />

      <RefundPaymentModal
        isOpen={Boolean(refundTargetPayment)}
        onClose={() => setRefundTargetPayment(null)}
        payment={refundTargetPayment}
        onSuccess={() => {
          loadPayments();
        }}
      />

      <RetryPaymentModal
        isOpen={Boolean(retryTargetPayment)}
        onClose={() => setRetryTargetPayment(null)}
        payment={retryTargetPayment}
        onSuccess={() => {
          loadPayments();
        }}
      />
    </div>
  );
}
