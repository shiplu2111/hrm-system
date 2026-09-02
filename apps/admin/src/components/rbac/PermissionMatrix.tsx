import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/Toggle';

export interface PermissionCategory {
  label: string;
  modules: { name: string; key: string }[];
}

const actions = ['View', 'Create', 'Edit', 'Delete', 'Approve', 'Finalize'] as const;
export type Action = (typeof actions)[number];

export const permissionCategories: PermissionCategory[] = [
  {
    label: 'Organization',
    modules: [
      { name: 'Company Profile', key: 'org-profile' },
      { name: 'Departments', key: 'org-departments' },
      { name: 'Designations & Levels', key: 'org-designations' },
      { name: 'Employment Types', key: 'org-employment-types' },
      { name: 'Org Chart', key: 'org-chart' },
    ],
  },
  {
    label: 'People',
    modules: [
      { name: 'Employee Directory', key: 'people-directory' },
      { name: 'Onboarding', key: 'people-onboarding' },
      { name: 'Offboarding', key: 'people-offboarding' },
      { name: 'Employee Profiles', key: 'people-profiles' },
    ],
  },
  {
    label: 'Time & Attendance',
    modules: [
      { name: 'Attendance Log', key: 'time-log' },
      { name: 'Leave Management', key: 'time-leave' },
      { name: 'Shift Scheduling', key: 'time-shifts' },
      { name: 'Overtime', key: 'time-overtime' },
    ],
  },
  {
    label: 'Payroll',
    modules: [
      { name: 'Pay Runs', key: 'payroll-runs' },
      { name: 'Compensation', key: 'payroll-comp' },
      { name: 'Tax Settings', key: 'payroll-tax' },
      { name: 'Payslips', key: 'payroll-payslips' },
    ],
  },
  {
    label: 'Self-Service',
    modules: [
      { name: 'My Requests', key: 'self-requests' },
      { name: 'My Payslips', key: 'self-payslips' },
      { name: 'My Profile', key: 'self-profile' },
    ],
  },
  {
    label: 'Reports & Analytics',
    modules: [
      { name: 'Reports', key: 'reports-view' },
      { name: 'Custom Dashboards', key: 'reports-dashboards' },
      { name: 'Export Data', key: 'reports-export' },
    ],
  },
  {
    label: 'Settings & Security',
    modules: [
      { name: 'Roles & Permissions', key: 'settings-rbac' },
      { name: 'Audit Logs', key: 'settings-audit' },
      { name: 'Integrations', key: 'settings-integrations' },
      { name: 'System Settings', key: 'settings-system' },
    ],
  },
];

export type Permissions = Record<string, Set<Action>>;

export function PermissionMatrix({
  permissions,
  onChange,
}: {
  permissions: Permissions;
  onChange: (p: Permissions) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCategory = (label: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const togglePermission = (moduleKey: string, action: Action) => {
    const current = new Set(permissions[moduleKey] || []);
    if (current.has(action)) current.delete(action);
    else current.add(action);
    onChange({ ...permissions, [moduleKey]: current });
  };

  const toggleCategoryAll = (category: PermissionCategory, checked: boolean) => {
    const next = { ...permissions };
    category.modules.forEach((m) => {
      if (checked) next[m.key] = new Set([...actions]);
      else next[m.key] = new Set();
    });
    onChange(next);
  };

  const isCategoryAllChecked = (category: PermissionCategory) => {
    return category.modules.every((m) => {
      const perms = permissions[m.key] || new Set<Action>();
      return actions.every((a) => perms.has(a));
    });
  };

  const isCategoryIndeterminate = (category: PermissionCategory) => {
    const allChecked = isCategoryAllChecked(category);
    const noneChecked = category.modules.every((m) => (permissions[m.key]?.size || 0) === 0);
    return !allChecked && !noneChecked;
  };

  return (
    <div className="border border-base rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center bg-[rgb(var(--bg-muted))] border-b border-base">
        <div className="w-64 min-w-[200px] px-4 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Module</div>
        <div className="flex-1 grid grid-cols-6">
          {actions.map((a) => (
            <div key={a} className="px-2 py-2.5 text-center text-xs font-semibold text-secondary uppercase tracking-wider">
              {a}
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      {permissionCategories.map((cat) => {
        const isCollapsed = collapsed.has(cat.label);
        return (
          <div key={cat.label} className="border-b border-base last:border-b-0">
            {/* Category header */}
            <div className="flex items-center bg-[rgb(var(--bg-muted))]/50 hover:bg-[rgb(var(--bg-hover))] transition-colors">
              <button
                onClick={() => toggleCategory(cat.label)}
                className="flex items-center gap-2 w-64 min-w-[200px] px-4 py-2.5 text-sm font-semibold text-primary text-left"
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {cat.label}
              </button>
              <div className="flex-1 grid grid-cols-6 px-2">
                <div className="flex justify-center">
                  <Checkbox
                    checked={isCategoryAllChecked(cat)}
                    indeterminate={isCategoryIndeterminate(cat)}
                    onChange={(v) => toggleCategoryAll(cat, v)}
                  />
                </div>
              </div>
            </div>
            {/* Modules */}
            {!isCollapsed && (
              <div className="animate-fade-in">
                {cat.modules.map((mod, i) => {
                  const perms = permissions[mod.key] || new Set<Action>();
                  return (
                    <div
                      key={mod.key}
                      className={`flex items-center hover:bg-[rgb(var(--bg-hover))] transition-colors ${i % 2 === 0 ? '' : 'bg-[rgb(var(--bg-muted))]/30'}`}
                    >
                      <div className="w-64 min-w-[200px] px-4 py-2.5 text-sm text-secondary pl-8">{mod.name}</div>
                      <div className="flex-1 grid grid-cols-6">
                        {actions.map((a) => (
                          <div key={a} className="flex justify-center py-2">
                            <Checkbox
                              checked={perms.has(a)}
                              onChange={() => togglePermission(mod.key, a)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
