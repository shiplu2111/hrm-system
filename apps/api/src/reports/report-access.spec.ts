import type { AuthenticatedUser, PermissionClaim } from '../auth/auth.types';
import { canRunReportCategory } from './report-access';
import { escapeCsv, serializeReportCsv } from './report-export.util';

function user(permissions: Array<[string, string[]]>, employeeId: string | null = 'emp-1'): AuthenticatedUser {
  const claims: PermissionClaim[] = permissions.flatMap(([module, actions]) =>
    actions.map((action) => ({ module, action })),
  );
  return {
    id: 'user-1',
    tenantId: 'tenant-1',
    roleId: 'role-1',
    roleName: 'Custom',
    employeeId,
    email: 'someone@example.com',
    permissions: claims,
  };
}

describe('canRunReportCategory', () => {
  const employeeRole = user([
    ['employee', ['view', 'edit']],
    ['payroll', ['view']],
    ['attendance', ['view', 'create']],
  ]);

  it('keeps self-service employees out of every company report', () => {
    expect(canRunReportCategory(employeeRole, 'payroll')).toBe(false);
    expect(canRunReportCategory(employeeRole, 'attendance')).toBe(false);
    expect(canRunReportCategory(employeeRole, 'hr')).toBe(false);
  });

  it('opens each category to roles that manage that module', () => {
    const payrollAdmin = user([
      ['employee', ['view']],
      ['payroll', ['view', 'create', 'edit', 'approve', 'finalize']],
      ['attendance', ['view']],
    ]);
    expect(canRunReportCategory(payrollAdmin, 'payroll')).toBe(true);
    expect(canRunReportCategory(payrollAdmin, 'attendance')).toBe(false);
    expect(canRunReportCategory(payrollAdmin, 'hr')).toBe(false);

    const hrAdmin = user([
      ['employee', ['view', 'create', 'edit']],
      ['attendance', ['view', 'edit', 'approve']],
    ]);
    expect(canRunReportCategory(hrAdmin, 'hr')).toBe(true);
    expect(canRunReportCategory(hrAdmin, 'attendance')).toBe(true);
    expect(canRunReportCategory(hrAdmin, 'payroll')).toBe(false);
  });

  it('requires view even when management actions are held', () => {
    expect(canRunReportCategory(user([['payroll', ['edit']]]), 'payroll')).toBe(false);
  });

  it('lets accounts with no employee record run reports with view alone', () => {
    const integration = user([['payroll', ['view']]], null);
    expect(canRunReportCategory(integration, 'payroll')).toBe(true);
    expect(canRunReportCategory(integration, 'hr')).toBe(false);
  });
});

describe('report CSV export', () => {
  it('neutralises formula-like text but leaves negative amounts alone', () => {
    expect(escapeCsv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(escapeCsv('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCsv('-120.50')).toBe('-120.50');
    expect(escapeCsv(-3)).toBe('-3');
    expect(escapeCsv(null)).toBe('');
  });

  it('starts with a BOM and uses CRLF rows', () => {
    const csv = serializeReportCsv(
      [
        { key: 'name', label: 'Name' },
        { key: 'net', label: 'Net' },
      ],
      [{ name: 'Zoë, A', net: '10.00' }],
    );
    expect(csv).toBe('\uFEFFName,Net\r\n"Zoë, A",10.00');
  });
});
