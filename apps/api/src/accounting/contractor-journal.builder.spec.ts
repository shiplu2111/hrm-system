import { buildContractorJournal } from './contractor-journal.builder';
import type { MappingLookup } from './accounting.constants';

describe('contractor-journal.builder', () => {
  const lookup: MappingLookup = {
    byComponentId: new Map(),
    bySystemKey: new Map([
      [
        'contractor_expense',
        {
          glAccountCode: '5040',
          glAccountName: 'Contractor Services Expense',
          postingSide: 'debit',
        },
      ],
      [
        'contractor_payable',
        {
          glAccountCode: '2150',
          glAccountName: 'Contractor Payments Payable',
          postingSide: 'credit',
        },
      ],
    ]),
  };

  it('builds balanced contractor journal separate from payroll accounts', () => {
    const built = buildContractorJournal({
      items: [
        {
          invoiceId: 'inv-1',
          invoiceNumber: 'CINV-2026-001',
          contractorName: 'ClearPath Consulting',
          amount: '40000.00',
        },
      ],
      lookup,
      batchReference: 'CPAY-2026-0001',
      postingDate: '2026-08-15',
    });

    expect(built.balanced).toBe(true);
    expect(built.lines).toHaveLength(2);
    expect(built.lines.map((line) => line.glAccountCode).sort()).toEqual(['2150', '5040']);
    expect(built.totalDebit).toBe('40000.00');
    expect(built.totalCredit).toBe('40000.00');
  });
});
