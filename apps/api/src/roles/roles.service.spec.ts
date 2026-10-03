import type { AuthenticatedUser } from '../auth/auth.types';
import { RolesService } from './roles.service';

jest.mock('../tenant/tenant.context', () => ({
  getTenantIdFromSession: () => 'tenant-1',
}));

const CUSTOM_ROLE_ID = '00000000-0000-4000-8000-0000000000c1';
const ACTOR_ROLE_ID = '00000000-0000-4000-8000-0000000000a1';

function roleRow(overrides: Partial<{ id: string; name: string; users: number; permissions: Array<[string, string]> }> = {}) {
  const permissions = overrides.permissions ?? [['employee', 'view']];
  return {
    id: overrides.id ?? CUSTOM_ROLE_ID,
    tenantId: 'tenant-1',
    name: overrides.name ?? 'Branch Manager',
    dataScope: 'all' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: permissions.map(([module, action]) => ({ module, action })),
    _count: { users: overrides.users ?? 0 },
  };
}

function setup(options: {
  actorPermissions?: Array<[string, string]>;
  roles?: ReturnType<typeof roleRow>[];
  workflowNames?: string[];
  actorOrgWide?: boolean;
} = {}) {
  const roles = options.roles ?? [roleRow()];
  const tx = {
    role: {
      create: jest.fn().mockResolvedValue({ id: 'new-role' }),
      update: jest.fn(),
      delete: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue(roleRow({ id: 'new-role' })),
    },
    permission: { createMany: jest.fn(), deleteMany: jest.fn() },
  };
  const prisma = {
    scoped: {
      role: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) => roles.find((role) => role.id === where.id) ?? null),
        findMany: jest.fn().mockResolvedValue(roles.map(({ id, name }) => ({ id, name }))),
      },
    },
    unscoped: {
      permission: {
        findMany: jest
          .fn()
          .mockResolvedValue((options.actorPermissions ?? [['settings', 'edit']]).map(([module, action]) => ({ module, action }))),
      },
      leavePolicy: { findMany: jest.fn().mockResolvedValue([]) },
      workflowDefinition: {
        findMany: jest.fn().mockResolvedValue((options.workflowNames ?? []).map((name) => ({ name }))),
      },
      workflowInstance: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    },
  };
  const audit = { log: jest.fn() };
  const dataScope = { isOrgWide: jest.fn().mockResolvedValue(options.actorOrgWide ?? true) };
  const service = new RolesService(prisma as never, audit as never, dataScope as never);
  return { service, prisma, tx, audit };
}

const actor: AuthenticatedUser = {
  id: 'user-1',
  tenantId: 'tenant-1',
  roleId: ACTOR_ROLE_ID,
  roleName: 'HR Admin',
  employeeId: 'emp-1',
  email: 'hr@example.com',
  permissions: [],
  authMethod: 'jwt',
};

