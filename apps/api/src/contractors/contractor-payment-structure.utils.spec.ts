import {
  computeHourlyInvoiceAmount,
  validateInvoiceAgainstContract,
} from './contractor-payment-structure.utils';

describe('contractor-payment-structure.utils', () => {
  it('computes hourly invoice amount', () => {
    expect(computeHourlyInvoiceAmount('10', '95.00')).toBe('950.00');
  });

  it('rejects fixed fee overrun', () => {
    expect(
      validateInvoiceAgainstContract({
        paymentStructure: 'fixed_project_fee',
        fixedFeeAmount: '10000.00',
        hourlyRate: null,
        invoiceAmount: '6000.00',
        invoicedTotalExcludingCurrent: '5000.00',
      }),
    ).toMatch(/exceed fixed project fee/);
  });

  it('requires milestone amount match', () => {
    expect(
      validateInvoiceAgainstContract({
        paymentStructure: 'milestone',
        fixedFeeAmount: null,
        hourlyRate: null,
        invoiceAmount: '5000.00',
        milestoneAmount: '4000.00',
        milestoneStatus: 'pending',
        invoicedTotalExcludingCurrent: '0.00',
      }),
    ).toMatch(/match milestone amount/);
  });

  it('validates hourly invoice math', () => {
    expect(
      validateInvoiceAgainstContract({
        paymentStructure: 'hourly_invoice',
        fixedFeeAmount: null,
        hourlyRate: '95.00',
        invoiceAmount: '950.00',
        hoursWorked: '10',
        invoicedTotalExcludingCurrent: '0.00',
      }),
    ).toBeNull();
  });
});
