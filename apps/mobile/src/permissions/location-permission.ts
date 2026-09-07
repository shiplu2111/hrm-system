import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';
import type { TFunction } from 'i18next';
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
  t: TFunction,
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
          t('alerts.locationRequiredTitle'),
          t('alerts.locationRequiredBody'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('alerts.openSettings'),
              onPress: () => void Linking.openSettings(),
            },
          ],
        );
        return null;
      }

      Alert.alert(
        t('alerts.clockInWithoutLocationTitle'),
        t('alerts.clockInWithoutLocationBody'),
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
          t('alerts.gpsUnavailableTitle'),
          t('alerts.gpsUnavailableBody'),
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

export function locationUsageDescription(t: TFunction): string {
  return Platform.select({
    ios: t('permissions.locationUsageIos'),
    android: t('permissions.locationUsageAndroid'),
    default: t('permissions.locationUsageDefault'),
  }) as string;
}
