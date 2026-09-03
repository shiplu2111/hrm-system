import type { AuthUser } from '@hrm/shared-types';
import type { CachedWorkLocation, GeofencePolicy } from './types';
import { getDatabase } from './database';

const KEYS = {
  accessToken: 'access_token',
  employeeId: 'employee_id',
  userJson: 'user_json',
  geofencePolicy: 'geofence_policy',
  workLocation: 'work_location_json',
} as const;

async function set(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_session (key, value) VALUES (?, ?)',
    key,
    value,
  );
}

async function get(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_session WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

async function remove(key: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM app_session WHERE key = ?', key);
}

export async function saveSession(input: {
  accessToken: string;
  user: AuthUser;
}): Promise<void> {
  await set(KEYS.accessToken, input.accessToken);
  await set(KEYS.userJson, JSON.stringify(input.user));
  if (input.user.employeeId) {
    await set(KEYS.employeeId, input.user.employeeId);
  }
}

export async function clearSession(): Promise<void> {
  await Promise.all(Object.values(KEYS).map((key) => remove(key)));
}

export async function getAccessToken(): Promise<string | null> {
  return get(KEYS.accessToken);
}

export async function getEmployeeId(): Promise<string | null> {
  return get(KEYS.employeeId);
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const raw = await get(KEYS.userJson);
  if (!raw) return null;
  return JSON.parse(raw) as AuthUser;
}

export async function getGeofencePolicy(): Promise<GeofencePolicy> {
  const raw = await get(KEYS.geofencePolicy);
  return raw === 'block' ? 'block' : 'allow_with_warning';
}

export async function setGeofencePolicy(policy: GeofencePolicy): Promise<void> {
  await set(KEYS.geofencePolicy, policy);
}

export async function getCachedWorkLocation(): Promise<CachedWorkLocation | null> {
  const raw = await get(KEYS.workLocation);
  if (!raw) return null;
  return JSON.parse(raw) as CachedWorkLocation;
}

export async function setCachedWorkLocation(
  location: CachedWorkLocation,
): Promise<void> {
  await set(KEYS.workLocation, JSON.stringify(location));
}
