import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { FileMeta, StorageDriver } from '../storage.types';

export interface S3StorageConfig {
  endpoint?: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
}

export class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;

  constructor(private readonly config: S3StorageConfig) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint || undefined,
      forcePathStyle: Boolean(config.endpoint),
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });
  }

  async upload(key: string, file: Buffer, meta: FileMeta): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: file,
        ContentType: meta.contentType,
        ContentLength: meta.size ?? file.length,
      }),
    );
    return key;
  }

  async getUrl(key: string, expirySeconds = 900): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
      { expiresIn: expirySeconds },
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async read(key: string): Promise<{ buffer: Buffer; meta: FileMeta }> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
    );

    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error('Empty object body');
    }

    return {
      buffer: Buffer.from(bytes),
      meta: {
        contentType: response.ContentType ?? 'application/octet-stream',
        size: response.ContentLength,
      },
    };
  }
}
