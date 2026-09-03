import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_PATH = '/api/v1';
const DEFAULT_PORT = 3000;

function getExpoDevHost(): string | null {
  const debuggerHost = Constants.expoGoConfig?.debuggerHost;
  if (!debuggerHost) return null;
  return debuggerHost.split(':')[0] ?? null;
}

function isLocalHostUrl(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1');
}

/**
 * Resolve API base URL for the current runtime.
 * Android emulator cannot reach host `localhost` — uses `10.0.2.2` instead.
 * Physical devices use the Expo/Metro host IP when available.
 */
export function getApiBaseUrl(): string {
  const configured =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    `http://localhost:${DEFAULT_PORT}${DEFAULT_PATH}`;

  if (configured && !isLocalHostUrl(configured)) {
    return configured.replace(/\/$/, '');
  }

  const expoHost = getExpoDevHost();
  if (expoHost) {
    const host =
      Platform.OS === 'android' &&
      (expoHost === 'localhost' || expoHost === '127.0.0.1')
        ? '10.0.2.2'
        : expoHost;
    return `http://${host}:${DEFAULT_PORT}${DEFAULT_PATH}`;
  }

  if (Platform.OS === 'android') {
    return configured
      .replace('localhost', '10.0.2.2')
      .replace('127.0.0.1', '10.0.2.2')
      .replace(/\/$/, '');
  }

  return configured.replace(/\/$/, '');
}
