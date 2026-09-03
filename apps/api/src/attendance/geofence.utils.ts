import type { AttendanceSyncEventType } from '@prisma/client';
import type { AttendanceSyncEventDto } from '../sync/dto/attendance-sync.dto';

const EARTH_RADIUS_M = 6_371_000;

/** Haversine distance in metres between two WGS-84 coordinates. */
export function distanceMetres(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function isWithinGeofence(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  radiusM: number,
): boolean {
  return distanceMetres(lat, lng, centerLat, centerLng) <= radiusM;
}

export interface GeofenceEvaluation {
  serverGeofenceOk: boolean | null;
  geofenceMismatch: boolean;
}

export interface GeofenceLocation {
  lat: number | null;
  lng: number | null;
  geofenceRadiusM: number | null;
}

/** Server-side geofence validation at sync time (OFFLINE_SYNC.md §6). */
export function evaluateGeofenceAtSync(
  event: Pick<AttendanceSyncEventDto, 'gps' | 'geofence_ok'>,
  eventType: AttendanceSyncEventType,
  location: GeofenceLocation | null,
): GeofenceEvaluation {
  if (eventType !== 'clock_in' && eventType !== 'clock_out') {
    return { serverGeofenceOk: null, geofenceMismatch: false };
  }

  if (
    !event.gps ||
    location?.lat == null ||
    location?.lng == null ||
    location.geofenceRadiusM == null
  ) {
    return { serverGeofenceOk: null, geofenceMismatch: false };
  }

  const serverOk = isWithinGeofence(
    event.gps.lat,
    event.gps.lng,
    Number(location.lat),
    Number(location.lng),
    location.geofenceRadiusM,
  );

  if (event.geofence_ok === undefined) {
    return { serverGeofenceOk: serverOk, geofenceMismatch: false };
  }

  return {
    serverGeofenceOk: serverOk,
    geofenceMismatch: event.geofence_ok !== serverOk,
  };
}

export interface AttendanceReviewFlags {
  timeAnomaly: boolean;
  geofenceMismatch: boolean;
  payrollEligible: boolean;
  reviewStatus: 'none' | 'pending_manager' | 'approved';
}

export function mergeReviewFlags(
  existing: Partial<AttendanceReviewFlags> | null | undefined,
  incoming: { timeAnomaly: boolean; geofenceMismatch: boolean },
): AttendanceReviewFlags {
  const timeAnomaly = Boolean(existing?.timeAnomaly) || incoming.timeAnomaly;
  const geofenceMismatch =
    Boolean(existing?.geofenceMismatch) || incoming.geofenceMismatch;
  const needsReview = timeAnomaly || geofenceMismatch;

  if (needsReview) {
    return {
      timeAnomaly,
      geofenceMismatch,
      payrollEligible: false,
      reviewStatus: 'pending_manager',
    };
  }

  return {
    timeAnomaly: false,
    geofenceMismatch: false,
    payrollEligible: existing?.payrollEligible ?? true,
    reviewStatus: existing?.reviewStatus ?? 'none',
  };
}

export function buildSyncReasons(flags: {
  timeAnomaly: boolean;
  geofenceMismatch: boolean;
}): string | undefined {
  const reasons: string[] = [];
  if (flags.timeAnomaly) reasons.push('time_anomaly');
  if (flags.geofenceMismatch) reasons.push('geofence_mismatch');
  return reasons.length > 0 ? reasons.join(',') : undefined;
}
