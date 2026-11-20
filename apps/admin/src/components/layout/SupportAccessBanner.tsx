import { useEffect, useState } from 'react';
import {
  AlertOctagon,
  Clock,
  LogOut,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import {
  clearSupportSession,
  getActiveSupportSession,
} from '@/lib/tenant-api-client';

export function SupportAccessBanner() {
  const session = getActiveSupportSession();
  const { current, tenantKey } = useTenant();

  const [timeLeft, setTimeLeft] = useState<{
    formatted: string;
    isExpired: boolean;
    isUrgent: boolean;
  }>({
    formatted: '',
    isExpired: false,
    isUrgent: false,
  });

  const [isEnding, setIsEnding] = useState(false);

  useEffect(() => {
    if (!session || !session.expiresAt) return;

    const updateCountdown = () => {
      const expiry = new Date(session.expiresAt!).getTime();
      const now = Date.now();
      const diffMs = expiry - now;

      if (diffMs <= 0) {
        setTimeLeft({
          formatted: '00m 00s (Expired)',
          isExpired: true,
          isUrgent: true,
        });
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const pad = (n: number) => String(n).padStart(2, '0');
      let formatted = '';
      if (hours > 0) {
        formatted = `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s remaining`;
      } else {
        formatted = `${pad(minutes)}m ${pad(seconds)}s remaining`;
      }

      setTimeLeft({
        formatted,
        isExpired: false,
        isUrgent: totalSeconds < 900, // < 15 minutes
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [session?.expiresAt]);

  if (!session) return null;

  const displayTenantName =
    session.tenantName || current?.tenantName || (tenantKey ? `${tenantKey}.cmsnbd.com` : 'Workspace');

  const handleEndSession = () => {
    setIsEnding(true);
    clearSupportSession();
    // Clear URL parameters and reload
    const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
    window.location.href = cleanUrl;
  };

  return (
    <aside
      aria-label="Platform Support Session Active"
      className="sticky top-0 z-[100] w-full bg-slate-950 text-slate-100 border-b-2 border-amber-500 shadow-xl select-none"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Indicator & Tenant Name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>

          <div className="flex items-center gap-2 font-bold tracking-wide uppercase text-amber-400 shrink-0">
            <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">Active Support Session</span>
            <span className="sm:hidden">Support Mode</span>
          </div>

          <span className="text-slate-600 dark:text-slate-500 hidden sm:inline">|</span>

          {/* Tenant Name */}
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-slate-400 hidden md:inline">Tenant:</span>
            <span className="font-extrabold text-white bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700 truncate">
              {displayTenantName}
            </span>
          </div>

          <span className="text-slate-600 dark:text-slate-500 hidden lg:inline">|</span>

          {/* Engineer & Mode */}
          <div className="hidden lg:flex items-center gap-1.5 text-slate-300">
            <UserCheck className="h-3.5 w-3.5 text-slate-400" />
            <span>Engineer:</span>
            <strong className="text-amber-300 font-semibold">{session.staffName}</strong>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-tight ${
                session.accessMode === 'read_write'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {session.accessMode === 'read_write' ? 'Read-Write' : 'Read-Only'}
            </span>
          </div>
        </div>

        {/* Right: Countdown & End Session Button */}
        <div className="flex items-center gap-3 shrink-0 ml-auto">
          {/* Live Countdown Timer */}
          {timeLeft.formatted && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono font-bold text-xs tracking-tight border ${
                timeLeft.isExpired
                  ? 'bg-rose-950 text-rose-300 border-rose-700 animate-pulse'
                  : timeLeft.isUrgent
                    ? 'bg-amber-950/80 text-amber-300 border-amber-700'
                    : 'bg-slate-900 text-slate-200 border-slate-800'
              }`}
            >
              <Clock className={`h-3.5 w-3.5 ${timeLeft.isUrgent ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>{timeLeft.formatted}</span>
            </div>
          )}

          {/* End Session Button */}
          <button
            type="button"
            onClick={handleEndSession}
            disabled={isEnding}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            title="Terminate impersonated support access and clear authorization credentials"
          >
            {isEnding ? (
              <>
                <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Ending...</span>
              </>
            ) : (
              <>
                <LogOut className="h-3.5 w-3.5" />
                <span>End Session</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sub-bar reminder: Hard-block and audit guarantee */}
      <div className="bg-slate-900/90 border-t border-slate-800/80 px-4 py-1 text-[11px] text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-1.5 truncate">
          <AlertOctagon className="h-3 w-3 text-amber-500 shrink-0" />
          <span className="truncate">
            <strong className="text-slate-300">Audited Impersonation:</strong> All actions are dual-logged with your verified identity.
            Payroll finalization, payment batches, and bank reveal are cryptographically blocked.
          </span>
        </div>
        <span className="hidden md:inline font-mono text-[10px] text-slate-500 uppercase shrink-0">
          SECURITY.md §2 · AUDIT_LOG.md
        </span>
      </div>
    </aside>
  );
}
