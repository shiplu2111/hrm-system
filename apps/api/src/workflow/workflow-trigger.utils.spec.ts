import {
  matchesAmountTrigger,
  pickMatchingWorkflowDefinition,
} from './workflow.utils';

describe('workflow amount-based routing', () => {
  const standard = {
    name: 'Standard',
    isDefault: true,
    triggerConfig: { type: 'always' as const },
  };
  const highValue = {
    name: 'High Value',
    isDefault: false,
    triggerConfig: {
      type: 'amount_threshold' as const,
      operator: 'gt' as const,
      value: 1000,
    },
  };

  it('matches gt threshold', () => {
    expect(matchesAmountTrigger(1001, highValue.triggerConfig)).toBe(true);
    expect(matchesAmountTrigger(1000, highValue.triggerConfig)).toBe(false);
    expect(matchesAmountTrigger(500, highValue.triggerConfig)).toBe(false);
  });

  it('matches gte threshold', () => {
    expect(
      matchesAmountTrigger(1000, {
        type: 'amount_threshold',
        operator: 'gte',
        value: 1000,
      }),
    ).toBe(true);
  });

  it('picks high-value workflow for large claims', () => {
    const picked = pickMatchingWorkflowDefinition(
      [standard, highValue],
      { amount: 1500 },
    );
    expect(picked?.name).toBe('High Value');
  });

  it('falls back to always workflow for small claims', () => {
    const picked = pickMatchingWorkflowDefinition(
      [standard, highValue],
      { amount: 350 },
    );
    expect(picked?.name).toBe('Standard');
  });
});
