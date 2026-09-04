import { Injectable } from '@nestjs/common';
import { FieldEncryptionService } from './field-encryption.service';
import {
  isEncryptedFieldPayload,
  maskSensitiveValue,
} from './sensitive-field.utils';

@Injectable()
export class SensitiveFieldService {
  constructor(private readonly encryption: FieldEncryptionService) {}

  encrypt(plaintext: string): string {
    return this.encryption.encrypt(plaintext.trim());
  }

  decrypt(stored: string): string {
    if (isEncryptedFieldPayload(stored)) {
      return this.encryption.decrypt(stored);
    }
    return stored;
  }

  mask(stored: string | null | undefined): string | null {
    if (!stored) return null;
    try {
      return maskSensitiveValue(this.decrypt(stored));
    } catch {
      return FieldEncryptionService.MASKED_VALUE;
    }
  }

  reveal(stored: string | null | undefined): string | null {
    if (!stored) return null;
    return this.decrypt(stored);
  }

  encryptIfPresent(value: string | null | undefined): string | null {
    if (!value?.trim()) return null;
    return this.encrypt(value);
  }
}
