import type { AttendanceEventType } from '@hrm/shared-types';

export type QueueItemStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface SyncQueueItem {
  id: string;
  localId: string;
  employeeId: string;
  eventType: AttendanceEventType;
  timestampDevice: string;
  gpsLat: number | null;
  gpsLng: number | null;
  geofenceOk: boolean | null;
  offlineDurationSeconds: number | null;
  status: QueueItemStatus;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CachedWorkLocation {
  lat: number;
  lng: number;
  radiusM: number;
  name: string;
}

export type GeofencePolicy = 'block' | 'allow_with_warning';

export type PermissionKind = 'location' | 'camera' | 'notifications';

export interface PermissionConsent {
  permission: PermissionKind;
  granted: boolean | null;
  updatedAt: string;
}
