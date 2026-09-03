export interface FileMeta {
  contentType: string;
  originalName?: string;
  size?: number;
}

/** FILE_STORAGE.md §2 — all file I/O goes through this interface. */
export interface StorageDriver {
  upload(key: string, file: Buffer, meta: FileMeta): Promise<string>;
  getUrl(key: string, expirySeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  read(key: string): Promise<{ buffer: Buffer; meta: FileMeta }>;
}

export type StorageDriverKind = 'local' | 's3';
