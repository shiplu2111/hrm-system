import type { WorkflowDefinitionStep } from '@hrm/shared-types';
import {
  normalizeWorkflowDefinition,
  unconnectedModuleMessage,
  type WorkflowDefinitionDraft,
} from './workflow-definition.rules';
import {
  applicableDefinitionSteps,
  describeWorkflowRouting,
  parseDefinitionSteps,
  type RoutableWorkflowDefinition,
} from './workflow.utils';

const manager: WorkflowDefinitionStep = { order: 1, assigneeType: 'direct_manager', roleName: 'Direct Manager' };
const accountant: WorkflowDefinitionStep = { order: 2, assigneeType: 'role', roleName: 'Accountant' };
const ownerOver1000: WorkflowDefinitionStep = {
  order: 3,
  assigneeType: 'role',
  roleName: 'Company Owner',
  condition: { type: 'amount_threshold', operator: 'gt', value: 1000 },
};

function draft(overrides: Partial<WorkflowDefinitionDraft> = {}): WorkflowDefinitionDraft {
  return {
    entityType: 'expense_claim',
    triggerConfig: { type: 'always' },
    steps: [manager, accountant, ownerOver1000],
    isDefault: false,
    isActive: true,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    ...overrides,
  };
}

function messageOf(input: WorkflowDefinitionDraft): string | null {
  const result = normalizeWorkflowDefinition(input);
  return result.ok ? null : result.message;
}

describe('normalizeWorkflowDefinition', () => {
  it('sorts, renumbers and canonicalises manager labels', () => {
    const result = normalizeWorkflowDefinition(
      draft({ steps: [{ ...accountant, order: 7 }, { ...manager, order: 3 }] }),
    );
    expect(result.ok && result.value.steps).toEqual([
      { order: 1, assigneeType: 'direct_manager', roleName: 'Manager' },
      { order: 2, assigneeType: 'role', roleName: 'Accountant' },
    ]);
  });

  it('keeps amount conditions on expense steps', () => {
    const result = normalizeWorkflowDefinition(draft());
    expect(result.ok && result.value.steps[2].condition).toEqual({
      type: 'amount_threshold',
      operator: 'gt',
      value: 1000,
    });
  });

  it('rejects amount conditions on modules without an amount', () => {
    expect(messageOf(draft({ entityType: 'timesheet_entry' }))).toMatch(/no amount/);
  });

  it('needs at least one step that always applies', () => {
    expect(messageOf(draft({ steps: [{ ...ownerOver1000, order: 1 }] }))).toMatch(/every request/);
  });

  it('rejects repeated approvers', () => {
    expect(
      messageOf(draft({ steps: [manager, { ...manager, order: 2, roleName: 'Manager' }] })),
    ).toBe("Step 2 repeats step 1 (Requester's manager)");
  });

  it('rejects an amount trigger outside expense claims', () => {
    expect(
      messageOf(
        draft({
          entityType: 'offer_letter',
          steps: [manager],
          triggerConfig: { type: 'amount_threshold', operator: 'gt', value: 10 },
        }),
      ),
    ).toMatch(/amount trigger/);
  });

  it('requires the default workflow to apply to every request', () => {
    expect(
      messageOf(
        draft({
          isDefault: true,
          triggerConfig: { type: 'amount_threshold', operator: 'gt', value: 1000 },
        }),
      ),
    ).toMatch(/default workflow must apply/);
  });

  it('drops the default flag when the workflow is turned off', () => {
    const result = normalizeWorkflowDefinition(draft({ isDefault: true, isActive: false }));
    expect(result.ok && result.value.isDefault).toBe(false);
  });

  it('rejects an end date before the start date', () => {
    expect(messageOf(draft({ effectiveTo: '2025-12-31' }))).toMatch(/End date/);
  });

  it('blocks modules that do not route through workflows', () => {
    expect(unconnectedModuleMessage('leave_request')).toMatch(/leave policy/);
    expect(unconnectedModuleMessage('payroll_adjustment')).toMatch(/yet/);
    expect(unconnectedModuleMessage('expense_claim')).toBeNull();
  });
});

