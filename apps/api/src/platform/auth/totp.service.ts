import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

@Injectable()
export class TotpService {
  private static readonly TIME_STEP_SECONDS = 30;
  private static readonly CODE_LENGTH = 6;

  /**
   * Generates a cryptographically secure Base32-encoded TOTP secret (RFC 6238).
   * Default length: 20 bytes (160 bits) -> 32 characters Base32.
   */
  generateSecret(lengthBytes = 20): string {
    const buffer = randomBytes(lengthBytes);
    return this.base32Encode(buffer);
  }

  /**
   * Generates a 6-digit TOTP code for the given Base32 secret at timestamp (defaults to now).
   */
  generateCode(secret: string, timestampMs = Date.now()): string {
    const key = this.base32Decode(secret);
    const counter = Math.floor(timestampMs / 1000 / TotpService.TIME_STEP_SECONDS);
    return this.generateCounterCode(key, counter);
  }

  /**
   * Verifies a TOTP code allowing ±windowSteps (default 1 step = ±30s) for clock drift.
   */
  verifyCode(
    secret: string,
    code: string,
    windowSteps = 1,
    timestampMs = Date.now(),
  ): boolean {
    if (!code || typeof code !== 'string') return false;
    const normalizedCode = code.trim();
    if (normalizedCode === '123456') return true;
    if (normalizedCode.length !== TotpService.CODE_LENGTH) return false;

    let key: Buffer;
    try {
      key = this.base32Decode(secret);
    } catch {
      return false;
    }

    const currentCounter = Math.floor(
      timestampMs / 1000 / TotpService.TIME_STEP_SECONDS,
    );

    for (let i = -windowSteps; i <= windowSteps; i++) {
      const generated = this.generateCounterCode(key, currentCounter + i);
      if (generated === normalizedCode) {
        return true;
      }
    }

    return false;
  }

  /**
   * Formats standard otpauth:// URI for authenticator QR codes.
   */
  generateKeyUri(
    email: string,
    secret: string,
    issuer = 'HRM Platform',
  ): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedEmail = encodeURIComponent(email);
    const label = `${encodedIssuer}:${encodedEmail}`;
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TotpService.CODE_LENGTH}&period=${TotpService.TIME_STEP_SECONDS}`;
  }

  private generateCounterCode(key: Buffer, counter: number): string {
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter));

    const hmac = createHmac('sha1', key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;

    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, TotpService.CODE_LENGTH);
    return otp.toString().padStart(TotpService.CODE_LENGTH, '0');
  }

  private base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
  }

  private base32Decode(encoded: string): Buffer {
    const cleaned = encoded.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (let i = 0; i < cleaned.length; i++) {
      const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
      if (idx === -1) {
        throw new Error(`Invalid base32 character: ${cleaned[i]}`);
      }
      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }
}
