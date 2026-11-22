import React, { useState } from 'react';
import type { RuleVersionView } from '@hrm/shared-types';
import { AlertCircle, Loader2, XCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface RejectRuleVersionModalProps {
  open: boolean;
  onClose: () => void;
  version: RuleVersionView;
  onReject: (reason: string) => Promise<void>;
  loading?: boolean;
}

export function RejectRuleVersionModal({
  open,
  onClose,
  version,
  onReject,
  loading = false,
}: RejectRuleVersionModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A rejection reason is mandatory to guide correction.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onReject(reason.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to reject rule version.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Reject Rule Version ${version.version}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Info Banner */}
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-200 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-950 dark:text-rose-100">
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>Rejection & Correction Workflow</span>
          </div>
          <p className="leading-relaxed">
            Rejecting this rule version will return it to <strong>Draft</strong> status and record your feedback.
            The submitter can address your comments and re-submit for review.
          </p>
        </div>

        {/* Reason Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Rejection Reason & Correction Guidance *
          </label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Overtime multiplier for weekends is listed as 1.5x instead of the statutory 2.0x required by Fair Work Australia Award."
            className="w-full p-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs dark:bg-red-950/40 dark:border-red-800 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || loading}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!reason.trim() || submitting || loading}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-sm disabled:opacity-50 transition flex items-center gap-1.5"
          >
            {submitting || loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            <span>Reject Version & Return to Draft</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
