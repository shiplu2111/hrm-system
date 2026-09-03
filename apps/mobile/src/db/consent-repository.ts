import type { PermissionConsent, PermissionKind } from './types';
import { getDatabase } from './database';

export async function recordConsent(
  permission: PermissionKind,
  granted: boolean,
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO permission_consent (permission, granted, updated_at)
     VALUES (?, ?, ?)`,
    permission,
    granted ? 1 : 0,
    now,
  );
}

export async function getConsent(
  permission: PermissionKind,
): Promise<PermissionConsent | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    permission: string;
    granted: number | null;
    updated_at: string;
  }>('SELECT * FROM permission_consent WHERE permission = ?', permission);

  if (!row) return null;

  return {
    permission: row.permission as PermissionKind,
    granted: row.granted === null ? null : row.granted === 1,
    updatedAt: row.updated_at,
  };
}
