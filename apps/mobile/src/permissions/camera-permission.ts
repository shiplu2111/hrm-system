import { Alert, Linking } from 'react-native';
import { recordConsent, getConsent } from '../db/consent-repository';

export async function requestCameraForFaceVerify(): Promise<boolean> {
  const { Camera } = await import('expo-camera');
  const current = await Camera.getCameraPermissionsAsync();
  if (current.granted) {
    await recordConsent('camera', true);
    return true;
  }

  const requested = await Camera.requestCameraPermissionsAsync();
  await recordConsent('camera', requested.granted);

  if (!requested.granted) {
    Alert.alert(
      'Camera unavailable',
      'Face verification needs camera access. You can still clock in using the standard button — try PIN or manual verification instead.',
      [
        { text: 'OK', style: 'default' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ],
    );
    return false;
  }

  return true;
}

export async function hasAskedCameraBefore(): Promise<boolean> {
  const consent = await getConsent('camera');
  return consent != null;
}
