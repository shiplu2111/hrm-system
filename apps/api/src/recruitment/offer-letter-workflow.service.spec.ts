import type { WorkflowInstanceRecord } from '@hrm/shared-types';
import { OfferLetterWorkflowService } from './offer-letter-workflow.service';

function instance(overrides: Partial<WorkflowInstanceRecord> = {}): WorkflowInstanceRecord {
  return {
    id: 'wf-1',
    definitionId: null,
    companyId: 'c1',
    tenantId: 't1',
    entityType: 'offer_letter',
    entityId: 'offer-1',
    requesterEmployeeId: 'emp-1',
    requesterUserId: 'user-1',
    status: 'pending',
    steps: [
      {
        order: 1,
        assigneeType: 'role',
        roleName: 'HR Admin',
        status: 'pending',
        actedByUserId: null,
        actedByEmployeeId: null,
        actedAt: null,
        comment: null,
      },
    ],
    currentStepOrder: 1,
    completedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('OfferLetterWorkflowService', () => {
  const startInput = {
    companyId: 'c1',
    tenantId: 't1',
    offerLetterId: 'offer-1',
    requesterEmployeeId: 'emp-1',
    requesterUserId: 'user-1',
  };

  function setup(existing: WorkflowInstanceRecord | null) {
    const engine = {
      findByEntity: jest.fn().mockResolvedValue(existing ? { id: existing.id } : null),
      toRecord: jest.fn().mockReturnValue(existing),
      deleteInstance: jest.fn().mockResolvedValue(undefined),
      startInstance: jest.fn().mockResolvedValue(instance({ id: 'wf-new' })),
    };
    const definitions = {
      findEffectiveDefault: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
    };
    const service = new OfferLetterWorkflowService(engine as never, definitions as never);
    return { service, engine, definitions };
  }

  it('reuses a pending instance instead of starting another', async () => {
    const { service, engine } = setup(instance());
    const result = await service.startForOfferLetter(startInput);
    expect(result.id).toBe('wf-1');
    expect(engine.startInstance).not.toHaveBeenCalled();
  });

  it('replaces a rejected instance when a revised offer is resubmitted', async () => {
    const { service, engine } = setup(instance({ status: 'rejected' }));
    const result = await service.startForOfferLetter(startInput);
    expect(engine.deleteInstance).toHaveBeenCalledWith('wf-1');
    expect(engine.startInstance).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'offer_letter', entityId: 'offer-1' }),
    );
    expect(result.id).toBe('wf-new');
  });

  it('previews the configured default workflow before submission', async () => {
    const { service, definitions } = setup(null);
    definitions.findEffectiveDefault.mockResolvedValue({
      id: 'def-1',
      name: 'Exec offer sign-off',
      steps: [{ order: 1, assigneeType: 'role', roleName: 'Company Owner' }],
    });
    const route = await service.resolveRoute('c1', null);
    expect(route).toEqual({
      definitionId: 'def-1',
      name: 'Exec offer sign-off',
      source: 'workflow_builder',
      steps: [{ order: 1, assigneeType: 'role', roleName: 'Company Owner' }],
    });
  });

  it('falls back to the built-in HR Admin → Company Owner chain', async () => {
    const { service } = setup(null);
    const route = await service.resolveRoute('c1', null);
    expect(route.source).toBe('system_default');
    expect(route.steps.map((s) => s.roleName)).toEqual(['HR Admin', 'Company Owner']);
  });

  it('describes a running instance from its own steps', async () => {
    const { service, definitions } = setup(null);
    definitions.findById.mockResolvedValue({ id: 'def-2', name: 'Offer approvals', steps: [] });
    const route = await service.resolveRoute('c1', instance({ definitionId: 'def-2' }));
    expect(route.name).toBe('Offer approvals');
    expect(route.steps).toEqual([{ order: 1, assigneeType: 'role', roleName: 'HR Admin' }]);
  });
});
