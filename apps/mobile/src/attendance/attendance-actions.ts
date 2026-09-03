import * as Crypto from 'expo-crypto';
import type { AttendanceEventType } from '@hrm/shared-types';
import { enqueueAttendanceEvent } from '../db/queue-repository';
import type { SyncQueueItem } from '../db/types';
import type { LocationCapture } from '../permissions/location-permission';

function newLocalId(): string {
  return Crypto.randomUUID();
}

export async function recordAttendanceAction(input: {
  employeeId: string;
  eventType: AttendanceEventType;
  location?: LocationCapture | null;
  offlineDurationSeconds?: number;
}): Promise<SyncQueueItem> {
  const now = new Date().toISOString();
  const localId = newLocalId();

  return enqueueAttendanceEvent({
    id: Crypto.randomUUID(),
    localId,
    employeeId: input.employeeId,
    eventType: input.eventType,
    timestampDevice: now,
    gpsLat: input.location?.lat ?? null,
    gpsLng: input.location?.lng ?? null,
    geofenceOk: input.location?.geofenceOk ?? null,
    offlineDurationSeconds: input.offlineDurationSeconds ?? null,
  });
}
