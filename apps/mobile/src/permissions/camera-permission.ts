import { Alert, Linking } from 'react-native';
import type { TFunction } from 'i18next';
import { recordConsent, getConsent } from '../db/consent-repository';

export async function requestCameraForFaceVerify(t: TFunction): Promise<boolean> {
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
      t('alerts.cameraUnavailableTitle'),
      t('alerts.cameraUnavailableBody'),
      [
        { text: t('common.close'), style: 'default' },
        {
          text: t('alerts.openSettings'),
          onPress: () => void Linking.openSettings(),
        },
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
