import {
  assertCategoryLimits,
  buildExpenseReferenceNumber,
  resolveExpenseDisplayStatus,
} from './expense.utils';

describe('expense.utils', () => {
  it('builds reference numbers', () => {
    expect(buildExpenseReferenceNumber(0, new Date('2026-05-01'))).toBe(
      'EXP-2026-001',
    );
  });

  it('resolves display status from workflow step', () => {
    expect(
      resolveExpenseDisplayStatus({
        status: 'pending_approval',
        workflow: {
          id: 'wf-1',
          steps: [
            {
              order: 1,
              assigneeType: 'direct_manager',
              roleName: 'Manager',
              status: 'pending',
              actedByUserId: null,
              actedByEmployeeId: null,
              actedAt: null,
              comment: null,
            },
          ],
        } as never,
      }),
    ).toBe('Pending Manager');
  });

  it('enforces category limits', () => {
    expect(() =>
      assertCategoryLimits({
        amount: 600,
        maxAmountPerClaim: 500,
        maxAmountPerMonth: null,
        employeeMonthlyTotal: 0,
      }),
    ).toThrow(/category limit/);
  });
});
