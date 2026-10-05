import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../auth/auth.types';
import { OrganizationController } from '../organization/organization.controller';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsService } from './permissions.service';
import { DataScopeService } from './data-scope.service';
import {
  PERMISSION_KEY,
  SELF_SERVICE_KEY,
  type RequiredPermission,
} from './require-permission.decorator';

function run(
  required: RequiredPermission,
  permissions: AuthenticatedUser['permissions'],
  options: { dataScope?: 'all' | 'team' | 'own'; selfService?: boolean } = {},
) {
  const reflector = {
    getAllAndOverride: (key: string) => {
      if (key === 'isPublic') return false;
      if (key === SELF_SERVICE_KEY) return options.selfService ?? false;
      return required;
    },
  } as unknown as Reflector;
  const prisma = {
    unscoped: {
      role: { findUnique: jest.fn().mockResolvedValue({ dataScope: options.dataScope ?? 'all' }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    },
  };
  const guard = new PermissionsGuard(
    reflector,
    new PermissionsService({} as never),
    new DataScopeService(prisma as never),
  );
  const user = { roleId: 'r', authMethod: 'jwt', permissions } as unknown as AuthenticatedUser;
  const context = {
    getHandler: () => ({ name: 'handler' }),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return guard.canActivate(context);
}

describe('PermissionsGuard alternatives', () => {
  const companies: RequiredPermission = {
    module: 'settings',
    action: 'view',
    orAnyOf: [{ module: 'payroll', action: 'view' }],
  };

  it('allows the primary permission', async () => {
    await expect(run(companies, [{ module: 'settings', action: 'view' }])).resolves.toBe(true);
  });

  it('allows a declared alternative', async () => {
    await expect(run(companies, [{ module: 'payroll', action: 'view' }])).resolves.toBe(true);
  });

  it('rejects users with neither', async () => {
    await expect(run(companies, [{ module: 'leave', action: 'view' }])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('never lets a sensitive action pass as an alternative', async () => {
    const required: RequiredPermission = {
      module: 'settings',
      action: 'view',
      orAnyOf: [{ module: 'payroll', action: 'finalize' }],
    };
    await expect(run(required, [{ module: 'payroll', action: 'finalize' }])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('PermissionsGuard own-scoped roles', () => {
  const view: RequiredPermission = { module: 'employee', action: 'view' };
  const perms: AuthenticatedUser['permissions'] = [{ module: 'employee', action: 'view' }];

  it('rejects own-scoped users on endpoints not marked @SelfService', async () => {
    await expect(run(view, perms, { dataScope: 'own' })).rejects.toMatchObject({
      response: { code: 'OWN_SCOPE_FORBIDDEN' },
    });
  });

  it('allows own-scoped users on @SelfService endpoints', async () => {
    await expect(run(view, perms, { dataScope: 'own', selfService: true })).resolves.toBe(true);
  });

  it('still requires the declared permission on @SelfService endpoints', async () => {
    await expect(
      run(view, [{ module: 'leave', action: 'view' }], { dataScope: 'own', selfService: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('leaves company-wide and team roles unaffected', async () => {
    await expect(run(view, perms, { dataScope: 'all' })).resolves.toBe(true);
    await expect(run(view, perms, { dataScope: 'team' })).resolves.toBe(true);
  });
});

describe('Org lookups for default roles without settings:view', () => {
  const roles: Record<string, AuthenticatedUser['permissions']> = {
    Manager: [
      { module: 'employee', action: 'view' },
      { module: 'leave', action: 'view' },
      { module: 'attendance', action: 'view' },
      { module: 'performance', action: 'view' },
    ],
    Recruiter: [
      { module: 'recruitment', action: 'view' },
      { module: 'employee', action: 'view' },
    ],
    Accountant: [
      { module: 'employee', action: 'view' },
      { module: 'payroll', action: 'view' },
    ],
    'Payroll Admin': [
      { module: 'employee', action: 'view' },
      { module: 'payroll', action: 'view' },
    ],
  };
  const lookups = [
    'listCompanies',
    'listDepartments',
    'getDepartmentTree',
    'listDesignations',
    'listEmploymentTypes',
    'listCostCentres',
  ] as const;

  for (const [role, permissions] of Object.entries(roles)) {
    it.each(lookups)(`${role} can call %s`, async (handler) => {
      const required = Reflect.getMetadata(
        PERMISSION_KEY,
        OrganizationController.prototype[handler],
      ) as RequiredPermission;
      await expect(run(required, permissions)).resolves.toBe(true);
    });
  }

  it('keeps org mutations on settings permissions', async () => {
    const required = Reflect.getMetadata(
      PERMISSION_KEY,
      OrganizationController.prototype.createDepartment,
    ) as RequiredPermission;
    await expect(run(required, roles.Manager)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
