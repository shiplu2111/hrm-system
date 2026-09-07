import type { PayrollJournalPreview } from '@hrm/shared-types';
import { payrollJournalToXeroLineAmounts } from './xero-gl.provider';

describe('payrollJournalToXeroLineAmounts', () => {
  const journal: PayrollJournalPreview = {
    payrollPeriodId: 'period-1',
    periodLabel: '2026-03-01 – 2026-03-31',
    postingDate: '2026-03-31',
    runCount: 2,
    referenceNumber: 'JE-2026-03',
    lines: [
      {
        glAccountCode: '6100',
        glAccountName: 'Salaries expense',
        description: 'Basic salary',
        debit: '5000.00',
        credit: '0.00',
        mappingSource: 'Basic',
        category: 'earning',
      },
      {
        glAccountCode: '2200',
        glAccountName: 'Salaries payable',
        description: 'Net pay',
        debit: '0.00',
        credit: '4500.00',
        mappingSource: 'net_pay_salary_payable',
        category: 'liability',
      },
    ],
    totalDebit: '5000.00',
    totalCredit: '5000.00',
    balanced: true,
    unmapped: [],
  };

  it('maps debits as positive and credits as negative', () => {
    expect(payrollJournalToXeroLineAmounts(journal)).toEqual([5000, -4500]);
  });
});
