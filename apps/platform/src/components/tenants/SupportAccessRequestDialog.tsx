import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
  Lock,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import type {
  SupportAccessMode,
  SupportAccessRequestRecord,
} from '@hrm/shared-types';
import { requestSupportAccess } from '@/lib/api-client';

interface SupportAccessRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: {
    id: string;
    name: string;
    subdomain: string;
    plan?: string;
    isSandbox?: boolean;
    country?: string;
  };
  currentStaff: {
    name: string;
    email: string;
    roleName: string;
  };
  preauthorized?: boolean;
  onSuccess: (session: SupportAccessRequestRecord) => void;
}

const DURATION_OPTIONS = [
  { val: 15, label: '15m' },
  { val: 30, label: '30m' },
  { val: 60, label: '1 hour', isRec: true },
  { val: 120, label: '2 hours' },
  { val: 240, label: '4 hours', isMax: true },
];

export function SupportAccessRequestDialog({
  isOpen,
  onClose,
  tenant,
  currentStaff,
  preauthorized = false,
  onSuccess,
}: SupportAccessRequestDialogProps) {
  const [duration, setDuration] = useState<number>(60);
  const [mode, setMode] = useState<SupportAccessMode>('read_only');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const charCount = reason.trim().length;
  const isValid = charCount >= 10;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isValid || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const result = await requestSupportAccess(tenant.id, {
        reason: reason.trim(),
        durationMinutes: duration,
        accessMode: mode,
      });
      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to submit support access request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !isSubmitting) onClose();
      }}
    >
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3
                id="support-dialog-title"
                className="text-base font-bold tracking-tight text-slate-900 dark:text-white"
              >
                Request Platform Support Access
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Time-boxed, cryptographically audited impersonation token for{' '}
                <strong className="text-slate-900 dark:text-slate-200">
                  {tenant.name}
                </strong>{' '}
                ({tenant.subdomain}.cmsnbd.com)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Pre-authorisation Status Badge */}
        <div className="mt-4">
          {preauthorized ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong>Pre-authorised by Workspace:</strong> This tenant has
                enabled automatic support grant approvals. Your session will
                activate immediately upon submission.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs">
              <Clock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                <strong>Manual Owner Approval Required:</strong> An in-app alert
                and authorization email will be dispatched to the tenant's
                Company Owner.
              </span>
            </div>
          )}
        </div>

        {/* Requesting Staff Details */}
        <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400">
              Requesting Staff:
            </span>{' '}
            <strong className="font-semibold text-slate-900 dark:text-slate-100">
              {currentStaff.name}
            </strong>{' '}
            <span className="text-slate-400">({currentStaff.email})</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-semibold">
            {currentStaff.roleName}
          </span>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Duration Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Session Duration (Max 4 Hours / 240 Minutes — SECURITY.md §2)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setDuration(opt.val)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition flex flex-col items-center justify-center gap-0.5 ${
                    duration === opt.val
                      ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500'
                  }`}
                >
                  <span>{opt.label}</span>
                  {opt.isRec && (
                    <span className="text-[9px] font-bold tracking-tight uppercase opacity-90">
                      Rec
                    </span>
                  )}
                  {opt.isMax && (
                    <span className="text-[9px] font-bold tracking-tight uppercase opacity-90">
                      Max
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Access Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Access Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('read_only')}
                className={`p-3 rounded-xl text-left border transition ${
                  mode === 'read_only'
                    ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/10 text-slate-900 dark:text-slate-100 ring-1 ring-amber-500'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    Read-Only (Default)
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Inspect records, configurations, and calculation logs. All
                  mutations are strictly blocked.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('read_write')}
                className={`p-3 rounded-xl text-left border transition ${
                  mode === 'read_write'
                    ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/10 text-slate-900 dark:text-slate-100 ring-1 ring-amber-500'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Lock className="h-4 w-4 text-amber-500" />
                    Read-Write
                  </span>
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase">
                    Explicit
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Permits corrective entity updates. Payroll finalize & bank
                  reveal remain cryptographically blocked.
                </p>
              </button>
            </div>
          </div>

          {/* Justification & Scope */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="support-reason"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Justification & Scope (Mandatory)
              </label>
              <span
                className={`text-[11px] ${
                  isValid
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400'
                }`}
              >
                {charCount} / 10 min chars
              </span>
            </div>
            <textarea
              id="support-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Investigating reported overtime calculation error for employee in pay period 12 reported in ticket #1049"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              disabled={isSubmitting}
            />
          </div>

          {/* Non-Negotiable Policy Box */}
          <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 dark:bg-slate-950 dark:border dark:border-slate-800 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-[11px] uppercase tracking-wide text-amber-400">
              <Info className="h-3.5 w-3.5 text-amber-400" />
              Non-Negotiable Security Policies (SECURITY.md, AUDIT_LOG.md)
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11px]">
              <li>
                Every request made with this token is written to both platform
                and tenant audit logs with your real name.
              </li>
              <li>
                Payroll finalization, payment batches, and revealing bank
                account details are cryptographically blocked.
              </li>
              <li>
                Session automatically expires after {duration} minutes and token
                cannot be refreshed.
              </li>
            </ul>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="h-10 px-5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Requesting...</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4" />
                  <span>Request Support Access</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
