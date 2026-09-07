import { scopesToPermissionClaims } from './scope-permissions.util';

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
  });

  it('maps read:employees to employees view only', () => {
    expect(scopesToPermissionClaims(['read:employees'])).toEqual([
      { module: 'employees', action: 'view' },
    ]);
  });
});
