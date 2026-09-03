import {
  distanceMetres,
  evaluateGeofenceAtSync,
  isWithinGeofence,
  mergeReviewFlags,
} from './geofence.utils';
import { AttendanceSyncEventType } from '@prisma/client';

describe('geofence.utils', () => {
  const sydney = { lat: -33.8688, lng: 151.2093, geofenceRadiusM: 200 };

  it('detects points inside and outside the geofence radius', () => {
    expect(isWithinGeofence(-33.8688, 151.2093, sydney.lat, sydney.lng, 200)).toBe(true);
    expect(distanceMetres(-33.8688, 151.2093, -33.95, 151.2093)).toBeGreaterThan(200);
    expect(isWithinGeofence(-33.95, 151.2093, sydney.lat, sydney.lng, 200)).toBe(false);
  });

  it('flags geofence mismatch when device and server disagree', () => {
    const result = evaluateGeofenceAtSync(
      {
        gps: { lat: -33.95, lng: 151.2093 },
        geofence_ok: true,
      },
      AttendanceSyncEventType.clock_in,
      sydney,
    );
    expect(result.serverGeofenceOk).toBe(false);
    expect(result.geofenceMismatch).toBe(true);
  });

  it('excludes flagged records from payroll until manager review clears them', () => {
    expect(
      mergeReviewFlags(
        { payrollEligible: true, reviewStatus: 'none' },
        { timeAnomaly: true, geofenceMismatch: false },
      ),
    ).toEqual({
      timeAnomaly: true,
      geofenceMismatch: false,
      payrollEligible: false,
      reviewStatus: 'pending_manager',
    });
  });
});
