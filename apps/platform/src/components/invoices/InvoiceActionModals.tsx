import { useState } from 'react';
import { AlertCircle, Check, DollarSign, FileText, Mail, ShieldAlert, X } from 'lucide-react';
import type { PlatformInvoiceDetailView } from '@hrm/shared-types';
import {
  issueInvoiceCreditNote,
  markInvoiceAsPaid,
  resendInvoiceEmail,
} from '@/lib/invoices-api';

interface ActionModalProps {
  invoice: PlatformInvoiceDetailView;
  onClose: () => void;
  onSuccess: (updated: PlatformInvoiceDetailView) => void;
}

export function MarkPaidModal({ invoice, onClose, onSuccess }: ActionModalProps) {
  const [reason, setReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('manual_bank_transfer');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A mandatory justification reason is required to mark an invoice as paid manually.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const updated = await markInvoiceAsPaid(invoice.id, {
        reason: reason.trim(),
        paymentMethod,
        reference: reference.trim() || undefined,
      });
      onSuccess(updated);
    } catch (err: any) {
      setError(err?.message || 'Failed to mark invoice as paid');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                Mark Invoice as Paid Manually
              </h3>
              <p className="text-xs text-slate-500">
                Invoice {invoice.invoiceNumber} · {invoice.tenantName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">Amount Outstanding:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {invoice.currency} {Number(invoice.amountDue).toFixed(2)}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="manual_bank_transfer">Manual Bank Transfer / Wire</option>
              <option value="check">Physical Check / Cheque</option>
              <option value="wire_swift">International SWIFT / Wire</option>
              <option value="direct_debit">Direct Debit Settlement</option>
              <option value="cash">Cash Settlement</option>
              <option value="other">Other Manual Settlement</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Payment Reference / Transaction ID (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. TR-9988221 or Check #4401"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Mandatory Justification Reason *
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Verified deposit in Barclays Corporate account per remittance advice received from CFO."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <ShieldAlert className="h-3 w-3 text-amber-500" />
              Will be permanently recorded in the platform immutable audit log.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !reason.trim()}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-40"
            >
              {loading ? 'Processing...' : 'Mark as Paid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CreditNoteModal({ invoice, onClose, onSuccess }: ActionModalProps) {
  const maxAllowed = Number(invoice.total);
  const [amount, setAmount] = useState<number>(Math.min(25, maxAllowed));
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A mandatory accounting reason is required to issue a credit note.');
      return;
    }
    if (amount <= 0 || amount > maxAllowed) {
      setError(`Credit amount must be between 0.01 and ${invoice.currency} ${maxAllowed.toFixed(2)}.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const updated = await issueInvoiceCreditNote(invoice.id, {
        amount,
        reason: reason.trim(),
      });
      onSuccess(updated);
    } catch (err: any) {
      setError(err?.message || 'Failed to issue credit note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                Issue Credit Note
              </h3>
              <p className="text-xs text-slate-500">
                Against Invoice {invoice.invoiceNumber} · {invoice.tenantName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Credit Amount ({invoice.currency})
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={maxAllowed}
                required
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400">
                Max: {invoice.currency} {maxAllowed.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Deducts from outstanding balance. If already paid, credited towards next renewal billing cycle.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Reason / Accounting Justification *
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Service disruption SLA credit or billing reconciliation discrepancy"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !reason.trim() || amount <= 0}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-40"
            >
              {loading ? 'Processing...' : 'Issue Credit Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ResendEmailModal({
  invoice,
  onClose,
  onSent,
}: {
  invoice: PlatformInvoiceDetailView;
  onClose: () => void;
  onSent: (msg: string) => void;
}) {
  const [recipient, setRecipient] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await resendInvoiceEmail(invoice.id, {
        recipientEmail: recipient.trim() || undefined,
      });
      onSent(
        `Invoice email with PDF successfully dispatched to ${res.recipient}${
          res.sent ? '' : ' (Logged to notifications)'
        }.`,
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                Resend Invoice Email
              </h3>
              <p className="text-xs text-slate-500">
                Invoice {invoice.invoiceNumber} · {invoice.tenantName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Recipient Email Override (Optional)
            </label>
            <input
              type="email"
              placeholder="Leave empty to use tenant primary billing contact"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              The invoice PDF generated via FileStorage will be automatically attached.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-40"
            >
              {loading ? 'Sending...' : 'Send Invoice Email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
