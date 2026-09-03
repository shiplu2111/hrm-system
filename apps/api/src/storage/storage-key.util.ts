import { randomUUID } from 'node:crypto';
import path from 'node:path';

/** FILE_STORAGE.md §4 — `{tenant_id}/{module}/{entity_id}/{filename_or_uuid}.{ext}` */
export function buildStorageKey(
  tenantId: string,
  module: string,
  entityId: string,
  originalFilename: string,
): string {
  const ext = path.extname(originalFilename).toLowerCase() || '';
  const safeName = `${randomUUID()}${ext}`;
  return `${tenantId}/${module}/${entityId}/${safeName}`;
}
