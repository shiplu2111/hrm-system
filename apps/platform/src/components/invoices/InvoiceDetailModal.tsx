import { useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Download,
  FileText,
  Mail,
  Shield,
  X,
} from 'lucide-react';
import type { PlatformInvoiceDetailView } from '@hrm/shared-types';
import { usePermissions } from '@/hooks/usePermission';
import { downloadInvoicePdf } from '@/lib/invoices-api';
import {
  CreditNoteModal,
  MarkPaidModal,
  ResendEmailModal,
} from './InvoiceActionModals';

interface Props {
  invoice: PlatformInvoiceDetailView;
  onClose: () => void;
  onRefresh: () => void;
}

const statusBadges: Record<string, string> = {
  paid: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  open: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  past_due: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  draft: 'border-slate-500/30 bg-slate-500/10 text-slate-500',
  uncollectible: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
  void: 'border-slate-500/30 bg-slate-500/10 text-slate-400 line-through',
};

export function InvoiceDetailModal({
  invoice: initialInvoice,
  onClose,
  onRefresh,
}: Props) {
  const [inv, setInv] = useState<PlatformInvoiceDetailView>(initialInvoice);
  const [activeModal, setActiveModal] = useState<'paid' | 'credit' | 'email' | null>(
    null,
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const { roleName, can } = usePermissions();

  // Role-gated to Billing Admin, Platform Admin, Platform Owner
  const isAuthorized =
    ['Billing Admin', 'Platform Admin', 'Platform Owner'].includes(roleName) ||
    can('billing', 'edit');

  const handleActionSuccess = (updated: PlatformInvoiceDetailView) => {
    setInv(updated);
    setActiveModal(null);
    onRefresh();
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadInvoicePdf(inv.id, inv.invoiceNumber);
    } catch (e: any) {
      setFeedback(`Download failed: ${e.message}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-4xl my-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold text-lg">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Invoice {inv.invoiceNumber}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    statusBadges[inv.status] ?? 'border-slate-500 text-slate-400'
                  }`}
                >
                  {inv.status.replace('_', ' ')}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {inv.tenantName}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                <span>
                  Subdomain:{' '}
                  <code className="text-slate-700 dark:text-slate-300 font-semibold">
                    {inv.tenantSubdomain}.cmsnbd.com
                  </code>
                </span>
                <span>•</span>
                <span>
                  Tenant ID:{' '}
                  <code className="text-slate-400 font-mono text-[11px]">
                    {inv.tenantId}
                  </code>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5 text-indigo-500" />
              {downloading ? 'Preparing...' : 'Download PDF'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {feedback && (
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between">
              <span>{feedback}</span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-xs text-blue-500 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Core Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-indigo-500" /> Invoice Total
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                {inv.currency} {Number(inv.total).toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Subtotal: {inv.currency} {Number(inv.subtotal).toFixed(2)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500" /> Amount Paid
              </div>
              <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                {inv.currency} {Number(inv.amountPaid).toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {inv.paidAt
                  ? `Paid: ${new Date(inv.paidAt).toLocaleDateString()}`
                  : 'Pending settlement'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-500" /> Balance Due
              </div>
              <div
                className={`text-xl font-extrabold mt-1 ${
                  Number(inv.amountDue) > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                {inv.currency} {Number(inv.amountDue).toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Net 30 billing terms
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-cyan-500" /> Due Date
              </div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
                {new Date(inv.dueDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Period: {new Date(inv.periodStart).toLocaleDateString()} –{' '}
                {new Date(inv.periodEnd).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Manual Payment Information if recorded */}
          {inv.paidReason && (
            <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-xs">
              <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Manual Payment Recorded
              </div>
              <p className="mt-1 text-emerald-700 dark:text-emerald-400">
                Method: <span className="font-semibold">{inv.paymentMethod?.replace('_', ' ')}</span> · Reason: {inv.paidReason}
              </p>
            </div>
          )}

          {/* Role-Gated Administrative Actions Toolbar */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-indigo-500" /> Administrative Actions
              </div>
              <p className="text-[11px] text-slate-500">
                Role-gated to Billing Admin, Platform Admin, and Platform Owner.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={!isAuthorized || inv.status === 'paid'}
                onClick={() => setActiveModal('paid')}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-40"
              >
                Mark as Paid Manually
              </button>

              <button
                type="button"
                disabled={!isAuthorized}
                onClick={() => setActiveModal('credit')}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-rose-300 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 transition disabled:opacity-40"
              >
                Issue Credit Note
              </button>

              <button
                type="button"
                disabled={!isAuthorized}
                onClick={() => setActiveModal('email')}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition disabled:opacity-40 flex items-center gap-1.5"
              >
                <Mail className="h-3 w-3 text-indigo-500" />
                Resend Invoice Email
              </button>
            </div>
          </div>

          {/* Section: Invoice Lines Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-500" /> Invoice Line Items ({inv.lines.length})
            </h3>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Item Description</th>
                    <th className="px-4 py-2.5 text-center">Quantity</th>
                    <th className="px-4 py-2.5 text-right">Unit Price</th>
                    <th className="px-4 py-2.5 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {inv.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {l.description}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500">
                        {l.quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                        {inv.currency} {Number(l.unitAmount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {inv.currency} {Number(l.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Linked Credit Notes if any */}
          {inv.creditNotes && inv.creditNotes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <Coins className="h-4 w-4" /> Issued Credit Notes ({inv.creditNotes.length})
              </h3>
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-rose-50/50 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-900 font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5">Credit Note #</th>
                      <th className="px-4 py-2.5 text-right">Credit Amount</th>
                      <th className="px-4 py-2.5">Mandatory Justification</th>
                      <th className="px-4 py-2.5">Issued By</th>
                      <th className="px-4 py-2.5">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 dark:divide-rose-950/30">
                    {inv.creditNotes.map((cn) => (
                      <tr key={cn.id}>
                        <td className="px-4 py-3 font-mono font-bold text-rose-600">
                          {cn.creditNoteNumber}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">
                          -{cn.currency} {Number(cn.amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {cn.reason}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {cn.issuedBy}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(cn.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section: Linked Payments */}
          {inv.payments && inv.payments.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-500" /> Payment Transactions ({inv.payments.length})
              </h3>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5">Provider</th>
                      <th className="px-4 py-2.5">Reference</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {inv.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 font-bold uppercase text-slate-700 dark:text-slate-300">
                          {p.provider}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">
                          {p.providerPaymentId || p.id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {p.currency} {Number(p.amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 dark:border-emerald-800 uppercase">
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* Action Dialogs */}
      {activeModal === 'paid' && (
        <MarkPaidModal
          invoice={inv}
          onClose={() => setActiveModal(null)}
          onSuccess={handleActionSuccess}
        />
      )}
      {activeModal === 'credit' && (
        <CreditNoteModal
          invoice={inv}
          onClose={() => setActiveModal(null)}
          onSuccess={handleActionSuccess}
        />
      )}
      {activeModal === 'email' && (
        <ResendEmailModal
          invoice={inv}
          onClose={() => setActiveModal(null)}
          onSent={(msg) => setFeedback(msg)}
        />
      )}
    </div>
  );
}
