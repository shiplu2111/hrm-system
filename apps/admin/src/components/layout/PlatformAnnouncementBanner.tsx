import { useEffect, useState, useCallback } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Info,
  Lock,
  X,
} from 'lucide-react';
import type { TenantActiveAnnouncement } from '@hrm/shared-types';
import {
  dismissAnnouncement,
  getActiveAnnouncements,
} from '@/lib/announcements-api';

export function PlatformAnnouncementBanner() {
  const [items, setItems] = useState<TenantActiveAnnouncement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const active = await getActiveAnnouncements();
      setItems(active);
      if (currentIndex >= active.length) {
        setCurrentIndex(Math.max(0, active.length - 1));
      }
    } catch {
      // ignore
    }
  }, [currentIndex]);

  useEffect(() => {
    fetchAnnouncements();
    // Poll every 60 seconds
    const interval = setInterval(fetchAnnouncements, 60000);
    return () => clearInterval(interval);
  }, [fetchAnnouncements]);

  if (!items.length) {
    return null;
  }

  const current = items[currentIndex] || items[0];
  if (!current) {
    return null;
  }

  const handleDismiss = async (id: string) => {
    // Optimistically remove from state
    const nextItems = items.filter((item) => item.id !== id);
    setItems(nextItems);
    if (currentIndex >= nextItems.length) {
      setCurrentIndex(Math.max(0, nextItems.length - 1));
    }

    try {
      await dismissAnnouncement(id);
    } catch (err) {
      console.error('Failed to dismiss announcement on server', err);
    }
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
  };

  // Severity styling
  const isCritical = current.severity === 'critical';
  const isWarning = current.severity === 'warning';
  const isInfo = current.severity === 'info';

  const containerClasses = isCritical
    ? 'bg-rose-600 text-white border-b border-rose-700 shadow-sm'
    : isWarning
    ? 'bg-amber-500 text-amber-950 border-b border-amber-600 shadow-sm'
    : 'bg-blue-600 text-white border-b border-blue-700 shadow-sm';

  const badgeClasses = isCritical
    ? 'bg-rose-700/80 text-rose-100'
    : isWarning
    ? 'bg-amber-600/30 text-amber-950'
    : 'bg-blue-700/80 text-blue-100';

  const buttonHoverClasses = isWarning
    ? 'hover:bg-amber-600/30 text-amber-950'
    : 'hover:bg-white/20 text-white';

  return (
    <div
      role="alert"
      className={`px-4 py-2 text-xs font-medium z-50 transition-all duration-200 flex items-center justify-between gap-3 ${containerClasses}`}
      data-testid="platform-announcement-banner"
      data-severity={current.severity}
    >
      <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0">
        <div className="shrink-0">
          {isCritical ? (
            <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
              <AlertOctagon className="h-3.5 w-3.5" />
            </div>
          ) : isWarning ? (
            <div className="h-5 w-5 rounded-full bg-amber-950/15 flex items-center justify-center">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
          ) : (
            <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center">
              <Info className="h-3.5 w-3.5" />
            </div>
          )}
        </div>

        <div className="truncate flex items-center gap-2 flex-1 min-w-0">
          <span
            className={`font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded shrink-0 ${badgeClasses}`}
          >
            {isCritical ? 'Critical Alert' : isWarning ? 'Notice' : 'Announcement'}
          </span>

          <span className="font-bold shrink-0">{current.title}</span>
          <span className="text-slate-200 dark:text-slate-100 opacity-90 truncate font-normal">
            — {current.body}
          </span>
        </div>
      </div>

      {/* Controls & Dismiss */}
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {/* Carousel indicator if multiple announcements */}
        {items.length > 1 && (
          <div className="flex items-center gap-1 mr-2 text-[11px] opacity-90">
            <button
              type="button"
              onClick={handlePrev}
              className={`p-0.5 rounded ${buttonHoverClasses} transition`}
              title="Previous announcement"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="font-semibold">
              {currentIndex + 1}/{items.length}
            </span>
            <button
              type="button"
              onClick={handleNext}
              className={`p-0.5 rounded ${buttonHoverClasses} transition`}
              title="Next announcement"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Dismiss Button or Locked Notice */}
        {current.dismissible ? (
          <button
            type="button"
            onClick={() => handleDismiss(current.id)}
            className={`p-1 rounded-md transition ${buttonHoverClasses}`}
            title="Dismiss announcement"
            aria-label="Dismiss announcement"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded ${
              isWarning ? 'bg-amber-600/20 text-amber-950' : 'bg-black/25 text-white'
            }`}
            title="This announcement is pinned by platform administrators and cannot be dismissed"
          >
            <Lock className="h-3 w-3" />
            Pinned
          </span>
        )}
      </div>
    </div>
  );
}
