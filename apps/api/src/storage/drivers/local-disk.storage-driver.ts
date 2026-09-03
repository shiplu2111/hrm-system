import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { FileMeta, StorageDriver } from '../storage.types';

export class LocalDiskStorageDriver implements StorageDriver {
  constructor(private readonly rootPath: string) {}

  private resolvePath(key: string): string {
    const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(this.rootPath, normalized);
    const relative = path.relative(this.rootPath, fullPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Invalid storage key');
    }
    return fullPath;
  }

  async upload(key: string, file: Buffer, meta: FileMeta): Promise<string> {
    const fullPath = this.resolvePath(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file);
    await this.writeSidecar(fullPath, meta);
    return key;
  }

  async getUrl(key: string, _expirySeconds?: number): Promise<string> {
    const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    return `${base}/api/v1/storage/files?key=${encodeURIComponent(key)}`;
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolvePath(key);
    await fs.rm(fullPath, { force: true });
    await fs.rm(`${fullPath}.meta.json`, { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(key));
      return true;
    } catch {
      return false;
    }
  }

  async read(key: string): Promise<{ buffer: Buffer; meta: FileMeta }> {
    const fullPath = this.resolvePath(key);
    const buffer = await fs.readFile(fullPath);
    const meta = await this.readSidecar(fullPath);
    return { buffer, meta };
  }

  private async writeSidecar(fullPath: string, meta: FileMeta): Promise<void> {
    await fs.writeFile(
      `${fullPath}.meta.json`,
      JSON.stringify(meta),
      'utf8',
    );
  }

  private async readSidecar(fullPath: string): Promise<FileMeta> {
    try {
      const raw = await fs.readFile(`${fullPath}.meta.json`, 'utf8');
      return JSON.parse(raw) as FileMeta;
    } catch {
      return { contentType: 'application/octet-stream' };
    }
  }
}
