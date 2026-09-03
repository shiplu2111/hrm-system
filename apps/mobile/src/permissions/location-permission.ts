import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';
import { getConsent, recordConsent } from '../db/consent-repository';
import type { GeofencePolicy } from '../db/types';
import { getCachedWorkLocation, getGeofencePolicy } from '../db/session-repository';
import { isWithinGeofence } from '../lib/geofence';

export interface LocationCapture {
  lat: number;
  lng: number;
  geofenceOk: boolean | null;
}

export async function ensureLocationForClockIn(
  policyOverride?: GeofencePolicy,
): Promise<LocationCapture | null> {
  const policy = policyOverride ?? (await getGeofencePolicy());
  const existing = await Location.getForegroundPermissionsAsync();

  if (existing.status !== Location.PermissionStatus.GRANTED) {
    const requested = await Location.requestForegroundPermissionsAsync();
    await recordConsent('location', requested.status === 'granted');

    if (requested.status !== Location.PermissionStatus.GRANTED) {
      if (policy === 'block') {
        Alert.alert(
          'Location required',
          'Your company requires location for clock-in. Enable location in Settings or contact your manager.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => void Linking.openSettings() },
          ],
        );
        return null;
      }

      Alert.alert(
        'Clock-in without location',
        'Location was denied. Your punch will be recorded and flagged for manager review when it syncs.',
      );
      return null;
    }
  } else {
    await recordConsent('location', true);
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const { latitude, longitude } = position.coords;
    const cached = await getCachedWorkLocation();
    const geofenceOk =
      cached != null
        ? isWithinGeofence(latitude, longitude, cached.lat, cached.lng, cached.radiusM)
        : null;

    return { lat: latitude, lng: longitude, geofenceOk };
  } catch {
    const lastKnown = await Location.getLastKnownPositionAsync();
    if (!lastKnown) {
      if (policy === 'allow_with_warning') {
        Alert.alert(
          'GPS unavailable',
          'Using last-known location failed. Clock-in will proceed without GPS and may be flagged at sync.',
        );
      }
      return null;
    }

    const { latitude, longitude } = lastKnown.coords;
    const cached = await getCachedWorkLocation();
    const geofenceOk =
      cached != null
        ? isWithinGeofence(latitude, longitude, cached.lat, cached.lng, cached.radiusM)
        : null;

    return { lat: latitude, lng: longitude, geofenceOk };
  }
}

export async function hasAskedLocationBefore(): Promise<boolean> {
  const consent = await getConsent('location');
  return consent != null;
}

export function locationUsageDescription(): string {
  return Platform.select({
    ios: 'HRM uses your location to validate geofenced clock-in/out for attendance.',
    android: 'HRM uses your location to validate geofenced clock-in/out for attendance.',
    default: 'Location is used for geofenced attendance.',
  }) as string;
}
