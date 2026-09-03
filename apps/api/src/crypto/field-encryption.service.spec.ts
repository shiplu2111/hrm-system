import { FieldEncryptionService } from './field-encryption.service';

describe('FieldEncryptionService', () => {
  const originalKey = process.env.FIELD_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.FIELD_ENCRYPTION_KEY = 'test-field-encryption-key-32chars!';
  });

  afterAll(() => {
    process.env.FIELD_ENCRYPTION_KEY = originalKey;
  });

  it('round-trips plaintext', () => {
    const service = new FieldEncryptionService();
    const encrypted = service.encrypt('smtp-app-password-123');
    expect(encrypted).not.toContain('smtp-app-password-123');
    expect(service.decrypt(encrypted)).toBe('smtp-app-password-123');
  });

  it('produces distinct ciphertext for the same input', () => {
    const service = new FieldEncryptionService();
    const a = service.encrypt('same-secret');
    const b = service.encrypt('same-secret');
    expect(a).not.toBe(b);
    expect(service.decrypt(a)).toBe('same-secret');
    expect(service.decrypt(b)).toBe('same-secret');
  });
});
