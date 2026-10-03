import { REDACTED, redactAuditValue } from './audit-redaction.utils';

describe('redactAuditValue', () => {
  it('returns null for missing values', () => {
    expect(redactAuditValue(null)).toBeNull();
    expect(redactAuditValue(undefined)).toBeNull();
  });

  it('redacts secrets and masks identifiers, leaving other fields intact', () => {
    expect(
      redactAuditValue({
        passwordHash: '$2b$10$abc',
        smtp_password: 'hunter2',
        mustChangePassword: true,
        bankAccountNumber: '0123456789',
        tax_id: 'TX-998877',
        firstName: 'Ada',
        baseSalary: 85000,
      }),
    ).toEqual({
      passwordHash: REDACTED,
      smtp_password: REDACTED,
      mustChangePassword: true,
      bankAccountNumber: '******6789',
      tax_id: '*****8877',
      firstName: 'Ada',
      baseSalary: 85000,
    });
  });

  it('applies rules inside nested objects and arrays', () => {
    expect(
      redactAuditValue({
        bank: { accountNumber: '9876543210', bankName: 'ACME' },
        credentials: [{ apiKey: 'k_live_1' }, { secretEncrypted: '{"iv":"x"}' }],
      }),
    ).toEqual({
      bank: { accountNumber: '******3210', bankName: 'ACME' },
      credentials: [{ apiKey: REDACTED }, { secretEncrypted: REDACTED }],
    });
  });

  it('wraps non-object payloads so the viewer always receives an object', () => {
    expect(redactAuditValue('active')).toEqual({ value: 'active' });
    expect(redactAuditValue(['a', 'b'])).toEqual({ value: ['a', 'b'] });
  });
});
