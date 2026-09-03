import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { PushPlatform } from '@hrm/shared-types';
import { registerPushToken } from '../api/client';
import { getDeviceId } from '../lib/device-id';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function resolvePlatform(): PushPlatform | null {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return null;
}

/** Request permission and register the native FCM/APNs token with the API. */
export async function ensurePushRegistration(): Promise<boolean> {
  if (!Device.isDevice) {
    return false;
  }

  const platform = resolvePlatform();
  if (!platform) {
    return false;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'HRM notifications',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const tokenResult = await Notifications.getDevicePushTokenAsync();
  const token = tokenResult.data;
  if (!token) {
    return false;
  }

  const deviceId = await getDeviceId();
  await registerPushToken({ token, deviceId, platform });
  return true;
}

/** Re-register when permission was already granted (e.g. on app launch). */
export async function registerPushTokenIfPermitted(): Promise<void> {
  if (!Device.isDevice) return;

  const platform = resolvePlatform();
  if (!platform) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  try {
    const tokenResult = await Notifications.getDevicePushTokenAsync();
    const token = tokenResult.data;
    if (!token) return;

    const deviceId = await getDeviceId();
    await registerPushToken({ token, deviceId, platform });
  } catch {
    // FCM credentials may be absent in local dev — in-app notifications still work.
  }
}

export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(handler);
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseListener(handler);
}
