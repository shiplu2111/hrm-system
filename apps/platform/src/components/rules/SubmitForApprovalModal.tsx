import React, { useState } from 'react';
import type { RuleVersionView } from '@hrm/shared-types';
import { FileCheck2, Loader2, Send, ShieldCheck, Users } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface SubmitForApprovalModalProps {
  open: boolean;
  onClose: () => void;
  version: RuleVersionView;
  onSubmit: (note?: string) => Promise<void>;
  loading?: boolean;
}

export function SubmitForApprovalModal({
  open,
  onClose,
  version,
  onSubmit,
  loading = false,
}: SubmitForApprovalModalProps) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await onSubmit(note.trim() || undefined);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit rule version for approval.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Submit Version ${version.version} for Approval`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Info Banner */}
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-900/60 dark:text-blue-200 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-sm text-blue-950 dark:text-blue-100">
            <FileCheck2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Compliance Approval Workflow</span>
          </div>
          <p className="leading-relaxed">
            Submitting will move this version from <strong>Draft</strong> to <strong>Pending Approval</strong>.
            In accordance with four-eyes principle (separation of duties), an independent <strong>Platform Owner</strong> or <strong>Platform Admin</strong> must review and publish this change.
          </p>
          <p className="font-semibold text-blue-800 dark:text-blue-300">
            You will not be allowed to approve your own submission.
          </p>
        </div>

        {/* Note Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Submission Note for Reviewer (Optional)
          </label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Updated statutory progressive tax bracket rates per 2026-27 federal budget schedule"
            className="w-full p-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            disabled={submitting || loading}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm disabled:opacity-50 transition flex items-center gap-1.5"
          >
            {submitting || loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Submit for Compliance Approval</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
