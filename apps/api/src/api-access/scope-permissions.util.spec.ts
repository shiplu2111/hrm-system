import { ForbiddenException } from '@nestjs/common';
import { API_ACCESS_SCOPE_PERMISSIONS } from '@hrm/shared-types';
import { MODULE_ACTIONS, type PermissionModule } from '../rbac/rbac.constants';
import {
  assertScopesWithinPermissions,
  assertValidScopes,
  scopesBeyondPermissions,
  scopesToPermissionClaims,
} from './scope-permissions.util';

describe('scopesToPermissionClaims', () => {
  it('maps read and write payroll scopes to payroll permissions', () => {
    const claims = scopesToPermissionClaims(['read:payroll', 'write:payroll']);
    expect(claims).toEqual(
      expect.arrayContaining([
        { module: 'payroll', action: 'view' },
        { module: 'payroll', action: 'create' },
        { module: 'payroll', action: 'edit' },
      ]),
    );
    expect(claims).toHaveLength(3);
  });

  it('maps read:employees to the employee module that endpoints check', () => {
    expect(scopesToPermissionClaims(['read:employees'])).toEqual([
      { module: 'employee', action: 'view' },
    ]);
  });

  it('ignores unknown scopes such as the retired read:reports', () => {
    expect(scopesToPermissionClaims(['read:reports'])).toEqual([]);
  });

  it('only grants module actions the RBAC system actually checks', () => {
    for (const permissions of Object.values(API_ACCESS_SCOPE_PERMISSIONS)) {
      for (const { module, action } of permissions) {
        expect(MODULE_ACTIONS[module as PermissionModule]).toContain(action);
      }
    }
  });
});

describe('assertValidScopes', () => {
  it('rejects unknown scopes and removes duplicates', () => {
    expect(() => assertValidScopes(['read:reports'])).toThrow('Invalid scopes');
    expect(assertValidScopes(['read:leave', 'read:leave'])).toEqual(['read:leave']);
  });
});

describe('scope bounding by the creator’s permissions', () => {
  const payrollViewer = [
    { module: 'payroll', action: 'view' },
    { module: 'settings', action: 'edit' },
  ];

  it('allows scopes the creator holds', () => {
    expect(scopesBeyondPermissions(['read:payroll'], payrollViewer)).toEqual([]);
    expect(() => assertScopesWithinPermissions(['read:payroll'], payrollViewer)).not.toThrow();
  });

  it('refuses write access the creator only has read access to', () => {
    expect(scopesBeyondPermissions(['read:payroll', 'write:payroll'], payrollViewer)).toEqual([
      'write:payroll',
    ]);
    expect(() => assertScopesWithinPermissions(['write:payroll'], payrollViewer)).toThrow(
      ForbiddenException,
    );
  });

  it('refuses modules the creator has no access to', () => {
    expect(scopesBeyondPermissions(['read:employees'], payrollViewer)).toEqual(['read:employees']);
  });
});
