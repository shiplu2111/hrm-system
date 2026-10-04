import {
  assertCategoryLimits,
  assertLimitOrder,
  buildExpenseReferenceNumber,
  buildLimitCheck,
  isFutureExpenseDate,
  monthBounds,
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

  it('labels approved claims as approved, not as queued for payroll', () => {
    expect(resolveExpenseDisplayStatus({ status: 'approved', workflow: null })).toBe(
      'Approved',
    );
  });

  it('rejects a per-claim limit above the monthly limit', () => {
    expect(() => assertLimitOrder(600, 500)).toThrow(/cannot be higher/);
    expect(() => assertLimitOrder(500, 500)).not.toThrow();
    expect(() => assertLimitOrder(600, null)).not.toThrow();
    expect(() => assertLimitOrder(null, 100)).not.toThrow();
  });

  it('builds a limit check for the expense month', () => {
    const check = buildLimitCheck({
      amount: 300,
      expenseDate: new Date('2026-03-20T00:00:00Z'),
      maxAmountPerClaim: 500,
      maxAmountPerMonth: 1500,
      otherClaimsThisMonth: 1250.5,
    });
    expect(check).toEqual({
      maxAmountPerClaim: 500,
      maxAmountPerMonth: 1500,
      month: '2026-03',
      otherClaimsThisMonth: 1250.5,
      exceedsPerClaim: false,
      exceedsPerMonth: true,
    });
    expect(
      buildLimitCheck({
        amount: 249.5,
        expenseDate: new Date('2026-03-20T00:00:00Z'),
        maxAmountPerClaim: null,
        maxAmountPerMonth: 1500,
        otherClaimsThisMonth: 1250.5,
      }).exceedsPerMonth,
    ).toBe(false);
  });

  it('treats dates more than a day past UTC today as future', () => {
    const now = new Date('2026-10-04T20:00:00Z');
    expect(isFutureExpenseDate(new Date('2026-10-05T00:00:00Z'), now)).toBe(false);
    expect(isFutureExpenseDate(new Date('2026-10-06T00:00:00Z'), now)).toBe(true);
  });

  it('gives month bounds for any day, including month ends', () => {
    const { start, end } = monthBounds(new Date('2028-02-29T00:00:00Z'));
    expect(start.toISOString().slice(0, 10)).toBe('2028-02-01');
    expect(end.toISOString().slice(0, 10)).toBe('2028-02-29');
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
