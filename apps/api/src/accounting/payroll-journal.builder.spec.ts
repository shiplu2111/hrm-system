import { Decimal } from '@prisma/client/runtime/library';
import type { PayrollCalculationPreview } from '@hrm/shared-types';
import {
  buildJournalFromAggregates,
  collectAggregatesFromPreview,
  journalToCsv,
  mergeAggregates,
  toJournalPreview,
} from './payroll-journal.builder';
import type { MappingLookup } from './accounting.constants';

describe('payroll-journal.builder', () => {
  const lookup: MappingLookup = {
    byComponentId: new Map([
      [
        'comp-basic',
        {
          glAccountCode: '5010',
          glAccountName: 'Basic Salary Expense',
          postingSide: 'debit',
        },
      ],
      [
        'comp-tax',
        {
          glAccountCode: '2110',
          glAccountName: 'Income Tax Payable',
          postingSide: 'credit',
        },
      ],
    ]),
    bySystemKey: new Map([
      [
        'net_pay_salary_payable',
        {
          glAccountCode: '2100',
          glAccountName: 'Salaries Payable',
          postingSide: 'credit',
        },
      ],
      [
        'employer_superannuation_expense',
        {
          glAccountCode: '5030',
          glAccountName: 'Employer Super Expense',
          postingSide: 'debit',
        },
      ],
      [
        'employer_superannuation_liability',
        {
          glAccountCode: '2130',
          glAccountName: 'Superannuation Payable',
          postingSide: 'credit',
        },
      ],
    ]),
  };

  const preview: PayrollCalculationPreview = {
    employeeId: 'emp-1',
    asOfDate: '2024-06-30',
    grossPay: '6600.00',
    totalDeductions: '990.00',
    netPay: '5610.00',
    earnings: [
      {
        salaryStructureId: 'ss-1',
        componentId: 'comp-basic',
        componentName: 'Basic Salary',
        componentType: 'earning',
        calculationType: 'fixed',
        baseAmount: null,
        percentage: null,
        amount: '6600.00',
      },
    ],
    deductions: [
      {
        salaryStructureId: 'ss-2',
        componentId: 'comp-tax',
        componentName: 'Income Tax',
        componentType: 'deduction',
        calculationType: 'percentage',
        baseAmount: '6600.00',
        percentage: 15,
        amount: '990.00',
      },
    ],
    superannuation: {
      schemeName: 'Superannuation Guarantee',
      contributionBase: 'gross',
      employerContributionRate: 11,
      employeeContributionRate: 0,
      baseAmount: '6600.00',
      employerContribution: '726.00',
      employeeContribution: '0.00',
      totalContribution: '726.00',
      ruleType: 'social_security',
    },
  };

  it('builds a balanced journal from payroll preview aggregates', () => {
    const aggregates = mergeAggregates(collectAggregatesFromPreview(preview));
    const built = buildJournalFromAggregates({
      aggregates,
      lookup,
      periodLabel: 'June 2024',
    });

    expect(built.balanced).toBe(true);
    expect(built.unmapped).toHaveLength(0);
    expect(built.totalDebit).toBe('7326.00');
    expect(built.totalCredit).toBe('7326.00');
  });

  it('reports unmapped components', () => {
    const sparseLookup: MappingLookup = {
      byComponentId: new Map(),
      bySystemKey: new Map(),
    };
    const built = buildJournalFromAggregates({
      aggregates: collectAggregatesFromPreview(preview),
      lookup: sparseLookup,
      periodLabel: 'June 2024',
    });

    expect(built.lines).toHaveLength(0);
    expect(built.unmapped.length).toBeGreaterThan(0);
  });

  it('renders CSV with header and reference number', () => {
    const built = buildJournalFromAggregates({
      aggregates: collectAggregatesFromPreview(preview),
      lookup,
      periodLabel: 'June 2024',
    });
    const journal = toJournalPreview({
      payrollPeriodId: 'period-1',
      periodLabel: 'June 2024',
      postingDate: '2024-06-30',
      runCount: 1,
      referenceNumber: 'JE-2024-06',
      built,
    });

    const csv = journalToCsv(journal, journal.referenceNumber);
    expect(csv.split('\n')[0]).toContain('Posting Date');
    expect(csv.split('\n')[0]).toMatch(/,Cost Centre$/);
    expect(csv).toContain('JE-2024-06');
    expect(csv).toContain('5010');
  });

  describe('cost centres', () => {
    const sales = { id: 'cc-sales', code: 'SALES', name: 'Sales' };
    const eng = { id: 'cc-eng', code: 'ENG', name: 'Engineering' };

    it('splits employee-cost lines per cost centre and keeps liabilities combined', () => {
      const aggregates = mergeAggregates([
        ...collectAggregatesFromPreview(preview, sales),
        ...collectAggregatesFromPreview(preview, eng),
      ]);
      const built = buildJournalFromAggregates({
        aggregates,
        lookup,
        periodLabel: 'June 2024',
      });

      const salaryLines = built.lines.filter((line) => line.glAccountCode === '5010');
      expect(salaryLines.map((line) => line.costCentreCode)).toEqual(['ENG', 'SALES']);
      expect(salaryLines.every((line) => line.debit === '6600.00')).toBe(true);
      expect(salaryLines[0].description).toContain('(ENG)');

      const netPay = built.lines.filter((line) => line.glAccountCode === '2100');
      expect(netPay).toHaveLength(1);
      expect(netPay[0].credit).toBe('11220.00');
      expect(netPay[0].costCentreCode).toBeNull();
      expect(built.balanced).toBe(true);
    });

    it('prefers a component override, then the cost-centre default, then the company mapping', () => {
      const withOverrides: MappingLookup = {
        ...lookup,
        byCostCentre: new Map([
          [
            'cc-sales',
            new Map([
              ['default', { glAccountCode: '6100', glAccountName: 'Sales Wages' }],
              [
                'component:comp-basic',
                { glAccountCode: '6110', glAccountName: 'Sales Base Salary' },
              ],
            ]),
          ],
        ]),
      };
      const built = buildJournalFromAggregates({
        aggregates: mergeAggregates([
          ...collectAggregatesFromPreview(preview, sales),
          ...collectAggregatesFromPreview(preview, eng),
        ]),
        lookup: withOverrides,
        periodLabel: 'June 2024',
      });

      const line = (code: string, cc: string | null) =>
        built.lines.find((row) => row.glAccountCode === code && row.costCentreCode === cc);
      expect(line('6110', 'SALES')?.debit).toBe('6600.00');
      expect(line('6100', 'SALES')?.debit).toBe('726.00');
      expect(line('5010', 'ENG')?.debit).toBe('6600.00');
      expect(line('5030', 'ENG')?.debit).toBe('726.00');
      expect(line('5010', 'SALES')).toBeUndefined();
      expect(built.balanced).toBe(true);
    });

    it('never applies cost-centre overrides to deductions or liabilities', () => {
      const built = buildJournalFromAggregates({
        aggregates: collectAggregatesFromPreview(preview, sales),
        lookup: {
          ...lookup,
          byCostCentre: new Map([
            ['cc-sales', new Map([['default', { glAccountCode: '6100', glAccountName: 'Sales Wages' }]])],
          ]),
        },
        periodLabel: 'June 2024',
      });

      expect(built.lines.find((row) => row.glAccountCode === '2110')?.credit).toBe('990.00');
      expect(built.lines.find((row) => row.glAccountCode === '2130')?.credit).toBe('726.00');
      expect(
        built.lines.filter((row) => row.glAccountCode === '6100').map((row) => row.category),
      ).toEqual(['earning', 'expense']);
    });

    it('maps an unmapped component through a cost-centre override with a debit side', () => {
      const built = buildJournalFromAggregates({
        aggregates: collectAggregatesFromPreview(preview, sales),
        lookup: {
          byComponentId: new Map([['comp-tax', lookup.byComponentId.get('comp-tax')!]]),
          bySystemKey: lookup.bySystemKey,
          byCostCentre: new Map([
            ['cc-sales', new Map([['default', { glAccountCode: '6100', glAccountName: 'Sales Wages' }]])],
          ]),
        },
        periodLabel: 'June 2024',
      });

      expect(built.unmapped).toHaveLength(0);
      const basic = built.lines.find(
        (row) => row.glAccountCode === '6100' && row.category === 'earning',
      );
      expect(basic?.debit).toBe('6600.00');
      expect(built.balanced).toBe(true);
    });

    it('reports the cost centre on unmapped items', () => {
      const built = buildJournalFromAggregates({
        aggregates: collectAggregatesFromPreview(preview, sales),
        lookup: { byComponentId: new Map(), bySystemKey: new Map() },
        periodLabel: 'June 2024',
      });
      const basic = built.unmapped.find((item) => item.source === 'Basic Salary');
      const tax = built.unmapped.find((item) => item.source === 'Income Tax');
      expect(basic?.costCentreCode).toBe('SALES');
      expect(tax?.costCentreCode).toBeNull();
    });
  });
});
