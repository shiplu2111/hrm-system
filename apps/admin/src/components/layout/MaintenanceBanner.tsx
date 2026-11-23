import { AlertTriangle, Clock, X } from 'lucide-react';
import { useState } from 'react';
import { useSystemStatus } from '@/hooks/useSystemStatus';

export function MaintenanceBanner() {
  const { status } = useSystemStatus();
  const [dismissed, setDismissed] = useState(false);

  // Only display if scheduled and not dismissed
  if (!status || status.status !== 'scheduled' || dismissed) {
    return null;
  }

  const formatTime = (iso?: string | null) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div
      role="alert"
      className="bg-amber-500 text-amber-950 px-4 py-2 text-xs font-medium flex items-center justify-between border-b border-amber-600 shadow-sm z-40 transition-all duration-200"
    >
      <div className="flex items-center gap-2.5 overflow-hidden">
        <div className="h-5 w-5 rounded-full bg-amber-600/30 flex items-center justify-center shrink-0 text-amber-950">
          <Clock className="h-3.5 w-3.5" />
        </div>
        <div className="truncate">
          <span className="font-bold mr-1.5 uppercase tracking-wide text-[11px] bg-amber-600/20 px-1.5 py-0.5 rounded">
            Scheduled Maintenance Notice
          </span>
          <span>{status.customMessage || 'Platform upgrades scheduled soon.'}</span>
          {status.scheduledStart && (
            <span className="font-semibold ml-2">
              (Starts: {formatTime(status.scheduledStart)}
              {status.scheduledEnd ? ` • Ends: ${formatTime(status.scheduledEnd)}` : ''})
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        <span className="text-[11px] opacity-80 hidden md:inline">
          Data and offline changes will remain safely preserved
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-amber-600/20 rounded-md transition text-amber-950"
          title="Dismiss banner"
          aria-label="Dismiss banner"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
