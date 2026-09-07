import type { TFunction } from 'i18next';
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

function eventLabel(type: SyncQueueItem['eventType'], t: TFunction): string {
  return t(`attendance.event.${type}`, {
    defaultValue: type.replace(/_/g, ' '),
  });
}

export function deriveSyncIndicatorState(
  input: {
    isOnline: boolean;
    isSyncing: boolean;
    counts: Record<QueueItemStatus, number>;
    todayEvents: SyncQueueItem[];
    phase: AttendancePhase;
  },
  t: TFunction,
): SyncIndicatorState {
  const { isOnline, isSyncing, counts, todayEvents, phase } = input;
  const latest = latestTodayEvent(todayEvents);
  const pendingTotal = counts.pending + counts.syncing;
  const hasFailed = counts.failed > 0;

  if (isSyncing || counts.syncing > 0) {
    return {
      tone: 'info',
      title: t('sync.syncing'),
      subtitle: latest
        ? t('sync.savedUploading', { event: eventLabel(latest.eventType, t) })
        : t('sync.uploadingQueued'),
      showRetry: false,
      showSpinner: true,
    };
  }

  if (hasFailed) {
    return {
      tone: 'danger',
      title: t('sync.syncFailed'),
      subtitle: latest
        ? t('sync.eventAtNeedRetry', {
            event: eventLabel(latest.eventType, t),
            time: formatTime(latest.timestampDevice),
            count: counts.failed,
          })
        : t('sync.punchesCouldNotSync', { count: counts.failed }),
      showRetry: isOnline,
      showSpinner: false,
    };
  }

  if (pendingTotal > 0) {
    return {
      tone: 'warning',
      title: isOnline ? t('sync.waitingToSync') : t('sync.offline'),
      subtitle: latest
        ? t('sync.eventRecordedQueued', {
            event: eventLabel(latest.eventType, t),
            time: formatTime(latest.timestampDevice),
            count: pendingTotal,
          })
        : t('sync.punchesSavedOnDevice', { count: pendingTotal }),
      showRetry: isOnline,
      showSpinner: false,
    };
  }

  if (latest && latest.status === 'synced') {
    return {
      tone: 'success',
      title: isOnline ? t('sync.synced') : t('sync.offlineSavedLocally'),
      subtitle: t('sync.eventOnServer', {
        event: eventLabel(latest.eventType, t),
        time: formatTime(latest.timestampDevice),
      }),
      showRetry: false,
      showSpinner: false,
    };
  }

  if (phase !== 'not_started') {
    return {
      tone: isOnline ? 'success' : 'warning',
      title: isOnline ? t('sync.recorded') : t('sync.offlineRecorded'),
      subtitle: t('sync.punchesSavedToday'),
      showRetry: false,
      showSpinner: false,
    };
  }

  return {
    tone: isOnline ? 'neutral' : 'warning',
    title: isOnline ? t('sync.online') : t('sync.offline'),
    subtitle: isOnline ? t('sync.readyAutoSync') : t('sync.offlineCanClockIn'),
    showRetry: false,
    showSpinner: false,
  };
}
