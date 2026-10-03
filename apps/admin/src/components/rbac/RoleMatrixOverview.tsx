import { Download } from 'lucide-react';
import type { PermissionModuleDefinition, TenantRoleRecord } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { downloadCsvFile } from '@/lib/csv';
import { rolesCopy as copy } from '@/lib/roles-copy';
import { groupModules, moduleActions, moduleLabel, roleScope, SENSITIVE_ACTIONS, toGrantSet } from '@/lib/role-matrix';

interface Props {
  roles: TenantRoleRecord[];
  definitions: PermissionModuleDefinition[];
  onSelect: (role: TenantRoleRecord) => void;
}

export function RoleMatrixOverview({ roles, definitions, onSelect }: Props) {
  const modules = groupModules(definitions).flatMap((group) => group.modules);
  const rows = roles.map((role) => ({ role, grants: toGrantSet(role.permissions), scope: roleScope(role) }));

  const cellText = (grants: Set<string>, module: string, scope: ReturnType<typeof roleScope>) => {
    const actions = moduleActions(grants, module);
    if (actions.length === 0) return copy.matrix.none;
    const list = actions.join(', ');
    return scope ? `${list} (${copy.matrix.scopeSuffix[scope]})` : list;
  };

  const exportCsv = () =>
    downloadCsvFile(
      'role-permission-matrix.csv',
      [copy.matrix.role, ...modules.map((definition) => moduleLabel(definition.key))],
      rows.map(({ role, grants, scope }) => [role.name, ...modules.map((definition) => cellText(grants, definition.key, scope))]),
    );

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-base">
        <p className="text-sm text-secondary max-w-3xl">{copy.matrix.description}</p>
        <Button variant="secondary" size="sm" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" /> {copy.matrix.exportCsv}
        </Button>
      </div>
      <div className="overflow-auto max-h-[70vh]">
        <table className="text-sm border-separate border-spacing-0">
          <thead className="sticky top-0 z-20">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-30 bg-[rgb(var(--bg-muted))] text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide border-b border-r border-base min-w-[200px]"
              >
                {copy.matrix.role}
              </th>
              {modules.map((definition) => (
                <th
                  key={definition.key}
                  scope="col"
                  className="bg-[rgb(var(--bg-muted))] text-left px-4 py-3 text-xs font-semibold text-secondary uppercase tracking-wide border-b border-base whitespace-nowrap"
                >
                  {moduleLabel(definition.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ role, grants, scope }) => (
              <tr key={role.id} className="group">
                <th
                  scope="row"
                  className="sticky left-0 z-10 surface group-hover:bg-[rgb(var(--bg-hover))] text-left font-normal px-4 py-2.5 border-b border-r border-base"
                >
                  <button
                    type="button"
                    onClick={() => onSelect(role)}
                    className="text-sm font-medium text-primary hover:text-accent-700 dark:hover:text-accent-300 hover:underline text-left"
                  >
                    {role.name}
                  </button>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <StatusPill tone={role.isSystem ? 'neutral' : 'accent'}>
                      {role.isSystem ? copy.badges.system : copy.badges.custom}
                    </StatusPill>
                    {scope ? <span className="text-xs text-muted">{copy.scope[scope]}</span> : null}
                  </div>
                </th>
                {modules.map((definition) => {
                  const actions = moduleActions(grants, definition.key);
                  return (
                    <td
                      key={definition.key}
                      className="px-4 py-2.5 border-b border-base whitespace-nowrap group-hover:bg-[rgb(var(--bg-hover))] align-top"
                    >
                      {actions.length === 0 ? (
                        <span className="text-muted">{copy.matrix.none}</span>
                      ) : (
                        <span className="text-primary">
                          {actions.map((action, index) => (
                            <span key={action}>
                              {index > 0 ? ', ' : ''}
                              <span className={SENSITIVE_ACTIONS.has(action) ? 'font-semibold' : ''}>{action}</span>
                            </span>
                          ))}
                          {scope ? <span className="text-muted"> ({copy.matrix.scopeSuffix[scope]})</span> : null}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
