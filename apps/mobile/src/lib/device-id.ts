import * as Application from 'expo-application';
import { Platform } from 'react-native';

export async function getDeviceId(): Promise<string> {
  if (Platform.OS === 'android') {
    return Application.getAndroidId() ?? 'android-unknown';
  }
  if (Platform.OS === 'ios') {
    return (await Application.getIosIdForVendorAsync()) ?? 'ios-unknown';
  }
  return `web-${Application.applicationId ?? 'unknown'}`;
}
