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
    expect(csv).toContain('JE-2024-06');
    expect(csv).toContain('5010');
  });
});
