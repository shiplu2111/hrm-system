import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsService } from './permissions.service';
import type { RequiredPermission } from './require-permission.decorator';

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
