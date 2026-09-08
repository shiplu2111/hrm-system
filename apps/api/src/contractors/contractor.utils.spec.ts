import {
  computeInvoiceDueDate,
  daysUntilExpiry,
  paymentTermsDays,
  resolveContractStatus,
} from './contractor.utils';

describe('contractor.utils', () => {
  it('maps payment terms to days', () => {
    expect(paymentTermsDays('net_30')).toBe(30);
    expect(paymentTermsDays('due_on_receipt')).toBe(0);
  });

  it('computes invoice due date from payment terms', () => {
    const issuedAt = new Date('2026-01-01T12:00:00.000Z');
    const dueAt = computeInvoiceDueDate(issuedAt, 'net_14');
    expect(dueAt.toISOString()).toBe('2026-01-15T12:00:00.000Z');
  });

  it('resolves expired contract status from dates', () => {
    const status = resolveContractStatus({
      storedStatus: 'active',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      asOf: new Date('2026-06-01'),
    });
    expect(status).toBe('expired');
  });

  it('computes days until expiry', () => {
    expect(
      daysUntilExpiry(new Date('2026-12-31'), new Date('2026-12-01')),
    ).toBe(30);
  });
});
