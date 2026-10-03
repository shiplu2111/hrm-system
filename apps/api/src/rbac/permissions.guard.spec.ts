import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../auth/auth.types';
import { OrganizationController } from '../organization/organization.controller';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsService } from './permissions.service';
import { PERMISSION_KEY, type RequiredPermission } from './require-permission.decorator';

function run(required: RequiredPermission, permissions: AuthenticatedUser['permissions']) {
  const reflector = {
    getAllAndOverride: (key: string) => (key === 'isPublic' ? false : required),
  } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector, new PermissionsService({} as never));
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