describe('RolesService', () => {
  it('refuses to grant permissions the actor does not hold', async () => {
    const { service, tx } = setup({ actorPermissions: [['employee', 'view'], ['settings', 'create']] });
    await expect(
      service.createCustomRole(
        { name: 'Payroll Officer', permissions: [{ module: 'payroll', action: 'finalize' }] },
        actor,
      ),
    ).rejects.toMatchObject({ response: { code: 'PERMISSION_NOT_HELD' } });
    expect(tx.role.create).not.toHaveBeenCalled();
  });

  it('creates a role and audits it in the same transaction', async () => {
    const { service, tx, audit } = setup({ actorPermissions: [['employee', 'view'], ['employee', 'edit']] });
    await service.createCustomRole(
      {
        name: '  HR Executive ',
        permissions: [
          { module: 'employee', action: 'view' },
          { module: 'employee', action: 'edit' },
          { module: 'employee', action: 'view' },
        ],
      },
      actor,
    );
    expect(tx.role.create).toHaveBeenCalledWith({
      data: { name: 'HR Executive', tenantId: 'tenant-1', dataScope: 'all' },
    });
    expect(tx.permission.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', recordId: 'new-role', module: 'settings' }),
      tx,
    );
  });

  it('rejects reserved and duplicate names case-insensitively', async () => {
    const { service } = setup({ actorPermissions: [['employee', 'view']] });
    const permissions = [{ module: 'employee', action: 'view' as const }];
    await expect(service.createCustomRole({ name: 'hr admin', permissions }, actor)).rejects.toMatchObject({
      response: { code: 'SYSTEM_ROLE_NAME_RESERVED' },
    });
    await expect(service.createCustomRole({ name: 'BRANCH MANAGER', permissions }, actor)).rejects.toMatchObject({
      response: { code: 'ROLE_NAME_TAKEN' },
    });
  });

  it('rejects platform-level modules', async () => {
    const { service } = setup({ actorPermissions: [['tenant', 'view']] });
    await expect(
      service.createCustomRole({ name: 'Billing', permissions: [{ module: 'tenant', action: 'view' }] }, actor),
    ).rejects.toMatchObject({ response: { code: 'PERMISSION_NOT_GRANTABLE' } });
  });

  it('only checks newly added permissions on update, so unrelated grants can still be removed', async () => {
    const { service, tx } = setup({
      actorPermissions: [['employee', 'view']],
      roles: [roleRow({ permissions: [['employee', 'view'], ['payroll', 'finalize']] })],
    });
    await service.updateCustomRole(CUSTOM_ROLE_ID, { permissions: [{ module: 'employee', action: 'view' }] }, actor);
    expect(tx.permission.deleteMany).toHaveBeenCalledWith({
      where: { roleId: CUSTOM_ROLE_ID, OR: [{ module: 'payroll', action: 'finalize' }] },
    });
    expect(tx.permission.createMany).not.toHaveBeenCalled();
  });

  it('stops editors removing their own access to role settings', async () => {
    const { service } = setup({
      roles: [roleRow({ id: ACTOR_ROLE_ID, permissions: [['settings', 'view'], ['settings', 'edit']] })],
    });
    await expect(
      service.updateCustomRole(ACTOR_ROLE_ID, { permissions: [{ module: 'settings', action: 'view' }] }, actor),
    ).rejects.toMatchObject({ response: { code: 'ROLE_SELF_LOCKOUT' } });
  });

  it('blocks renaming or deleting a role that approval steps reference', async () => {
    const { service } = setup({ workflowNames: ['Expense approval'] });
    await expect(service.updateCustomRole(CUSTOM_ROLE_ID, { name: 'Area Manager' }, actor)).rejects.toMatchObject({
      response: { code: 'ROLE_IN_WORKFLOW' },
    });
    await expect(service.deleteCustomRole(CUSTOM_ROLE_ID, actor)).rejects.toMatchObject({
      response: { code: 'ROLE_IN_WORKFLOW' },
    });
  });

  it('lets team-scoped editors create team roles but not company-wide ones', async () => {
    const { service, tx } = setup({ actorPermissions: [['employee', 'view']], actorOrgWide: false });
    const permissions = [{ module: 'employee', action: 'view' as const }];
    await expect(
      service.createCustomRole({ name: 'Area Lead', permissions }, actor),
    ).rejects.toMatchObject({ response: { code: 'DATA_SCOPE_NOT_HELD' } });
    await service.createCustomRole({ name: 'Area Lead', dataScope: 'team', permissions }, actor);
    expect(tx.role.create).toHaveBeenCalledWith({
      data: { name: 'Area Lead', tenantId: 'tenant-1', dataScope: 'team' },
    });
  });

  it('updates and audits a data scope change', async () => {
    const { service, tx, audit } = setup();
    await service.updateCustomRole(CUSTOM_ROLE_ID, { dataScope: 'team' }, actor);
    expect(tx.role.update).toHaveBeenCalledWith({
      where: { id: CUSTOM_ROLE_ID },
      data: { dataScope: 'team' },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        oldValue: { entity: 'role', dataScope: 'all' },
        newValue: { entity: 'role', dataScope: 'team' },
      }),
      tx,
    );
  });

  it('refuses to change system roles or delete roles in use', async () => {
    const { service } = setup({ roles: [roleRow({ id: 'sys', name: 'Manager' }), roleRow({ users: 3 })] });
    await expect(service.updateCustomRole('sys', { name: 'Team Lead' }, actor)).rejects.toMatchObject({
      response: { code: 'SYSTEM_ROLE_IMMUTABLE' },
    });
    await expect(service.deleteCustomRole(CUSTOM_ROLE_ID, actor)).rejects.toMatchObject({
      response: { code: 'ROLE_IN_USE' },
    });
  });
});
