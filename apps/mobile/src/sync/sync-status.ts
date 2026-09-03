import type { AttendancePhase } from '@hrm/shared-types';
import type { QueueItemStatus, SyncQueueItem } from '../db/types';

export type SyncIndicatorTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface SyncIndicatorState {
  tone: SyncIndicatorTone;
  title: string;
  subtitle: string;
  showRetry: boolean;
  showSpinner: boolean;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function latestTodayEvent(events: SyncQueueItem[]): SyncQueueItem | null {
  if (events.length === 0) return null;
  return events[events.length - 1];
}

function eventLabel(type: SyncQueueItem['eventType']): string {
  return type.replace(/_/g, ' ');
}

export function deriveSyncIndicatorState(input: {
  isOnline: boolean;
  isSyncing: boolean;
  counts: Record<QueueItemStatus, number>;
  todayEvents: SyncQueueItem[];
  phase: AttendancePhase;
}): SyncIndicatorState {
  const { isOnline, isSyncing, counts, todayEvents, phase } = input;
  const latest = latestTodayEvent(todayEvents);
  const pendingTotal = counts.pending + counts.syncing;
  const hasFailed = counts.failed > 0;

  if (isSyncing || counts.syncing > 0) {
    return {
      tone: 'info',
      title: 'Syncing…',
      subtitle: latest
        ? `${eventLabel(latest.eventType)} saved on device · uploading`
        : 'Uploading queued punches',
      showRetry: false,
      showSpinner: true,
    };
  }

  if (hasFailed) {
    return {
      tone: 'danger',
      title: 'Sync failed',
      subtitle: latest
        ? `${eventLabel(latest.eventType)} at ${formatTime(latest.timestampDevice)} · ${counts.failed} need retry`
        : `${counts.failed} punch(es) could not sync`,
      showRetry: isOnline,
      showSpinner: false,
    };
  }

  if (pendingTotal > 0) {
    return {
      tone: 'warning',
      title: isOnline ? 'Waiting to sync' : 'Offline',
      subtitle: latest
        ? `${eventLabel(latest.eventType)} recorded at ${formatTime(latest.timestampDevice)} · ${pendingTotal} queued`
        : `${pendingTotal} punch(es) saved on device`,
      showRetry: isOnline,
      showSpinner: false,
    };
  }

  if (latest && latest.status === 'synced') {
    return {
      tone: 'success',
      title: isOnline ? 'Synced' : 'Offline · saved locally',
      subtitle: `${eventLabel(latest.eventType)} at ${formatTime(latest.timestampDevice)} · on server`,
      showRetry: false,
      showSpinner: false,
    };
  }

  if (phase !== 'not_started') {
    return {
      tone: isOnline ? 'success' : 'warning',
      title: isOnline ? 'Recorded' : 'Offline · recorded',
      subtitle: 'Today\'s punches saved on this device',
      showRetry: false,
      showSpinner: false,
    };
  }

  return {
    tone: isOnline ? 'neutral' : 'warning',
    title: isOnline ? 'Online' : 'Offline',
    subtitle: isOnline
      ? 'Ready — punches sync automatically'
      : 'You can clock in — punches save on device',
    showRetry: false,
    showSpinner: false,
  };
}
