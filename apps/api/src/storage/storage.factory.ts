import { LocalDiskStorageDriver } from './drivers/local-disk.storage-driver';
import { S3StorageDriver } from './drivers/s3.storage-driver';
import type { StorageDriver, StorageDriverKind } from './storage.types';

export function resolveStorageDriverKind(): StorageDriverKind {
  const raw = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();
  return raw === 's3' ? 's3' : 'local';
}

export function createStorageDriver(): StorageDriver {
  const kind = resolveStorageDriverKind();

  if (kind === 's3') {
    const bucket = process.env.S3_BUCKET;
    const accessKey = process.env.S3_ACCESS_KEY;
    const secretKey = process.env.S3_SECRET_KEY;
    const region = process.env.S3_REGION ?? 'us-east-1';

    if (!bucket || !accessKey || !secretKey) {
      throw new Error(
        'S3 storage selected but S3_BUCKET, S3_ACCESS_KEY, or S3_SECRET_KEY is missing',
      );
    }

    return new S3StorageDriver({
      bucket,
      accessKey,
      secretKey,
      region,
      endpoint: process.env.S3_ENDPOINT || undefined,
    });
  }

  const rootPath = process.env.LOCAL_STORAGE_PATH ?? './storage';
  return new LocalDiskStorageDriver(rootPath);
}
