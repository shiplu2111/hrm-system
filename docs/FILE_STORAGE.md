# FILE_STORAGE.md

## 1. Why This Exists

The platform must support two storage backends, selectable per deployment/tenant without code changes: **S3-compatible object storage** (AWS S3, DigitalOcean Spaces, MinIO) and **local hosting-server disk storage**. See ARCHITECTURE.md §6 for the driver interface.

## 2. Driver Interface

```ts
interface StorageDriver {
  upload(key: string, file: Buffer, meta: FileMeta): Promise<string>; // returns storage key
  getUrl(key: string, expirySeconds?: number): Promise<string>;       // signed URL for S3, direct/served path for local
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
```

All application code depends only on this interface — never on `fs` or `aws-sdk` directly outside the driver implementations.

## 3. Configuration

Selected via environment variable (see ENV_SETUP.md):

```
STORAGE_DRIVER=s3        # or "local"

# S3 driver
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_REGION=

# Local driver
LOCAL_STORAGE_PATH=/var/app/storage
LOCAL_STORAGE_PUBLIC_URL_BASE=
```

## 4. Key Naming Convention

```
{tenant_id}/{module}/{entity_id}/{filename_or_uuid}.{ext}
```
e.g. `acme-corp/documents/emp-1234/passport-scan.pdf` — keeps tenant isolation visible even at the storage layer and simplifies per-tenant export/deletion.

## 5. Access Control

- S3: private bucket, access only via short-lived signed URLs generated server-side after a permission check.
- Local: files served through an authenticated API route (never directly exposed via static file serving), which performs the same permission check as the S3 signed-URL path — access control must be equivalent regardless of driver.

## 6. File Types & Limits

- Per-module allowed MIME types and max size enforced server-side (e.g. documents: PDF/JPG/PNG up to 10MB; profile photos: JPG/PNG up to 5MB).
- Virus/malware scanning on upload where feasible (especially for the local driver, since there's no cloud-provider-level scanning).

## 7. Migration Between Drivers

- A tenant migrating from local → S3 (or vice versa) is a background job that copies all keys and updates no application data (since keys are storage-agnostic) — only the active driver config changes.

## 8. Backup Considerations

- Local driver: file storage must be included in the server backup routine (see SYSTEM_SETTINGS.md) — it is not automatically durable like S3.
- S3 driver: rely on provider durability plus versioning/lifecycle policy on the bucket.
