import { useState } from 'react';
import { Save, RotateCcw, Filter } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Form';
import { PermissionMatrix, type Permissions, type Action } from '@/components/rbac/PermissionMatrix';

// Pre-seeded permissions for "HR Admin" role as an example
const hrAdminPerms: Record<string, Action[]> = {
  'org-profile': ['View', 'Edit'],
  'org-departments': ['View', 'Create', 'Edit'],
  'org-designations': ['View', 'Create', 'Edit'],
  'org-employment-types': ['View', 'Create', 'Edit'],
  'org-chart': ['View'],
  'people-directory': ['View', 'Create', 'Edit'],
  'people-onboarding': ['View', 'Create', 'Edit', 'Approve'],
  'people-offboarding': ['View', 'Create', 'Edit'],
  'people-profiles': ['View', 'Edit'],
  'time-log': ['View', 'Edit'],
  'time-leave': ['View', 'Approve'],
  'time-shifts': ['View', 'Create', 'Edit'],
  'time-overtime': ['View', 'Approve'],
  'payroll-runs': ['View'],
  'payroll-comp': ['View', 'Edit'],
  'payroll-tax': ['View'],
  'payroll-payslips': ['View'],
  'self-requests': ['View', 'Create'],
  'self-payslips': ['View'],
  'self-profile': ['View', 'Edit'],
  'reports-view': ['View'],
  'reports-dashboards': ['View', 'Create'],
  'reports-export': ['View'],
  'settings-rbac': ['View'],
  'settings-audit': ['View'],
  'settings-integrations': [],
  'settings-system': [],
};

function toPermissions(perms: Record<string, Action[]>): Permissions {
  const result: Permissions = {};
  for (const [key, actions] of Object.entries(perms)) {
    result[key] = new Set(actions);
  }
  return result;
}

export function PermissionMatrixPage() {
  const [selectedRole, setSelectedRole] = useState('hr-admin');
  const [permissions, setPermissions] = useState<Permissions>(() => toPermissions(hrAdminPerms));

  const roles = [
    { value: 'super-admin', label: 'Super Admin' },
    { value: 'company-owner', label: 'Company Owner' },
    { value: 'hr-admin', label: 'HR Admin' },
    { value: 'payroll-admin', label: 'Payroll Admin' },
    { value: 'manager', label: 'Manager' },
    { value: 'employee', label: 'Employee' },
    { value: 'accountant', label: 'Accountant' },
    { value: 'recruiter', label: 'Recruiter' },
    { value: 'compliance-officer', label: 'Compliance Officer' },
  ];

  const totalPerms = Object.values(permissions).reduce((s, set) => s + set.size, 0);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Permission Matrix</h1>
          <p className="text-sm text-secondary mt-0.5">Configure granular permissions for each role across all modules.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary">
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
          <Button variant="primary">
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      </div>

      {/* Role selector + summary */}
      <Card>
        <CardBody className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="h-10 w-10 rounded-lg bg-accent-100 dark:bg-accent-950/40 text-accent-700 dark:text-accent-300 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                <path d="M12 2L3 7v6c0 5 3.5 9 9 11 5.5-2 9-6 9-11V7l-9-5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-primary">Editing permissions for</span>
                <Select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-48 h-8 inline-block"
                >
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </Select>
              </div>
              <p className="text-xs text-muted mt-1">
                {totalPerms} permissions granted across {Object.keys(permissions).filter((k) => permissions[k].size > 0).length} modules
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="accent">{totalPerms} active</Badge>
            <Badge tone="neutral">7 categories</Badge>
            <Button variant="ghost" size="sm">
              <Filter className="h-3.5 w-3.5" /> Filter
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Matrix */}
      <PermissionMatrix permissions={permissions} onChange={setPermissions} />

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-4 w-4 rounded border border-strong flex items-center justify-center bg-accent-600 border-accent-600">
            <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          Granted
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-4 w-4 rounded border border-strong" />
          Not granted
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-4 w-4 rounded border border-strong flex items-center justify-center bg-accent-600 border-accent-600">
            <span className="h-0.5 w-2 bg-white rounded-full" />
          </span>
          Partial (some in group)
        </span>
      </div>
    </div>
  );
}
