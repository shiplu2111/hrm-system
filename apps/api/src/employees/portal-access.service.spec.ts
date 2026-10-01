import { validatePasswordStrength } from '../auth/password-policy.utils';
import { generateTemporaryPassword } from './portal-access.service';

describe('generateTemporaryPassword', () => {
  it('always satisfies the password policy', () => {
    for (let i = 0; i < 500; i += 1) {
      const password = generateTemporaryPassword();
      expect(password).toHaveLength(12);
      expect(validatePasswordStrength(password)).toBeNull();
    }
  });

  it('avoids look-alike characters', () => {
    for (let i = 0; i < 500; i += 1) {
      expect(generateTemporaryPassword()).not.toMatch(/[0O1lI]/);
    }
  });

  it('does not repeat', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateTemporaryPassword()));
    expect(seen.size).toBe(200);
  });
});
