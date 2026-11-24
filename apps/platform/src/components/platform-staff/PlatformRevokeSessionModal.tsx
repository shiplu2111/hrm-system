import { useState } from 'react';
import { AlertCircle, AlertTriangle, Globe, Laptop, RefreshCw, ShieldAlert, X } from 'lucide-react';
import type { PlatformStaffSessionView } from '@hrm/shared-types';
import { revokePlatformSession } from '@/lib/platform-staff-api';

interface Props {
  session: PlatformStaffSessionView | null;
  onClose: () => void;
  onRevoked: (sessionId: string) => void;
}

export function PlatformRevokeSessionModal({ session, onClose, onRevoked }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return null;

  const handleRevoke = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await revokePlatformSession(session.id);
      onRevoked(session.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to revoke staff session');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 text-rose-600">
            <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Revoke Staff Session?</h3>
              <p className="text-xs text-slate-500 mt-0.5">Immediate operator session termination</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
          <div>
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Staff Member</span>
            <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
              {session.userName} ({session.userEmail})
            </div>
            <div className="text-[11px] text-slate-500">Role: {session.userRoleName}</div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
                <Laptop className="h-3 w-3" /> Device
              </span>
              <div className="text-slate-800 dark:text-slate-200 text-[11px] font-medium truncate mt-0.5" title={session.device}>
                {session.device}
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
                <Globe className="h-3 w-3" /> Location / IP
              </span>
              <div className="text-slate-800 dark:text-slate-200 text-[11px] font-medium truncate mt-0.5" title={`${session.location} (${session.ipAddress})`}>
                {session.location}
              </div>
            </div>
          </div>

          {session.isUnusualLocation && (
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-1.5 mt-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>Flagged: {session.unusualLocationReason || 'Unusual location detected'}</span>
            </div>
          )}
        </div>

        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-900 dark:text-rose-200 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            <span>Impact of Revocation</span>
          </div>
          <p className="leading-relaxed">
            The refresh token will be invalidated immediately. Any future token refreshes from this device will fail,
            forcing the operator to log in and re-verify their 2FA.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={submitting}
            className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-2 shadow-sm transition-all"
          >
            {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            <span>Revoke Session</span>
          </button>
        </div>
      </div>
    </div>
  );
}
