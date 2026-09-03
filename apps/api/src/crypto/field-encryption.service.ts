import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const SCRYPT_SALT = 'hrm-field-encryption-v1';

interface EncryptedPayload {
  v: number;
  iv: string;
  tag: string;
  data: string;
}

@Injectable()
export class FieldEncryptionService {
  /** Mask shown in API responses for stored secrets — SECURITY.md §11 */
  static readonly MASKED_VALUE = '••••••••';

  encrypt(plaintext: string): string {
    const key = this.getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const payload: EncryptedPayload = {
      v: 1,
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: encrypted.toString('base64'),
    };
    return JSON.stringify(payload);
  }

  decrypt(ciphertext: string): string {
    let payload: EncryptedPayload;
    try {
      payload = JSON.parse(ciphertext) as EncryptedPayload;
    } catch {
      throw new InternalServerErrorException({
        code: 'INTERNAL_ERROR',
        message: 'Stored secret is corrupted',
      });
    }

    if (payload.v !== 1) {
      throw new InternalServerErrorException({
        code: 'INTERNAL_ERROR',
        message: 'Unsupported secret encryption version',
      });
    }

    const key = this.getKey();
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(payload.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.data, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  private getKey(): Buffer {
    const secret = process.env.FIELD_ENCRYPTION_KEY?.trim();
    if (!secret) {
      throw new InternalServerErrorException({
        code: 'INTERNAL_ERROR',
        message: 'FIELD_ENCRYPTION_KEY is not configured',
      });
    }
    return scryptSync(secret, SCRYPT_SALT, KEY_LENGTH);
  }
}