describe('amount-conditioned steps', () => {
  it('parses stored conditions and ignores malformed ones', () => {
    const steps = parseDefinitionSteps([
      ownerOver1000,
      { order: 1, assigneeType: 'role', roleName: 'HR Admin', condition: { type: 'other' } },
    ]);
    expect(steps[0]).toEqual({ order: 1, assigneeType: 'role', roleName: 'HR Admin' });
    expect(steps[1].condition).toEqual(ownerOver1000.condition);
  });

  it('skips steps whose threshold the amount does not pass and renumbers the rest', () => {
    const steps = [manager, accountant, ownerOver1000];
    expect(applicableDefinitionSteps(steps, { amount: 1000 }).map((s) => s.roleName)).toEqual([
      'Direct Manager',
      'Accountant',
    ]);
    expect(applicableDefinitionSteps(steps, { amount: 1000.01 })).toEqual([
      { order: 1, assigneeType: 'direct_manager', roleName: 'Direct Manager' },
      { order: 2, assigneeType: 'role', roleName: 'Accountant' },
      { order: 3, assigneeType: 'role', roleName: 'Company Owner' },
    ]);
  });

  it('keeps conditional steps when the amount is unknown', () => {
    expect(applicableDefinitionSteps([manager, ownerOver1000], {})).toHaveLength(2);
  });
});

describe('describeWorkflowRouting', () => {
  const today = '2026-06-01';
  const base = {
    isDefault: false,
    isActive: true,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    triggerConfig: { type: 'always' as const },
  };
  const def = (
    id: string,
    overrides: Partial<RoutableWorkflowDefinition> = {},
  ): RoutableWorkflowDefinition => ({
    id,
    name: id,
    entityType: 'expense_claim',
    ...base,
    ...overrides,
  });

  it('reports why a definition is not used', () => {
    const routing = describeWorkflowRouting(
      [
        def('off', { isActive: false }),
        def('later', { effectiveFrom: '2026-07-01' }),
        def('over', { effectiveTo: '2026-05-31' }),
        def('leave', { entityType: 'leave_request' }),
      ],
      today,
    );
    expect(routing.get('off')?.status).toBe('inactive');
    expect(routing.get('later')?.status).toBe('scheduled');
    expect(routing.get('over')?.status).toBe('ended');
    expect(routing.get('leave')?.status).toBe('module_not_connected');
  });

  it('only uses the default in default-only modules', () => {
    const routing = describeWorkflowRouting(
      [
        def('main', { entityType: 'timesheet_entry', isDefault: true }),
        def('spare', { entityType: 'timesheet_entry' }),
      ],
      today,
    );
    expect(routing.get('main')?.status).toBe('in_use');
    expect(routing.get('spare')?.status).toBe('not_default');
  });

  it('uses every distinct expense threshold and the default as the fallback', () => {
    const over1000 = { type: 'amount_threshold' as const, operator: 'gt' as const, value: 1000 };
    const routing = describeWorkflowRouting(
      [
        def('standard', { isDefault: true }),
        def('other-always'),
        def('high', { triggerConfig: over1000, effectiveFrom: '2026-02-01' }),
        def('high-copy', { triggerConfig: over1000 }),
      ],
      today,
    );
    expect(routing.get('standard')?.status).toBe('in_use');
    expect(routing.get('other-always')).toEqual({
      status: 'overridden',
      overriddenBy: { id: 'standard', name: 'standard' },
    });
    expect(routing.get('high')?.status).toBe('in_use');
    expect(routing.get('high-copy')).toEqual({
      status: 'overridden',
      overriddenBy: { id: 'high', name: 'high' },
    });
  });
});
