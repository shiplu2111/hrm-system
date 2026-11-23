import { Clock, Power, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { useState } from 'react';
import type { PublicMaintenanceStatus } from '@hrm/shared-types';

export function MaintenancePage({
  status,
  onRetry,
}: {
  status?: PublicMaintenanceStatus | null;
  onRetry?: () => void;
}) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    if (onRetry) {
      await onRetry();
    } else {
      window.location.reload();
    }
    setTimeout(() => setRetrying(false), 1000);
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-rose-500 selection:text-white">
      {/* Container */}
      <div className="max-w-lg w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-8 sm:p-10 text-center relative overflow-hidden">
        {/* Glow behind icon */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-rose-500/10 dark:bg-rose-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Icon */}
        <div className="h-16 w-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-6 shadow-sm relative">
          <Power className="h-8 w-8" />
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 mb-4 animate-pulse">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          Scheduled Maintenance in Progress
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
          CMSN-HR is Temporarily Offline
        </h1>

        {/* Description / Custom Message */}
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          {status?.customMessage ||
            'We are currently performing essential platform upgrades, database maintenance, and security enhancements to ensure peak system performance.'}
        </p>

        {/* Target restoration card */}
        {status?.scheduledEnd && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 mb-6 text-left">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              <Clock className="h-4 w-4 text-amber-500" />
              Target Service Restoration
            </div>
            <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">
              {formatTime(status.scheduledEnd)}
            </p>
          </div>
        )}

        {/* Offline sync safety note */}
        <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs text-left flex items-start gap-3 mb-8">
          <Smartphone className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-bold">Mobile App Users:</span> Attendance punches and offline requests remain securely queued on your device and will synchronize automatically once maintenance completes.
          </div>
        </div>

        {/* Retry Button */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Checking System...' : 'Check Status'}
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>All tenant business data and audit records remain encrypted and secure</span>
        </div>
      </div>
    </div>
  );
}
